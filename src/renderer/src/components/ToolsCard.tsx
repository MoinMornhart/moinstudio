import { useEffect, useState } from 'react'
import type { ToolProgressEvent, ToolStatus } from '@shared/app'
import { Card } from './Panel'

const PHASE_TEXT: Record<ToolProgressEvent['phase'], string> = {
  check: 'Prüfe …',
  download: 'Lade herunter …',
  verify: 'Prüfsumme ok',
  extract: 'Entpacke …',
  done: 'Fertig',
  error: 'Fehler'
}

function mb(bytes: number): string {
  return `${Math.round(bytes / 1e6)} MB`
}

/** Status der Werkzeuge (Blender, FFmpeg, uv) mit Installation per Knopf und Fortschritt. */
export function ToolsCard(): React.JSX.Element {
  const [tools, setTools] = useState<ToolStatus[] | null>(null)
  const [progress, setProgress] = useState<Partial<Record<ToolStatus['id'], ToolProgressEvent>>>({})

  useEffect(() => {
    void window.moin.toolsStatus().then(setTools)
    return window.moin.onToolProgress((p) => setProgress((prev) => ({ ...prev, [p.id]: p })))
  }, [])

  const install = async (id: ToolStatus['id']): Promise<void> => {
    setTools(await window.moin.installTool(id))
  }

  return (
    <Card title="Werkzeuge">
      {!tools ? (
        <p className="muted">Lade …</p>
      ) : (
        <ul className="tool-list">
          {tools.map((t) => {
            const p = progress[t.id]
            const busy = p && p.phase !== 'done' && p.phase !== 'error'
            return (
              <li key={`${t.id}@${t.version}`}>
                <div className="tool-head">
                  <span className={t.installed ? 'dot ok' : 'dot'} aria-hidden="true" />
                  <b>{t.label}</b>
                  <span className="muted">{t.installed ? 'installiert' : `nicht installiert (${mb(t.sizeBytes)})`}</span>
                  {!t.installed && !busy && (
                    <button className="btn small" onClick={() => void install(t.id)}>Installieren</button>
                  )}
                </div>
                {busy && (
                  <div className="tool-progress">
                    <span>{PHASE_TEXT[p.phase]}{p.percent !== null && p.phase === 'download' ? ` ${p.percent} %` : ''}</span>
                    <progress max={100} value={p.phase === 'download' ? (p.percent ?? undefined) : undefined} />
                  </div>
                )}
                {p?.phase === 'error' && <p className="warn">{p.message}</p>}
              </li>
            )
          })}
        </ul>
      )}
      <p className="muted small">Alles wird ohne Admin-Rechte nach %LOCALAPPDATA%\MoinStudio geladen und per SHA256 geprüft.</p>
    </Card>
  )
}
