import { useEffect, useState } from 'react'
import type { DeviceConfig, HardwareState, RenderSetting } from '@shared/hardware'
import { Card } from './Panel'
import { useJobs } from './JobsWidget'

export function useHardwareState(): HardwareState | null {
  const [state, setState] = useState<HardwareState | null>(null)
  useEffect(() => {
    void window.moin.hardwareState().then(setState)
    return window.moin.onHardwareState(setState)
  }, [])
  return state
}

const ENGINE_NAME: Record<RenderSetting['engine'], string> = {
  CYCLES: 'Cycles',
  EEVEE: 'EEVEE',
  WORKBENCH: 'Workbench'
}

function renderText(r: RenderSetting): string {
  const where = r.engine === 'CYCLES' ? (r.device === 'CPU' ? ' auf der CPU' : ` auf der GPU (${r.device})`) : ''
  return `${ENGINE_NAME[r.engine]}${where}, ${r.width}×${r.height}`
}

function duration(s: number | null): string {
  if (s === null) return ''
  return s < 90 ? ` · ca. ${s} s pro Bild` : ` · ca. ${Math.round(s / 60)} min pro Bild`
}

const IMAGE_MODELS: Record<DeviceConfig['imageModels'], string> = {
  off: 'aus',
  small: 'klein',
  sdxl: 'SDXL',
  flux: 'FLUX'
}

/** Ergebnis des Hardware-Tests mit Begründungen und Knopf „Neu testen“. */
/** Startet den Job „Probebild“ und zeigt das Ergebnis, sobald er fertig ist. */
function ProbeRender({ disabled }: { disabled: boolean }): React.JSX.Element {
  const jobs = useJobs()
  const [jobId, setJobId] = useState<string | null>(null)
  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const job = jobs?.jobs.find((j) => j.id === jobId)
  useEffect(() => {
    if (job?.state === 'done') void window.moin.jobImage(job.id).then(setImage)
  }, [job?.state, job?.id])
  const start = async (): Promise<void> => {
    setImage(null)
    setError(null)
    try {
      setJobId(await window.moin.probeRender())
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err))
    }
  }
  const busy = job && (job.state === 'queued' || job.state === 'running' || job.state === 'paused')
  return (
    <>
      <button className="btn" disabled={disabled || !!busy} onClick={() => void start()}>
        Probebild rendern
      </button>
      {error && <p className="warn">{error}</p>}
      {job?.state === 'failed' && <p className="warn">{job.error}</p>}
      {image && <img className="probe-image" src={image} alt="Probebild aus Blender" />}
    </>
  )
}

export function HardwareCard(): React.JSX.Element {
  const state = useHardwareState()
  const running = state?.state === 'running'
  const profile = state?.state === 'done' ? state.profile : state?.state === 'error' ? state.profile : null
  const c = profile ? { ...profile.config, ...profile.overrides } : null

  return (
    <Card title="Hardware & Leistung" badge={state?.state === 'done' && state.outdated ? 'neu testen empfohlen' : undefined}>
      {!state ? (
        <p className="muted">Lade …</p>
      ) : running ? (
        <div className="tool-progress standalone">
          <span>{state.progress.step}</span>
          <progress max={100} value={state.progress.percent} />
        </div>
      ) : state.state === 'none' ? (
        <p className="muted">
          Noch nicht getestet. Der Test ermittelt einmalig pro Gerät die beste Einstellung für Rendern, Video und KI-Modelle
          (dauert wenige Minuten, beim ersten Mal inklusive Download von Blender).
        </p>
      ) : null}

      {state?.state === 'error' && <p className="warn">Test fehlgeschlagen: {state.message}</p>}

      {c && profile && !running && (
        <>
          <dl className="facts">
            <dt>Grafik</dt>
            <dd>
              {profile.hardware.gpus.filter((g) => g.physical).map((g) => `${g.name}${g.vramMB ? ` (${Math.round(g.vramMB / 1024)} GB)` : ''}`).join(', ') ||
                'keine GPU erkannt'}
            </dd>
            <dt>Prozessor</dt>
            <dd>{profile.hardware.cpuThreads} Threads · {profile.hardware.ramGB} GB RAM</dd>
            <dt>Blender</dt>
            <dd>{c.blenderVersion ?? 'nicht lauffähig'}{c.blenderMesa ? ' · Software-OpenGL' : ''}</dd>
            <dt>Vorschau</dt>
            <dd>{renderText(c.preview)}</dd>
            <dt>Endbild</dt>
            <dd>{renderText(c.final)}{duration(c.finalSecondsEstimate)}</dd>
            <dt>Video</dt>
            <dd>{c.encoder}</dd>
            <dt>Whisper</dt>
            <dd>{c.whisper.model} ({c.whisper.device === 'cuda' ? 'GPU' : 'CPU'})</dd>
            <dt>Bildmodelle</dt>
            <dd>{IMAGE_MODELS[c.imageModels]}</dd>
          </dl>
          {c.notes.length > 0 && (
            <ul className="notes">
              {c.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <p className="muted small">
            Getestet am {new Date(profile.createdAt).toLocaleString('de-DE')} in {profile.durationSeconds} s.
          </p>
        </>
      )}

      <div className="row">
        <button className="btn" disabled={running} onClick={() => void window.moin.runHardwareTest()}>
          {state?.state === 'none' ? 'Hardware jetzt testen' : 'Hardware neu testen'}
        </button>
        {profile && <ProbeRender disabled={running} />}
      </div>
    </Card>
  )
}

/** Hinweisleiste oben, solange der Hardware-Test läuft. */
export function HardwareBanner(): React.JSX.Element | null {
  const state = useHardwareState()
  if (state?.state !== 'running') return null
  return (
    <div className="update-banner">
      <span>Hardware-Test: {state.progress.step}</span>
      <progress max={100} value={state.progress.percent} />
    </div>
  )
}
