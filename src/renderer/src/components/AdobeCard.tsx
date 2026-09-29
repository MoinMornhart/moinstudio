import { useEffect, useState } from 'react'
import type { AdobeStatus } from '@shared/app'
import { Card } from './Panel'

const NAME = { premiere: 'Premiere', photoshop: 'Photoshop', aftereffects: 'After Effects' } as const

/** Adobe in den Einstellungen (ROADMAP 8.2): was gefunden wurde, mit Version. Bleibt „ungetestet“ bis zur Abnahme. */
export function AdobeCard(): React.JSX.Element {
  const [status, setStatus] = useState<AdobeStatus | null>(null)
  const [sucht, setSucht] = useState(false)
  const suche = (neu: boolean): void => {
    setSucht(true)
    void window.moin
      .adobeStatus(neu)
      .then(setStatus)
      .finally(() => setSucht(false))
  }
  useEffect(() => void window.moin.adobeStatus(false).then(setStatus), [])
  return (
    <Card title="Adobe" badge="ungetestet">
      {!status ? (
        <p className="muted">Suche Adobe-Programme …</p>
      ) : status.programme.length === 0 ? (
        <p className="muted">Nicht erkannt – MoinStudio läuft im Modus ohne Adobe. Alles funktioniert auch ohne.</p>
      ) : (
        <>
          <dl className="facts">
            {status.programme.map((p) => (
              <div key={p.pfad} style={{ display: 'contents' }}>
                <dt>{NAME[p.id]}</dt>
                <dd title={p.pfad}>
                  {p.name}
                  {p.version && <span className="muted"> · {p.version}</span>}
                  {p.beta && <span className="badge"> Beta</span>}
                </dd>
              </div>
            ))}
          </dl>
          <p className="muted small">Die Übergabe an Adobe ist noch nicht auf einem Rechner mit Adobe geprüft.</p>
        </>
      )}
      <div className="row">
        <button className="btn small" disabled={sucht} onClick={() => suche(true)}>
          {sucht ? 'Suche …' : 'Neu suchen'}
        </button>
      </div>
    </Card>
  )
}
