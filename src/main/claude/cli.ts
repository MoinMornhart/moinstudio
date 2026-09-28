import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { runHidden } from '../tools/smoke'
import { blockedEnvPresent, cleanClaudeEnv } from './env'

async function isFile(path: string): Promise<boolean> {
  return (await stat(path).catch(() => null))?.isFile() === true
}

function versionKey(name: string): number[] {
  return (/(\d+)\.(\d+)\.(\d+)/.exec(name)?.slice(1) ?? ['0', '0', '0']).map(Number)
}

function compareVersions(a: string, b: string): number {
  const va = versionKey(a)
  const vb = versionKey(b)
  for (let i = 0; i < 3; i++) if (va[i] !== vb[i]) return va[i]! - vb[i]!
  return 0
}

/** Sucht claude.exe in den Erweiterungsordnern von VS Code und kompatiblen Editoren (neueste Version zuerst). */
async function editorExtensionCandidates(home: string): Promise<string[]> {
  const found: string[] = []
  for (const editor of ['.vscode', '.vscode-insiders', '.cursor', '.windsurf']) {
    const dir = join(home, editor, 'extensions')
    let names: string[]
    try {
      names = await readdir(dir)
    } catch {
      continue
    }
    const exts = names.filter((n) => n.startsWith('anthropic.claude-code-')).sort(compareVersions).reverse()
    for (const ext of exts) {
      for (const rel of ['resources\\native-binary\\claude.exe', 'resources\\claude.exe', 'native-binary\\claude.exe']) {
        found.push(join(dir, ext, rel))
      }
    }
  }
  return found
}

/**
 * Findet die offizielle Claude-Code-CLI (unverändertes Binary). Reihenfolge:
 * eingestellter Pfad → PATH → ~/.local/bin (offizieller Installer) → npm global → Editor-Erweiterungen.
 */
export async function findClaudeCli(configured?: string | null, env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  if (configured && (await isFile(configured))) return configured
  const home = env['USERPROFILE'] ?? homedir()
  const candidates: string[] = []
  const where = await runHidden('where.exe', ['claude'], 10_000)
  if (where.code === 0) candidates.push(...where.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))
  candidates.push(join(home, '.local', 'bin', 'claude.exe'))
  if (env['APPDATA']) candidates.push(join(env['APPDATA'], 'npm', 'claude.cmd'))
  candidates.push(...(await editorExtensionCandidates(home)))
  for (const c of candidates) {
    if (/\.(exe|cmd)$/i.test(c) && (await isFile(c))) return c
  }
  // Letzter Versuch: rekursiv in der neuesten VS-Code-Erweiterung
  for (const editorExt of await editorExtensionCandidates(home)) {
    const extRoot = editorExt.split('\\resources\\')[0]!.split('\\native-binary\\')[0]!
    const hit = await findFile(extRoot, 'claude.exe', 4)
    if (hit) return hit
  }
  return null
}

async function findFile(dir: string, name: string, depth: number): Promise<string | null> {
  if (depth < 0) return null
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }
  for (const e of entries) if (e.isFile() && e.name.toLowerCase() === name) return join(dir, e.name)
  for (const e of entries) {
    if (e.isDirectory() && e.name !== 'node_modules') {
      const hit = await findFile(join(dir, e.name), name, depth - 1)
      if (hit) return hit
    }
  }
  return null
}

export interface ClaudeStatus {
  cli: string | null
  version: string | null
  loggedIn: boolean
  /** z. B. „claude.ai“ (Abo) – alles andere wird abgelehnt */
  authMethod: string | null
  subscription: string | null
  /** true = Abo-Login, darf benutzt werden */
  usable: boolean
  warnings: string[]
  problem: string | null
}

/**
 * Prüft CLI und Login (docs/claude-integration.md, Regel 3). Die Anmeldedaten selbst werden nie
 * gelesen – nur die Ausgabe von `claude auth status`.
 */
export async function claudeStatus(configured?: string | null): Promise<ClaudeStatus> {
  const warnings: string[] = []
  const blocked = blockedEnvPresent()
  if (blocked.length) {
    warnings.push(`Im System gesetzt und für MoinStudio ignoriert: ${blocked.join(', ')} (MoinStudio nutzt nur dein Abo).`)
  }
  if (await hasApiKeyHelper()) warnings.push('In ~/.claude/settings.json ist ein „apiKeyHelper“ eingetragen – der könnte statt des Abos einen API-Key liefern.')

  const base: ClaudeStatus = { cli: null, version: null, loggedIn: false, authMethod: null, subscription: null, usable: false, warnings, problem: null }
  const cli = await findClaudeCli(configured)
  if (!cli) return { ...base, problem: 'Claude Code wurde nicht gefunden. Bitte Claude Code installieren (claude.com/claude-code).' }

  const env = cleanClaudeEnv()
  const version = await runHidden(cli, ['--version'], 30_000, env)
  const status = await runHidden(cli, ['auth', 'status'], 30_000, env)
  const result: ClaudeStatus = { ...base, cli, version: /(\d+\.\d+\.\d+)/.exec(version.stdout)?.[1] ?? null }
  let data: Record<string, unknown>
  try {
    data = JSON.parse(status.stdout) as Record<string, unknown>
  } catch {
    data = {}
  }
  result.loggedIn = status.code === 0 && data['loggedIn'] === true
  result.authMethod = typeof data['authMethod'] === 'string' ? data['authMethod'] : null
  result.subscription = typeof data['subscriptionType'] === 'string' ? data['subscriptionType'] : null
  result.usable = result.loggedIn && result.authMethod === 'claude.ai' && (data['apiProvider'] === undefined || data['apiProvider'] === 'firstParty')
  if (!result.loggedIn) result.problem = 'Claude Code ist nicht angemeldet. Bitte einmal im Terminal „claude auth login“ ausführen und mit deinem Claude-Konto anmelden.'
  else if (!result.usable) result.problem = `Claude Code ist nicht mit einem Claude-Abo angemeldet (Methode: ${result.authMethod ?? 'unbekannt'}). MoinStudio nutzt ausschließlich das Abo.`
  return result
}

async function hasApiKeyHelper(): Promise<boolean> {
  try {
    const text = await readFile(join(homedir(), '.claude', 'settings.json'), 'utf8')
    return /"apiKeyHelper"\s*:/.test(text)
  } catch {
    return false
  }
}
