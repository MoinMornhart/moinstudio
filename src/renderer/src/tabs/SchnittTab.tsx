import { useCallback, useEffect, useRef, useState } from 'react'
import type { SchnittAbschnitt, SchnittExport, SchnittHighlight, SchnittListe, SchnittProjekt } from '@shared/app'
import { Card, PageHeader } from '../components/Panel'
import { abholen, OEFFNE_EREIGNIS } from '../navigation'

/**
 * Schnitt-Reiter (ROADMAP 6.x): Rohvideo rein, fertiges Video raus. 6.2: Projekte, Import mit Vorschau, Wellenform
 * und Standbild-Leiste; die weiteren Schritte (Transkript, Rohschnitt, Untertitel, Export) kommen hier dazu.
 */

const KANAELE = ['MoinMornhart', 'MoinMorni']

function zeitText(sek: number): string {
  const h = Math.floor(sek / 3600)
  const m = Math.floor((sek % 3600) / 60)
  const s = Math.floor(sek % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

function groesseText(bytes: number): string {
  return bytes > 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`
}

/** Wellenform mit Abspielposition; Klick springt an die Stelle. */
function Wellenform({ id, dauer, zeit, springe }: { id: string; dauer: number; zeit: number; springe: (s: number) => void }): React.JSX.Element | null {
  const [daten, setDaten] = useState<{ aufloesung: number; werte: number[] } | null>(null)
  const leinwand = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    void window.moin.schnittWellenform(id).then(setDaten)
  }, [id])
  useEffect(() => {
    const c = leinwand.current
    if (!c || !daten) return
    const g = c.getContext('2d')
    if (!g) return
    const w = (c.width = c.clientWidth * devicePixelRatio)
    const h = (c.height = 64 * devicePixelRatio)
    g.clearRect(0, 0, w, h)
    const n = daten.werte.length
    g.fillStyle = '#f0a83a'
    for (let x = 0; x < w; x++) {
      const a = Math.floor((x / w) * n)
      const b = Math.max(a + 1, Math.floor(((x + 1) / w) * n))
      let spitze = 0
      for (let i = a; i < b; i++) spitze = Math.max(spitze, daten.werte[i] ?? 0)
      const hoehe = Math.max(1, (spitze / 100) * h)
      g.fillRect(x, (h - hoehe) / 2, 1, hoehe)
    }
    g.fillStyle = '#ffffff'
    g.fillRect((zeit / dauer) * w, 0, 2 * devicePixelRatio, h)
  }, [daten, zeit, dauer])
  if (!daten) return null
  return (
    <canvas
      ref={leinwand}
      className="wellenform"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        springe(((e.clientX - r.left) / r.width) * dauer)
      }}
    />
  )
}

const GRUND: Record<SchnittListe['entfernt'][number]['grund'], string> = {
  pause: 'Pause',
  aehm: '„ähm“',
  wiederholung: 'Wiederholung',
  versprecher: 'Versprecher',
  leerlauf: 'Leerlauf',
  manuell: 'von dir'
}

/** Rohschnitt: vorher/nachher, was rausfliegt (Klick springt hin). */
function Rohschnitt({ id, liste, setListe, springe }: { id: string; liste: SchnittListe; setListe: (l: SchnittListe) => void; springe: (s: number) => void }): React.JSX.Element {
  const nachher = liste.behalten.reduce((s, b) => s + b.ende - b.start, 0)
  const [pausenZeigen, setPausenZeigen] = useState(false)
  const [wunsch, setWunsch] = useState('')
  const [meldung, setMeldung] = useState<string | null>(null)
  const umschalten = (i: number): void => void window.moin.schnittUmschalten(id, i).then(setListe)
  const senden = async (): Promise<void> => {
    setMeldung(null)
    try {
      await window.moin.schnittWunsch(id, wunsch)
      setWunsch('')
      setMeldung('Claude arbeitet deinen Wunsch ein …')
    } catch (err) {
      setMeldung(err instanceof Error ? err.message : String(err))
    }
  }
  return (
    <div className="rohschnitt">
      <p>
        <strong>Rohschnitt:</strong> {zeitText(liste.dauer)} → {zeitText(nachher)} ({Math.round((1 - nachher / liste.dauer) * 100)} % kürzer)
      </p>
      <div className="schnitt-streifen">
        {liste.entfernt.map((e, i) => (
          <span key={i} className={`weg ${e.grund}${e.aus ? ' aus' : ''}`} style={{ left: `${(e.start / liste.dauer) * 100}%`, width: `${((e.ende - e.start) / liste.dauer) * 100}%` }} title={`${GRUND[e.grund]} ${zeitText(e.start)}`} />
        ))}
      </div>
      <div className="transkript">
        {liste.entfernt.map((e, i) =>
          e.grund === 'pause' && !pausenZeigen ? null : (
            <div key={i} className={e.aus ? 'schnittstelle aus' : 'schnittstelle'}>
              <button className="satz" onClick={() => springe(Math.max(0, e.start - 1))}>
                <span className="muted small">{zeitText(e.start)}</span>
                <span>
                  <span className="badge">{GRUND[e.grund]}</span> {e.text ?? `${(e.ende - e.start).toFixed(1)} s`}
                </span>
              </button>
              <button className="btn small" title={e.aus ? 'Wieder rausschneiden' : 'Doch drinlassen'} onClick={() => umschalten(i)}>
                {e.aus ? 'bleibt drin' : 'raus'}
              </button>
            </div>
          )
        )}
        <button className="btn small" onClick={() => setPausenZeigen((z) => !z)}>
          {pausenZeigen ? 'Pausen ausblenden' : `${liste.entfernt.filter((e) => e.grund === 'pause').length} gekürzte Pausen zeigen`}
        </button>
      </div>
      <div className="row wrap">
        <input
          className="input"
          placeholder="Änderung in Worten, z. B. lass die Stelle mit dem Creeper länger drin"
          value={wunsch}
          onChange={(e) => setWunsch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && wunsch.trim() && void senden()}
        />
        <button className="btn" disabled={!wunsch.trim()} onClick={() => void senden()}>
          Ändern
        </button>
        {meldung && <p className="muted small">{meldung}</p>}
      </div>
    </div>
  )
}

/** Transkript: jeder Satz mit Zeit, Klick springt hin, der gerade laufende Satz ist hervorgehoben. */
function Transkript({
  id,
  bereit,
  zeit,
  springe,
  liste,
  setListe
}: {
  id: string
  bereit: boolean
  zeit: number
  springe: (s: number) => void
  liste: SchnittListe | null
  setListe: (l: SchnittListe) => void
}): React.JSX.Element | null {
  const [abschnitte, setAbschnitte] = useState<SchnittAbschnitt[] | null>(null)
  useEffect(() => {
    if (bereit) void window.moin.schnittTranskript(id).then(setAbschnitte)
  }, [id, bereit])
  if (!abschnitte) return null
  // Satz gilt als rausgeschnitten, wenn aktive Schnitte mehr als die Hälfte davon abdecken
  const raus = (a: SchnittAbschnitt): boolean =>
    !!liste && liste.entfernt.filter((e) => !e.aus).reduce((s, e) => s + Math.max(0, Math.min(e.ende, a.ende) - Math.max(e.start, a.start)), 0) > (a.ende - a.start) / 2
  return (
    <div className="transkript">
      <div className="card-head">
        <h2>Transkript</h2>
        <button className="btn small" onClick={() => void window.moin.schnittTranskriptStart(id)}>
          Neu erstellen
        </button>
      </div>
      {abschnitte.length === 0 && <p className="muted">Im Video wurde nichts gesprochen.</p>}
      {abschnitte.map((a) => {
        const weg = raus(a)
        return (
          <div key={a.start} className={weg ? 'schnittstelle aus' : 'schnittstelle'}>
            <button className={zeit >= a.start && zeit < a.ende ? 'satz aktiv' : 'satz'} onClick={() => springe(a.start)}>
              <span className="muted small">{zeitText(a.start)}</span>
              <span>{a.text}</span>
            </button>
            {liste && (
              <button className="btn small" title={weg ? 'Satz zurückholen' : 'Satz rausschneiden'} onClick={() => void window.moin.schnittBereich(id, a.start - 0.05, a.ende + 0.1, !weg, a.text).then(setListe)}>
                {weg ? 'zurück' : 'raus'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Export für YouTube: Datei, Prüfung, Titel, Beschreibung, Kapitel, Speichern, Thumbnail-Vorschläge. */
function Export({ p, neuLaden }: { p: SchnittProjekt; neuLaden: () => void }): React.JSX.Element {
  const [info, setInfo] = useState<SchnittExport | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  useEffect(() => {
    if (p.exportiert && !p.auftrag) void window.moin.schnittExportInfo(p.id).then(setInfo)
  }, [p.id, p.exportiert, p.auftrag])
  const kopieren = (t: string): void => void navigator.clipboard.writeText(t).then(() => setMeldung('Kopiert.'))
  return (
    <div className="schnitt-fertig">
      <div className="card-head">
        <h2>Export für YouTube</h2>
      </div>
      <p className="muted small">Volle Qualität aus dem Original, nach YouTubes Upload-Empfehlung, mit Kapiteln, Titel- und Beschreibungsvorschlag.</p>
      <div className="row wrap">
        <button className="btn primary" disabled={!!p.auftrag} onClick={() => void window.moin.schnittExport(p.id).then(neuLaden)}>
          {p.exportiert ? 'Neu exportieren' : 'Exportieren'}
        </button>
        <button
          className="btn"
          title="Sequenz mit allen Schnitten, Zooms und Kapitel-Markern plus Untertitel (SRT) zum Weiterschneiden in Premiere – noch nicht mit Premiere getestet"
          onClick={() =>
            void window.moin.schnittPremiere(p.id).then(
              (r) => setMeldung(`Für Premiere gespeichert: ${r.xml}${r.srt ? ' (+ Untertitel)' : ''}. In Premiere: Datei → Importieren.`),
              (e: unknown) => setMeldung(String(e))
            )
          }
        >
          Für Premiere (ungetestet)
        </button>
        {info && (
          <>
            <button className="btn" onClick={() => void window.moin.schnittExportSpeichern(p.id).then((f) => f && setMeldung(`Gespeichert: ${f}`))}>
              Speichern unter …
            </button>
            <button className="btn" onClick={() => void window.moin.schnittThumbnail(p.id).then(() => setMeldung('Thumbnail-Vorschläge laufen – siehe Reiter Thumbnail.'))}>
              Thumbnail-Vorschläge
            </button>
          </>
        )}
      </div>
      {meldung && <p className="ok-note small">{meldung}</p>}
      {info && (
        <>
          <video className="schnitt-player" src={info.url} controls preload="metadata" style={{ marginTop: 10 }} />
          <ul className="pruefliste">
            {info.pruefung.map((x) => (
              <li key={x.punkt} className={x.ok ? 'own-ok' : 'own-bad'}>
                {x.ok ? '✓' : '✗'} {x.punkt} <span className="muted small">({x.wert})</span>
              </li>
            ))}
          </ul>
          <dl className="facts">
            <dt>Titel</dt>
            <dd>
              {info.titel.map((t) => (
                <button key={t} className="chip" onClick={() => kopieren(t)} title="Kopieren">
                  {t}
                </button>
              ))}
            </dd>
            <dt>Beschreibung</dt>
            <dd>
              <button className="satz" onClick={() => kopieren(`${info.beschreibung}${info.kapitelText ? `\n\n${info.kapitelText}` : ''}`)} title="Mit Kapiteln kopieren">
                <span />
                <span style={{ whiteSpace: 'pre-wrap' }}>
                  {info.beschreibung}
                  {info.kapitelText ? `\n\n${info.kapitelText}` : ''}
                </span>
              </button>
            </dd>
          </dl>
        </>
      )}
    </div>
  )
}

/** Stream-Highlights und Shorts: Höhepunkte finden, als Clip (16:9) oder Short (9:16) exportieren. */
function Highlights({ p, springe, neuLaden }: { p: SchnittProjekt; springe: (s: number) => void; neuLaden: () => void }): React.JSX.Element {
  const [liste, setListe] = useState<SchnittHighlight[] | null>(null)
  const [clips, setClips] = useState<{ name: string; url: string }[]>([])
  useEffect(() => {
    if (p.highlights !== null && !p.auftrag) void window.moin.schnittHighlights(p.id).then(setListe)
    if (p.clipsStand && !p.auftrag) void window.moin.schnittClipDateien(p.id).then(setClips)
  }, [p.id, p.highlights, p.clipsStand, p.auftrag])
  const exportiere = (auswahl: { index: number; art: 'clip' | 'short' }[]): void => void window.moin.schnittClips(p.id, auswahl).then(neuLaden)
  return (
    <div className="schnitt-fertig">
      <div className="card-head">
        <h2>Highlights und Shorts</h2>
      </div>
      <p className="muted small">Für Streams: MoinStudio findet die stärksten Momente und macht daraus Clips oder Shorts im Hochformat (Facecam oben, Gameplay unten, Untertitel Wort für Wort).</p>
      <div className="row wrap">
        <button className="btn" disabled={!!p.auftrag || !p.transkript} onClick={() => void window.moin.schnittHighlightsStart(p.id).then(neuLaden)}>
          {p.highlights === null ? 'Höhepunkte finden' : 'Neu suchen'}
        </button>
        {liste && liste.length > 0 && (
          <button className="btn primary" disabled={!!p.auftrag} onClick={() => exportiere(liste.map((_, index) => ({ index, art: 'short' as const })))}>
            Alle als Shorts
          </button>
        )}
      </div>
      {liste && liste.length === 0 && <p className="muted">Keine starken Momente gefunden.</p>}
      {liste?.map((h, i) => (
        <div key={i} className="schnittstelle">
          <button className="satz" onClick={() => springe(h.start)}>
            <span className="muted small">{zeitText(h.start)}</span>
            <span>
              <strong>{h.titel}</strong> <span className="badge">{h.wert}/10</span>
              <span className="muted small"> {Math.round(h.ende - h.start)} s · {h.grund}</span>
            </span>
          </button>
          <span className="row" style={{ marginTop: 0 }}>
            <button className="btn small" disabled={!!p.auftrag} onClick={() => exportiere([{ index: i, art: 'clip' }])}>
              Clip
            </button>
            <button className="btn small" disabled={!!p.auftrag} onClick={() => exportiere([{ index: i, art: 'short' }])}>
              Short
            </button>
          </span>
        </div>
      ))}
      {clips.length > 0 && (
        <>
          <div className="clip-raster">
            {clips.map((c) => (
              <figure key={c.name} className={c.name.includes('short') ? 'hoch' : ''}>
                <video src={c.url} controls preload="metadata" />
                <figcaption className="muted small">{c.name}</figcaption>
              </figure>
            ))}
          </div>
          <button className="btn small" onClick={() => void window.moin.schnittClipOrdner(p.id)}>
            Ordner mit den Clips öffnen
          </button>
        </>
      )}
    </div>
  )
}

function ProjektAnsicht({ p, zurueck, loeschen, neuLaden }: { p: SchnittProjekt; zurueck: () => void; loeschen: () => void; neuLaden: () => void }): React.JSX.Element {
  const video = useRef<HTMLVideoElement>(null)
  const [zeit, setZeit] = useState(0)
  const [sicher, setSicher] = useState(false)
  const [liste, setListe] = useState<SchnittListe | null>(null)
  const [geschnitten, setGeschnitten] = useState(true)
  // neu laden, wenn der Rohschnitt fertig ist oder ein Auftrag (z. B. ein Änderungswunsch) endet
  useEffect(() => {
    if (p.rohschnitt && !p.auftrag) void window.moin.schnittListe(p.id).then(setListe)
  }, [p.id, p.rohschnitt, p.auftrag])
  const dauer = p.quelle?.dauer ?? 0
  // Vorschau des Schnitts: entfernte Stellen werden beim Abspielen übersprungen
  const zeitUpdate = (t: number): void => {
    setZeit(t)
    if (!geschnitten || !liste || !video.current || video.current.paused) return
    const weg = liste.entfernt.find((e) => t >= e.start && t < e.ende - 0.05)
    if (weg) video.current.currentTime = Math.max(...liste.entfernt.filter((e) => e.start <= weg.ende + 0.05 && e.ende >= weg.start).map((e) => e.ende))
  }
  const springe = (s: number): void => {
    if (video.current) video.current.currentTime = Math.max(0, Math.min(dauer, s))
  }
  return (
    <Card title={p.name} badge={p.kanal}>
      <div className="row wrap" style={{ marginTop: 0, marginBottom: 12 }}>
        <button className="btn small" onClick={zurueck}>
          ← Alle Projekte
        </button>
        <button className="btn small" onClick={() => (sicher ? loeschen() : setSicher(true))}>
          {sicher ? 'Wirklich löschen? (Rohvideo bleibt)' : 'Projekt löschen'}
        </button>
      </div>
      {p.auftrag && (
        <p className={p.auftrag.state === 'failed' ? 'warn' : 'muted'}>
          {p.auftrag.state === 'failed' ? `Fehler: ${p.auftrag.error}` : `${p.auftrag.step || 'Wartet …'}${p.auftrag.progress !== null ? ` (${Math.round(p.auftrag.progress)} %)` : ''}`}
        </p>
      )}
      {p.proxyUrl ? (
        <video ref={video} className="schnitt-player" src={p.proxyUrl} controls preload="metadata" onTimeUpdate={(e) => zeitUpdate(e.currentTarget.currentTime)} />
      ) : (
        <div className="thumb-placeholder schnitt-player">Vorschau wird erstellt …</div>
      )}
      {p.wellenform && dauer > 0 && <Wellenform id={p.id} dauer={dauer} zeit={zeit} springe={springe} />}
      {p.leisteUrl && dauer > 0 && (
        <img
          className="schnitt-leiste"
          src={p.leisteUrl}
          alt="Standbild-Leiste"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            springe(((e.clientX - r.left) / r.width) * dauer)
          }}
        />
      )}
      {liste && (
        <label className="row" style={{ alignItems: 'center' }}>
          <input type="checkbox" checked={geschnitten} onChange={(e) => setGeschnitten(e.target.checked)} /> Geschnitten abspielen (entfernte Stellen überspringen)
        </label>
      )}
      {liste && <Rohschnitt id={p.id} liste={liste} setListe={setListe} springe={springe} />}
      {liste && (
        <div className="schnitt-fertig">
          <div className="card-head">
            <h2>Fertiger Schnitt</h2>
          </div>
          <div className="row wrap" style={{ marginTop: 0 }}>
            <select className="input" style={{ flex: '0 0 200px' }} value={p.einstellungen.untertitel} onChange={(e) => void window.moin.schnittEinstellungen(p.id, { untertitel: e.target.value as 'aus' | 'an' | 'karaoke' }).then(neuLaden)}>
              <option value="aus">Keine Untertitel</option>
              <option value="an">Untertitel</option>
              <option value="karaoke">Untertitel Wort für Wort</option>
            </select>
            <label className="row" style={{ alignItems: 'center', marginTop: 0 }}>
              <input type="checkbox" checked={p.einstellungen.zooms} onChange={(e) => void window.moin.schnittEinstellungen(p.id, { zooms: e.target.checked }).then(neuLaden)} /> Zooms auf Höhepunkte
            </label>
            <button className="btn primary" disabled={!!p.auftrag} onClick={() => void window.moin.schnittVorschau(p.id).then(neuLaden)}>
              Vorschau rendern
            </button>
          </div>
          {p.vorschauUrl && <video className="schnitt-player" src={p.vorschauUrl} controls preload="metadata" style={{ marginTop: 10 }} />}
        </div>
      )}
      {liste && <Export p={p} neuLaden={neuLaden} />}
      {p.transkript && <Highlights p={p} springe={springe} neuLaden={neuLaden} />}
      <Transkript id={p.id} bereit={p.transkript} zeit={zeit} springe={springe} liste={liste} setListe={setListe} />
      {p.quelle && (
        <dl className="facts" style={{ marginTop: 12 }}>
          <dt>Länge</dt>
          <dd>{zeitText(p.quelle.dauer)}</dd>
          <dt>Bild</dt>
          <dd>
            {p.quelle.breite}×{p.quelle.hoehe}, {p.quelle.fps} fps{p.quelle.audio ? '' : ', ohne Ton'}
          </dd>
          <dt>Rohvideo</dt>
          <dd title={p.quelle.pfad}>
            {p.quelle.pfad.split(/[\\/]/).pop()} ({groesseText(p.quelle.groesse)}) – bleibt, wo es liegt
          </dd>
        </dl>
      )}
    </Card>
  )
}

export function SchnittTab(): React.JSX.Element {
  const [projekte, setProjekte] = useState<SchnittProjekt[]>([])
  const [offen, setOffen] = useState<string | null>(() => abholen('schnitt'))
  const [kanal, setKanal] = useState(KANAELE[0]!)
  useEffect(() => {
    const sprung = (e: Event): void => {
      const d = (e as CustomEvent<{ tab: string; ziel?: string }>).detail
      if (d.tab === 'schnitt' && abholen('schnitt')) setOffen(d.ziel ?? null)
    }
    window.addEventListener(OEFFNE_EREIGNIS, sprung)
    return () => window.removeEventListener(OEFFNE_EREIGNIS, sprung)
  }, [])
  const [fehler, setFehler] = useState<string | null>(null)
  const laden = useCallback(() => void window.moin.schnittProjekte().then(setProjekte, (e: unknown) => setFehler(String(e))), [])
  useEffect(laden, [laden])
  // solange etwas läuft, alle 2 Sekunden auffrischen
  const laeuft = projekte.some((p) => p.auftrag && p.auftrag.state !== 'failed')
  useEffect(() => {
    if (!laeuft) return
    const t = setInterval(laden, 2000)
    return () => clearInterval(t)
  }, [laeuft, laden])

  const importieren = async (): Promise<void> => {
    setFehler(null)
    try {
      const id = await window.moin.schnittImport(kanal)
      if (id) {
        setOffen(id)
        laden()
      }
    } catch (err) {
      setFehler(err instanceof Error ? err.message : String(err))
    }
  }
  const aktiv = projekte.find((p) => p.id === offen)

  return (
    <>
      <PageHeader title="Schnitt" subtitle="Rohvideo rein, fertiges Video raus – MoinStudio schneidet, du schaust nur noch drüber." />
      {fehler && <p className="warn">{fehler}</p>}
      <div className="grid">
        {aktiv ? (
          <ProjektAnsicht
            p={aktiv}
            neuLaden={laden}
            zurueck={() => setOffen(null)}
            loeschen={() =>
              void window.moin.schnittLoeschen(aktiv.id).then(() => {
                setOffen(null)
                laden()
              })
            }
          />
        ) : (
          <>
            <Card title="Neues Video">
              <p className="muted small">Wähle dein Rohvideo (Aufnahme oder Stream). Es bleibt, wo es liegt – MoinStudio erstellt nur eine Vorschau zum Schneiden.</p>
              <div className="row wrap">
                <select className="input" value={kanal} onChange={(e) => setKanal(e.target.value)} style={{ flex: '0 0 170px' }}>
                  {KANAELE.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
                <button className="btn primary" onClick={() => void importieren()}>
                  Rohvideo wählen …
                </button>
              </div>
            </Card>
            <Card title="Projekte" badge={`${projekte.length}`}>
              {projekte.length === 0 && <p className="muted">Noch keine Projekte.</p>}
              {projekte.map((p) => (
                <button key={p.id} className="schnitt-projekt" onClick={() => setOffen(p.id)}>
                  {p.leisteUrl ? <img src={p.leisteUrl} alt="" /> : <span className="thumb-placeholder" />}
                  <span>
                    <strong>{p.name}</strong>
                    <span className="muted small">
                      {p.kanal}
                      {p.quelle?.dauer ? ` · ${zeitText(p.quelle.dauer)}` : ''}
                      {p.auftrag ? ` · ${p.auftrag.state === 'failed' ? 'Fehler' : `${p.auftrag.step || 'wartet'}`}` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </Card>
          </>
        )}
      </div>
    </>
  )
}
