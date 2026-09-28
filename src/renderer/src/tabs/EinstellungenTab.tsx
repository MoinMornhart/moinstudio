import { useEffect, useState } from 'react'
import type { AppInfo, AutostartState, UpdateStatus } from '@shared/app'
import { useUpdateStatus } from '../components/UpdateBanner'
import { Card, PageHeader } from '../components/Panel'
import { DataDirCard } from '../components/DataDirCard'
import { ToolsCard } from '../components/ToolsCard'
import { HardwareCard } from '../components/HardwareCard'
import { ClaudeCard } from '../components/ClaudeCard'

function AutostartSwitch(): React.JSX.Element {
  const [state, setState] = useState<AutostartState | null>(null)
  useEffect(() => {
    void window.moin.getAutostart().then(setState)
  }, [])
  if (!state) return <p className="muted">Lade …</p>
  return (
    <label className={state.available ? 'switch' : 'switch disabled'}>
      <input
        type="checkbox"
        checked={state.enabled}
        disabled={!state.available}
        onChange={(e) => void window.moin.setAutostart(e.target.checked).then(setState)}
      />
      <span>Mit Windows starten</span>
      {!state.available && <small className="muted"> (nur in der installierten App)</small>}
    </label>
  )
}

function updateText(s: UpdateStatus): string {
  switch (s.state) {
    case 'dev': return 'In der Entwicklungsumgebung nicht verfügbar.'
    case 'idle': return 'Noch nicht geprüft.'
    case 'checking': return 'Suche nach Updates …'
    case 'none': return `Du hast die neueste Version (${s.version}).`
    case 'available': return `Version ${s.version} ist verfügbar.`
    case 'downloading': return `Lade Version ${s.version} … ${s.percent} %`
    case 'ready': return `Version ${s.version} ist bereit zur Installation.`
    case 'error': return `Fehler: ${s.message}`
  }
}

function UpdateCard(): React.JSX.Element {
  const live = useUpdateStatus()
  const [checked, setChecked] = useState<UpdateStatus | null>(null)
  const status = live.state === 'idle' && checked ? checked : live
  return (
    <Card title="Updates">
      <p className="muted">{updateText(status)}</p>
      <div className="row">
        <button className="btn" disabled={status.state === 'checking' || status.state === 'downloading'} onClick={() => void window.moin.checkForUpdate().then(setChecked)}>
          Nach Updates suchen
        </button>
        {status.state === 'available' && (
          <button className="btn primary" onClick={() => void window.moin.downloadUpdate()}>Herunterladen</button>
        )}
        {status.state === 'ready' && (
          <button className="btn primary" onClick={() => void window.moin.installUpdate()}>Neu starten und installieren</button>
        )}
      </div>
    </Card>
  )
}

export function EinstellungenTab({ info }: { info: AppInfo | null }): React.JSX.Element {
  return (
    <>
      <PageHeader title="Einstellungen" subtitle="Datenordner, Hardware, Claude-Anbindung und Updates." />
      <div className="grid">
        <DataDirCard />
        <ClaudeCard />
        <HardwareCard />
        <ToolsCard />
        <Card title="Über MoinStudio">
          {info ? (
            <dl className="facts">
              <dt>Version</dt><dd>{info.version}</dd>
              <dt>System</dt><dd>{info.platform} / {info.arch}</dd>
              <dt>Electron</dt><dd>{info.electron}</dd>
              <dt>Chromium</dt><dd>{info.chrome}</dd>
              <dt>Node</dt><dd>{info.node}</dd>
            </dl>
          ) : (
            <p className="muted">Lade …</p>
          )}
          <div className="row">
            <button className="btn" onClick={() => void window.moin.openLogs()}>Protokolle öffnen</button>
            <button className="btn" onClick={() => void window.moin.setupComplete(false).then(() => window.location.reload())}>
              Einrichtung erneut starten
            </button>
          </div>
        </Card>
        <UpdateCard />
        <Card title="Start">
          <AutostartSwitch />
        </Card>
        <Card title="Adobe" badge="ungetestet">
          <p className="muted">Nicht erkannt – MoinStudio läuft im Modus ohne Adobe.</p>
        </Card>
      </div>
    </>
  )
}
