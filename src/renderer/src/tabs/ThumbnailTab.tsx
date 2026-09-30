import { useCallback, useEffect, useState } from 'react'
import { ClaudeVerbinden } from '../components/ClaudeCard'
import type { ClaudeStatusInfo, ThumbAuftrag, ThumbErgebnis, ThumbSkin, ThumbVideoErgebnis } from '@shared/app'
import { Card, PageHeader } from '../components/Panel'
import { useJobs } from '../components/JobsWidget'

const KANAELE = ['MoinMornhart', 'MoinMorni']
const GEFUEHLE = ['', 'schockiert', 'lachend', 'begeistert', 'wütend', 'traurig', 'cringe', 'skeptisch', 'müde', 'neugierig']

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

type Modus = 'minecraft' | 'reaction' | 'gaming' | 'vorlage'
const MODI: { id: Modus; titel: string; kanal: string; text: string }[] = [
  { id: 'minecraft', titel: 'Minecraft', kanal: 'MoinMornhart', text: 'Szene aus Beschreibung oder Video' },
  { id: 'reaction', titel: 'Reaction', kanal: 'MoinMorni', text: 'Original-Thumbnail + dein Skin' },
  { id: 'gaming', titel: 'Gaming', kanal: 'MoinMorni', text: 'Spielbild oder Hintergrund + deine Pose' },
  { id: 'vorlage', titel: 'Spiele-Vorlage', kanal: 'MoinMorni', text: 'Du statt der Person im Thumbnail' }
]

function Skins({ skins, setSkins }: { skins: ThumbSkin[]; setSkins: (s: ThumbSkin[]) => void }): React.JSX.Element {
  const [fehler, setFehler] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [laedt, setLaedt] = useState(false)
  const perName = async (rolle: 'ich' | 'freund'): Promise<void> => {
    setFehler(null)
    setLaedt(true)
    try {
      setSkins(await window.moin.thumbSkinName(name, rolle))
      setName('')
    } catch (err) {
      setFehler(fehlerText(err))
    } finally {
      setLaedt(false)
    }
  }
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
      {skins.length === 0 && <p className="muted">Gib zuerst deinen Minecraft-Namen ein oder lade deinen Skin hoch. Skins von Freunden kommen dazu, wenn sie mit ins Bild sollen.</p>}
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
        <input
          className="input"
          placeholder="Minecraft-Name, z. B. MoinMornhart"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && void perName(skins.some((s) => s.rolle === 'ich') ? 'freund' : 'ich')}
        />
        <button className="btn primary" disabled={laedt || !name.trim()} onClick={() => void perName('ich')}>
          {laedt ? 'Lade …' : 'Als meinen Skin'}
        </button>
        <button className="btn" disabled={laedt || !name.trim()} onClick={() => void perName('freund')}>
          Als Freund
        </button>
      </div>
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

