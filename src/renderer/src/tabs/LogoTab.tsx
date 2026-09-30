import { useCallback, useEffect, useState } from 'react'
import type { LogoEintrag, LogoErgebnis, LogoExportGroesse, LogoQuelle, ThumbAuftrag } from '@shared/app'
import { Card, PageHeader } from '../components/Panel'
import { useJobs } from '../components/JobsWidget'
import { LogoBild, LogoHochladen } from '../components/LogoWahl'

/**
 * Reiter „Logo“ (Philip, 30.09.): Logos aus einer Beschreibung erstellen (Claude plant, Blender baut mit echten
 * Minecraft-Texturen), in Worten ändern (Verlauf wie beim Thumbnail), hochladen, Bibliothek pflegen und exportieren.
 */

const KANAELE = ['MoinMornhart', 'MoinMorni']
const EXPORTE: { id: LogoExportGroesse; name: string }[] = [
  { id: 512, name: 'PNG 512 px' },
  { id: 1024, name: 'PNG 1024 px' },
  { id: 2048, name: 'PNG 2048 px' },
  { id: 'wasserzeichen', name: 'YouTube-Wasserzeichen 150×150' }
]
const BEISPIELE = ['Kanal-Logo MoinMornhart mit meinem Kopf', 'Serien-Logo „Chained Together“ mit Kette', 'Logo für unseren Server „MoinCraft“ mit Grasblock', 'MoinMorni Gaming in Gold']

function fehlerText(err: unknown): string {
  return err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err)
}

/** Export-Auswahl: Größe wählen, dann Speichern-Dialog */
function Export({ quelle, onGespeichert }: { quelle: LogoQuelle; onGespeichert: (pfad: string) => void }): React.JSX.Element {
  const [groesse, setGroesse] = useState<LogoExportGroesse>(1024)
  return (
    <div className="row wrap" style={{ marginTop: 0 }}>
      <select className="input" value={String(groesse)} onChange={(e) => setGroesse(e.target.value === 'wasserzeichen' ? 'wasserzeichen' : (Number(e.target.value) as LogoExportGroesse))} style={{ flex: '1 1 150px' }}>
        {EXPORTE.map((x) => (
          <option key={x.id} value={String(x.id)}>
            {x.name}
          </option>
        ))}
      </select>
      <button className="btn small" onClick={() => void window.moin.logoExport(quelle, groesse).then((p) => p && onGespeichert(p))}>
        Exportieren …
      </button>
    </div>
  )
}

