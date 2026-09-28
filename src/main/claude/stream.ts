/**
 * Auswertung der NDJSON-Ausgabe von `claude -p --output-format stream-json --verbose`.
 * Unbekannte Ereignistypen werden ignoriert (die Doku kündigt neue Werte an).
 */

export type ClaudeEvent =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string }
  | { kind: 'limit'; resetAt: Date | null; message: string }
  | { kind: 'limit-warning'; utilization: number | null }
  | { kind: 'retry'; error: string; delayMs: number | null }
  | { kind: 'result'; result: ClaudeResult }
  | { kind: 'other' }

export interface ClaudeResult {
  ok: boolean
  text: string
  sessionId: string | null
  structured: unknown
  subtype: string
  terminalReason: string | null
  errors: string[]
  usage: { input: number; output: number; cacheCreation: number; cacheRead: number }
  model: string | null
}

const LIMIT_TEXT = /You've hit your (session|weekly|Opus|Sonnet|usage) limit(?:\s*·\s*resets\s+([^\n"]+))?/i

/** `resetsAt` aus dem rate_limit_event: Sekunden oder Millisekunden seit 1970 (nicht dokumentiert). */
export function epochToDate(value: unknown): Date | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(n < 1e12 ? n * 1000 : n)
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/**
 * Liest die Reset-Zeit aus Texten wie „resets 3:45pm“, „resets Mon 12:00am“ oder „resets 15:45“
 * (lokale Zeit). Liegt die Uhrzeit heute schon zurück, ist der nächste Tag gemeint.
 */
export function parseResetText(text: string, now = new Date()): Date | null {
  const m = /(?:(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(text.trim())
  if (!m) return null
  let hour = Number(m[2])
  const minute = m[3] ? Number(m[3]) : 0
  const ampm = m[4]?.toLowerCase()
  if (ampm === 'pm' && hour < 12) hour += 12
  if (ampm === 'am' && hour === 12) hour = 0
  if (hour > 23 || minute > 59) return null
  const d = new Date(now)
  d.setSeconds(0, 0)
  d.setHours(hour, minute)
  if (m[1]) {
    const target = WEEKDAYS.indexOf(m[1].toLowerCase())
    let add = (target - d.getDay() + 7) % 7
    if (add === 0 && d <= now) add = 7
    d.setDate(d.getDate() + add)
  } else if (d <= now) {
    d.setDate(d.getDate() + 1)
  }
  return d
}

function limitFromText(text: string): { resetAt: Date | null; message: string } | null {
  const m = LIMIT_TEXT.exec(text)
  if (!m) return null
  return { resetAt: m[2] ? parseResetText(m[2]) : null, message: m[0] }
}

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {})
const num = (v: unknown): number => (typeof v === 'number' ? v : 0)

export function parseResult(e: Json): ClaudeResult {
  const usage = obj(e['usage'])
  const modelUsage = obj(e['modelUsage'])
  return {
    ok: e['is_error'] !== true && e['subtype'] === 'success',
    text: typeof e['result'] === 'string' ? e['result'] : '',
    sessionId: typeof e['session_id'] === 'string' ? e['session_id'] : null,
    structured: e['structured_output'],
    subtype: String(e['subtype'] ?? ''),
    terminalReason: typeof e['terminal_reason'] === 'string' ? e['terminal_reason'] : null,
    errors: Array.isArray(e['errors']) ? e['errors'].map(String) : [],
    usage: {
      input: num(usage['input_tokens']),
      output: num(usage['output_tokens']),
      cacheCreation: num(usage['cache_creation_input_tokens']),
      cacheRead: num(usage['cache_read_input_tokens'])
    },
    model: Object.keys(modelUsage)[0] ?? null
  }
}

/** Ordnet ein einzelnes Ereignis (eine Zeile) ein. */
export function interpretEvent(e: Json): ClaudeEvent {
  const type = e['type']
  if (type === 'rate_limit_event') {
    const info = obj(e['rate_limit_info'])
    if (info['status'] === 'rejected') {
      return { kind: 'limit', resetAt: epochToDate(info['resetsAt']), message: String(info['errorCode'] ?? 'Limit erreicht') }
    }
    if (info['status'] === 'allowed_warning') {
      return { kind: 'limit-warning', utilization: typeof info['utilization'] === 'number' ? info['utilization'] : null }
    }
    return { kind: 'other' }
  }
  if (type === 'system' && e['subtype'] === 'api_retry') {
    return { kind: 'retry', error: String(e['error'] ?? ''), delayMs: typeof e['retry_delay_ms'] === 'number' ? e['retry_delay_ms'] : null }
  }
  if (type === 'assistant') {
    const message = obj(e['message'])
    const content = Array.isArray(message['content']) ? (message['content'] as Json[]) : []
    const text = content.filter((c) => c['type'] === 'text').map((c) => String(c['text'] ?? '')).join('')
    const limit = e['error'] === 'rate_limit' ? { resetAt: null, message: 'rate_limit' } : limitFromText(text)
    if (limit) return { kind: 'limit', ...limit }
    const tool = content.find((c) => c['type'] === 'tool_use')
    if (tool) return { kind: 'tool', name: String(tool['name'] ?? '') }
    return text ? { kind: 'text', text } : { kind: 'other' }
  }
  if (type === 'result') {
    const result = parseResult(e)
    const limit = limitFromText(`${result.text}\n${result.errors.join('\n')}`)
    if (!result.ok && limit) return { kind: 'limit', ...limit }
    return { kind: 'result', result }
  }
  return { kind: 'other' }
}

/** Zerlegt einen Datenstrom in vollständige Zeilen; Rest bleibt für den nächsten Block. */
export class LineSplitter {
  private rest = ''
  push(chunk: string): string[] {
    const text = this.rest + chunk
    const lines = text.split(/\r?\n/)
    this.rest = lines.pop() ?? ''
    return lines.filter((l) => l.trim().length > 0)
  }
  flush(): string[] {
    const last = this.rest.trim()
    this.rest = ''
    return last ? [last] : []
  }
}
