import { useEffect, useState } from 'react'
import type { PlanungAenderung, PlanungKarte, PlanungThumbStand, SchnittProjekt } from '@shared/app'
import { oeffne } from '../navigation'

/** Stand eines Schnitt-Projekts in einfachen Worten */
function schnittStand(p: SchnittProjekt): string {
  if (p.auftrag && p.auftrag.state !== 'failed') return `läuft: ${p.auftrag.step || 'wird bearbeitet'}${p.auftrag.progress !== null ? ` (${Math.round(p.auftrag.progress)} %)` : ''}`
  if (p.auftrag?.state === 'failed') return `Fehler: ${p.auftrag.error ?? 'unbekannt'}`
  if (p.exportiert) return 'fertig exportiert'
  if (p.rohschnitt) return 'Rohschnitt fertig – bitte ansehen'
  if (p.transkript) return 'Transkript fertig'
  return 'importiert'
}

const fehlerText = (e: unknown): string => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/**
 * Planungskarte ↔ Schnitt und Thumbnail (ROADMAP 7.5): Rohvideo schneiden, Thumbnail erstellen und wählen,
 * Titel/Beschreibung/Kapitel aus dem Export übernehmen.
 */
export function KartenVideo({ karte, ersetze, aendern }: { karte: PlanungKarte; ersetze: (k: PlanungKarte) => void; aendern: (a: PlanungAenderung) => void }): React.JSX.Element {
  const [projekte, setProjekte] = useState<SchnittProjekt[]>([])
  const [thumb, setThumb] = useState<PlanungThumbStand | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [kopiert, setKopiert] = useState<string | null>(null)

  const projekt = projekte.find((p) => p.id === karte.schnitt) ?? null
  const thumbLaeuft = !!thumb?.auftrag && ['queued', 'running', 'paused', 'waiting-limit'].includes(thumb.auftrag.state)
  const schnittLaeuft = !!projekt?.auftrag && projekt.auftrag.state !== 'failed'

  useEffect(() => {
    let aktiv = true
    const laden = (): void => {
      void window.moin.schnittProjekte().then((p) => aktiv && setProjekte(p))
      if (karte.thumbnail?.auftrag) void window.moin.planungThumbVarianten(karte.id).then((t) => aktiv && setThumb(t))
    }
    laden()
    // solange etwas läuft, alle 2 Sekunden nachsehen
    const t = thumbLaeuft || schnittLaeuft ? setInterval(laden, 2000) : null
    return () => {
      aktiv = false
      if (t) clearInterval(t)
    }
  }, [karte.id, karte.schnitt, karte.thumbnail?.auftrag, karte.thumbnail?.bild, thumbLaeuft, schnittLaeuft])

  const tu = (p: Promise<PlanungKarte | null>): void => {
    setFehler(null)
    p.then((k) => k && ersetze(k)).catch((e: unknown) => setFehler(fehlerText(e)))
  }
  const kopiere = (name: string, text: string): void => {
    void navigator.clipboard.writeText(text).then(() => {
      setKopiert(name)
      setTimeout(() => setKopiert(null), 1500)
    })
  }

  const passend = projekte.filter((p) => p.kanal === karte.kanal)
  return (
    <div className="details-block karten-video">
      <span className="muted small">Video</span>

      <div className="video-zeile">
        <strong>Schnitt</strong>
        {karte.schnitt ? (
          <>
            <span className="muted small">{projekt ? `${projekt.name} · ${schnittStand(projekt)}` : 'Projekt nicht gefunden (gelöscht?)'}</span>
            <span className="row" style={{ marginTop: 0 }}>
              {projekt && (
                <button className="btn small" onClick={() => oeffne('schnitt', projekt.id)}>
                  Im Schnitt öffnen
                </button>
              )}
              <button className="btn small" onClick={() => aendern({ schnitt: null })}>
                Verbindung lösen
              </button>
            </span>
          </>
        ) : (
          <span className="row wrap" style={{ marginTop: 0 }}>
            <button className="btn small primary" onClick={() => tu(window.moin.planungSchneiden(karte.id))}>
              Rohvideo schneiden …
            </button>
            {passend.length > 0 && (
              <select className="input small" value="" onChange={(e) => e.target.value && aendern({ schnitt: e.target.value })} aria-label="Vorhandenes Schnitt-Projekt verbinden">
                <option value="">… oder vorhandenes Projekt</option>
                {passend.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </span>
        )}
      </div>

      <div className="video-zeile">
        <strong>Thumbnail</strong>
        {thumbLaeuft && thumb?.auftrag && (
          <span className="muted small">
            wird erstellt: {thumb.auftrag.step || 'wartet'}
            {thumb.auftrag.progress !== null && ` (${Math.round(thumb.auftrag.progress)} %)`}
          </span>
        )}
        {thumb?.auftrag?.state === 'failed' && <span className="warn small">Fehler: {thumb.auftrag.error}</span>}
        {thumb && thumb.varianten.length > 0 ? (
          <>
            <span className="muted small">{karte.thumbnail?.gewaehlt ? 'Gewählt – zum Wechseln ein anderes anklicken.' : 'Klick auf das Bild, das du nehmen willst.'}</span>
            <div className="thumb-wahl">
              {thumb.varianten.map((v) => {
                const an = karte.thumbnail?.gewaehlt && karte.thumbnail.bild === v.pfad
                return (
                  <button key={v.pfad} className={`thumb-knopf${an ? ' on' : ''}`} title={v.titel} onClick={() => tu(window.moin.planungThumbWaehlen(karte.id, v.pfad))}>
                    <img src={v.url} alt={v.titel} />
                    {an && <span className="thumb-haken">✓</span>}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          karte.bildUrl && <img className="thumb-einzeln" src={karte.bildUrl} alt="Thumbnail" />
        )}
        {!thumbLaeuft && (
          <button className={`btn small${karte.thumbnail ? '' : ' primary'}`} onClick={() => tu(window.moin.planungThumbnail(karte.id))}>
            {karte.thumbnail ? 'Neue Thumbnails erstellen' : 'Thumbnail erstellen'}
          </button>
        )}
        {!karte.thumbnail && <span className="muted small">Nimmt Titel und Notizen der Karte als Beschreibung.</span>}
      </div>

      {karte.youtube && (
        <div className="video-zeile">
          <strong>Für YouTube</strong>
          <span className="muted small">Aus dem Export: zum Einfügen beim Hochladen.</span>
          {(
            [
              ['Titel', karte.youtube.titel],
              ['Beschreibung', karte.youtube.beschreibung],
              ['Kapitel', karte.youtube.kapitel]
            ] as const
          )
            .filter(([, text]) => text.trim())
            .map(([name, text]) => (
              <div key={name} className="yt-feld">
                <span className="yt-kopf">
                  <span className="small">{name}</span>
                  <button className="btn small" onClick={() => kopiere(name, text)}>
                    {kopiert === name ? 'Kopiert' : 'Kopieren'}
                  </button>
                </span>
                <pre className="yt-text">{text}</pre>
              </div>
            ))}
        </div>
      )}
      {fehler && <p className="warn small">{fehler}</p>}
    </div>
  )
}
