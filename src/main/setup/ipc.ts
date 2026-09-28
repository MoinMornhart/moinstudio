import { ipcMain, shell } from 'electron'
import { spawn } from 'node:child_process'
import { IPC, type SetupChecks } from '@shared/app'
import { findClaudeCli } from '../claude/cli'
import { cleanClaudeEnv } from '../claude/env'
import type { SettingsStore } from '../data/settings'
import { claudeDesktopInstalled, detectAdobe } from './detect'

/** Offizielle Seiten für fehlende Programme (nur öffnen – Installation macht Philip selbst). */
const LINKS: Record<string, string> = {
  'claude-code': 'https://claude.com/claude-code',
  'claude-desktop': 'https://claude.ai/download'
}

export function registerSetupIpc(settings: SettingsStore, forceCompleted: boolean): void {
  ipcMain.handle(IPC.setupState, async () => (forceCompleted ? true : (await settings.load()).setupCompleted))
  ipcMain.handle(IPC.setupComplete, async (_e, done: unknown) => {
    await settings.update({ setupCompleted: done !== false })
    return done !== false
  })
  ipcMain.handle(IPC.setupChecks, async (): Promise<SetupChecks> => {
    const [desktop, adobe] = await Promise.all([claudeDesktopInstalled(), detectAdobe()])
    return { claudeDesktop: desktop, adobe: adobe.map((a) => ({ id: a.id, name: a.name })) }
  })
  ipcMain.handle(IPC.openLink, async (_e, key: unknown) => {
    const url = LINKS[String(key)]
    if (url) await shell.openExternal(url)
  })
  // Anthropics eigener Login-Ablauf in einem sichtbaren Terminal – MoinStudio sieht keine Zugangsdaten.
  ipcMain.handle(IPC.claudeLogin, async () => {
    const cli = await findClaudeCli()
    if (!cli) throw new Error('Claude Code wurde nicht gefunden.')
    const child = spawn(process.env['ComSpec'] ?? 'cmd.exe', ['/d', '/c', 'start', '"Claude Login"', 'cmd', '/k', `"${cli}" auth login`], {
      env: cleanClaudeEnv(),
      detached: true,
      stdio: 'ignore',
      windowsVerbatimArguments: true
    })
    child.unref()
  })
}
