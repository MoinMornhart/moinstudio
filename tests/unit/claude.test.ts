import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { blockedEnvPresent, cleanClaudeEnv } from '../../src/main/claude/env'
import { ClaudeLimitError, buildArgs, commandLine, quoteForCmd, runClaude, runClaudeInJob } from '../../src/main/claude/run'
import { epochToDate, interpretEvent, LineSplitter, parseResetText } from '../../src/main/claude/stream'
import { JobQueue, type JobContext } from '../../src/main/jobs/queue'

const FAKE = resolve(__dirname, '../fixtures/fake-claude.mjs')

describe('Umgebung ohne API-Key', () => {
  it('entfernt API-Key und Anbieter-Variablen (auch in anderer Schreibweise)', () => {
    const env = cleanClaudeEnv({ PATH: 'x', ANTHROPIC_API_KEY: 'sk', anthropic_base_url: 'u', CLAUDE_CODE_USE_BEDROCK: '1', ELECTRON_RUN_AS_NODE: '1' })
    expect(env).toEqual({ PATH: 'x' })
    expect(blockedEnvPresent({ ANTHROPIC_API_KEY: 'sk', PATH: 'x' })).toEqual(['ANTHROPIC_API_KEY'])
  })
})

describe('Reset-Zeiten', () => {
  // Samstag, 26.09.2026, 17:00 Ortszeit
  const now = new Date(2026, 8, 26, 17, 0, 0)
  it('versteht 12- und 24-Stunden-Angaben und nimmt bei vergangener Uhrzeit den nächsten Tag', () => {
    expect(parseResetText('3:45pm', now)).toEqual(new Date(2026, 8, 27, 15, 45))
    expect(parseResetText('11pm', now)).toEqual(new Date(2026, 8, 26, 23, 0))
    expect(parseResetText('18:30', now)).toEqual(new Date(2026, 8, 26, 18, 30))
    expect(parseResetText('12:00am', now)).toEqual(new Date(2026, 8, 27, 0, 0))
  })
  it('versteht Wochentage', () => {
    expect(parseResetText('Mon 12:00am', now)).toEqual(new Date(2026, 8, 28, 0, 0))
  })
  it('liest Epochen in Sekunden oder Millisekunden', () => {
    expect(epochToDate(1790000000)?.getTime()).toBe(1790000000000)
    expect(epochToDate(1790000000000)?.getTime()).toBe(1790000000000)
    expect(epochToDate('kaputt')).toBeNull()
  })
})

