import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import type { JobContext } from '../jobs/queue'
import { cleanClaudeEnv } from './env'
import { interpretEvent, LineSplitter, type ClaudeEvent, type ClaudeResult } from './stream'

/** Claude-Abo-Limit erreicht – der Aufruf kann nach `resetAt` mit `sessionId` fortgesetzt werden. */
export class ClaudeLimitError extends Error {
  constructor(
    readonly resetAt: Date | null,
    readonly sessionId: string | null,
    detail: string
  ) {
    super(`Claude-Limit erreicht (${detail})`)
  }
}

export interface ClaudeRunOptions {
  cli: string
  /** Argumente vor den Claude-Argumenten (z. B. Skriptpfad, wenn `cli` ein Interpreter ist; für Tests) */
  cliPrefix?: string[]
  prompt: string
  /** Eigener, leerer Arbeitsordner (keine fremden Hooks/.mcp.json) */
  workDir: string
  /** Neue Session mit dieser ID starten … */
  sessionId?: string
  /** … oder eine bestehende fortsetzen */
  resume?: string
  model?: 'haiku' | 'sonnet' | 'opus' | string
  maxTurns?: number
  mcpConfig?: string
  /** Erlaubte Werkzeuge ohne Rückfrage, z. B. ['Read', 'mcp__moinstudio__*'] */
  allowedTools?: string[]
  /** Verfügbare Werkzeuge begrenzen (spart Kontext); leer = keine eingebauten Werkzeuge */
  tools?: string[]
  appendSystemPrompt?: string
  jsonSchema?: object
  addDirs?: string[]
  onEvent?: (e: ClaudeEvent) => void
  /** Job-Kontext: Prozess wird angemeldet (Pause), Abbruch beendet Claude sauber */
  ctx?: JobContext<unknown>
  signal?: AbortSignal
  /** Höchstdauer in ms (Standard 30 min): ein hängender Aufruf blockierte sonst den ganzen Auftrag (Test 02.10.:
   *  Bildprüfung hing über sechs Stunden) */
  zeitlimitMs?: number
}

export const STANDARD_ZEITLIMIT_MS = 30 * 60 * 1000

export function buildArgs(o: ClaudeRunOptions): string[] {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'dontAsk', '--strict-mcp-config']
  if (o.resume) args.push('--resume', o.resume)
  else args.push('--session-id', o.sessionId ?? randomUUID())
  if (o.model) args.push('--model', o.model)
  if (o.maxTurns) args.push('--max-turns', String(o.maxTurns))
  if (o.mcpConfig) args.push('--mcp-config', o.mcpConfig)
  if (o.tools) args.push('--tools', o.tools.join(','))
  if (o.allowedTools?.length) args.push('--allowedTools', o.allowedTools.join(','))
  if (o.appendSystemPrompt) args.push('--append-system-prompt', o.appendSystemPrompt)
  if (o.jsonSchema) args.push('--json-schema', JSON.stringify(o.jsonSchema))
  for (const d of o.addDirs ?? []) args.push('--add-dir', d)
  // Niemals --bare: dann liest Claude Code den Abo-Login nicht (docs/claude-integration.md, Regel 5).
  return args
}

