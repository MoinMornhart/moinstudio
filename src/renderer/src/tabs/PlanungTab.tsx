import { useCallback, useEffect, useState } from 'react'
import { PLANUNG_SPALTEN, type PlanungAenderung, type PlanungKanal, type PlanungKarte, type PlanungSpalte } from '@shared/app'
import type { Rhythmus } from '@shared/kalender'
import { PageHeader } from '../components/Panel'
import { PlanungKalender } from '../components/PlanungKalender'
import { KartenVideo } from '../components/KartenVideo'
import { IdeenFinder, TitelVorschlaege } from '../components/PlanungClaude'

const KANAELE: { id: PlanungKanal; info: string }[] = [
  { id: 'MoinMornhart', info: 'Minecraft' },
  { id: 'MoinMorni', info: 'Reactions, Gaming, Streams' }
]
const TAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

/** „Sa 03.10. 17:00“ */
export function terminText(termin: string): string {
  const d = new Date(termin)
  if (Number.isNaN(d.getTime())) return termin
  const zwei = (n: number): string => String(n).padStart(2, '0')
  return `${TAGE[d.getDay()]} ${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}. ${zwei(d.getHours())}:${zwei(d.getMinutes())}`
}

const ueberfaellig = (k: PlanungKarte): boolean => !!k.termin && k.spalte !== 'veroeffentlicht' && new Date(k.termin).getTime() < Date.now()

/** Reihenfolge-Wert für die Anzeige, bevor der Speicher antwortet (gleiche Regel wie im Hauptprozess). */
function ordnungLokal(spalte: PlanungKarte[], index: number): number {
  const vor = spalte[index - 1]?.ordnung
  const nach = spalte[index]?.ordnung
  if (vor === undefined && nach === undefined) return 1
  if (vor === undefined) return nach! - 1
  if (nach === undefined) return vor + 1
  return (vor + nach) / 2
}

