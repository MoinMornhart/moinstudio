import { useEffect, useState } from 'react'
import type { PlanungClaudeArt, PlanungClaudeErgebnis, PlanungClaudeStand, PlanungKanal, PlanungKarte } from '@shared/app'
import { teileTermin, WOCHENTAGE_KURZ } from '@shared/kalender'

const fehlerText = (e: unknown): string => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** Startet einen Claude-Auftrag der Planung und verfolgt ihn, bis er fertig ist. */
export function useClaudeAuftrag<A extends PlanungClaudeArt>(art: A): {
  stand: PlanungClaudeStand | null
  ergebnis: Extract<PlanungClaudeErgebnis, { art: A }> | null
  laeuft: boolean
  fehler: string | null
  starte: (o?: { kanal?: string; wunsch?: string; karte?: string; projekt?: string }) => void
} {
  const [auftrag, setAuftrag] = useState<string | null>(null)
  const [stand, setStand] = useState<PlanungClaudeStand | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const laeuft = !!auftrag && (!stand || !['done', 'failed', 'cancelled'].includes(stand.state))
  useEffect(() => {
    if (!auftrag || !laeuft) return
    const t = setInterval(() => void window.moin.planungClaudeStand(auftrag).then(setStand), 1500)
    return () => clearInterval(t)
  }, [auftrag, laeuft])
  return {
    stand,
    ergebnis: stand?.ergebnis?.art === art ? (stand.ergebnis as Extract<PlanungClaudeErgebnis, { art: A }>) : null,
    laeuft,
    fehler: fehler ?? (stand?.state === 'failed' ? (stand.error ?? 'Fehlgeschlagen') : null),
    starte: (o) => {
      setFehler(null)
      setStand(null)
      window.moin.planungClaude(art, o).then(setAuftrag, (e: unknown) => setFehler(fehlerText(e)))
    }
  }
}

export function Fortschritt({ stand, text }: { stand: PlanungClaudeStand | null; text: string }): React.JSX.Element {
  const wartet = stand?.state === 'queued' || stand?.state === 'waiting-limit'
  return (
    <p className="muted small claude-laeuft">
      <span className="spinner" aria-hidden="true" />
      {wartet ? (stand?.state === 'waiting-limit' ? 'Claude-Limit erreicht – geht danach von selbst weiter.' : 'Wartet auf andere Aufgaben …') : stand?.step || text}
    </p>
  )
}

