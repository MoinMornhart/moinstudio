import { spawn } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { RenderSetting } from '@shared/hardware'
import { blenderEnv, hasMesa } from '../hardware/mesa'
import type { JobContext } from './queue'

export interface BlenderRun {
  exe: string
  mesa: boolean
  script: string
  args: string[]
}

/**
 * Absturz ohne Python-Fehler = Grafik (OpenGL) in dieser Sitzung nicht nutzbar. Das passiert z. B., wenn der
 * Hardware-Test per Remote Desktop lief (Remote-Grafikadapter) und später ohne diese Sitzung gerendert wird.
 */
export function looksLikeGpuFailure(code: number | null, output: string): boolean {
  return code !== 0 && code !== null && !/Traceback|Error: Python/i.test(output)
}

/**
 * Startet Blender unsichtbar im Hintergrundmodus als angemeldeten Kindprozess des Jobs
 * (niedrige Priorität, hält bei Pause wirklich an, wird bei Abbruch beendet). Stürzt Blender ohne
 * Software-OpenGL ab, wird automatisch einmal mit Mesa/llvmpipe wiederholt (läuft auf jedem Rechner).
 */
export async function runBlender(run: BlenderRun, ctx: JobContext<unknown>): Promise<{ code: number | null; output: string; mesaFallback?: boolean }> {
  const first = await runBlenderOnce(run, ctx)
  // Bild schon fertig (MOIN_BILD_OK), nur die Photoshop-Maske danach ist abgestürzt: kein zweiter Durchlauf mit Mesa
  if (first.output.includes('MOIN_BILD_OK')) return first
  if (run.mesa || ctx.signal.aborted || !looksLikeGpuFailure(first.code, first.output) || !(await hasMesa(dirname(run.exe)))) return first
  ctx.progress(null, 'Grafik in dieser Sitzung nicht nutzbar – rendere mit Software-OpenGL …')
  return { ...(await runBlenderOnce({ ...run, mesa: true }, ctx)), mesaFallback: true }
}

function runBlenderOnce(run: BlenderRun, ctx: JobContext<unknown>): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(run.exe, ['-b', '--factory-startup', '--python', run.script, '--', ...run.args], {
      cwd: dirname(run.exe),
      env: blenderEnv(run.mesa),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    ctx.track(child)
    let output = ''
    let wache: NodeJS.Timeout | undefined
    const collect = (d: Buffer): void => {
      output = (output + d.toString()).slice(-20_000)
      // Nach dem fertigen Bild rechnet Blender nur noch die Photoshop-Maske (Workbench/OpenGL). Die hing auf manchen
      // Rechnern ewig (Test 30.09.) – spätestens nach 90 s beenden, das Bild ist ja fertig
      if (!wache && output.includes('MOIN_BILD_OK')) wache = setTimeout(() => child.kill(), 90_000)
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    const onAbort = (): void => {
      child.kill()
    }
    ctx.signal.addEventListener('abort', onAbort, { once: true })
    child.once('error', reject)
    child.once('exit', (code) => {
      ctx.signal.removeEventListener('abort', onAbort)
      if (wache) clearTimeout(wache)
      resolve({ code, output })
    })
  })
}

export interface ProbeRenderPayload {
  exe: string
  mesa: boolean
  script: string
  setting: RenderSetting
  outDir: string
}

/** Job „Probebild“: rendert die Testszene mit der Vorschau-Einstellung des Geräts. */
export async function probeRenderJob(p: ProbeRenderPayload, ctx: JobContext<unknown>): Promise<{ image: string; seconds: number }> {
  ctx.progress(null, `Rendere Probebild (${p.setting.engine}) …`)
  const json = join(p.outDir, `${ctx.id}.json`)
  const image = join(p.outDir, `${ctx.id}.png`)
  const { code, output } = await runBlender(
    { exe: p.exe, mesa: p.mesa, script: p.script, args: ['render', json, p.setting.engine, p.setting.device, String(p.setting.width), String(p.setting.height), image] },
    ctx
  )
  await ctx.yield()
  let result: { ok?: boolean; seconds?: number; error?: string } = {}
  try {
    result = JSON.parse(await readFile(json, 'utf8')) as typeof result
  } catch {
    throw new Error(`Blender hat kein Ergebnis geliefert (Exit ${code}): ${output.trim().split(/\r?\n/).slice(-2).join(' | ')}`)
  } finally {
    await rm(json, { force: true })
  }
  if (!result.ok) throw new Error(result.error ?? 'Render fehlgeschlagen')
  return { image, seconds: result.seconds ?? 0 }
}