/** Quotet ein Argument für cmd.exe (für per npm installierte `claude.cmd`). */
export function quoteForCmd(arg: string): string {
  if (arg !== '' && !/[\s"&|<>^%()!]/.test(arg)) return arg
  // Backslashes vor Anführungszeichen und am Ende verdoppeln, Anführungszeichen escapen,
  // % aus der Variablen-Erweiterung von cmd.exe herausnehmen.
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1').replace(/%/g, '"%"')}"`
}

/** `.exe` direkt starten; `.cmd`/`.bat` brauchen cmd.exe (Node startet sie sonst nicht). */
export function commandLine(cli: string, args: string[]): [string, string[], boolean] {
  if (!/\.(cmd|bat)$/i.test(cli)) return [cli, args, false]
  const line = [cli, ...args].map(quoteForCmd).join(' ')
  return [process.env['ComSpec'] ?? 'cmd.exe', ['/d', '/s', '/c', `"${line}"`], true]
}

/**
 * Führt einen headless-Aufruf mit dem Abo-Login aus. Der Prompt geht über stdin (kein
 * Windows-Quoting-Problem). Wirft `ClaudeLimitError`, wenn das Abo-Limit erreicht ist.
 */
export async function runClaude(o: ClaudeRunOptions): Promise<ClaudeResult> {
  await mkdir(o.workDir, { recursive: true })
  const args = buildArgs(o)
  const sessionId = o.resume ?? args[args.indexOf('--session-id') + 1] ?? null
  const signal = o.ctx?.signal ?? o.signal

  return new Promise<ClaudeResult>((resolve, reject) => {
    const [command, commandArgs, verbatim] = commandLine(o.cli, [...(o.cliPrefix ?? []), ...args])
    const child = spawn(command, commandArgs, {
      cwd: o.workDir,
      env: cleanClaudeEnv(),
      windowsHide: true,
      windowsVerbatimArguments: verbatim,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    o.ctx?.track(child)
    const splitter = new LineSplitter()
    let result: ClaudeResult | null = null
    let limit: { resetAt: Date | null; message: string } | null = null
    let stderr = ''

    const handle = (line: string): void => {
      let json: Record<string, unknown>
      try {
        json = JSON.parse(line) as Record<string, unknown>
      } catch {
        return
      }
      const event = interpretEvent(json)
      if (event.kind === 'limit') limit = { resetAt: event.resetAt ?? limit?.resetAt ?? null, message: event.message }
      if (event.kind === 'result') result = event.result
      o.onEvent?.(event)
    }
    child.stdout.on('data', (d: Buffer) => splitter.push(d.toString('utf8')).forEach(handle))
    child.stderr.on('data', (d: Buffer) => {
      stderr = (stderr + d.toString('utf8')).slice(-8000)
    })
    const onAbort = (): void => {
      child.stdin.end()
      child.kill()
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    let abgelaufen = false
    const wache = setTimeout(() => {
      abgelaufen = true
      child.stdin.end()
      child.kill()
    }, o.zeitlimitMs ?? STANDARD_ZEITLIMIT_MS)
    child.once('error', (err) => {
      clearTimeout(wache)
      reject(err)
    })
    child.once('close', (code) => {
      clearTimeout(wache)
      signal?.removeEventListener('abort', onAbort)
      if (abgelaufen) return reject(new Error(`Claude hat nicht rechtzeitig geantwortet (nach ${Math.round((o.zeitlimitMs ?? STANDARD_ZEITLIMIT_MS) / 60000)} min abgebrochen)`))
      splitter.flush().forEach(handle)
      const lim = limit as { resetAt: Date | null; message: string } | null
      const res = result as ClaudeResult | null
      if (lim && !res?.ok) return reject(new ClaudeLimitError(lim.resetAt, res?.sessionId ?? sessionId, lim.message))
      if (res) return resolve(res)
      reject(new Error(`Claude Code endete ohne Ergebnis (Exit ${code}). ${stderr.trim().split(/\r?\n/).slice(-2).join(' | ')}`))
    })
    child.stdin.end(o.prompt, 'utf8')
  })
}

/**
 * Für Jobs: Aufruf mit automatischer Fortsetzung. Bei Limit wird die Session gemerkt und der Job
 * wartet bis zum Reset (Checkpoint `claudeSession`), danach geht es mit `--resume` weiter.
 */
export async function runClaudeInJob(
  o: Omit<ClaudeRunOptions, 'ctx' | 'resume' | 'sessionId'>,
  ctx: JobContext<{ claudeSession?: string; claudePrompted?: boolean }>
): Promise<ClaudeResult> {
  const cp = ctx.checkpoint ?? {}
  const resume = cp.claudePrompted ? cp.claudeSession : undefined
  const sessionId = resume ? undefined : randomUUID()
  await ctx.save({ ...cp, claudeSession: resume ?? sessionId, claudePrompted: true })
  const fresh = (): Promise<ClaudeResult> => runClaude({ ...o, sessionId: randomUUID(), ctx: ctx as JobContext<unknown> })
  try {
    if (!resume) return await runClaude({ ...o, sessionId, ctx: ctx as JobContext<unknown> })
    try {
      return await runClaude({
        ...o,
        prompt: `Du wurdest durch ein Nutzungslimit unterbrochen. Falls du Teile schon erledigt hast, mach dort weiter; sonst beginne mit dieser Aufgabe:\n\n${o.prompt}`,
        resume,
        ctx: ctx as JobContext<unknown>
      })
    } catch (err) {
      // Kam das Limit vor der ersten Antwort, gibt es keine Session zum Fortsetzen → neu beginnen.
      if (err instanceof ClaudeLimitError) throw err
      return await fresh()
    }
  } catch (err) {
    if (err instanceof ClaudeLimitError) {
      const resetAt = err.resetAt ?? new Date(Date.now() + 60 * 60 * 1000)
      // eine Minute Puffer nach dem Reset
      ctx.waitUntil(new Date(resetAt.getTime() + 60_000))
    }
    throw err
  }
}
