import { useState } from 'react'
import type { PlanungAenderung, PlanungKanal, PlanungKarte } from '@shared/app'
import {
  luecken,
  monatsRaster,
  plusTage,
  tagVon,
  teileTermin,
  terminAufTag,
  WOCHE,
  WOCHENTAGE_KURZ,
  wochenTage,
  STANDARD_ZEIT,
  type Luecke,
  type Rhythmus,
  type Wochentag
} from '@shared/kalender'
import { WochenPlaner } from './PlanungClaude'

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const KANAELE: { id: PlanungKanal; kurz: string; klasse: string }[] = [
  { id: 'MoinMornhart', kurz: 'Mornhart', klasse: 'k-mornhart' },
  { id: 'MoinMorni', kurz: 'Morni', klasse: 'k-morni' }
]
const klasse = (kanal: string): string => KANAELE.find((k) => k.id === kanal)?.klasse ?? ''
const kurz = (kanal: string): string => KANAELE.find((k) => k.id === kanal)?.kurz ?? kanal

/** Kalender der Upload-Termine beider Kanäle mit Upload-Rhythmus und Lücken (ROADMAP 7.4). */
export function PlanungKalender({
  karten,
  rhythmus,
  setzeRhythmus,
  oeffne,
  aendern
}: {
  karten: PlanungKarte[]
  rhythmus: Rhythmus
  setzeRhythmus: (r: Rhythmus) => void
  oeffne: (id: string) => void
  aendern: (id: string, a: PlanungAenderung) => void
}): React.JSX.Element {
  const heute = tagVon(new Date())
  const [ansicht, setAnsicht] = useState<'monat' | 'woche'>('monat')
  const [bezug, setBezug] = useState(heute)
  const [sichtbar, setSichtbar] = useState<Record<string, boolean>>({ MoinMornhart: true, MoinMorni: true })
  const [ziel, setZiel] = useState<string | null>(null)
  const [ziehe, setZiehe] = useState<string | null>(null)

  const b = new Date(`${bezug}T12:00`)
  const tage = ansicht === 'monat' ? monatsRaster(b.getFullYear(), b.getMonth()) : wochenTage(bezug)
  const blaettern = (richtung: number): void => {
    if (ansicht === 'woche') return setBezug(plusTage(bezug, 7 * richtung))
    setBezug(tagVon(new Date(b.getFullYear(), b.getMonth() + richtung, 1)))
  }
  const titel = ansicht === 'monat' ? `${MONATE[b.getMonth()]} ${b.getFullYear()}` : `${tagText(tage[0])} – ${tagText(tage[6])}`

  const gezeigt = karten.filter((k) => sichtbar[k.kanal])
  const mitTermin = gezeigt.filter((k) => k.termin)
  const ohneTermin = gezeigt.filter((k) => !k.termin && k.spalte !== 'veroeffentlicht')
  const rhythmusGezeigt = Object.fromEntries(Object.entries(rhythmus).filter(([k]) => sichtbar[k]))
  const lueckenHier = luecken(rhythmusGezeigt, karten, tage[0], tage[tage.length - 1], heute)
  const lueckenBald = luecken(rhythmusGezeigt, karten, heute, plusTage(heute, 27), heute)

  const ablegen = (tag: string, id: string): void => {
    const k = karten.find((x) => x.id === id)
    if (!k) return
    const termin = terminAufTag(tag, k.termin, rhythmus[k.kanal])
    if (termin !== k.termin) aendern(id, { termin })
  }
  const ziehbar = (k: PlanungKarte): React.HTMLAttributes<HTMLElement> & { draggable: boolean } => ({
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.setData('text/plain', k.id)
      e.dataTransfer.effectAllowed = 'move'
      setZiehe(k.id)
    },
    onDragEnd: () => {
      setZiehe(null)
      setZiel(null)
    }
  })

  return (
    <div className="kalender-flaeche">
      <div className="kalender">
        <div className="kalender-leiste">
          <div className="row" style={{ marginTop: 0 }}>
            <button className="icon-btn" aria-label="Zurück" onClick={() => blaettern(-1)}>
              ‹
            </button>
            <button className="btn small" onClick={() => setBezug(heute)}>
              Heute
            </button>
            <button className="icon-btn" aria-label="Weiter" onClick={() => blaettern(1)}>
              ›
            </button>
            <h2 className="kalender-titel">{titel}</h2>
          </div>
          <div className="row" style={{ marginTop: 0 }}>
            {KANAELE.map((k) => (
              <button key={k.id} className={`chip legende ${k.klasse}${sichtbar[k.id] ? ' on' : ''}`} onClick={() => setSichtbar({ ...sichtbar, [k.id]: !sichtbar[k.id] })}>
                <span className="punkt-farbe" />
                {k.id}
              </button>
            ))}
            <span className="segment">
              <button className={ansicht === 'monat' ? 'on' : ''} onClick={() => setAnsicht('monat')}>
                Monat
              </button>
              <button className={ansicht === 'woche' ? 'on' : ''} onClick={() => setAnsicht('woche')}>
                Woche
              </button>
            </span>
          </div>
        </div>

        <div className={`kalender-raster ${ansicht}`}>
          {WOCHE.map((t) => (
            <div key={t} className="kalender-kopf">
              {WOCHENTAGE_KURZ[t]}
            </div>
          ))}
          {tage.map((tag) => {
            const termine = mitTermin.filter((k) => k.termin!.startsWith(tag)).sort((x, y) => x.termin!.localeCompare(y.termin!))
            const frei = lueckenHier.filter((l) => l.tag === tag)
            const fremd = ansicht === 'monat' && Number(tag.slice(5, 7)) !== b.getMonth() + 1
            return (
              <div
                key={tag}
                data-tag={tag}
                className={`kalender-tag${fremd ? ' fremd' : ''}${tag === heute ? ' heute' : ''}${tag < heute ? ' vorbei' : ''}${ziel === tag ? ' ziel' : ''}`}
                onDragOver={(e) => {
                  if (!ziehe) return
                  e.preventDefault()
                  if (ziel !== tag) setZiel(tag)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (ziehe) ablegen(tag, ziehe)
                  setZiehe(null)
                  setZiel(null)
                }}
              >
                <span className="kalender-nr">{ansicht === 'woche' ? tagText(tag) : Number(tag.slice(8))}</span>
                {termine.map((k) => (
                  <button key={k.id} className={`termin-pille ${klasse(k.kanal)}${k.spalte === 'veroeffentlicht' ? ' fertig' : ''}${k.spalte !== 'veroeffentlicht' && k.termin! < `${heute}T` ? ' spaet' : ''}`} title={`${k.kanal}: ${k.titel}`} onClick={() => oeffne(k.id)} {...ziehbar(k)}>
                    <span className="pille-text">
                      <span className="zeit">{teileTermin(k.termin!).zeit}</span> {k.titel}
                    </span>
                  </button>
                ))}
                {frei.map((l) => (
                  <span key={l.kanal} className={`luecke ${klasse(l.kanal)}`} title={`Laut Rhythmus lädt ${l.kanal} hier hoch, aber es ist noch kein Video geplant.`}>
                    {l.zeit} frei · {kurz(l.kanal)}
                  </span>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      <aside className="kalender-seite">
        <section>
          <h3>Ohne Termin</h3>
          <p className="muted small">Auf einen Tag ziehen, um den Upload zu planen.</p>
          <div className="ohne-termin">
            {ohneTermin.length === 0 && <p className="muted small">Alles eingeplant.</p>}
            {ohneTermin.map((k) => (
              <button key={k.id} className={`termin-pille ${klasse(k.kanal)}`} onClick={() => oeffne(k.id)} {...ziehbar(k)}>
                <span className="pille-text">{k.titel}</span>
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3>Nächste 4 Wochen</h3>
          <LueckenText luecken={lueckenBald} rhythmusLeer={Object.values(rhythmusGezeigt).every((s) => s.length === 0)} />
        </section>
        <WochenPlaner karten={karten} termin={(id, termin) => aendern(id, { termin })} />
        <section>
          <h3>Upload-Rhythmus</h3>
          <p className="muted small">Wann lädst du normalerweise hoch? Freie Termine erscheinen dann im Kalender.</p>
          {KANAELE.map((k) => (
            <RhythmusZeile key={k.id} kanal={k.id} klasse={k.klasse} slots={rhythmus[k.id] ?? []} setze={(slots) => setzeRhythmus({ ...rhythmus, [k.id]: slots })} />
          ))}
        </section>
      </aside>
    </div>
  )
}

function tagText(tag: string): string {
  const d = new Date(`${tag}T12:00`)
  return `${WOCHENTAGE_KURZ[d.getDay()]} ${tag.slice(8)}.${tag.slice(5, 7)}.`
}

function LueckenText({ luecken, rhythmusLeer }: { luecken: Luecke[]; rhythmusLeer: boolean }): React.JSX.Element {
  if (rhythmusLeer) return <p className="muted small">Noch kein Upload-Rhythmus festgelegt.</p>
  if (luecken.length === 0) return <p className="small ok-text">Jeder Upload-Termin ist mit einem Video belegt.</p>
  const erste = luecken[0]
  return (
    <p className="small">
      <strong className="warn-text">{luecken.length === 1 ? '1 freier Termin' : `${luecken.length} freie Termine`}</strong>
      <span className="muted"> · als Nächstes {erste.kanal} am {tagText(erste.tag)} um {erste.zeit}</span>
    </p>
  )
}

function RhythmusZeile({ kanal, klasse, slots, setze }: { kanal: PlanungKanal; klasse: string; slots: { tag: Wochentag; zeit: string }[]; setze: (s: { tag: Wochentag; zeit: string }[]) => void }): React.JSX.Element {
  const zeit = slots[0]?.zeit ?? STANDARD_ZEIT
  return (
    <div className={`rhythmus ${klasse}`}>
      <span className="rhythmus-kanal">
        <span className="punkt-farbe" />
        {kanal}
      </span>
      <div className="rhythmus-tage">
        {WOCHE.map((t) => {
          const an = slots.some((s) => s.tag === t)
          return (
            <button key={t} className={`tag-knopf${an ? ' on' : ''}`} aria-pressed={an} onClick={() => setze(an ? slots.filter((s) => s.tag !== t) : [...slots, { tag: t, zeit }])}>
              {WOCHENTAGE_KURZ[t]}
            </button>
          )
        })}
        <input className="input small zeit-feld" type="time" aria-label={`Uhrzeit ${kanal}`} value={zeit} disabled={slots.length === 0} onChange={(e) => e.target.value && setze(slots.map((s) => ({ ...s, zeit: e.target.value })))} />
      </div>
    </div>
  )
}
