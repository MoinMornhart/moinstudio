import { ipcMain, shell } from 'electron'
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { IPC, type SetupChecks } from '@shared/app'
import { findClaudeCli } from '../claude/cli'
import { cleanClaudeEnv } from '../claude/env'
import type { SettingsStore } from '../data/settings'
import { claudeDesktopInstalled, detectAdobe } from './detect'

/** Offizielle Seiten für fehlende Programme (Claude Code richtet „Mit Claude verbinden“ auch selbst ein). */
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
  // Mit Claude verbinden (Philip, 29.09.: „eine Verknüpfung, dass man Claude einfach mit dem Konto verbinden kann“):
  // Anthropics eigener Login-Ablauf in einem sichtbaren Fenster – MoinStudio sieht keine Zugangsdaten. Fehlt Claude
  // Code, installiert zuerst Anthropics offizieller Installer (pro Benutzer, ohne Admin-Rechte) und meldet dann an.
  // --claudeai legt die Anmeldung fest auf das Abo (nie API-Abrechnung).
  ipcMain.handle(IPC.claudeLogin, async (): Promise<{ installiert: boolean }> => {
    const cli = await findClaudeCli()
    // Kleines PowerShell-Skript im Temp-Ordner, sichtbar gestartet (sicherer als lange Befehle über cmd /c start)
    const zeilen = [
      '$Host.UI.RawUI.WindowTitle = "Claude verbinden"',
      ...(cli
        ? [`& "${cli}" auth login --claudeai`]
        : [
            'Write-Host "Claude Code wird installiert (offizieller Installer von Anthropic, ohne Admin-Rechte) ..."',
            'irm https://claude.ai/install.ps1 | iex',
            'Write-Host ""',
            'Write-Host "Jetzt mit deinem Claude-Konto anmelden ..."',
            '& "$env:USERPROFILE\\.local\\bin\\claude.exe" auth login --claudeai'
          ]),
      'Write-Host ""',
      'Write-Host "Fertig - du kannst dieses Fenster schliessen. MoinStudio erkennt die Verbindung von selbst."'
    ]
    const skript = join(tmpdir(), 'moinstudio-claude-verbinden.ps1')
    await writeFile(skript, '﻿' + zeilen.join('\r\n'), 'utf8')
    const child = spawn(
      process.env['ComSpec'] ?? 'cmd.exe',
      ['/d', '/c', 'start', '""', 'powershell', '-NoProfile', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', `"${skript}"`],
      { env: cleanClaudeEnv(), detached: true, stdio: 'ignore', windowsVerbatimArguments: true }
    )
    child.unref()
    return { installiert: !cli }
  })
}
