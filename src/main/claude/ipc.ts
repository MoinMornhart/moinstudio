import { ipcMain } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/app'
import { claudeStatus, type ClaudeStatus } from './cli'
import { runClaude } from './run'

export function registerClaudeIpc(): void {
  ipcMain.handle(IPC.claudeStatus, () => claudeStatus())
}

/**
 * `--moin-claude-test`: prüft CLI und Abo-Login und macht einen winzigen Probeaufruf
 * (Haiku, keine Werkzeuge, 1 Turn). Exit 0 = Abo-Anbindung funktioniert.
 */
export async function runClaudeCliTest(root: string): Promise<number> {
  const status: ClaudeStatus = await claudeStatus()
  console.log(JSON.stringify({ ...status, cli: status.cli ? '…' + status.cli.slice(-40) : null }, null, 2))
  if (!status.usable || !status.cli) return 2
  const started = Date.now()
  const res = await runClaude({
    cli: status.cli,
    prompt: 'Antworte nur mit dem Wort: Moin',
    workDir: join(root, 'claude-work'),
    model: 'haiku',
    maxTurns: 1,
    tools: []
  })
  console.log(
    JSON.stringify({ ok: res.ok, text: res.text, model: res.model, sekunden: (Date.now() - started) / 1000, usage: res.usage }, null, 2)
  )
  return res.ok ? 0 : 1
}
