import { useEffect, useState } from 'react'
import type { JobInfo, QueueState } from '@shared/jobs'

export function useJobs(): QueueState | null {
  const [state, setState] = useState<QueueState | null>(null)
  useEffect(() => {
    void window.moin.jobsState().then(setState)
    return window.moin.onJobsState(setState)
  }, [])
  return state
}

const ACTIVE = new Set<JobInfo['state']>(['queued', 'running', 'paused', 'waiting-limit'])

/** Kompakte Aufgabenliste in der Seitenleiste mit Pause/Fortsetzen/Abbrechen. */
export function JobsWidget(): React.JSX.Element | null {
  const state = useJobs()
  if (!state) return null
  const active = state.jobs.filter((j) => ACTIVE.has(j.state))
  return (
    <div className="jobs-widget">
      <div className="jobs-head">
        <span>Aufgaben{active.length ? ` (${active.length})` : ''}</span>
        <button
          className={state.paused ? 'btn small primary' : 'btn small'}
          title={state.paused ? 'Rechenlast wieder freigeben' : 'Rendern und Analysen anhalten, damit du nebenbei arbeiten kannst'}
          onClick={() => void window.moin.jobAction(state.paused ? 'resumeAll' : 'pauseAll')}
        >
          {state.paused ? '▶ Fortsetzen' : '⏸ Rechenlast pausieren'}
        </button>
      </div>
      {active.length === 0 ? (
        <p className="muted small">Keine laufenden Aufgaben.</p>
      ) : (
        <ul className="jobs-list">
          {active.map((j) => (
            <li key={j.id} className={`job ${j.state}`}>
              <div className="job-title">{j.title}</div>
              <div className="job-step">{j.step}</div>
              {j.state === 'running' && <progress max={100} value={j.progress ?? undefined} />}
              <div className="job-actions">
                {j.state === 'running' && <button className="icon-btn" title="Pausieren" onClick={() => void window.moin.jobAction('pause', j.id)}>⏸</button>}
                {j.state === 'paused' && <button className="icon-btn" title="Fortsetzen" onClick={() => void window.moin.jobAction('resume', j.id)}>▶</button>}
                <button className="icon-btn" title="Abbrechen" onClick={() => void window.moin.jobAction('cancel', j.id)}>✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
