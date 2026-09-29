import { useCallback, useEffect, useRef, useState } from 'react'
import type { SchnittAbschnitt, SchnittProjekt } from '@shared/app'
import { Card, PageHeader } from '../components/Panel'

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

/** Transkript: jeder Satz mit Zeit, Klick springt hin, der gerade laufende Satz ist hervorgehoben. */
function Transkript({ id, bereit, zeit, springe }: { id: string; bereit: boolean; zeit: number; springe: (s: number) => void }): React.JSX.Element | null {
  const [abschnitte, setAbschnitte] = useState<SchnittAbschnitt[] | null>(null)
  useEffect(() => {
    if (bereit) void window.moin.schnittTranskript(id).then(setAbschnitte)
  }, [id, bereit])
  if (!abschnitte) return null
  return (
    <div className="transkript">
      <div className="card-head">
        <h2>Transkript</h2>
        <button className="btn small" onClick={() => void window.moin.schnittTranskriptStart(id)}>
          Neu erstellen
        </button>
      </div>
      {abschnitte.length === 0 && <p className="muted">Im Video wurde nichts gesprochen.</p>}
      {abschnitte.map((a) => (
        <button key={a.start} className={zeit >= a.start && zeit < a.ende ? 'satz aktiv' : 'satz'} onClick={() => springe(a.start)}>
          <span className="muted small">{zeitText(a.start)}</span>
          <span>{a.text}</span>
        </button>
      ))}
    </div>
  )
}

function ProjektAnsicht({ p, zurueck, loeschen }: { p: SchnittProjekt; zurueck: () => void; loeschen: () => void }): React.JSX.Element {
  const video = useRef<HTMLVideoElement>(null)
  const [zeit, setZeit] = useState(0)
  const [sicher, setSicher] = useState(false)
  const dauer = p.quelle?.dauer ?? 0
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
        <video ref={video} className="schnitt-player" src={p.proxyUrl} controls preload="metadata" onTimeUpdate={(e) => setZeit(e.currentTarget.currentTime)} />
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
      <Transkript id={p.id} bereit={p.transkript} zeit={zeit} springe={springe} />
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
  const [offen, setOffen] = useState<string | null>(null)
  const [kanal, setKanal] = useState(KANAELE[0]!)
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
