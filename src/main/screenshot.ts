import type { BrowserWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { IPC, TABS } from '@shared/app'

const FLAG = '--moin-screenshot='
/** Zusätzlich zu `--moin-screenshot=`: statt der Reiter die Schritte des Einrichtungsassistenten aufnehmen */
export const SETUP_FLAG = '--moin-screenshot-setup'
export const SETUP_STEPS = 6

/** Liest `--moin-screenshot=<ordner>` aus den Startargumenten (für Selbstprüfung und README-Bilder). */
export function parseScreenshotArg(argv: readonly string[]): string | null {
  const arg = argv.find((a) => a.startsWith(FLAG))
  if (!arg) return null
  const dir = arg.slice(FLAG.length).trim()
  return dir ? resolve(dir) : null
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Schaltet jeden Reiter durch und speichert je ein PNG, ohne das Fenster anzuzeigen. */
export async function runScreenshotMode(win: BrowserWindow, dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
  if (win.webContents.isLoading()) {
    await new Promise<void>((r) => win.webContents.once('did-finish-load', () => r()))
  }
  await wait(800)
  if (process.argv.includes(SETUP_FLAG)) {
    for (let step = 0; step < SETUP_STEPS; step++) {
      win.webContents.send(IPC.setupStep, step)
      await wait(1500)
      await writeFile(join(dir, `setup-${step + 1}.png`), (await win.webContents.capturePage()).toPNG())
    }
    return
  }
  for (const tab of TABS) {
    win.webContents.send(IPC.selectTab, tab.id)
    await wait(1200)
    await writeFile(join(dir, `${tab.id}.png`), (await aufnahme(win)).toPNG())
  }
}

/** Auf langsamen Rechnern liefert die Aufnahme manchmal ein leeres, einfarbiges Bild – dann warten und neu aufnehmen. */
async function aufnahme(win: BrowserWindow): Promise<Electron.NativeImage> {
  let bild = await win.webContents.capturePage()
  for (let versuch = 0; versuch < 5 && einfarbig(bild); versuch++) {
    await wait(1000)
    win.webContents.invalidate()
    bild = await win.webContents.capturePage()
  }
  return bild
}

function einfarbig(bild: Electron.NativeImage): boolean {
  const px = bild.toBitmap()
  for (let i = 4; i < px.length; i += 4 * 997) if (px[i] !== px[0] || px[i + 1] !== px[1] || px[i + 2] !== px[2]) return false
  return true
}
