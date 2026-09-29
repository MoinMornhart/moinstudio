import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { IPC, type AppInfo, type AutostartState } from '@shared/app'
import { parseScreenshotArg, runScreenshotMode, SETUP_FLAG } from './screenshot'
import { runUpdateCli, setupUpdater } from './updater'
import { SettingsStore } from './data/settings'
import { registerDataIpc } from './data/ipc'
import { ToolManager } from './tools/manager'
import { localRoot, registerToolsIpc, runToolsCli } from './tools/ipc'
import { HardwareController } from './hardware/controller'
import { setupJobs } from './jobs/setup'
import { registerClaudeIpc, runClaudeCliTest } from './claude/ipc'
import { registerMcpIpc } from './mcp/ipc'
import { startAppRpc } from './rpc/app-rpc'
import { registerSetupIpc } from './setup/ipc'

const screenshotDir = parseScreenshotArg(process.argv)
const mainWindow = (): BrowserWindow | undefined => BrowserWindow.getAllWindows()[0]
const settings = new SettingsStore(app.getPath('userData'))
const tools = new ToolManager(localRoot())
const hardware = new HardwareController(tools, localRoot(), mainWindow)
registerDataIpc(settings, mainWindow)
registerToolsIpc(tools, mainWindow)
hardware.register()
registerClaudeIpc()
registerMcpIpc(localRoot())
// Im Screenshot-Modus den Assistenten nur zeigen, wenn er ausdrücklich aufgenommen werden soll
registerSetupIpc(settings, !!screenshotDir && !process.argv.includes(SETUP_FLAG))
const { queue: jobs, enqueueProbe, starteThumbnail, starteVideo, starteReaktion } = setupJobs(localRoot(), tools, hardware, settings, mainWindow)

// Fester Name für den Autostart-Eintrag (HKCU\...\Run). Ohne ihn leitet Electron den Namen
// aus der AppUserModelId ab, und Setzen und Abfragen könnten verschiedene Einträge meinen.
const LOGIN_ITEM = { name: 'MoinStudio' }
app.setAppUserModelId('de.moinmornhart.moinstudio')

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: `MoinStudio ${app.getVersion()}`,
    backgroundColor: '#0e0e12',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => {
    if (!screenshotDir) win.show()
  })

  // Externe Links im Standardbrowser öffnen, nie in der App.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

ipcMain.handle(IPC.appInfo, (): AppInfo => ({
  name: app.getName(),
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node
}))

ipcMain.handle(IPC.openLogs, async () => {
  const dir = app.getPath('logs')
  await mkdir(dir, { recursive: true })
  await shell.openPath(dir)
})

function autostartState(): AutostartState {
  if (!app.isPackaged) return { available: false, enabled: false }
  const items = app.getLoginItemSettings().launchItems ?? []
  return { available: true, enabled: items.some((i) => i.name === LOGIN_ITEM.name && i.enabled) }
}

ipcMain.handle(IPC.autostartGet, () => autostartState())
ipcMain.handle(IPC.autostartSet, (_e, enabled: unknown) => {
  if (app.isPackaged) app.setLoginItemSettings({ ...LOGIN_ITEM, openAtLogin: enabled === true })
  return autostartState()
})

