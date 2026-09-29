import { useCallback, useEffect, useState } from 'react'
import type { ThumbAuftrag, ThumbErgebnis, ThumbSkin, ThumbVideoErgebnis } from '@shared/app'
import { Card, PageHeader } from '../components/Panel'
import { useJobs } from '../components/JobsWidget'

const KANAELE = ['MoinMornhart', 'MoinMorni']

function fehlerText(err: unknown): string {
  return err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err)
}

/** Gesicht aus dem Skin (Kopf vorn 8×8 bei 8,8 plus Hut-Ebene bei 40,8), pixelscharf vergrößert */
function SkinBild({ id, klein }: { id: string; klein?: boolean }): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let aktiv = true
    void window.moin.thumbSkinBild(id).then((daten) => {
      if (!daten || !aktiv) return
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = c.height = 64
        const g = c.getContext('2d')
        if (!g) return
        g.imageSmoothingEnabled = false
        const s = img.width / 64 // HD-Skins (128, 256 …)
        g.drawImage(img, 8 * s, 8 * s, 8 * s, 8 * s, 0, 0, 64, 64)
        g.drawImage(img, 40 * s, 8 * s, 8 * s, 8 * s, 0, 0, 64, 64)
        if (aktiv) setSrc(c.toDataURL())
      }
      img.src = daten
    })
    return () => {
      aktiv = false
    }
  }, [id])
  const groesse = klein ? 22 : 72
  return src ? (
    <img src={src} alt="" style={{ width: groesse, height: groesse, imageRendering: 'pixelated', borderRadius: klein ? '50%' : 6 }} />
  ) : (
    <span className="muted small">…</span>
  )
}

