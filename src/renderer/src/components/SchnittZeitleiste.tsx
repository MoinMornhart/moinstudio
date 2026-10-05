import { useEffect, useRef, useState } from 'react'
import type { SchnittEffekt, SchnittListe, SchnittProjekt } from '@shared/app'
import { effektText } from '@shared/effekt-text'

/**
 * Timeline (Philip, 05.10.): alle Schnitte und Effekte auf einen Blick, über der ganzen Aufnahme. Oben der Schnitt
 * (grün bleibt, rot fliegt raus – Klick schaltet eine Schnittstelle um), darunter je eine Spur für Bibliotheks-Effekte,
 * Bild/Text, Kamera und Ton. Klick auf einen Effekt springt hin und zeigt An/Aus und Löschen.
 */

/** Ereignis, wenn Effekte geändert wurden (damit die Effektliste darunter mitzieht) */
export const EFFEKTE_GEAENDERT = 'moin-effekte-geaendert'

const SPUREN: { name: string; passt: (e: SchnittEffekt) => boolean }[] = [
  { name: 'Bibliothek', passt: (e) => !!e['bib'] },
  { name: 'Bild & Text', passt: (e) => ['text', 'bild', 'video', 'intro'].includes(e.art) },
  { name: 'Kamera & Tempo', passt: (e) => ['zoom', 'wackeln', 'tempo', 'einfrieren', 'farbe', 'blitz', 'uebergang', 'abblende', 'zensur'].includes(e.art) },
  { name: 'Ton', passt: (e) => ['geraeusch', 'lautstaerke'].includes(e.art) }
]

const zeitText = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function spanne(e: SchnittEffekt): { a: number; b: number } | null {
  if (typeof e.von === 'number' && typeof e.bis === 'number') return { a: e.von, b: e.bis }
  if (typeof e.bei === 'number') return { a: e.bei, b: e.bei + (typeof e['dauer'] === 'number' ? (e['dauer'] as number) : 1) }
  return null
}

export function SchnittZeitleiste({ p, liste, setListe, zeit, springe }: { p: SchnittProjekt; liste: SchnittListe; setListe: (l: SchnittListe) => void; zeit: number; springe: (s: number) => void }): React.JSX.Element {
  const [effekte, setEffekte] = useState<SchnittEffekt[]>([])
  const [gewaehlt, setGewaehlt] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const rolle = useRef<HTMLDivElement>(null)
  const dauer = liste.dauer || 1
  useEffect(() => {
    if (!p.auftrag) void window.moin.schnittEffekte(p.id).then(setEffekte)
  }, [p.id, p.auftrag, p.antwort?.zeit])
  useEffect(() => {
    const neu = (): void => void window.moin.schnittEffekte(p.id).then(setEffekte)
    window.addEventListener(EFFEKTE_GEAENDERT, neu)
    return () => window.removeEventListener(EFFEKTE_GEAENDERT, neu)
  }, [p.id])
  // Abspielposition im Blick halten, wenn hineingezoomt ist
  useEffect(() => {
    const r = rolle.current
    if (!r || zoom === 1) return
    const x = (zeit / dauer) * r.scrollWidth
    if (x < r.scrollLeft || x > r.scrollLeft + r.clientWidth) r.scrollLeft = x - r.clientWidth / 3
  }, [zeit, zoom, dauer])

  const pos = (t: number): string => `${(Math.max(0, Math.min(dauer, t)) / dauer) * 100}%`
  const breite = (a: number, b: number, min = 3): string => `max(${min}px, ${((b - a) / dauer) * 100}%)`
  const aendern = (i: number, a: { aus: boolean } | null): void =>
    void window.moin.schnittEffektAendern(p.id, i, a).then((l) => {
      setEffekte(l)
      if (a === null) setGewaehlt(null)
      window.dispatchEvent(new Event(EFFEKTE_GEAENDERT))
    })
  const sel = gewaehlt !== null ? effekte[gewaehlt] : undefined
  // Zeitmarken ungefähr jede Minute (beim Hineinzoomen dichter), die letzte nicht am rechten Rand
  const schritte = Math.max(1, Math.min(40, Math.ceil((dauer / 60) * Math.min(zoom, 4))))
  const raster = Array.from({ length: schritte }, (_, i) => (i * dauer) / schritte)

  return (
    <div className="zeitleiste">
      <div className="row" style={{ marginTop: 0, justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Timeline</strong>
        <label className="row small muted" style={{ marginTop: 0, alignItems: 'center' }}>
          Zoom
          <input type="range" min={1} max={20} step={1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
      </div>
      <div className="zl-rahmen">
        <div className="zl-namen">
          <span />
          <span>Schnitt</span>
          {SPUREN.map((s) => (
            <span key={s.name}>{s.name}</span>
          ))}
        </div>
        <div className="zl-rolle" ref={rolle}>
          <div className="zl-inhalt" style={{ width: `${zoom * 100}%` }}>
            <div
              className="zl-lineal"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                springe(((e.clientX - r.left) / r.width) * dauer)
              }}
            >
              {raster.map((t, i) => (
                <span key={i} style={{ left: pos(t) }}>
                  {zeitText(t)}
                </span>
              ))}
            </div>
            <div className="zl-spur">
              {liste.behalten.map((b, i) => (
                <span key={`b${i}`} className="zl-drin" style={{ left: pos(b.start), width: breite(b.start, b.ende, 1) }} onClick={() => springe(b.start)} />
              ))}
              {liste.entfernt.map((e, i) => (
                <span
                  key={`e${i}`}
                  className={`zl-weg${e.aus ? ' aus' : ''}`}
                  style={{ left: pos(e.start), width: breite(e.start, e.ende, 1) }}
                  title={`${e.aus ? 'bleibt drin' : 'raus'}: ${e.text ?? `${(e.ende - e.start).toFixed(1)} s`} – Klick schaltet um`}
                  onClick={() => void window.moin.schnittUmschalten(p.id, i).then(setListe)}
                />
              ))}
            </div>
            {SPUREN.map((s) => (
              <div key={s.name} className="zl-spur">
                {effekte.map((e, i) => {
                  // jeder Effekt nur in der ersten passenden Spur
                  if (SPUREN.find((x) => x.passt(e)) !== s) return null
                  const z = spanne(e)
                  if (!z) return null
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`zl-effekt${e.aus ? ' aus' : ''}${gewaehlt === i ? ' on' : ''}`}
                      style={{ left: pos(z.a), width: breite(z.a, z.b) }}
                      title={`${zeitText(z.a)} ${effektText(e)}`}
                      onClick={() => {
                        setGewaehlt(i)
                        springe(z.a)
                      }}
                    />
                  )
                })}
              </div>
            ))}
            <span className="zl-kopf" style={{ left: pos(zeit) }} />
          </div>
        </div>
      </div>
      {sel ? (
        <div className="row wrap" style={{ alignItems: 'center' }}>
          <span>
            <span className="muted small">{spanne(sel) ? zeitText(spanne(sel)!.a) : 'vor dem Video'}</span> {effektText(sel)}
          </span>
          <button type="button" className="btn small" onClick={() => aendern(gewaehlt!, { aus: !sel.aus })}>
            {sel.aus ? 'einschalten' : 'ausschalten'}
          </button>
          <button type="button" className="btn small" onClick={() => aendern(gewaehlt!, null)}>
            löschen
          </button>
        </div>
      ) : (
        <span className="muted small">Klick auf einen Effekt: hinspringen, an/aus. Klick auf Rot: Schnittstelle doch drinlassen (und zurück).</span>
      )}
    </div>
  )
}