describe('Stream-Ereignisse', () => {
  it('erkennt Limit, Vorwarnung, Werkzeuge, Text und Ergebnis', () => {
    expect(interpretEvent({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', resetsAt: 1790000000 } })).toMatchObject({ kind: 'limit' })
    expect(interpretEvent({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed_warning', utilization: 0.85 } })).toEqual({ kind: 'limit-warning', utilization: 0.85 })
    expect(interpretEvent({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read' }] } })).toEqual({ kind: 'tool', name: 'Read' })
    expect(interpretEvent({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hi' }] } })).toEqual({ kind: 'text', text: 'Hi' })
    expect(interpretEvent({ type: 'assistant', error: 'rate_limit', message: { content: [] } })).toMatchObject({ kind: 'limit' })
    const limitText = interpretEvent({ type: 'assistant', message: { content: [{ type: 'text', text: "You've hit your weekly limit · resets Mon 12:00am" }] } })
    expect(limitText.kind).toBe('limit')
    const ok = interpretEvent({ type: 'result', subtype: 'success', is_error: false, result: 'OK', session_id: 's1', usage: { input_tokens: 3 } })
    expect(ok).toMatchObject({ kind: 'result', result: { ok: true, text: 'OK', sessionId: 's1' } })
    expect(interpretEvent({ type: 'result', subtype: 'error_during_execution', is_error: true, result: "You've hit your Opus limit · resets 3pm" }).kind).toBe('limit')
    expect(interpretEvent({ type: 'neuer_typ_2027' }).kind).toBe('other')
  })
  it('setzt zerstückelte Zeilen korrekt zusammen', () => {
    const s = new LineSplitter()
    expect(s.push('{"a":1}\n{"b"')).toEqual(['{"a":1}'])
    expect(s.push(':2}\r\n')).toEqual(['{"b":2}'])
    expect(s.flush()).toEqual([])
  })
})

describe('Aufruf-Argumente', () => {
  it('nutzt stream-json, strikte MCP-Konfiguration, keine Rückfragen und nie --bare', () => {
    const args = buildArgs({ cli: 'claude', prompt: 'x', workDir: '.', model: 'haiku', maxTurns: 3, allowedTools: ['Read', 'mcp__moinstudio__*'], tools: ['Read'] })
    expect(args).toEqual(expect.arrayContaining(['-p', '--output-format', 'stream-json', '--verbose', '--strict-mcp-config', '--permission-mode', 'dontAsk', '--session-id', '--model', 'haiku', '--max-turns', '3']))
    expect(args).not.toContain('--bare')
    expect(args[args.indexOf('--allowedTools') + 1]).toBe('Read,mcp__moinstudio__*')
    const resumed = buildArgs({ cli: 'claude', prompt: 'x', workDir: '.', resume: 'abc' })
    expect(resumed).toContain('--resume')
    expect(resumed).not.toContain('--session-id')
  })
  it('quotet für cmd.exe und startet .cmd über die Shell', () => {
    expect(quoteForCmd('haiku')).toBe('haiku')
    expect(quoteForCmd('a b')).toBe('"a b"')
    expect(quoteForCmd('{"type":"object"}')).toBe('"{\\"type\\":\\"object\\"}"')
    expect(quoteForCmd('100%')).toBe('"100"%""')
    const [cmd, args, verbatim] = commandLine('C:\\npm\\claude.cmd', ['-p', 'a b'])
    expect(cmd.toLowerCase()).toContain('cmd')
    expect(args.slice(0, 3)).toEqual(['/d', '/s', '/c'])
    expect(verbatim).toBe(true)
    expect(commandLine('C:\\x\\claude.exe', ['-p'])).toEqual(['C:\\x\\claude.exe', ['-p'], false])
  })
})

describe('runClaude mit CLI-Attrappe', () => {
  let work: string
  afterEach(async () => {
    delete process.env['ANTHROPIC_API_KEY']
    if (work) await rm(work, { recursive: true, force: true })
  })

  it('schickt den Prompt über stdin, entfernt den API-Key und liefert das Ergebnis', async () => {
    work = await mkdtemp(join(tmpdir(), 'moin-claude-'))
    process.env['ANTHROPIC_API_KEY'] = 'sk-test-nicht-verwenden'
    const events: string[] = []
    const res = await runClaude({ cli: process.execPath, cliPrefix: [FAKE], prompt: 'Sag Hallo „mit Umlauten äöü“', workDir: work, onEvent: (e) => events.push(e.kind) })
    expect(res.ok).toBe(true)
    expect(res.text).toBe('prompt=Sag Hallo „mit Umlauten äöü“ key=nein bare=false')
    expect(res.sessionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.usage.cacheCreation).toBe(30000)
    expect(events).toEqual(expect.arrayContaining(['tool', 'text', 'result']))
  })

  it('meldet ein Abo-Limit als ClaudeLimitError mit Reset-Zeit und Session', async () => {
    work = await mkdtemp(join(tmpdir(), 'moin-claude-'))
    const err = await runClaude({ cli: process.execPath, cliPrefix: [FAKE], prompt: 'LIMIT bitte', workDir: work, sessionId: '11111111-2222-3333-4444-555555555555' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ClaudeLimitError)
    expect((err as ClaudeLimitError).sessionId).toBe('11111111-2222-3333-4444-555555555555')
    expect((err as ClaudeLimitError).resetAt).not.toBeNull()
  })

  it('lässt einen Job bei Limit bis zum Reset warten und merkt sich die Session', async () => {
    work = await mkdtemp(join(tmpdir(), 'moin-claude-'))
    const q = new JobQueue(join(work, 'jobs'))
    q.register('claude', (p: { prompt: string }, ctx: JobContext<{ claudeSession?: string }>) =>
      runClaudeInJob({ cli: process.execPath, cliPrefix: [FAKE], prompt: p.prompt, workDir: work }, ctx)
    )
    await q.start()
    const id = await q.enqueue('claude', 'Test', { prompt: 'LIMIT' })
    // großzügig warten: unter Last (paralleler Blender-Render) startet node deutlich langsamer
    for (let i = 0; i < 1200 && q.get(id)?.state !== 'waiting-limit'; i++) await new Promise((r) => setTimeout(r, 25))
    const info = q.get(id)
    expect(info?.state).toBe('waiting-limit')
    expect(new Date(info!.resumeAt!).getTime()).toBeGreaterThan(Date.now())
    await q.cancel(id)
    q.dispose()
  }, 45_000)
})