// `--moin-autostart=on|off` setzt den Autostart ohne Oberfläche (Einrichtung, Tests) und beendet.
const autostartArg = process.argv.find((a) => a.startsWith('--moin-autostart='))?.split('=')[1]
const updateArg = process.argv.find((a) => a.startsWith('--moin-update='))?.split('=')[1]
const toolsArg = process.argv.find((a) => a.startsWith('--moin-tools='))?.split('=')[1]
if (toolsArg === 'install') {
  void app.whenReady().then(async () => app.exit(await runToolsCli(tools)))
} else if (process.argv.includes('--moin-claude-test')) {
  void app.whenReady().then(async () => {
    try {
      app.exit(await runClaudeCliTest(localRoot()))
    } catch (err) {
      console.error(err)
      app.exit(1)
    }
  })
} else if (process.argv.includes('--moin-probe')) {
  // Integrationstest Job-System: Probebild rendern, mittendrin 3 s pausieren, fortsetzen.
  void app.whenReady().then(async () => {
    await jobs.start()
    const t0 = Date.now()
    const log = (m: string): void => console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`)
    try {
      const id = await enqueueProbe()
      log('Job gestartet')
      await new Promise((r) => setTimeout(r, 1500))
      await jobs.pause(id)
      log(`pausiert: ${jobs.get(id)?.state}`)
      await new Promise((r) => setTimeout(r, 3000))
      await jobs.resume(id)
      log(`fortgesetzt: ${jobs.get(id)?.state}`)
      const info = await jobs.waitFor(id)
      log(`Ende: ${info.state} ${info.error ?? ''} ${JSON.stringify(jobs.result(id) ?? {})}`)
      app.exit(info.state === 'done' ? 0 : 1)
    } catch (err) {
      console.error(err)
      app.exit(1)
    }
  })
} else if (process.argv.some((a) => a.startsWith('--moin-reaktion='))) {
  // Integrationstest Reaction (Stilbuch 14) ohne Dateidialog; optional --moin-gefuehl=… --moin-wort=…
  const original = process.argv.find((a) => a.startsWith('--moin-reaktion='))!.slice('--moin-reaktion='.length)
  const arg = (n: string): string | undefined => process.argv.find((a) => a.startsWith(`--moin-${n}=`))?.split('=').slice(1).join('=')
  void app.whenReady().then(async () => {
    await jobs.start()
    try {
      const id = await starteReaktion(original, { gefuehl: arg('gefuehl'), wort: arg('wort') })
      const info = await jobs.waitFor(id)
      console.log(`Ende: ${info.state} ${info.error ?? ''}`)
      console.log(JSON.stringify(jobs.result(id) ?? {}, null, 1))
      app.exit(info.state === 'done' ? 0 : 1)
    } catch (err) {
      console.error(err)
      app.exit(1)
    }
  })
} else if (process.argv.some((a) => a.startsWith('--moin-video='))) {
  // Integrationstest Video → Vorschläge (ROADMAP 5.5) ohne Dateidialog
  const video = process.argv.find((a) => a.startsWith('--moin-video='))!.slice('--moin-video='.length)
  void app.whenReady().then(async () => {
    await jobs.start()
    try {
      const id = await starteVideo(video, 'MoinMornhart')
      const info = await jobs.waitFor(id)
      console.log(`Ende: ${info.state} ${info.error ?? ''}`)
      const res = jobs.result<{ inhalt: string; vorschlaege: unknown[] }>(id)
      console.log(JSON.stringify({ inhalt: res?.inhalt, vorschlaege: res?.vorschlaege }, null, 1))
      app.exit(info.state === 'done' ? 0 : 1)
    } catch (err) {
      console.error(err)
      app.exit(1)
    }
  })
} else if (process.argv.some((a) => a.startsWith('--moin-thumbnail='))) {
  // Integrationstest Thumbnail: ganzer Ablauf wie im Reiter (Claude plant, Blender rendert, Prüfung, Text)
  const text = process.argv.find((a) => a.startsWith('--moin-thumbnail='))!.slice('--moin-thumbnail='.length)
  void app.whenReady().then(async () => {
    await jobs.start()
    try {
      const id = await starteThumbnail({ beschreibung: text, freunde: process.argv.filter((a) => a.startsWith('--moin-freund=')).map((a) => a.slice(14)), anzahl: 2 })
      console.log('Job', id)
      const info = await jobs.waitFor(id)
      console.log(`Ende: ${info.state} ${info.error ?? ''}`)
      console.log(JSON.stringify(jobs.result(id) ?? {}, null, 1))
      app.exit(info.state === 'done' ? 0 : 1)
    } catch (err) {
      console.error(err)
      app.exit(1)
    }
  })
} else if (process.argv.includes('--moin-hwtest')) {
  // Hardware-Test ohne Oberfläche (Einrichtung, Tests); Ergebnis in logs\hardware.log und device-profile.json
  void app.whenReady().then(async () => {
    try {
      const profile = await hardware.run()
      console.log(JSON.stringify(profile.config, null, 2))
      app.exit(profile.config.blenderVersion ? 0 : 2)
    } catch (err) {
      console.error(err)
      app.exit(1)
    }
  })
} else if (updateArg === 'check' || updateArg === 'install') {
  void app.whenReady().then(async () => {
    const code = await runUpdateCli(updateArg)
    // Bei „install“ beendet quitAndInstall die App selbst; sonst hier beenden.
    if (updateArg === 'check' || code !== 0) app.exit(code)
  })
} else if (autostartArg === 'on' || autostartArg === 'off') {
  void app.whenReady().then(() => {
    if (app.isPackaged) app.setLoginItemSettings({ ...LOGIN_ITEM, openAtLogin: autostartArg === 'on' })
    app.exit(app.isPackaged ? 0 : 3)
  })
} else if (!app.requestSingleInstanceLock() && !screenshotDir) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  void app.whenReady().then(async () => {
    const win = createWindow()
    if (!screenshotDir) {
      void jobs.start()
      // Verbindung für den MCP-Server (Claude Desktop / claude -p)
      startAppRpc({ settings, hardware, jobs, enqueueProbe }).catch((err: unknown) => console.error('Pipe-Server:', err))
    }
    if (!screenshotDir) setupUpdater(mainWindow)
    // Erster Start bzw. geändertes Gerät: Hardware-Test im Hintergrund (nur in der installierten App,
    // damit Entwicklungsläufe nicht jedes Mal Blender herunterladen).
    if (!screenshotDir && app.isPackaged) {
      win.webContents.once('did-finish-load', () => void hardware.autoRunIfNeeded())
    }
    if (screenshotDir) {
      try {
        await runScreenshotMode(win, screenshotDir)
        app.exit(0)
      } catch (err) {
        console.error('Screenshot-Modus fehlgeschlagen:', err)
        app.exit(1)
      }
    }
  })

  app.on('window-all-closed', () => app.quit())
}
