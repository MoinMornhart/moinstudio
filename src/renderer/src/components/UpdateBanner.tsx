import { useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/app'

/** Hinweisleiste oben, sobald eine neue Version verfügbar oder bereit zur Installation ist. */
export function UpdateBanner(): React.JSX.Element | null {
  const status = useUpdateStatus()
  if (status.state === 'available') {
    return (
      <div className="update-banner">
        <span>Neue Version <b>{status.version}</b> verfügbar.</span>
        <button className="btn primary small" onClick={() => void window.moin.downloadUpdate()}>
          Herunterladen
        </button>
      </div>
    )
  }
  if (status.state === 'downloading') {
    return (
      <div className="update-banner">
        <span>Lade Version {status.version} … {status.percent} %</span>
        <progress max={100} value={status.percent} />
      </div>
    )
  }
  if (status.state === 'ready') {
    return (
      <div className="update-banner">
        <span>Version <b>{status.version}</b> ist bereit.</span>
        <button className="btn primary small" onClick={() => void window.moin.installUpdate()}>
          Jetzt neu starten und installieren
        </button>
      </div>
    )
  }
  return null
}

export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  useEffect(() => window.moin.onUpdateStatus(setStatus), [])
  return status
}
