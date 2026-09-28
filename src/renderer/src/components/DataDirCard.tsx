import { useEffect, useState } from 'react'
import type { DataDirStatus } from '@shared/app'
import { Card } from './Panel'

/** Datenordner wählen/öffnen und OneDrive-Konflikte anzeigen. */
export function DataDirCard(): React.JSX.Element {
  const [status, setStatus] = useState<DataDirStatus | null>(null)
  useEffect(() => {
    void window.moin.dataStatus().then(setStatus)
  }, [])

  const choose = async (): Promise<void> => {
    const next = await window.moin.chooseDataDir()
    if (next) setStatus(next)
  }

  return (
    <Card title="Datenordner" badge={status?.conflicts.length ? `${status.conflicts.length} Konflikt(e)` : undefined}>
      {!status ? (
        <p className="muted">Lade …</p>
      ) : !status.dataDir ? (
        <p className="muted">
          Noch kein Datenordner gewählt. Hier liegen Skins, Freunde, Requisiten, Planung und Projekte. Wähle zum Beispiel
          einen Ordner in OneDrive, damit PC und Laptop dieselben Daten haben.
        </p>
      ) : (
        <>
          <p className="path">{status.dataDir}</p>
          {!status.available && (
            <p className="warn">Ordner nicht gefunden. Ist OneDrive angemeldet bzw. das Laufwerk verbunden?</p>
          )}
          {status.conflicts.length > 0 && (
            <div className="warn">
              OneDrive hat Konfliktkopien angelegt (dieselbe Datei wurde auf zwei Geräten geändert):
              <ul>
                {status.conflicts.map((c) => (
                  <li key={c.copy}>
                    <code>{c.copy}</code> ↔ <code>{c.original}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <div className="row">
        <button className="btn primary" onClick={() => void choose()}>
          {status?.dataDir ? 'Anderen Ordner wählen …' : 'Ordner wählen …'}
        </button>
        {status?.dataDir && status.available && (
          <button className="btn" onClick={() => void window.moin.openDataDir()}>Im Explorer öffnen</button>
        )}
      </div>
    </Card>
  )
}