/** Varianten eines Auftrags oder einer Änderung. „Ändern“ wählt das Bild für die nächste Änderung im Verlauf. */
function Ergebnis({ auftrag, gewaehlt, onWaehle }: { auftrag: ThumbAuftrag; gewaehlt: number | null; onWaehle: (i: number) => void }): React.JSX.Element {
  const [ergebnis, setErgebnis] = useState<ThumbErgebnis | null>(null)
  const [gross, setGross] = useState<number | null>(null)
  const [gespeichert, setGespeichert] = useState<string | null>(null)
  const [versuch, setVersuch] = useState(0)
  useEffect(() => {
    if (auftrag.state === 'done') void window.moin.thumbErgebnis(auftrag.id).then(setErgebnis)
  }, [auftrag.id, auftrag.state, versuch])
  // Fehlt ein Bild ohne Fehlermeldung (z. B. iCloud lädt es gerade hoch), kurz danach noch einmal laden
  useEffect(() => {
    if (!ergebnis || versuch >= 5 || !ergebnis.varianten.some((x) => !x.bild && !x.fehler)) return
    const t = setTimeout(() => setVersuch((n) => n + 1), 3000)
    return () => clearTimeout(t)
  }, [ergebnis, versuch])
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
          <figure key={i} className={gewaehlt === i ? 'variant gewaehlt' : 'variant'}>
            <button className="variant-open" disabled={!x.bild} onClick={() => setGross(i)}>
              {x.bild ? <img src={x.bild} alt={x.titel} /> : <div className="thumb-placeholder">Kein Bild</div>}
              {x.bild && <span className="variant-zoom">Groß ansehen</span>}
            </button>
            <figcaption>
              <div className="variant-title">
                <strong>{x.titel}</strong>
              </div>
              {x.fehler && <span className="own-bad small">{x.fehler}</span>}
              {x.warnungen.length > 0 && <span className="own-bad small">Hinweise: {x.warnungen.join(' · ')}</span>}
              {x.bild && (
                <div className="row">
                  <button className={gewaehlt === i ? 'btn small primary' : 'btn small'} aria-pressed={gewaehlt === i} onClick={() => onWaehle(i)}>
                    {gewaehlt === i ? '✏️ Gewählt' : '✏️ Ändern'}
                  </button>
                  <button className="btn small" onClick={() => void window.moin.thumbSpeichern(auftrag.id, i).then(setGespeichert)}>
                    Speichern …
                  </button>
                  <button
                    className="btn small"
                    title="Mit getrennten Ebenen (Hintergrund, Figuren, Text) zum Nachbessern in Photoshop – noch nicht mit Photoshop getestet"
                    onClick={() => void window.moin.thumbPhotoshop(auftrag.id, i).then((r) => r && setGespeichert(`${r.datei} (Ebenen: ${r.ebenen.join(', ')})`))}
                  >
                    Für Photoshop (ungetestet) …
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

/**
 * Verlauf eines Thumbnails wie ein Chat (Philip, 30.09.): oben der Auftrag, darunter jede Änderung mit ihrem Ergebnis,
 * ganz unten das Eingabefeld. Geändert wird das gewählte Bild, sonst das neueste.
 */
function Verlauf({ auftrag, aenderungen, onNeu }: { auftrag: ThumbAuftrag; aenderungen: ThumbAuftrag[]; onNeu: () => void }): React.JSX.Element {
  const [wahl, setWahl] = useState<{ job: string; variante: number } | null>(null)
  const [text, setText] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [loeschen, setLoeschen] = useState<string | null>(null)
  const schritte = [auftrag, ...aenderungen]
  const neuestes = [...schritte].reverse().find((s) => s.state === 'done')
  const basis = wahl && schritte.some((s) => s.id === wahl.job) ? wahl : neuestes ? { job: neuestes.id, variante: 0 } : null
  const name = (b: { job: string; variante: number }): string => {
    const n = schritte.findIndex((s) => s.id === b.job)
    if (n < 0) return 'einer gelöschten Änderung'
    return n === 0 ? `Variante ${b.variante + 1}` : `Änderung ${n}${b.variante > 0 ? `, Bild ${b.variante + 1}` : ''}`
  }
  const senden = async (): Promise<void> => {
    if (!basis || !text.trim()) return
    setFehler(null)
    try {
      await window.moin.thumbAendern(basis.job, basis.variante, text)
      setText('')
      setWahl(null)
      onNeu()
    } catch (err) {
      setFehler(fehlerText(err))
    }
  }
  return (
    <div className="verlauf">
      <Ergebnis auftrag={auftrag} gewaehlt={basis?.job === auftrag.id ? basis.variante : null} onWaehle={(i) => setWahl({ job: auftrag.id, variante: i })} />
      {aenderungen.map((a, n) => {
        // Nur sagen, woran geändert wurde, wenn es nicht einfach das Bild direkt darüber ist
        const vorher = n === 0 ? auftrag.id : aenderungen[n - 1]!.id
        const woran = a.basis && (a.basis.job !== vorher || n === 0) ? name(a.basis) : null
        return (
          <div key={a.id} className="verlauf-schritt">
            <div className="verlauf-wunsch">
              <span className="verlauf-nr">Änderung {n + 1}</span>
              <span>„{a.wunsch}“</span>
              {woran && <span className="muted small">an {woran}</span>}
              <button
                className="icon-btn"
                title="Diese Änderung löschen"
                onClick={() => {
                  if (loeschen === a.id) void window.moin.thumbLoeschen(a.id).then(() => (setLoeschen(null), onNeu()))
                  else setLoeschen(a.id)
                }}
              >
                {loeschen === a.id ? 'Wirklich löschen?' : '🗑'}
              </button>
            </div>
            <Ergebnis auftrag={a} gewaehlt={basis?.job === a.id ? basis.variante : null} onWaehle={(i) => setWahl({ job: a.id, variante: i })} />
          </div>
        )
      })}
      {basis && (
        <div className="verlauf-eingabe">
          <span className="muted small">
            Ändert: {name(basis)}
            {!wahl && schritte.length > 1 ? ' (neuestes Bild)' : ''}
          </span>
          <div className="row">
            <input
              className="input"
              placeholder="Änderung, z. B. Text gelb, Kopf größer, schau wütender"
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
  const [gefuehl, setGefuehl] = useState('')
  const [reaktionWort, setReaktionWort] = useState('')
  const [spiel, setSpiel] = useState('')
  const [wunsch, setWunsch] = useState('')
  const [wunschGefuehl, setWunschGefuehl] = useState('')
  const [mitWort, setMitWort] = useState('')
  const [vorlageWunsch, setVorlageWunsch] = useState('')
  const [loeschen, setLoeschen] = useState<string | null>(null)
  // Ohne Claude-Verbindung geht hier nichts: dann steht oben direkt der Knopf „Mit Claude verbinden“
  const [claude, setClaude] = useState<ClaudeStatusInfo | null>(null)
  useEffect(() => {
    void window.moin.claudeStatus().then(setClaude)
  }, [])
  const [modus, setModus] = useState<Modus>(() => {
    try {
      return (localStorage.getItem('thumb-modus') as Modus | null) ?? 'minecraft'
    } catch {
      return 'minecraft'
    }
  })
  const waehle = (m: Modus): void => {
    setModus(m)
    try {
      localStorage.setItem('thumb-modus', m)
    } catch {
      /* egal */
    }
  }
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
  const reaktion = async (): Promise<void> => {
    setFehler(null)
    try {
      const id = await window.moin.thumbReaktion({ gefuehl, wort: reaktionWort, kanal: 'MoinMorni', freunde })
      if (id) {
        setOffen(id)
        ladeAuftraege()
      }
    } catch (err) {
      setFehler(fehlerText(err))
    }
  }
  const eigenesBild = async (): Promise<void> => {
    setFehler(null)
    try {
      const id = await window.moin.thumbReaktion({ gefuehl: wunschGefuehl, wort: mitWort, kanal: 'MoinMorni', spiel, wunsch: wunsch.trim() || undefined, ohneExtras: Boolean(wunsch.trim()) && !mitWort.trim(), freunde })
      if (id) {
        setOffen(id)
        ladeAuftraege()
      }
    } catch (err) {
      setFehler(fehlerText(err))
    }
  }
  const spielvorlage = async (): Promise<void> => {
    setFehler(null)
    try {
      const id = await window.moin.thumbSpielvorlage({ wunsch: vorlageWunsch, freunde })
      if (id) {
        setOffen(id)
        ladeAuftraege()
      }
    } catch (err) {
      setFehler(fehlerText(err))
    }
  }
  // Änderungen stehen im Verlauf ihres Ursprungsauftrags, nicht als eigene Aufträge in der Liste
  const haupt = auftraege.filter((a) => !a.eltern || !auftraege.some((x) => x.id === a.eltern))
  const zuAuftrag = (id: string): ThumbAuftrag[] => auftraege.filter((a) => a.eltern === id).sort((x, y) => x.createdAt.localeCompare(y.createdAt))
  const freundSkins = skins.filter((s) => s.rolle === 'freund')
  // Freunde mit aufs Bild – in jeder Art (Philip: z. B. Chained Together mit einem Freund)
  const freundWahl = freundSkins.length > 0 && (
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
  )

  return (
    <>
      <PageHeader title="Thumbnail" subtitle="Beschreibe dein Video – Claude plant Szenen nach den großen Minecraft-Kanälen, Blender rendert sie mit echten Texturen." />
      {claude && !claude.usable && (
        <div className="claude-hinweis">
          <strong>Claude ist noch nicht verbunden</strong>
          <span className="muted small">Für Thumbnails braucht MoinStudio dein Claude-Abo.</span>
          <ClaudeVerbinden status={claude} onStatus={setClaude} />
        </div>
      )}
      <div className="modus-wahl" aria-label="Was möchtest du machen?">
        {MODI.map((m) => (
          <button key={m.id} aria-pressed={modus === m.id} className={modus === m.id ? 'modus on' : 'modus'} onClick={() => waehle(m.id)}>
            <strong>{m.titel}</strong>
            <span className="muted small">{m.text}</span>
            <span className="modus-kanal">{m.kanal}</span>
          </button>
        ))}
      </div>
      {fehler && <p className="warn">{fehler}</p>}
      <div className="grid">
        {modus === 'minecraft' && (
        <Card title="Neues Thumbnail">
          <textarea
            className="input"
            rows={3}
            placeholder="z. B. Ich kämpfe gegen SimPell, er fällt fast von der Klippe"
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
          />
          {freundWahl}
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
        )}
        {modus === 'reaction' && (
        <Card title="Reaction-Thumbnail" badge="MoinMorni">
          <p className="muted small">
            Lade das Thumbnail des Videos hoch, auf das du reagierst. Dein Skin kommt dazu – wie bei BastiGHGs Zweitkanal und Zarbex, jedes Mal in einer neuen Pose, mit Wort und Pfeil.
          </p>
          {freundWahl}
          <div className="row wrap">
            <select className="input" value={gefuehl} onChange={(e) => setGefuehl(e.target.value)} style={{ flex: '0 0 170px' }}>
              {GEFUEHLE.map((g) => (
                <option key={g} value={g}>
                  {g ? g[0]!.toUpperCase() + g.slice(1) : 'Gefühl: Claude wählt'}
                </option>
              ))}
            </select>
            <input className="input" placeholder="Wort (optional, z. B. KRASS)" value={reaktionWort} onChange={(e) => setReaktionWort(e.target.value)} />
            <button className="btn primary" onClick={() => void reaktion()}>
              Original-Thumbnail wählen …
            </button>
          </div>
        </Card>
        )}
        {modus === 'gaming' && (
        <Card title="Gaming-Thumbnail" badge="MoinMorni">
          <p className="muted small">
            Lade ein Spielbild, einen Screenshot oder einen eigenen Hintergrund hoch. Beschreibe, wie du posieren willst – oder lass das Feld leer, dann wählt Claude Pose, Wort und
            Pfeil. Mit Spielname kommt das Spiel unten in die Ecke.
          </p>
          <textarea
            className="input"
            rows={2}
            placeholder="Pose (optional), z. B. Ich halte mir die Hände vors Gesicht und gucke durch die Finger"
            value={wunsch}
            onChange={(e) => setWunsch(e.target.value)}
          />
          {freundWahl}
          <div className="row wrap">
            <select className="input" value={wunschGefuehl} onChange={(e) => setWunschGefuehl(e.target.value)} style={{ flex: '0 0 170px' }}>
              {GEFUEHLE.map((g) => (
                <option key={g} value={g}>
                  {g ? g[0]!.toUpperCase() + g.slice(1) : 'Gefühl: passend'}
                </option>
              ))}
            </select>
            <input className="input" placeholder="Spielname (optional)" value={spiel} onChange={(e) => setSpiel(e.target.value)} />
            <input className="input" placeholder="Wort (optional)" value={mitWort} onChange={(e) => setMitWort(e.target.value)} />
            <button className="btn primary" onClick={() => void eigenesBild()}>
              Spielbild / Hintergrund wählen …
            </button>
          </div>
        </Card>
        )}
        {modus === 'vorlage' && (
        <Card title="Spiele-Vorlage: du statt der Person" badge="MoinMorni">
          <p className="muted small">
            Wähle ein Spiele-Thumbnail eines anderen Creators. Die Person darin wird entfernt, dein Skin steht an ihrer Stelle in passender Pose – mit echtem 3D-Gegenstand, falls sie
            etwas hält. Der Titel bleibt obendrauf. Das Ergebnis ist nur für dich (fremde Vorlage). Sind mehrere Personen drauf, ersetzen deine gewählten Freunde die anderen.
          </p>
          {freundWahl}
          <div className="row wrap">
            <input className="input" placeholder="Wunsch (optional, z. B. schau wütender)" value={vorlageWunsch} onChange={(e) => setVorlageWunsch(e.target.value)} />
            <button className="btn primary" onClick={() => void spielvorlage()}>
              Spiele-Thumbnail wählen …
            </button>
          </div>
        </Card>
        )}
        <Skins skins={skins} setSkins={setSkins} />
        <Card title="Aufträge" badge={`${haupt.length}`}>
          {haupt.length === 0 && <p className="muted">Noch keine Thumbnails erstellt.</p>}
          {haupt.map((a) => {
            const aenderungen = zuAuftrag(a.id)
            const laeuft = [a, ...aenderungen].some((x) => !['done', 'failed', 'cancelled'].includes(x.state))
            return (
            <div key={a.id} className="session">
              <div className="session-head" style={{ cursor: 'pointer' }} onClick={() => setOffen(offen === a.id ? null : a.id)}>
                <strong className="session-title">{a.art === 'video' ? '🎬 ' : ''}{a.titel.replace(/^Thumbnail: /, '')}</strong>
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
                    if (loeschen === a.id) void window.moin.thumbLoeschen(a.id).then(() => (setLoeschen(null), ladeAuftraege()))
                    else setLoeschen(a.id)
                  }}
                >
                  {loeschen === a.id ? 'Wirklich löschen?' : '🗑'}
                </button>
              </div>
              {(offen === a.id || laeuft) &&
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
                  <Verlauf
                    auftrag={a}
                    aenderungen={aenderungen}
                    onNeu={() => {
                      setOffen(a.id)
                      ladeAuftraege()
                    }}
                  />
                ))}
            </div>
            )
          })}
        </Card>
      </div>
    </>
  )
}
