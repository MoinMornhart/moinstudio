import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

async function exists(path: string): Promise<boolean> {
  return (await stat(path).catch(() => null)) !== null
}

async function listDir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir)
  } catch {
    return []
  }
}

/** Ist die Claude-Desktop-App installiert? (klassischer Installer oder Store-/MSIX-Paket) */
export async function claudeDesktopInstalled(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const local = env['LOCALAPPDATA'] ?? ''
  if (local && (await exists(join(local, 'AnthropicClaude')))) return true
  return (await listDir(join(local, 'Packages'))).some((n) => /^Claude_/i.test(n))
}

export interface AdobeApp {
  id: 'premiere' | 'aftereffects' | 'photoshop'
  name: string
  /** z. B. „2026“ aus dem Ordnernamen */
  year: string | null
  path: string
}

const ADOBE_PATTERNS: { id: AdobeApp['id']; folder: RegExp; exe: string }[] = [
  // Premiere heißt ab 2026 evtl. „Adobe Premiere 2026“ statt „Adobe Premiere Pro 2026“ (docs/research/adobe.md)
  { id: 'premiere', folder: /^Adobe Premiere( Pro)?( (\d{4}))?$/i, exe: 'Adobe Premiere Pro.exe' },
  { id: 'aftereffects', folder: /^Adobe After Effects( (\d{4}))?$/i, exe: 'Support Files\\AfterFX.exe' },
  { id: 'photoshop', folder: /^Adobe Photoshop( (\d{4}))?$/i, exe: 'Photoshop.exe' }
]

/**
 * Einfache Erkennung installierter Adobe-Programme über die Standard-Installationsordner.
 * Die vollständige Erkennung (Registry, Versionen, Plugins) folgt im Adobe-Modul (ROADMAP M9).
 */
export async function detectAdobe(programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files'): Promise<AdobeApp[]> {
  const base = join(programFiles, 'Adobe')
  const found: AdobeApp[] = []
  for (const folder of await listDir(base)) {
    for (const p of ADOBE_PATTERNS) {
      const m = p.folder.exec(folder)
      if (!m) continue
      const dir = join(base, folder)
      const exeName = p.id === 'premiere' && !(await exists(join(dir, p.exe))) ? 'Adobe Premiere.exe' : p.exe
      if (await exists(join(dir, exeName))) {
        found.push({ id: p.id, name: folder, year: /(\d{4})$/.exec(folder)?.[1] ?? null, path: join(dir, exeName) })
      }
    }
  }
  return found
}
