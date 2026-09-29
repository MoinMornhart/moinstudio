import { useEffect, useState } from 'react'
import type { ClaudeStatusInfo, McpStatus } from '@shared/app'
import { Card } from './Panel'

/** Trägt MoinStudio als MCP-Server in Claude Desktop ein. */
function DesktopConnect(): React.JSX.Element {
  const [status, setStatus] = useState<McpStatus | null>(null)
  const [desktop, setDesktop] = useState<boolean | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void window.moin.mcpStatus().then(setStatus)
    void window.moin.setupChecks().then((c) => setDesktop(c.claudeDesktop))
  }, [])
  if (desktop === false) {
    return (
      <div className="desktop-connect">
        <p className="muted small">Claude Desktop ist nicht installiert. Damit kannst du MoinStudio auch im Chat steuern (optional).</p>
        <button className="btn" onClick={() => void window.moin.openLink('claude-desktop')}>Claude Desktop herunterladen</button>
      </div>
    )
  }
  const connected = !!status && status.configs.length > 0 && status.configs.every((c) => c.current)
  const install = async (): Promise<void> => {
    setError(null)
    try {
      setStatus(await window.moin.mcpInstall())
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }
  return (
    <div className="desktop-connect">
      <p className="muted small">
        {connected
          ? 'Claude Desktop ist mit MoinStudio verbunden – dort kannst du MoinStudio im Chat nutzen.'
          : 'Claude Desktop kann MoinStudio direkt steuern (Status, Aufgaben, Renders ansehen).'}
      </p>
      {status && !status.packaged && <p className="muted small">Entwicklungsversion: Der Eintrag zeigt auf diesen Projektordner.</p>}
      {done && <p className="ok-note">Eingetragen. Bitte Claude Desktop jetzt komplett beenden (auch im Infobereich) und neu starten.</p>}
      {error && <p className="warn">{error}</p>}
      <button className={connected ? 'btn' : 'btn primary'} onClick={() => void install()}>
        {connected ? 'Verbindung erneuern' : 'Mit Claude Desktop verbinden'}
      </button>
    </div>
  )
}

const SUBSCRIPTION: Record<string, string> = { pro: 'Claude Pro', max: 'Claude Max' }

/**
 * Ein Knopf „Mit Claude verbinden“ (Philip, 29.09.): installiert Claude Code bei Bedarf, öffnet Anthropics Anmeldung und
 * prüft danach alle 3 Sekunden (höchstens 10 Minuten), bis die Verbindung per Abo steht.
 */
export function ClaudeVerbinden({ status, onStatus }: { status: ClaudeStatusInfo | null; onStatus: (s: ClaudeStatusInfo) => void }): React.JSX.Element | null {
  const [wartet, setWartet] = useState<'installiert' | 'anmeldung' | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  useEffect(() => {
    if (!wartet) return
    const beginn = Date.now()
    const t = setInterval(() => {
      void window.moin.claudeStatus().then((s) => {
        onStatus(s)
        if (s.usable || Date.now() - beginn > 600_000) {
          setWartet(null)
          clearInterval(t)
        }
      })
    }, 3000)
    return () => clearInterval(t)
  }, [wartet, onStatus])
  if (!status || status.usable) return null
  const verbinden = async (): Promise<void> => {
    setFehler(null)
    try {
      const r = await window.moin.claudeLogin()
      setWartet(r.installiert ? 'installiert' : 'anmeldung')
    } catch (err) {
      setFehler(err instanceof Error ? err.message : String(err))
    }
  }
  return (
    <div className="claude-verbinden">
      <button className="btn primary" disabled={!!wartet} onClick={() => void verbinden()}>
        {wartet ? 'Warte auf deine Anmeldung …' : 'Mit Claude verbinden'}
      </button>
      <p className="muted small">
        {wartet === 'installiert'
          ? 'Im neuen Fenster wird Claude Code eingerichtet, danach öffnet sich die Anmeldung im Browser. Melde dich mit deinem Claude-Konto an – hier wird es automatisch erkannt.'
          : wartet
            ? 'Melde dich im Browser mit deinem Claude-Konto an – hier wird es automatisch erkannt.'
            : 'Öffnet Anthropics offizielle Anmeldung mit deinem Claude-Konto (Abo, kein API-Key). Fehlt Claude Code, wird es vorher automatisch eingerichtet.'}
      </p>
      {fehler && <p className="warn">{fehler}</p>}
    </div>
  )
}

/** Status der Claude-Code-Anbindung: gefunden? per Abo angemeldet? Warnungen? */
export function ClaudeCard(): React.JSX.Element {
  const [status, setStatus] = useState<ClaudeStatusInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const check = async (): Promise<void> => {
    setChecking(true)
    try {
      setStatus(await window.moin.claudeStatus())
    } finally {
      setChecking(false)
    }
  }
  useEffect(() => {
    void window.moin.claudeStatus().then(setStatus)
  }, [])

  return (
    <Card title="Claude (dein Abo)" badge={status && !status.usable ? 'Aktion nötig' : undefined}>
      {!status ? (
        <p className="muted">Prüfe Claude Code …</p>
      ) : (
        <>
          <dl className="facts">
            <dt>Claude Code</dt>
            <dd>{status.cli ? `gefunden${status.version ? ` (Version ${status.version})` : ''}` : 'noch nicht eingerichtet'}</dd>
            <dt>Anmeldung</dt>
            <dd>
              {status.usable
                ? `per Abo (${SUBSCRIPTION[status.subscription ?? ''] ?? status.subscription ?? 'Abo'})`
                : status.loggedIn
                  ? `nicht per Abo (${status.authMethod ?? 'unbekannt'})`
                  : 'nicht angemeldet'}
            </dd>
          </dl>
          {status.problem && <p className="warn">{status.problem}</p>}
          {status.warnings.map((w) => (
            <p key={w} className="warn">{w}</p>
          ))}
          <p className="muted small">
            MoinStudio nutzt ausschließlich dein Claude-Abo – ohne API-Key. Tipp: In claude.ai → Einstellungen → Nutzung die
            „Usage Credits“ ausgeschaltet lassen, dann entstehen nie Zusatzkosten.
          </p>
        </>
      )}
      <div className="row wrap">
        <button className="btn" disabled={checking} onClick={() => void check()}>
          Erneut prüfen
        </button>
      </div>
      <ClaudeVerbinden status={status} onStatus={setStatus} />
      <DesktopConnect />
    </Card>
  )
}
