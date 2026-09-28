import { dirname, join } from 'node:path'
import type { HardwareProgress } from '@shared/hardware'
import { BlenderBench, benchEncoder, ENCODERS, type CyclesDevice, type EncoderBench, type RenderBench } from './bench'
import { decideConfig } from './decide'
import { detectHardware } from './detect'
import { ensureMesaCache, installMesaInto, removeMesaFrom } from './mesa'
import { fingerprint, type DeviceProfile, type ProfileStore } from './profile'
import type { ToolManager } from '../tools/manager'
import { BLENDER_FALLBACK, BLENDER_PRIMARY, FFMPEG, type ToolSpec } from '../tools/specs'

export interface HardwareTestOptions {
  tools: ToolManager
  profiles: ProfileStore
  appVersion: string
  benchScript: string
  /** %LOCALAPPDATA%\MoinStudio */
  root: string
  onProgress?: (p: HardwareProgress) => void
  signal?: AbortSignal
}

const GPU_TYPES: CyclesDevice[] = ['OPTIX', 'CUDA', 'HIP', 'ONEAPI']

/**
 * Hardware-Test beim ersten Start: erkennen → messen → festlegen → speichern.
 * Jeder Einzeltest läuft isoliert; Abstürze gelten als „nicht verfügbar“, nie als Fehler der App.
 */
export async function runHardwareTest(o: HardwareTestOptions): Promise<DeviceProfile> {
  const started = Date.now()
  const report = (percent: number, step: string): void => o.onProgress?.({ percent: Math.round(percent), step })
  const bench = new BlenderBench(o.benchScript, join(o.root, 'hwtest'))
  const renders: RenderBench[] = []

  report(2, 'Erkenne Hardware …')
  const hw = await detectHardware(o.root)
  const hasPhysicalGpu = hw.gpus.some((g) => g.physical)

  const install = async (spec: ToolSpec, from: number, to: number): Promise<string> =>
    o.tools.install(spec, (p) => {
      if (p.phase === 'download' && p.percent !== null) report(from + ((to - from) * p.percent) / 100, `Lade ${spec.label} … ${p.percent} %`)
      else if (p.phase === 'extract') report(to, `Entpacke ${spec.label} …`)
    }, o.signal)

  /** Alle Render-Tests für eine Blender-Version. */
  const testBlender = async (spec: ToolSpec, exe: string, from: number, to: number): Promise<void> => {
    // Echte GPU vorhanden: eventuell früher abgelegtes Software-OpenGL entfernen
    if (hasPhysicalGpu) await removeMesaFrom(dirname(exe))
    report(from, `Prüfe ${spec.label} …`)
    const devices = await bench.devices(exe)
    const gpuTypes = GPU_TYPES.filter((t) => (devices.gpu[t]?.length ?? 0) > 0)
    const plan: [RenderBench['engine'], CyclesDevice][] = [
      ['WORKBENCH', 'CPU'],
      ['EEVEE', 'CPU'],
      ...gpuTypes.map((t): [RenderBench['engine'], CyclesDevice] => ['CYCLES', t]),
      ['CYCLES', 'CPU']
    ]
    for (const [i, [engine, device]] of plan.entries()) {
      report(from + ((to - from) * i) / plan.length, `${spec.label}: teste ${engine}${engine === 'CYCLES' ? ` (${device})` : ''} …`)
      renders.push(await bench.render(exe, spec.version, engine, device, false))
    }
  }

  // Blender: bevorzugte Version
  const primaryExe = await install(BLENDER_PRIMARY, 5, 25)
  await testBlender(BLENDER_PRIMARY, primaryExe, 25, 45)
  let activeSpec = BLENDER_PRIMARY
  let activeExe = primaryExe

  // Rückfall: Stürzt die neue Version beim Rendern generell ab (z. B. fehlender CPU-Befehl RDTSCP),
  // wird Blender 4.5 LTS geladen und getestet.
  const primaryOk = renders.some((r) => r.blender === BLENDER_PRIMARY.version && r.ok)
  const primaryCyclesOk = renders.some((r) => r.blender === BLENDER_PRIMARY.version && r.engine === 'CYCLES' && r.ok)
  if (!primaryOk || !primaryCyclesOk) {
    const fallbackExe = await install(BLENDER_FALLBACK, 45, 60)
    await testBlender(BLENDER_FALLBACK, fallbackExe, 60, 72)
    if (renders.some((r) => r.blender === BLENDER_FALLBACK.version && r.ok)) {
      activeSpec = BLENDER_FALLBACK
      activeExe = fallbackExe
    }
  }

  // Keine echte GPU und EEVEE/Workbench laufen nicht: Software-OpenGL (Mesa) versuchen
  const rasterOk = renders.some((r) => r.blender === activeSpec.version && r.ok && r.engine !== 'CYCLES')
  if (!rasterOk && !hasPhysicalGpu) {
    report(74, 'Keine GPU erkannt – lade Software-OpenGL (Mesa) …')
    const cache = await ensureMesaCache(o.root, o.signal)
    await installMesaInto(dirname(activeExe), cache)
    for (const engine of ['WORKBENCH', 'EEVEE'] as const) {
      report(engine === 'WORKBENCH' ? 76 : 80, `${activeSpec.label}: teste ${engine} mit Software-OpenGL …`)
      renders.push(await bench.render(activeExe, activeSpec.version, engine, 'CPU', true, 300_000))
    }
    if (!renders.some((r) => r.mesa && r.ok)) await removeMesaFrom(dirname(activeExe))
  }

  // FFmpeg-Encoder
  const ffmpeg = await install(FFMPEG, 84, 88)
  const encoders: EncoderBench[] = []
  for (const [i, enc] of ENCODERS.entries()) {
    report(88 + i * 2, `Teste Video-Encoder ${enc} …`)
    encoders.push(await benchEncoder(ffmpeg, enc))
  }

  report(97, 'Lege beste Konfiguration fest …')
  const config = decideConfig(hw, renders, encoders)
  const installedBlender = Object.values(await o.tools.installed())
    .filter((t) => t.path.includes('\\bl\\'))
    .map((t) => t.version)
  const profile: DeviceProfile = {
    format: 1,
    createdAt: new Date().toISOString(),
    fingerprint: fingerprint(hw, o.appVersion, installedBlender),
    hardware: hw,
    renders,
    encoders,
    config,
    overrides: (await o.profiles.load())?.overrides ?? {},
    durationSeconds: Math.round((Date.now() - started) / 1000)
  }
  await o.profiles.save(profile)
  report(100, 'Fertig')
  return profile
}

/** Muss neu getestet werden? (kein Profil oder Hardware/Treiber/App-Minor/Blender geändert) */
export async function needsHardwareTest(profiles: ProfileStore, tools: ToolManager, appVersion: string, root: string): Promise<boolean> {
  const profile = await profiles.load()
  if (!profile) return true
  const hw = await detectHardware(root)
  const installedBlender = Object.values(await tools.installed())
    .filter((t) => t.path.includes('\\bl\\'))
    .map((t) => t.version)
  return fingerprint(hw, appVersion, installedBlender) !== profile.fingerprint
}
