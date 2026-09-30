import { useEffect, useRef, useState } from 'react'
import { LOGO_GROESSEN, LOGO_POSITIONEN, type LogoEintrag, type ThumbLogoWahl } from '@shared/app'

/**
 * Logo für jedes Thumbnail (Philip, 30.09.): Auswahl aus der Logo-Bibliothek (Reiter „Logo“) oder Hochladen, dazu Platz
 * und Größe. Voreinstellung ist das Standard-Logo des Kanals – gibt es keins, kommt kein Logo aufs Bild.
 */

/** Bilddatei (PNG, JPG, WEBP oder SVG) → PNG-Data-URL mit Transparenz; SVGs werden mit 1024 px gerastert */
export async function dateiAlsPng(datei: File): Promise<string> {
  const url = await new Promise<string>((ok, fehler) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result))
    r.onerror = () => fehler(new Error('Datei nicht lesbar'))
    r.readAsDataURL(datei)
  })
  const img = await new Promise<HTMLImageElement>((ok, fehler) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = () => fehler(new Error('Das Bild ließ sich nicht öffnen.'))
    i.src = url
  })
  const svg = datei.type.includes('svg') || datei.name.toLowerCase().endsWith('.svg')
  const b0 = img.naturalWidth || 1024
  const h0 = img.naturalHeight || 1024
  const f = svg ? 1024 / Math.max(b0, h0) : Math.min(1, 2048 / Math.max(b0, h0))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(b0 * f))
  c.height = Math.max(1, Math.round(h0 * f))
  c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/png')
}

/** Vorschaubild eines Logos aus der Bibliothek (auf Schachbrett, damit Transparenz sichtbar ist) */
export function LogoBild({ id, hoehe = 40 }: { id: string; hoehe?: number }): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let aktiv = true
    void window.moin.logoBild(id).then((d) => aktiv && setSrc(d))
    return () => {
      aktiv = false
    }
  }, [id])
  return <span className="logo-vorschau" style={{ height: hoehe }}>{src ? <img src={src} alt="" /> : '…'}</span>
}

/** Knopf „Logo hochladen …“ (Dateiauswahl in der Oberfläche, damit auch SVG geht) */
export function LogoHochladen({ onFertig, klein }: { onFertig: (logos: LogoEintrag[]) => void; klein?: boolean }): React.JSX.Element {
  const eingabe = useRef<HTMLInputElement>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)
  return (
    <>
      <input
        ref={eingabe}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
        style={{ display: 'none' }}
        onChange={(e) => {
          const datei = e.target.files?.[0]
          e.target.value = ''
          if (!datei) return
          setFehler(null)
          setLaedt(true)
          void dateiAlsPng(datei)
            .then((png) => window.moin.logoHochladen(datei.name.replace(/\.[^.]+$/, ''), png))
            .then(onFertig, (err: unknown) => setFehler(err instanceof Error ? err.message : String(err)))
            .finally(() => setLaedt(false))
        }}
      />
      <button className={klein ? 'btn small' : 'btn'} disabled={laedt} onClick={() => eingabe.current?.click()}>
        {laedt ? 'Lade …' : 'Logo hochladen …'}
      </button>
      {fehler && <span className="warn small">{fehler}</span>}
    </>
  )
}

export function LogoWahl({ kanal, wert, onWert }: { kanal: string; wert: ThumbLogoWahl | undefined; onWert: (w: ThumbLogoWahl | undefined) => void }): React.JSX.Element {
  const [logos, setLogos] = useState<LogoEintrag[]>([])
  useEffect(() => {
    void window.moin.logoListe().then(setLogos, () => setLogos([]))
  }, [])
  const standard = logos.find((l) => l.standard.includes(kanal))
  const id = wert?.id ?? ''
  const gewaehlt = id === 'standard' ? standard : logos.find((l) => l.id === id)
  const setze = (patch: Partial<ThumbLogoWahl>): void => onWert({ id: wert?.id ?? 'standard', position: wert?.position ?? 'auto', groesse: wert?.groesse ?? 'mittel', ...patch })
  return (
    <div className="logo-wahl">
      <span className="muted small">Logo:</span>
      <select className="input" value={id} onChange={(e) => (e.target.value ? setze({ id: e.target.value }) : onWert(undefined))} style={{ flex: '0 1 230px' }}>
        <option value="standard">{standard ? `Standard (${standard.name})` : `Standard von ${kanal} (keins festgelegt)`}</option>
        <option value="">Ohne Logo</option>
        {logos.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      {gewaehlt && (
        <>
          <LogoBild id={gewaehlt.id} hoehe={30} />
          <select className="input" value={wert?.position ?? 'auto'} onChange={(e) => setze({ position: e.target.value as ThumbLogoWahl['position'] })} style={{ flex: '0 1 150px' }}>
            {LOGO_POSITIONEN.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select className="input" value={wert?.groesse ?? 'mittel'} onChange={(e) => setze({ groesse: e.target.value as ThumbLogoWahl['groesse'] })} style={{ flex: '0 1 110px' }}>
            {LOGO_GROESSEN.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </>
      )}
      <LogoHochladen
        klein
        onFertig={(neu) => {
          setLogos(neu)
          const letztes = neu[neu.length - 1]
          if (letztes) setze({ id: letztes.id })
        }}
      />
    </div>
  )
}