/** Ideenfinder je Kanal (ROADMAP 7.6) */
export function IdeenFinder({ kanal, uebernehmen }: { kanal: PlanungKanal; uebernehmen: (titel: string, idee: string) => Promise<void> }): React.JSX.Element {
  const a = useClaudeAuftrag('ideen')
  const [wunsch, setWunsch] = useState('')
  const [genommen, setGenommen] = useState<Set<string>>(new Set())
  return (
    <section className="ideen-finder">
      <div className="row wrap" style={{ marginTop: 0 }}>
        <input className="input" placeholder={`Wunsch (optional), z. B. „mit SimPell“, „Halloween“, „kurze Challenge“`} value={wunsch} onChange={(e) => setWunsch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !a.laeuft && a.starte({ kanal, wunsch })} />
        <button className="btn primary" disabled={a.laeuft} onClick={() => a.starte({ kanal, wunsch })}>
          {a.ergebnis ? 'Neue Ideen' : `10 Ideen für ${kanal}`}
        </button>
      </div>
      {a.laeuft && <Fortschritt stand={a.stand} text="Claude sucht Ideen …" />}
      {a.fehler && <p className="warn small">{a.fehler}</p>}
      {a.ergebnis && (
        <div className="ideen-liste">
          {a.ergebnis.ideen.map((i) => (
            <div key={i.titel} className="idee">
              <div className="idee-text">
                <strong>{i.titel}</strong>
                <span className="small">{i.idee}</span>
                <span className="muted small">{i.warum}</span>
              </div>
              <button
                className="btn small"
                disabled={genommen.has(i.titel)}
                onClick={() => void uebernehmen(i.titel, i.idee).then(() => setGenommen(new Set([...genommen, i.titel])))}
              >
                {genommen.has(i.titel) ? 'Übernommen' : 'Als Idee übernehmen'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** Titelvorschläge für eine Karte */
export function TitelVorschlaege({ karte, setze }: { karte: PlanungKarte; setze: (titel: string) => void }): React.JSX.Element {
  const a = useClaudeAuftrag('titel')
  return (
    <div className="details-block">
      <span className="row" style={{ marginTop: 0, alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="muted small">Titel</span>
        <button className="btn small" disabled={a.laeuft} onClick={() => a.starte({ karte: karte.id })}>
          {a.ergebnis ? 'Neue Vorschläge' : 'Titel vorschlagen'}
        </button>
      </span>
      {a.laeuft && <Fortschritt stand={a.stand} text="Claude schreibt Titel …" />}
      {a.fehler && <p className="warn small">{a.fehler}</p>}
      {a.ergebnis?.titel.map((t) => (
        <button key={t.titel} className={`titel-vorschlag${t.titel === karte.titel ? ' on' : ''}`} title={t.warum} onClick={() => setze(t.titel)}>
          <span>{t.titel}</span>
          <span className="muted small">{t.warum}</span>
        </button>
      ))}
    </div>
  )
}

/** Wochenplan-Vorschlag im Kalender */
export function WochenPlaner({ karten, termin }: { karten: PlanungKarte[]; termin: (id: string, termin: string) => void }): React.JSX.Element {
  const a = useClaudeAuftrag('woche')
  const [uebernommen, setUebernommen] = useState<Set<string>>(new Set())
  const titel = (id: string): string => karten.find((k) => k.id === id)?.titel ?? 'Karte gelöscht'
  const wann = (t: string): string => {
    const { tag, zeit } = teileTermin(t)
    return `${WOCHENTAGE_KURZ[new Date(`${tag}T12:00`).getDay()]} ${tag.slice(8)}.${tag.slice(5, 7)}. ${zeit}`
  }
  const nimm = (id: string, t: string): void => {
    termin(id, t)
    setUebernommen((u) => new Set([...u, id]))
  }
  const offen = a.ergebnis?.woche.plan.filter((p) => !uebernommen.has(p.karte)) ?? []
  return (
    <section>
      <h3>Wochenplan</h3>
      <p className="muted small">Claude verteilt deine Karten auf die freien Upload-Termine der nächsten zwei Wochen.</p>
      <button className="btn small" disabled={a.laeuft} onClick={() => a.starte()}>
        {a.ergebnis ? 'Neu vorschlagen' : 'Plan vorschlagen'}
      </button>
      {a.laeuft && <Fortschritt stand={a.stand} text="Claude plant …" />}
      {a.fehler && <p className="warn small">{a.fehler}</p>}
      {a.ergebnis && (
        <div className="wochen-plan">
          {a.ergebnis.woche.plan.length === 0 && <p className="muted small">Kein Vorschlag – es fehlen freie Termine oder Karten ohne Termin.</p>}
          {a.ergebnis.woche.plan.map((p) => (
            <div key={p.karte} className="plan-zeile">
              <span className="small">
                <strong>{wann(p.termin)}</strong> {titel(p.karte)}
              </span>
              <span className="muted small">{p.grund}</span>
              <button className="btn small" disabled={uebernommen.has(p.karte)} onClick={() => nimm(p.karte, p.termin)}>
                {uebernommen.has(p.karte) ? 'Eingeplant' : 'Einplanen'}
              </button>
            </div>
          ))}
          {offen.length > 1 && (
            <button className="btn small primary" onClick={() => offen.forEach((p) => nimm(p.karte, p.termin))}>
              Alle einplanen
            </button>
          )}
          {a.ergebnis.woche.aufnehmen.length > 0 && (
            <>
              <span className="small">
                <strong>Diese Woche aufnehmen</strong>
              </span>
              {a.ergebnis.woche.aufnehmen.map((x) => (
                <span key={x.karte} className="small">
                  • {titel(x.karte)} <span className="muted">– {x.grund}</span>
                </span>
              ))}
            </>
          )}
          {a.ergebnis.woche.hinweis && <p className="muted small">{a.ergebnis.woche.hinweis}</p>}
        </div>
      )}
    </section>
  )
}