/** Varianten eines Logo-Auftrags oder einer Änderung */
function Ergebnis({ auftrag, gewaehlt, onWaehle, onBibliothek }: { auftrag: ThumbAuftrag; gewaehlt: number | null; onWaehle: (i: number) => void; onBibliothek: (l: LogoEintrag[]) => void }): React.JSX.Element {
  const [ergebnis, setErgebnis] = useState<LogoErgebnis | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  useEffect(() => {
    if (auftrag.state === 'done') void window.moin.logoErgebnis(auftrag.id).then(setErgebnis)
  }, [auftrag.id, auftrag.state])
  if (auftrag.state === 'failed') return <p className="warn">Fehlgeschlagen: {auftrag.error}</p>
  if (auftrag.state !== 'done')
    return (
      <p className="muted">
        {auftrag.step || 'Wartet …'} {auftrag.progress !== null && `(${Math.round(auftrag.progress)} %)`}
      </p>
    )
  if (!ergebnis) return <p className="muted">Lade Ergebnis …</p>
  return (
    <>
      <div className="variant-grid">
        {ergebnis.varianten.map((x, i) => (
          <figure key={i} className={gewaehlt === i ? 'variant gewaehlt logo-variante' : 'variant logo-variante'}>
            <div className="variant-open">{x.bild ? <img src={x.bild} alt={x.titel} /> : <div className="thumb-placeholder">Kein Bild</div>}</div>
            <figcaption>
              <div className="variant-title">
                <strong>{x.titel}</strong>
              </div>
              {x.fehler && <span className="own-bad small">{x.fehler}</span>}
              {x.warnungen.length > 0 && <span className="own-bad small">Hinweise: {x.warnungen.join(' · ')}</span>}
              {x.bild && (
                <>
                  <div className="row wrap">
                    <button className={gewaehlt === i ? 'btn small primary' : 'btn small'} aria-pressed={gewaehlt === i} onClick={() => onWaehle(i)}>
                      {gewaehlt === i ? '✏️ Gewählt' : '✏️ Ändern'}
                    </button>
                    <button
                      className="btn small"
                      onClick={() =>
                        void window.moin.logoMerken(auftrag.id, i, x.titel.replace(/^Geändert: /, '')).then((l) => {
                          onBibliothek(l)
                          setMeldung('In der Bibliothek gespeichert – jetzt in jedem Thumbnail wählbar.')
                        })
                      }
                    >
                      In Bibliothek
                    </button>
                  </div>
                  <Export quelle={{ job: auftrag.id, variante: i }} onGespeichert={(p) => setMeldung(`Gespeichert: ${p}`)} />
                </>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
      {meldung && <p className="ok-note small">{meldung}</p>}
    </>
  )
}

/** Verlauf wie beim Thumbnail: Auftrag oben, Änderungen darunter, Eingabe unten */
function Verlauf({ auftrag, aenderungen, onNeu, onBibliothek }: { auftrag: ThumbAuftrag; aenderungen: ThumbAuftrag[]; onNeu: () => void; onBibliothek: (l: LogoEintrag[]) => void }): React.JSX.Element {
  const [wahl, setWahl] = useState<{ job: string; variante: number } | null>(null)
  const [text, setText] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [loeschen, setLoeschen] = useState<string | null>(null)
  const schritte = [auftrag, ...aenderungen]
  const neuestes = [...schritte].reverse().find((s) => s.state === 'done')
  const basis = wahl && schritte.some((s) => s.id === wahl.job) ? wahl : neuestes ? { job: neuestes.id, variante: 0 } : null
  const name = (b: { job: string; variante: number }): string => {
    const n = schritte.findIndex((s) => s.id === b.job)
    return n < 0 ? 'einer gelöschten Änderung' : n === 0 ? `Variante ${b.variante + 1}` : `Änderung ${n}`
  }
  const senden = async (): Promise<void> => {
    if (!basis || !text.trim()) return
    setFehler(null)
    try {
      await window.moin.logoAendern(basis.job, basis.variante, text)
      setText('')
      setWahl(null)
      onNeu()
    } catch (err) {
      setFehler(fehlerText(err))
    }
  }
  return (
    <div className="verlauf">
      <Ergebnis auftrag={auftrag} gewaehlt={basis?.job === auftrag.id ? basis.variante : null} onWaehle={(i) => setWahl({ job: auftrag.id, variante: i })} onBibliothek={onBibliothek} />
      {aenderungen.map((a, n) => (
        <div key={a.id} className="verlauf-schritt">
          <div className="verlauf-wunsch">
            <span className="verlauf-nr">Änderung {n + 1}</span>
            <span>„{a.wunsch}“</span>
            {a.basis && (a.basis.job !== (n === 0 ? auftrag.id : aenderungen[n - 1]!.id) || n === 0) && <span className="muted small">an {name(a.basis)}</span>}
            <button
              className="icon-btn"
              title="Diese Änderung löschen"
              onClick={() => {
                if (loeschen === a.id) void window.moin.logoLoeschen(a.id).then(() => (setLoeschen(null), onNeu()))
                else setLoeschen(a.id)
              }}
            >
              {loeschen === a.id ? 'Wirklich löschen?' : '🗑'}
            </button>
          </div>
          <Ergebnis auftrag={a} gewaehlt={basis?.job === a.id ? basis.variante : null} onWaehle={(i) => setWahl({ job: a.id, variante: i })} onBibliothek={onBibliothek} />
        </div>
      ))}
      {basis && (
        <div className="verlauf-eingabe">
          <span className="muted small">Ändert: {name(basis)}</span>
          <div className="row">
            <input
              className="input"
              placeholder="Änderung, z. B. in Rot, Text MOINCRAFT, Creeper-Kopf statt meinem, mehr schräg"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && text.trim() && void senden()}
            />
            <button className="btn primary" disabled={!text.trim()} onClick={() => void senden()}>
              Ändern
            </button>
          </div>
          {fehler && <p className="warn small">{fehler}</p>}
        </div>
      )}
    </div>
  )
}

/** Logo-Bibliothek: Vorschau, umbenennen, Standard je Kanal, exportieren, löschen */
function Bibliothek({ logos, setLogos }: { logos: LogoEintrag[]; setLogos: (l: LogoEintrag[]) => void }): React.JSX.Element {
  const [loeschen, setLoeschen] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  return (
    <Card title="Logo-Bibliothek" badge={`${logos.length}`}>
      <p className="muted small">Diese Logos kannst du in jedem Thumbnail wählen. Das Standard-Logo eines Kanals ist dort schon vorausgewählt.</p>
      {logos.length === 0 && <p className="muted">Noch keine Logos. Erstelle eins oben oder lade eins hoch (PNG, JPG oder SVG – ohne Transparenz wird der Hintergrund entfernt).</p>}
      <ul className="logo-grid">
        {logos.map((l) => (
          <li key={l.id} className="logo-tile">
            <LogoBild id={l.id} hoehe={90} />
            <input className="input" defaultValue={l.name} onBlur={(e) => e.target.value.trim() && e.target.value !== l.name && void window.moin.logoEintrag(l.id, { name: e.target.value }).then(setLogos)} />
            <span className="muted small">
              {l.quelle === 'erstellt' ? 'Erstellt' : 'Hochgeladen'} · {l.breite}×{l.hoehe}
            </span>
            <div className="row wrap" style={{ marginTop: 0 }}>
              {KANAELE.map((k) => {
                const an = l.standard.includes(k)
                return (
                  <button key={k} className={an ? 'chip on' : 'chip'} style={{ paddingLeft: 10 }} title={an ? `Standard-Logo für ${k} – klicken zum Abwählen` : `Als Standard-Logo für ${k}`} onClick={() => void window.moin.logoEintrag(l.id, { standard: { kanal: k, an: !an } }).then(setLogos)}>
                    {an ? '★' : '☆'} {k}
                  </button>
                )
              })}
            </div>
            <Export quelle={{ logo: l.id }} onGespeichert={(p) => setMeldung(`Gespeichert: ${p}`)} />
            <button
              className="btn small"
              onClick={() => {
                if (loeschen === l.id) void window.moin.logoEintrag(l.id, { entfernen: true }).then((x) => (setLoeschen(null), setLogos(x)))
                else setLoeschen(l.id)
              }}
            >
              {loeschen === l.id ? 'Wirklich löschen?' : 'Löschen'}
            </button>
          </li>
        ))}
      </ul>
      {meldung && <p className="ok-note small">{meldung}</p>}
      <div className="row wrap">
        <LogoHochladen onFertig={setLogos} />
      </div>
    </Card>
  )
}

export function LogoTab(): React.JSX.Element {
  const jobs = useJobs()
  const [beschreibung, setBeschreibung] = useState('')
  const [kanal, setKanal] = useState(KANAELE[0]!)
  const [anzahl, setAnzahl] = useState(3)
  const [fehler, setFehler] = useState<string | null>(null)
  const [auftraege, setAuftraege] = useState<ThumbAuftrag[]>([])
  const [logos, setLogos] = useState<LogoEintrag[]>([])
  const [offen, setOffen] = useState<string | null>(null)
  const [loeschen, setLoeschen] = useState<string | null>(null)
  useEffect(() => {
    void window.moin.logoListe().then(setLogos, (err: unknown) => setFehler(fehlerText(err)))
  }, [])
  const ladeAuftraege = useCallback(() => void window.moin.logoAuftraege().then(setAuftraege), [])
  useEffect(ladeAuftraege, [jobs, ladeAuftraege])
  const start = async (): Promise<void> => {
    setFehler(null)
    try {
      const id = await window.moin.logoStart({ beschreibung, kanal, anzahl })
      setOffen(id)
      setBeschreibung('')
      ladeAuftraege()
    } catch (err) {
      setFehler(fehlerText(err))
    }
  }
  const haupt = auftraege.filter((a) => !a.eltern || !auftraege.some((x) => x.id === a.eltern))
  const zuAuftrag = (id: string): ThumbAuftrag[] => auftraege.filter((a) => a.eltern === id).sort((x, y) => x.createdAt.localeCompare(y.createdAt))
  return (
    <>
      <PageHeader title="Logo" subtitle="Kanal-, Serien- und Server-Logos in Minecraft-Blockschrift – mit echten Texturen, Items und Köpfen, immer mit transparentem Hintergrund." />
      {fehler && <p className="warn">{fehler}</p>}
      <div className="grid">
        <Card title="Neues Logo">
          <textarea className="input" rows={3} placeholder="z. B. Serien-Logo „Chained Together“ mit Kette" value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} />
          <div className="row wrap wunsch-beispiele">
            {BEISPIELE.map((b) => (
              <button key={b} className="chip" onClick={() => setBeschreibung(b)}>
                {b}
              </button>
            ))}
          </div>
          <div className="row wrap">
            <select className="input" value={kanal} onChange={(e) => setKanal(e.target.value)} style={{ flex: '0 0 170px' }}>
              {KANAELE.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <select className="input" value={anzahl} onChange={(e) => setAnzahl(Number(e.target.value))} style={{ flex: '0 0 140px' }}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'Variante' : 'Varianten'}
                </option>
              ))}
            </select>
            <button className="btn primary" disabled={beschreibung.trim().length < 2} onClick={() => void start()}>
              Logo erstellen
            </button>
          </div>
        </Card>
        <Bibliothek logos={logos} setLogos={setLogos} />
        <Card title="Aufträge" badge={`${haupt.length}`}>
          {haupt.length === 0 && <p className="muted">Noch keine Logos erstellt.</p>}
          {haupt.map((a) => {
            const aenderungen = zuAuftrag(a.id)
            const laeuft = [a, ...aenderungen].some((x) => !['done', 'failed', 'cancelled'].includes(x.state))
            return (
              <div key={a.id} className="session">
                <div className="session-head" style={{ cursor: 'pointer' }} onClick={() => setOffen(offen === a.id ? null : a.id)}>
                  <strong className="session-title">{a.titel.replace(/^Logo: /, '')}</strong>
                  {aenderungen.length > 0 && (
                    <span className="muted small">
                      {aenderungen.length} {aenderungen.length === 1 ? 'Änderung' : 'Änderungen'}
                    </span>
                  )}
                  <span className={`status ${a.state === 'done' ? 'fertig' : a.state === 'failed' ? 'fehler' : 'rendert'}`}>
                    {a.state === 'done' ? 'fertig' : a.state === 'failed' ? 'Fehler' : a.state === 'paused' ? 'pausiert' : a.state === 'waiting-limit' ? 'wartet auf Claude-Limit' : 'läuft'}
                  </span>
                  <button
                    className="icon-btn"
                    title={aenderungen.length ? 'Auftrag mit allen Änderungen löschen' : 'Auftrag löschen'}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (loeschen === a.id) void window.moin.logoLoeschen(a.id).then(() => (setLoeschen(null), ladeAuftraege()))
                      else setLoeschen(a.id)
                    }}
                  >
                    {loeschen === a.id ? 'Wirklich löschen?' : '🗑'}
                  </button>
                </div>
                {(offen === a.id || laeuft) && (
                  <Verlauf
                    auftrag={a}
                    aenderungen={aenderungen}
                    onNeu={() => {
                      setOffen(a.id)
                      ladeAuftraege()
                    }}
                    onBibliothek={setLogos}
                  />
                )}
              </div>
            )
          })}
        </Card>
      </div>
    </>
  )
}