function Skins({ skins, setSkins }: { skins: ThumbSkin[]; setSkins: (s: ThumbSkin[]) => void }): React.JSX.Element {
  const [fehler, setFehler] = useState<string | null>(null)
  const hochladen = (rolle: 'ich' | 'freund') => async (): Promise<void> => {
    setFehler(null)
    try {
      setSkins(await window.moin.thumbSkinAdd(rolle))
    } catch (err) {
      setFehler(fehlerText(err))
    }
  }
  return (
    <Card title="Skins" badge={`${skins.length}`}>
      {fehler && <p className="warn">{fehler}</p>}
      {skins.length === 0 && <p className="muted">Lade zuerst deinen eigenen Skin hoch. Skins von Freunden kommen dazu, wenn sie mit ins Bild sollen.</p>}
      <ul className="skin-grid">
        {skins.map((s) => (
          <li key={s.id} className="skin-tile">
            <SkinBild id={s.id} />
            <div className="skin-name" title={s.name}>
              {s.name}
            </div>
            <span className="badge">{s.rolle === 'ich' ? 'Mein Skin' : 'Freund'}</span>
            <div className="skin-actions">
              {s.rolle !== 'ich' && (
                <button className="btn small" onClick={() => void window.moin.thumbSkinUpdate(s.id, { rolle: 'ich' }).then(setSkins)}>
                  Als meinen nehmen
                </button>
              )}
              <button className="btn small" title="Entfernen" onClick={() => void window.moin.thumbSkinUpdate(s.id, { entfernen: true }).then(setSkins)}>
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="row wrap">
        <button className="btn" onClick={() => void hochladen('ich')()}>
          Mein Skin hochladen
        </button>
        <button className="btn" onClick={() => void hochladen('freund')()}>
          Skin eines Freundes hochladen
        </button>
      </div>
    </Card>
  )
}

function Ergebnis({ auftrag }: { auftrag: ThumbAuftrag }): React.JSX.Element {
  const [ergebnis, setErgebnis] = useState<ThumbErgebnis | null>(null)
  const [gross, setGross] = useState<number | null>(null)
  const [gespeichert, setGespeichert] = useState<string | null>(null)
  useEffect(() => {
    if (auftrag.state === 'done') void window.moin.thumbErgebnis(auftrag.id).then(setErgebnis)
  }, [auftrag.id, auftrag.state])
  if (auftrag.state === 'failed') return <p className="warn">Fehlgeschlagen: {auftrag.error}</p>
  if (auftrag.state !== 'done')
    return (
      <p className="muted">
        {auftrag.step || 'Wartet …'} {auftrag.progress !== null && `(${Math.round(auftrag.progress)} %)`}
      </p>
    )
  if (!ergebnis) return <p className="muted">Lade Ergebnis …</p>
  const v = gross !== null ? ergebnis.varianten[gross] : null
  return (
    <>
      <div className="variant-grid">
        {ergebnis.varianten.map((x, i) => (
          <figure key={i} className="variant">
            <button className="variant-open" disabled={!x.bild} onClick={() => setGross(i)}>
              {x.bild ? <img src={x.bild} alt={x.titel} /> : <div className="thumb-placeholder">Kein Bild</div>}
              {x.bild && <span className="variant-zoom">Groß ansehen</span>}
            </button>
            <figcaption>
              <div className="variant-title">
                <strong>{x.titel}</strong>
              </div>
              {x.vorbild && (
                <span className="muted small">
                  Orientiert sich an: {x.vorbild.kanal} –{' '}
                  <a href={x.vorbild.url} target="_blank" rel="noreferrer">
                    „{x.vorbild.titel}“
                  </a>
                </span>
              )}
              {x.fehler && <span className="own-bad small">{x.fehler}</span>}
              {x.warnungen.length > 0 && <span className="own-bad small">Hinweise: {x.warnungen.join(' · ')}</span>}
              {x.bild && (
                <div className="row">
                  <button className="btn small" onClick={() => void window.moin.thumbSpeichern(auftrag.id, i).then(setGespeichert)}>
                    Speichern …
                  </button>
                </div>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
      {gespeichert && <p className="ok-note small">Gespeichert: {gespeichert}</p>}
      {v && (
        <div className="lightbox" onClick={() => setGross(null)}>
          <div className="lightbox-panel" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-head">
              <strong>{v.titel}</strong>
              <div className="lightbox-nav">
                <button className="icon-btn" disabled={gross === 0} onClick={() => setGross((g) => (g ?? 1) - 1)}>
                  ‹
                </button>
                <button className="icon-btn" disabled={gross === ergebnis.varianten.length - 1} onClick={() => setGross((g) => (g ?? 0) + 1)}>
                  ›
                </button>
                <button className="icon-btn" onClick={() => setGross(null)}>
                  ✕
                </button>
              </div>
            </div>
            <div className="lightbox-body">
              <div className="lightbox-image">{v.bild && <img src={v.bild} alt={v.titel} />}</div>
              <div className="lightbox-side">
                <p className="lightbox-idea">{v.warum}</p>
                {v.vorbild && (
                  <p className="muted small">
                    Vorbild: {v.vorbild.kanal} – „{v.vorbild.titel}“
                  </p>
                )}
                <div className="lightbox-actions">
                  <button className="btn primary" onClick={() => void window.moin.thumbSpeichern(auftrag.id, gross!).then(setGespeichert)}>
                    Speichern …
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Video-Auswertung (ROADMAP 5.5): was Claude im Video sieht und welche Thumbnails es vorschlägt */
function VideoVorschlaege({ auftrag, kanal, onStart }: { auftrag: ThumbAuftrag; kanal: string; onStart: (id: string) => void }): React.JSX.Element {
  const [ergebnis, setErgebnis] = useState<ThumbVideoErgebnis | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  useEffect(() => {
    if (auftrag.state === 'done') void window.moin.thumbVideoErgebnis(auftrag.id).then(setErgebnis)
  }, [auftrag.id, auftrag.state])
  if (auftrag.state === 'failed') return <p className="warn">Fehlgeschlagen: {auftrag.error}</p>
  if (auftrag.state !== 'done')
    return (
      <p className="muted">
        {auftrag.step || 'Wartet …'} {auftrag.progress !== null && `(${Math.round(auftrag.progress)} %)`}
      </p>
    )
  if (!ergebnis) return <p className="muted">Lade Vorschläge …</p>
  return (
    <div className="plan-result">
      {fehler && <p className="warn">{fehler}</p>}
      <p className="muted">{ergebnis.inhalt}</p>
      {ergebnis.vorschlaege.map((v, i) => (
        <div key={i} className="analysis">
          <strong>{v.beschreibung}</strong>
          <span className="muted small">
            {v.warum}
            {v.zeitpunkt && ` · bei ${v.zeitpunkt}`}
          </span>
          <div className="row">
            <button
              className="btn small primary"
              onClick={() =>
                void window.moin.thumbStart({ beschreibung: v.beschreibung, kanal, freunde: v.freunde, anzahl: 3 }).then(onStart, (err: unknown) => setFehler(fehlerText(err)))
              }
            >
              Dieses Thumbnail erstellen
            </button>
          </div>
        </div>
      ))}
      <details>
        <summary className="muted small">Bilder, die Claude gesehen hat</summary>
        {ergebnis.boegen.map((b, i) => (
          <img key={i} src={b} alt="" style={{ width: '100%', borderRadius: 6, marginTop: 4 }} />
        ))}
      </details>
    </div>
  )
}

/** Thumbnail-Reiter (ROADMAP 5.4): Beschreibung → Claude plant Varianten mit Vorbild → Blender rendert. */
export function ThumbnailTab(): React.JSX.Element {
  const jobs = useJobs()
  const [skins, setSkins] = useState<ThumbSkin[]>([])
  const [beschreibung, setBeschreibung] = useState('')
  const [kanal, setKanal] = useState(KANAELE[0]!)
  const [freunde, setFreunde] = useState<string[]>([])
  const [anzahl, setAnzahl] = useState(3)
  const [fehler, setFehler] = useState<string | null>(null)
  const [auftraege, setAuftraege] = useState<ThumbAuftrag[]>([])
  const [offen, setOffen] = useState<string | null>(null)
  const [videoTitel, setVideoTitel] = useState('')

  useEffect(() => {
    void window.moin.thumbSkins().then(setSkins, (err: unknown) => setFehler(fehlerText(err)))
  }, [])
  const ladeAuftraege = useCallback(() => void window.moin.thumbAuftraege().then(setAuftraege), [])
  useEffect(ladeAuftraege, [jobs, ladeAuftraege])

  const start = async (): Promise<void> => {
    setFehler(null)
    try {
      const id = await window.moin.thumbStart({ beschreibung, kanal, freunde, anzahl })
      setOffen(id)
      setBeschreibung('')
      ladeAuftraege()
    } catch (err) {
      setFehler(fehlerText(err))
    }
  }
  const video = async (): Promise<void> => {
    setFehler(null)
    try {
      const id = await window.moin.thumbVideo(kanal, videoTitel)
      if (id) {
        setOffen(id)
        ladeAuftraege()
      }
    } catch (err) {
      setFehler(fehlerText(err))
    }
  }
  const freundSkins = skins.filter((s) => s.rolle === 'freund')

  return (
    <>
      <PageHeader title="Thumbnail" subtitle="Beschreibe dein Video – Claude plant Szenen nach den großen Minecraft-Kanälen, Blender rendert sie mit echten Texturen." />
      <div className="grid">
        <Card title="Neues Thumbnail">
          {fehler && <p className="warn">{fehler}</p>}
          <textarea
            className="input"
            rows={3}
            placeholder="z. B. Ich kämpfe gegen SimPell, er fällt fast von der Klippe"
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
          />
          {freundSkins.length > 0 && (
            <div className="friends">
              <span className="muted small">Mit im Bild:</span>
              {freundSkins.map((s) => {
                const an = freunde.includes(s.id)
                return (
                  <button key={s.id} className={an ? 'chip on' : 'chip'} onClick={() => setFreunde((f) => (an ? f.filter((x) => x !== s.id) : [...f, s.id]))}>
                    <SkinBild id={s.id} klein />
                    {s.name}
                  </button>
                )
              })}
            </div>
          )}
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
            <button className="btn primary" disabled={beschreibung.trim().length < 3} onClick={() => void start()}>
              Thumbnail erstellen
            </button>
          </div>
          <p className="muted small" style={{ marginTop: 14 }}>
            Oder lade dein Video hoch: Claude sieht es sich an und schlägt passende Thumbnails vor.
          </p>
          <div className="row wrap">
            <input className="input" placeholder="Videotitel (optional)" value={videoTitel} onChange={(e) => setVideoTitel(e.target.value)} />
            <button className="btn" onClick={() => void video()}>
              Video hochladen …
            </button>
          </div>
        </Card>
        <Skins skins={skins} setSkins={setSkins} />
        <Card title="Aufträge" badge={`${auftraege.length}`}>
          {auftraege.length === 0 && <p className="muted">Noch keine Thumbnails erstellt.</p>}
          {auftraege.map((a) => (
            <div key={a.id} className="session">
              <div className="session-head" style={{ cursor: 'pointer' }} onClick={() => setOffen(offen === a.id ? null : a.id)}>
                <strong className="session-title">{a.art === 'video' ? '🎬 ' : ''}{a.titel.replace(/^Thumbnail: /, '')}</strong>
                <span className={`status ${a.state === 'done' ? 'fertig' : a.state === 'failed' ? 'fehler' : 'rendert'}`}>
                  {a.state === 'done' ? 'fertig' : a.state === 'failed' ? 'Fehler' : a.state === 'paused' ? 'pausiert' : a.state === 'waiting-limit' ? 'wartet auf Claude-Limit' : 'läuft'}
                </span>
              </div>
              {(offen === a.id || a.state !== 'done') &&
                (a.art === 'video' ? (
                  <VideoVorschlaege
                    auftrag={a}
                    kanal={kanal}
                    onStart={(id) => {
                      setOffen(id)
                      ladeAuftraege()
                    }}
                  />
                ) : (
                  <Ergebnis auftrag={a} />
                ))}
            </div>
          ))}
        </Card>
      </div>
    </>
  )
}
