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
            <dd>{status.cli ? `gefunden${status.version ? ` (Version ${status.version})` : ''}` : 'nicht gefunden'}</dd>
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
        {status && !status.cli && (
          <button className="btn primary" onClick={() => void window.moin.openLink('claude-code')}>
            Claude Code herunterladen
          </button>
        )}
        {status?.cli && !status.usable && (
          <button className="btn primary" onClick={() => void window.moin.claudeLogin()}>
            Mit Claude-Konto anmelden
          </button>
        )}
        <button className="btn" disabled={checking} onClick={() => void check()}>
          Erneut prüfen
        </button>
      </div>
      {status?.cli && !status.usable && (
        <p className="muted small">
          Es öffnet sich ein Fenster mit Anthropics offizieller Anmeldung. Danach hier auf „Erneut prüfen“ klicken.
        </p>
      )}
      <DesktopConnect />
    </Card>
  )
}
