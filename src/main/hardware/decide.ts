import type {
  CyclesDevice,
  DeviceConfig,
  EncoderBench,
  HardwareInfo,
  ImageModelTier,
  RenderBench,
  WhisperChoice
} from '@shared/hardware'

export type { DeviceConfig, ImageModelTier, WhisperChoice } from '@shared/hardware'

const GPU_ORDER: CyclesDevice[] = ['OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL']
const ENCODER_ORDER = ['h264_nvenc', 'h264_amf', 'h264_qsv', 'libx264']

/** Test: 480×270 bei 16 Samples. Endbild: 1920×1080 → 16× Pixel. */
const PIXEL_FACTOR = (1920 * 1080) / (480 * 270)
/** Endbild darf auf diesem Gerät höchstens so lange dauern, sonst wird ein schnellerer Weg gewählt. */
const FINAL_BUDGET_SECONDS = 180

function best<T>(items: T[], score: (t: T) => number): T | undefined {
  return [...items].sort((a, b) => score(a) - score(b))[0]
}

export function decideConfig(hw: HardwareInfo, renders: RenderBench[], encoders: EncoderBench[]): DeviceConfig {
  const notes: string[] = []
  const ok = renders.filter((r) => r.ok && r.seconds !== null)

  // 1. Blender-Version: zuerst eine, auf der Cycles läuft (beste Qualität), dann die neueste
  const rank = (v: string): number => (ok.some((r) => r.blender === v && r.engine === 'CYCLES') ? 1 : 0)
  const versions = [...new Set(ok.map((r) => r.blender))].sort(
    (a, b) => rank(b) - rank(a) || b.localeCompare(a, undefined, { numeric: true })
  )
  const blenderVersion = versions[0] ?? null
  const usable = ok.filter((r) => r.blender === blenderVersion)
  const crashedNewer = renders.some((r) => r.reason === 'illegal-instruction' && r.blender !== blenderVersion)
  if (crashedNewer && blenderVersion) notes.push(`Neuere Blender-Version stürzt auf dieser CPU ab, nutze ${blenderVersion}.`)
  if (!blenderVersion) notes.push('Blender konnte auf diesem Gerät nicht rendern – Thumbnail-Rendering ist nicht verfügbar.')

  const cyclesGpu = best(
    usable.filter((r) => r.engine === 'CYCLES' && r.device !== 'CPU'),
    (r) => GPU_ORDER.indexOf(r.device) * 1000 + (r.seconds ?? 0)
  )
  const cyclesCpu = usable.find((r) => r.engine === 'CYCLES' && r.device === 'CPU')
  const eevee = usable.find((r) => r.engine === 'EEVEE')
  const workbench = usable.find((r) => r.engine === 'WORKBENCH')
  const blenderMesa = usable.length > 0 && usable.every((r) => r.mesa || r.engine === 'CYCLES') && usable.some((r) => r.mesa)

  // 2. Endbild: Kandidaten in Qualitätsreihenfolge; der erste, der ins Zeitbudget passt, gewinnt.
  //    Passt keiner, wird der schnellste genommen (langsam, aber es funktioniert).
  const estimate = (r: RenderBench | undefined, samplesFactor: number): number | null =>
    r?.seconds != null ? Math.round(r.seconds * PIXEL_FACTOR * samplesFactor) : null
  interface Candidate {
    setting: DeviceConfig['final']
    est: number
    note: string
  }
  const candidates: Candidate[] = []
  const add = (r: RenderBench | undefined, samples: number, note: string): void => {
    const est = estimate(r, samples / 16)
    if (r && est !== null) candidates.push({ setting: { engine: r.engine, device: r.device, width: 1920, height: 1080, samples }, est, note })
  }
  add(cyclesGpu, 128, `Endbild mit Cycles auf der Grafikkarte (${cyclesGpu?.device ?? ''}).`)
  add(cyclesCpu, 64, 'Endbild mit Cycles auf der CPU.')
  add(eevee, 64, eevee?.mesa ? 'Endbild mit EEVEE über Software-OpenGL (keine GPU erkannt).' : 'Endbild mit EEVEE.')
  add(cyclesCpu, 32, 'Endbild mit Cycles auf der CPU, reduzierte Samples (Rauschen wird entfernt).')
  const chosen = candidates.find((c) => c.est <= FINAL_BUDGET_SECONDS) ?? best(candidates, (c) => c.est)
  let final: DeviceConfig['final']
  let finalSecondsEstimate: number | null
  if (chosen) {
    final = chosen.setting
    finalSecondsEstimate = chosen.est
    notes.push(chosen.est > FINAL_BUDGET_SECONDS ? `${chosen.note} Dieses Gerät ist dafür langsam.` : chosen.note)
  } else {
    final = { engine: 'WORKBENCH', device: 'CPU', width: 1920, height: 1080, samples: 1 }
    finalSecondsEstimate = null
    if (workbench) notes.push('Nur die einfache Workbench-Engine läuft – Endbilder ohne realistisches Licht.')
  }

  // 3. Vorschau für die Prüfschleife: schnell, 960×540
  const previewCandidate = best(
    [workbench, eevee, cyclesGpu, cyclesCpu].filter((r): r is RenderBench => !!r),
    (r) => r.seconds ?? Infinity
  )
  const preview: DeviceConfig['preview'] = previewCandidate
    ? { engine: previewCandidate.engine, device: previewCandidate.device, width: 960, height: 540, samples: previewCandidate.engine === 'CYCLES' ? 8 : 16 }
    : { engine: 'WORKBENCH', device: 'CPU', width: 960, height: 540, samples: 1 }

  // 4. Video-Encoder: schnellster funktionierender, Hardware bevorzugt
  const workingEnc = encoders.filter((e) => e.ok)
  const encoder =
    best(workingEnc, (e) => ENCODER_ORDER.indexOf(e.encoder) * 10_000 - (e.fps ?? 0))?.encoder ?? 'libx264'
  if (encoder !== 'libx264') notes.push(`Video-Export mit Hardware-Encoder ${encoder}.`)

  // 5. Whisper und lokale Bildmodelle nach Grafikkarte/CPU
  const gpus = hw.gpus.filter((g) => g.physical)
  const nvidia = gpus.filter((g) => g.vendor === 'nvidia').sort((a, b) => (b.vramMB ?? 0) - (a.vramMB ?? 0))[0]
  let whisper: WhisperChoice
  if (nvidia && (nvidia.vramMB ?? 0) >= 6000) whisper = { model: 'large-v3-turbo', device: 'cuda', compute: 'float16' }
  else if (hw.cpuThreads >= 12 && hw.ramGB >= 16) whisper = { model: 'medium', device: 'cpu', compute: 'int8' }
  else if (hw.cpuThreads >= 4) whisper = { model: 'small', device: 'cpu', compute: 'int8' }
  else whisper = { model: 'base', device: 'cpu', compute: 'int8' }

  const dedicatedVram = Math.max(0, ...gpus.filter((g) => g.vendor === 'nvidia' || g.vendor === 'amd').map((g) => g.vramMB ?? 0))
  const imageModels: ImageModelTier =
    dedicatedVram >= 13_000 ? 'flux' : dedicatedVram >= 8_000 ? 'sdxl' : dedicatedVram >= 6_000 ? 'small' : 'off'
  if (imageModels === 'off') notes.push('Lokale Bildmodelle aus (keine Grafikkarte mit mindestens 6 GB VRAM).')

  return { blenderVersion, blenderMesa, preview, final, finalSecondsEstimate, encoder, whisper, imageModels, notes }
}
