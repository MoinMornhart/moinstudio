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
