/** Datentypen des Hardware-Tests – gemeinsam für Main-Prozess und Oberfläche. */

export type GpuVendor = 'nvidia' | 'amd' | 'intel' | 'microsoft' | 'virtual' | 'other'

export interface GpuInfo {
  name: string
  vendor: GpuVendor
  /** Grafikspeicher in MB, null wenn unbekannt */
  vramMB: number | null
  driver: string | null
  /** false für Software-/Basis-/VM-Adapter ohne echte 3D-Beschleunigung */
  physical: boolean
}

export interface HardwareInfo {
  os: string
  cpuModel: string
  cpuThreads: number
  ramGB: number
  freeDiskGB: number
  gpus: GpuInfo[]
}

export type BlenderEngine = 'CYCLES' | 'EEVEE' | 'WORKBENCH'
export type CyclesDevice = 'CPU' | 'OPTIX' | 'CUDA' | 'HIP' | 'ONEAPI' | 'METAL'
export type FailReason = 'illegal-instruction' | 'crash' | 'timeout' | 'error' | 'black-image'

export interface RenderBench {
  blender: string
  engine: BlenderEngine
  device: CyclesDevice
  mesa: boolean
  ok: boolean
  seconds: number | null
  reason?: FailReason
  detail?: string
}

export interface EncoderBench {
  encoder: string
  ok: boolean
  fps: number | null
}

export type WhisperChoice = {
  model: 'large-v3-turbo' | 'medium' | 'small' | 'base'
  device: 'cuda' | 'cpu'
  compute: 'float16' | 'int8'
}
export type ImageModelTier = 'off' | 'small' | 'sdxl' | 'flux'

export interface RenderSetting {
  engine: BlenderEngine
  device: CyclesDevice
  width: number
  height: number
  samples: number
}

export interface DeviceConfig {
  /** null = Blender läuft auf diesem Gerät nicht → Thumbnail-Rendering nicht möglich */
  blenderVersion: string | null
  /** Mesa-Software-OpenGL neben blender.exe (nur Rechner ohne echte GPU) */
  blenderMesa: boolean
  preview: RenderSetting
  final: RenderSetting
  /** Geschätzte Sekunden für ein Endbild (grobe Hochrechnung aus dem Test) */
  finalSecondsEstimate: number | null
  encoder: string
  whisper: WhisperChoice
  imageModels: ImageModelTier
  /** Kurze, verständliche Begründungen für die Anzeige */
  notes: string[]
}

export interface DeviceProfile {
  format: 1
  createdAt: string
  fingerprint: string
  hardware: HardwareInfo
  renders: RenderBench[]
  encoders: EncoderBench[]
  config: DeviceConfig
  /** Von Philip in den Einstellungen überschriebene Werte (haben Vorrang) */
  overrides: Partial<DeviceConfig>
  durationSeconds: number
}

export interface HardwareProgress {
  percent: number
  step: string
}

export type HardwareState =
  | { state: 'none' }
  | { state: 'running'; progress: HardwareProgress }
  | { state: 'done'; profile: DeviceProfile; outdated: boolean }
  | { state: 'error'; message: string; profile: DeviceProfile | null }
