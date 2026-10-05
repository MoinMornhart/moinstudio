import { useState } from 'react'
import type { KalenderLink, KalenderStand } from '@shared/app'

/**
 * Kalender verbinden (Philip, 05.10.): Apple Kalender über iCloud in beide Richtungen, Google, Outlook und andere per
 * iCal-Link zum Anzeigen. Gleicht alle 5 Minuten und nach jeder Kartenänderung ab.
 */

const fehlerText = (e: unknown): string => (e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e))
const FARBEN = ['#4285f4', '#0078d4', '#34a853', '#a142f4', '#e8710a', '#7c8a99']

function seit(iso: string | null): string {
  if (!iso) return 'noch nie'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  return min < 1 ? 'gerade eben' : min < 60 ? `vor ${min} min` : new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function KalenderAbgleich({ stand, neuLaden }: { stand: KalenderStand | null; neuLaden: () => void }): React.JSX.Element {
  const [offen, setOffen] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)
  const [appleId, setAppleId] = useState('')
  const [pw, setPw] = useState('')
  const [link, setLink] = useState({ name: '', url: '' })
  const apple = stand?.apple ?? null
  const links = stand?.links ?? []
  const anzahl = (stand?.termine.length ?? 0)

  const tu = (f: () => Promise<unknown>): void => {
    setFehler(null)
    setLaedt(true)
    f()
      .then(neuLaden, (e: unknown) => setFehler(fehlerText(e)))
      .finally(() => setLaedt(false))
  }
  const speichereLinks = (l: KalenderLink[]): void => tu(() => window.moin.kalenderEinstellen({ links: l }))

  const status = apple?.fehler || links.some((l) => l.fehler) ? 'warn-text' : 'ok-text'
  return (
    <section className="kalender-abgleich">
      <h3>Kalender-Abgleich</h3>
      <p className="small">
        {!apple && !links.length ? (
          <span className="muted">Noch kein Kalender verbunden.</span>
        ) : (
          <span className={status}>
            {stand?.laeuft ? 'Gleicht gerade ab …' : `Abgeglichen ${seit(stand?.stand ?? null)}`} · {anzahl} andere Termine
          </span>
        )}
      </p>
      <div className="row wrap" style={{ marginTop: 0 }}>
        <button className="btn small" onClick={() => setOffen(!offen)}>
          {offen ? 'Fertig' : apple || links.length ? 'Kalender verwalten' : 'Kalender verbinden'}
        </button>
        {(apple || links.length > 0) && (
          <button className="btn small" disabled={laedt || stand?.laeuft} onClick={() => tu(() => window.moin.kalenderJetzt())}>
            Jetzt abgleichen
          </button>
        )}
      </div>
      {apple?.fehler && <p className="warn small">Apple Kalender: {apple.fehler}</p>}
      {links.filter((l) => l.fehler).map((l) => (
        <p key={l.id} className="warn small">
          {l.name}: {l.fehler}
        </p>
      ))}
      {fehler && <p className="warn small">{fehler}</p>}

      {offen && (
        <div className="kalender-verwalten">
          <h4>Apple Kalender (iCloud)</h4>
          {apple?.verbunden ? (
            <>
              <p className="small muted">Verbunden als {apple.benutzer}</p>
              <label className="row small" style={{ marginTop: 0, alignItems: 'center' }}>
                <input type="checkbox" checked={apple.eintragen} onChange={(e) => tu(() => window.moin.kalenderEinstellen({ eintragen: e.target.checked }))} /> Upload-Termine in den Kalender „MoinStudio“ eintragen
              </label>
              <p className="small muted" style={{ margin: 0 }}>
                Anzeigen:
              </p>
              {apple.kalender
                .filter((k) => !k.moin)
                .map((k) => {
                  const an = !apple.ausgeblendet.includes(k.href)
                  return (
                    <label key={k.href} className="row small" style={{ marginTop: 0, alignItems: 'center' }}>
                      <input type="checkbox" checked={an} onChange={() => tu(() => window.moin.kalenderEinstellen({ ausgeblendet: an ? [...apple.ausgeblendet, k.href] : apple.ausgeblendet.filter((x) => x !== k.href) }))} />
                      <span className="punkt-farbe" style={{ background: k.farbe }} /> {k.name}
                    </label>
                  )
                })}
              <button className="btn small" onClick={() => tu(() => window.moin.kalenderAppleTrennen())}>
                Trennen
              </button>
            </>
          ) : (
            <>
              <p className="small muted">
                {apple ? `Auf diesem Gerät fehlt noch das Passwort für ${apple.benutzer}.` : 'Melde dich mit deiner Apple-ID und einem app-spezifischen Passwort an.'} Das Passwort erstellst du auf{' '}
                <a href="https://account.apple.com/account/manage" target="_blank" rel="noreferrer">
                  account.apple.com
                </a>{' '}
                → Anmelden und Sicherheit → App-spezifische Passwörter (Name z. B. „MoinStudio“). Es bleibt verschlüsselt auf diesem Gerät.
              </p>
              <input className="input small" placeholder="Apple-ID (E-Mail)" autoComplete="username" value={appleId || apple?.benutzer || ''} onChange={(e) => setAppleId(e.target.value)} />
              <input className="input small" placeholder="App-spezifisches Passwort (xxxx-xxxx-xxxx-xxxx)" type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} />
              <button
                className="btn small primary"
                disabled={laedt || !pw.trim() || !(appleId || apple?.benutzer)}
                onClick={() =>
                  tu(async () => {
                    await window.moin.kalenderApple(appleId || apple?.benutzer || '', pw)
                    setPw('')
                  })
                }
              >
                {laedt ? 'Prüfe …' : 'Verbinden'}
              </button>
            </>
          )}

          <h4>Google, Outlook und andere</h4>
          <p className="small muted">
            Füge den geheimen iCal-Link ein. Google: Kalender-Einstellungen → dein Kalender → „Privatadresse im iCal-Format“. Outlook: Einstellungen → Kalender → Freigegebene Kalender → Kalender veröffentlichen → ICS-Link.
          </p>
          {links.map((l, i) => (
            <div key={l.id} className="row small" style={{ marginTop: 0, alignItems: 'center' }}>
              <input type="checkbox" checked={l.an} onChange={(e) => speichereLinks(links.map((x) => (x.id === l.id ? { ...x, an: e.target.checked } : x)))} />
              <input type="color" value={l.farbe ?? FARBEN[i % FARBEN.length]} aria-label={`Farbe ${l.name}`} onChange={(e) => speichereLinks(links.map((x) => (x.id === l.id ? { ...x, farbe: e.target.value } : x)))} />
              <span style={{ flex: 1 }}>{l.name}</span>
              <button className="chip-x" aria-label={`${l.name} entfernen`} onClick={() => speichereLinks(links.filter((x) => x.id !== l.id))}>
                ✕
              </button>
            </div>
          ))}
          <input className="input small" placeholder="Name (z. B. Google, Arbeit, Schule)" value={link.name} onChange={(e) => setLink({ ...link, name: e.target.value })} />
          <input className="input small" placeholder="https://… oder webcal://…" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} />
          <button
            className="btn small"
            disabled={laedt || !link.url.trim()}
            onClick={() =>
              tu(async () => {
                await window.moin.kalenderLinkPruefen(link.url)
                const name = link.name.trim() || (/google/i.test(link.url) ? 'Google' : /outlook|live\.com|office/i.test(link.url) ? 'Outlook' : 'Kalender')
                await window.moin.kalenderEinstellen({ links: [...links, { id: '', name, url: link.url, farbe: FARBEN[links.length % FARBEN.length], an: true }] })
                setLink({ name: '', url: '' })
              })
            }
          >
            {laedt ? 'Prüfe …' : 'Kalender hinzufügen'}
          </button>
          <p className="small muted">Tipp: Damit deine Upload-Termine auch in Google oder Outlook erscheinen, gib den iCloud-Kalender „MoinStudio“ am iPhone/Mac als öffentlichen Kalender frei und abonniere den Link dort.</p>
        </div>
      )}
    </section>
  )
}