export function PlanungTab(): React.JSX.Element {
  const [karten, setKarten] = useState<PlanungKarte[] | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [kanal, setKanal] = useState<PlanungKanal>('MoinMornhart')
  const [offen, setOffen] = useState<string | null>(null)
  const [ansicht, setAnsicht] = useState<'board' | 'kalender'>('board')
  const [ideen, setIdeen] = useState(false)
  const [rhythmus, setRhythmus] = useState<Rhythmus>({})

  const laden = useCallback((): void => {
    window.moin
      .planungKarten()
      .then((k) => {
        setKarten(k)
        setFehler(null)
      })
      .catch((e: Error) => setFehler(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')))
    void window.moin.planungRhythmus().then(setRhythmus).catch(() => undefined)
  }, [])
  useEffect(() => {
    laden()
    return window.moin.onPlanungGeaendert(laden)
  }, [laden])

  const ersetze = (k: PlanungKarte): void => setKarten((alt) => (alt ?? []).map((x) => (x.id === k.id ? k : x)))
  const aendern = (id: string, aenderung: PlanungAenderung): void => {
    setKarten((alt) => (alt ?? []).map((x) => (x.id === id ? { ...x, ...aenderung } : x)))
    void window.moin.planungAendern(id, aenderung).then(ersetze).catch(laden)
  }
  const verschieben = (id: string, spalte: PlanungSpalte, index: number, ziele: PlanungKarte[]): void => {
    setKarten((alt) => (alt ?? []).map((x) => (x.id === id ? { ...x, spalte, ordnung: ordnungLokal(ziele, index) } : x)))
    void window.moin.planungVerschieben(id, { spalte, index }).then(ersetze).catch(laden)
  }
  const neu = (spalte: PlanungSpalte, titel: string): void => {
    void window.moin.planungNeu({ kanal, titel, spalte }).then((k) => setKarten((alt) => [...(alt ?? []), k]))
  }
  const setzeRhythmus = (r: Rhythmus): void => {
    setRhythmus(r)
    void window.moin.planungRhythmusSetzen(r).then(setRhythmus)
  }
  const loeschen = (id: string): void => {
    setOffen(null)
    setKarten((alt) => (alt ?? []).filter((x) => x.id !== id))
    void window.moin.planungLoeschen(id).catch(laden)
  }

  const imKanal = (karten ?? []).filter((k) => k.kanal === kanal)
  const offeneKarte = karten?.find((k) => k.id === offen) ?? null

  return (
    <>
      <PageHeader title="Planung" subtitle="Jedes Video von der Idee bis zum Upload – für MoinMornhart und MoinMorni." />
      <div className="planung-kopf">
        {ansicht === 'kalender' ? (
          <p className="muted">Upload-Termine beider Kanäle. Karten auf einen Tag ziehen, um sie einzuplanen oder zu verschieben.</p>
        ) : (
        <div className="kanal-wahl" role="tablist">
          {KANAELE.map((k) => (
            <button key={k.id} role="tab" aria-selected={kanal === k.id} className={`kanal-knopf${kanal === k.id ? ' on' : ''}`} onClick={() => setKanal(k.id)}>
              <strong>{k.id}</strong>
              <span className="muted small">
                {k.info} · {(karten ?? []).filter((x) => x.kanal === k.id && x.spalte !== 'veroeffentlicht').length} offen
              </span>
            </button>
          ))}
        </div>
        )}
        <span className="row" style={{ marginTop: 0 }}>
        {ansicht === 'board' && (
          <button className={`btn small${ideen ? ' on' : ''}`} onClick={() => setIdeen(!ideen)}>
            {ideen ? 'Ideen ausblenden' : 'Ideen mit Claude'}
          </button>
        )}
        <span className="segment">
          <button className={ansicht === 'board' ? 'on' : ''} onClick={() => setAnsicht('board')}>
            Board
          </button>
          <button className={ansicht === 'kalender' ? 'on' : ''} onClick={() => setAnsicht('kalender')}>
            Kalender
          </button>
        </span>
        </span>
      </div>
      {ansicht === 'board' && ideen && (
        <IdeenFinder
          key={kanal}
          kanal={kanal}
          uebernehmen={(titel, idee) => window.moin.planungNeu({ kanal, titel, spalte: 'idee', notizen: idee }).then((k) => setKarten((alt) => [...(alt ?? []), k]))}
        />
      )}
      {fehler && <p className="warn">{fehler}</p>}
      {karten && ansicht === 'board' && <Board karten={imKanal} oeffne={setOffen} verschieben={verschieben} neu={neu} />}
      {karten && ansicht === 'kalender' && <PlanungKalender karten={karten} rhythmus={rhythmus} setzeRhythmus={setzeRhythmus} oeffne={setOffen} aendern={aendern} />}
      {offeneKarte && <KartenDetails key={offeneKarte.id} karte={offeneKarte} ersetze={ersetze} aendern={(a) => aendern(offeneKarte.id, a)} loeschen={() => loeschen(offeneKarte.id)} schliessen={() => setOffen(null)} />}
    </>
  )
}

function Board({
  karten,
  oeffne,
  verschieben,
  neu
}: {
  karten: PlanungKarte[]
  oeffne: (id: string) => void
  verschieben: (id: string, spalte: PlanungSpalte, index: number, ziele: PlanungKarte[]) => void
  neu: (spalte: PlanungSpalte, titel: string) => void
}): React.JSX.Element {
  const [ziehe, setZiehe] = useState<string | null>(null)
  const [marke, setMarke] = useState<{ spalte: PlanungSpalte; index: number } | null>(null)

  const indexAus = (liste: HTMLElement, y: number): number => {
    const kacheln = [...liste.querySelectorAll<HTMLElement>('[data-karte]')].filter((el) => el.dataset['karte'] !== ziehe)
    const i = kacheln.findIndex((el) => {
      const r = el.getBoundingClientRect()
      return y < r.top + r.height / 2
    })
    return i < 0 ? kacheln.length : i
  }

  return (
    <div className="board-scroll">
      <div className="board">
        {PLANUNG_SPALTEN.map((s) => {
          const inSpalte = karten.filter((k) => k.spalte === s.id).sort((a, b) => a.ordnung - b.ordnung)
          const ohneGezogene = inSpalte.filter((k) => k.id !== ziehe)
          return (
            <div
              key={s.id}
              className={`board-col${marke?.spalte === s.id ? ' ziel' : ''}`}
              onDragOver={(e) => {
                if (!ziehe) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                const index = indexAus(e.currentTarget, e.clientY)
                if (marke?.spalte !== s.id || marke.index !== index) setMarke({ spalte: s.id, index })
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setMarke(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (ziehe) verschieben(ziehe, s.id, indexAus(e.currentTarget, e.clientY), ohneGezogene)
                setZiehe(null)
                setMarke(null)
              }}
            >
              <div className="board-col-head">
                <span>{s.name}</span>
                <span className="board-zahl">{inSpalte.length}</span>
              </div>
              <div className="board-karten">
                {inSpalte.map((k) => {
                  const i = ohneGezogene.indexOf(k)
                  return (
                    <div key={k.id} className={k.id === ziehe ? 'weg' : undefined}>
                      {i >= 0 && marke?.spalte === s.id && marke.index === i && <div className="ablage" />}
                      <Kachel karte={k} oeffne={oeffne} ziehen={setZiehe} />
                    </div>
                  )
                })}
                {marke?.spalte === s.id && marke.index >= ohneGezogene.length && <div className="ablage" />}
                {s.id === 'idee' && karten.length === 0 && <p className="muted small">Noch keine Videos geplant. Tipp unten eine Idee ein.</p>}
              </div>
              <NeueKarte spalte={s.id} neu={neu} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Kachel({ karte, oeffne, ziehen }: { karte: PlanungKarte; oeffne: (id: string) => void; ziehen: (id: string | null) => void }): React.JSX.Element {
  const erledigt = karte.checkliste.filter((c) => c.erledigt).length
  const notiz = karte.notizen.split('\n').find((z) => z.trim())
  return (
    <button
      className="kachel"
      data-karte={karte.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', karte.id)
        e.dataTransfer.effectAllowed = 'move'
        // erst nach dem Start ausblenden, sonst bricht Chromium das Ziehen ab
        setTimeout(() => ziehen(karte.id), 0)
      }}
      onDragEnd={() => ziehen(null)}
      onClick={() => oeffne(karte.id)}
    >
      {karte.bildUrl && <img className="kachel-bild" src={karte.bildUrl} alt="" draggable={false} />}
      <span className="kachel-titel">{karte.titel}</span>
      {notiz && <span className="kachel-notiz">{notiz}</span>}
      {(karte.termin || karte.checkliste.length > 0 || karte.schnitt || karte.thumbnail?.gewaehlt || karte.youtube) && (
        <span className="kachel-fuss">
          {karte.termin && <span className={`termin${ueberfaellig(karte) ? ' spaet' : ''}`}>{terminText(karte.termin)}</span>}
          {karte.schnitt && <span className="kachel-chip schnitt" title="Mit einem Video im Schnitt verknüpft">✂ Im Schnitt</span>}
          {karte.thumbnail?.gewaehlt && <span className="kachel-chip bild" title="Thumbnail ausgewählt">🖼 Thumbnail</span>}
          {karte.youtube && <span className="kachel-chip text" title="Titel, Beschreibung und Kapitel aus dem Export">✎ Text fertig</span>}
          {karte.checkliste.length > 0 && (
            <span className={`haken${erledigt === karte.checkliste.length ? ' voll' : ''}`}>
              ✓ {erledigt}/{karte.checkliste.length}
            </span>
          )}
        </span>
      )}
    </button>
  )
}

function NeueKarte({ spalte, neu }: { spalte: PlanungSpalte; neu: (spalte: PlanungSpalte, titel: string) => void }): React.JSX.Element {
  const [offen, setOffen] = useState(spalte === 'idee')
  const [titel, setTitel] = useState('')
  const senden = (): void => {
    if (titel.trim()) neu(spalte, titel.trim())
    setTitel('')
  }
  if (!offen)
    return (
      <button className="neue-karte-knopf" onClick={() => setOffen(true)}>
        + Karte
      </button>
    )
  return (
    <input
      className="input small neue-karte"
      placeholder={spalte === 'idee' ? 'Neue Idee …' : 'Neue Karte …'}
      value={titel}
      autoFocus={spalte !== 'idee'}
      onChange={(e) => setTitel(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') senden()
        if (e.key === 'Escape') {
          setTitel('')
          if (spalte !== 'idee') setOffen(false)
        }
      }}
      onBlur={() => {
        senden()
        if (spalte !== 'idee') setOffen(false)
      }}
    />
  )
}

function KartenDetails({
  karte,
  ersetze,
  aendern,
  loeschen,
  schliessen
}: {
  karte: PlanungKarte
  ersetze: (k: PlanungKarte) => void
  aendern: (a: PlanungAenderung) => void
  loeschen: () => void
  schliessen: () => void
}): React.JSX.Element {
  const [titel, setTitel] = useState(karte.titel)
  const [notizen, setNotizen] = useState(karte.notizen)
  const [punkt, setPunkt] = useState('')
  const [sicher, setSicher] = useState(false)
  // Änderungen von außen (anderes Gerät, Claude Desktop) übernehmen – React-Muster „Zustand beim Rendern anpassen“
  const [stand, setStand] = useState({ titel: karte.titel, notizen: karte.notizen })
  if (stand.titel !== karte.titel || stand.notizen !== karte.notizen) {
    setStand({ titel: karte.titel, notizen: karte.notizen })
    if (stand.titel !== karte.titel) setTitel(karte.titel)
    if (stand.notizen !== karte.notizen) setNotizen(karte.notizen)
  }
  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') schliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [schliessen])

  const liste = karte.checkliste
  return (
    <div className="details-hinter" onMouseDown={(e) => e.target === e.currentTarget && schliessen()}>
      <aside className="details" aria-label="Karte bearbeiten">
        <div className="details-kopf">
          <textarea
            className="details-titel"
            rows={2}
            value={titel}
            onChange={(e) => setTitel(e.target.value.replace(/\n/g, ' '))}
            onBlur={() => titel.trim() && titel.trim() !== karte.titel && aendern({ titel: titel.trim() })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLTextAreaElement).blur()
              }
            }}
          />
          <button className="icon-btn" aria-label="Schließen" onClick={schliessen}>
            ✕
          </button>
        </div>

        <div className="details-felder">
          <label>
            <span className="muted small">Kanal</span>
            <select className="input" value={karte.kanal} onChange={(e) => aendern({ kanal: e.target.value as PlanungKanal })}>
              {KANAELE.map((k) => (
                <option key={k.id}>{k.id}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="muted small">Stand</span>
            <select className="input" value={karte.spalte} onChange={(e) => aendern({ spalte: e.target.value as PlanungSpalte })}>
              {PLANUNG_SPALTEN.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="muted small">Upload-Termin</span>
            <span className="row" style={{ marginTop: 0 }}>
              <input className="input" type="datetime-local" value={karte.termin ?? ''} onChange={(e) => aendern({ termin: e.target.value || null })} />
              {karte.termin && (
                <button className="btn small" onClick={() => aendern({ termin: null })}>
                  Entfernen
                </button>
              )}
            </span>
          </label>
        </div>

        <TitelVorschlaege karte={karte} setze={(t) => aendern({ titel: t })} />

        <KartenVideo karte={karte} ersetze={ersetze} aendern={aendern} />

        <label className="details-block">
          <span className="muted small">Notizen (Idee, Ablauf, Seed, Mitspieler …)</span>
          <textarea className="input" rows={6} value={notizen} onChange={(e) => setNotizen(e.target.value)} onBlur={() => notizen !== karte.notizen && aendern({ notizen })} />
        </label>

        <div className="details-block">
          <span className="muted small">
            Checkliste {liste.length > 0 && `(${liste.filter((c) => c.erledigt).length}/${liste.length})`}
          </span>
          {liste.map((c, i) => (
            <div key={i} className="punkt">
              <input type="checkbox" checked={c.erledigt} onChange={() => aendern({ checkliste: liste.map((x, j) => (j === i ? { ...x, erledigt: !x.erledigt } : x)) })} />
              <span className={c.erledigt ? 'erledigt' : ''}>{c.text}</span>
              <button className="chip-x" aria-label="Punkt entfernen" onClick={() => aendern({ checkliste: liste.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
          ))}
          <input
            className="input small"
            placeholder="Punkt hinzufügen …"
            value={punkt}
            onChange={(e) => setPunkt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && punkt.trim()) {
                aendern({ checkliste: [...liste, { text: punkt.trim(), erledigt: false }] })
                setPunkt('')
              }
            }}
          />
        </div>

        <div className="details-fuss">
          <span className="muted small">
            Zuletzt geändert {new Date(karte.updatedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} auf {karte.updatedBy}
          </span>
          {sicher ? (
            <span className="row" style={{ marginTop: 0 }}>
              <button className="btn small" onClick={() => setSicher(false)}>
                Behalten
              </button>
              <button className="btn small gefahr" onClick={loeschen}>
                Wirklich löschen
              </button>
            </span>
          ) : (
            <button className="btn small" onClick={() => setSicher(true)}>
              Löschen
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}
