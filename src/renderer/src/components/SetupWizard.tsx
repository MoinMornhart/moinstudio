import { useEffect, useState } from 'react'
import type { SetupChecks } from '@shared/app'
import { ClaudeCard } from './ClaudeCard'
import { DataDirCard } from './DataDirCard'
import { HardwareCard, useHardwareState } from './HardwareCard'
import { ToolsCard } from './ToolsCard'

const STEPS = ['Willkommen', 'Datenordner', 'Claude', 'Werkzeuge & Hardware', 'Adobe', 'Fertig'] as const

function Welcome(): React.JSX.Element {
  return (
    <div className="setup-text">
      <h2>Moin! 👋</h2>
      <p>
        MoinStudio erstellt Thumbnails mit deinem Minecraft-Skin, schneidet Videos und plant deine Uploads – alles auf diesem
        Rechner und mit deinem Claude-Abo, ohne API-Kosten.
      </p>
      <p>Die Einrichtung dauert ein paar Minuten:</p>
      <ol>
        <li>Datenordner wählen (z. B. in OneDrive, damit PC und Laptop dieselben Skins und Pläne haben)</li>
        <li>Claude prüfen (Claude Code mit deinem Abo, optional Claude Desktop)</li>
        <li>Werkzeuge laden und die beste Einstellung für diesen Rechner messen</li>
        <li>Adobe erkennen – fehlt es, ist das kein Problem</li>
      </ol>
      <p className="muted">Jeder Schritt lässt sich überspringen und später in den Einstellungen nachholen.</p>
    </div>
  )
}

function ToolsStep(): React.JSX.Element {
  const hw = useHardwareState()
  const [starting, setStarting] = useState(false)
  const running = hw?.state === 'running'
  const start = async (): Promise<void> => {
    setStarting(true)
    try {
      await window.moin.installTool('uv')
      await window.moin.runHardwareTest()
    } finally {
      setStarting(false)
    }
  }
  return (
    <>
      <div className="setup-text">
        <p>
          MoinStudio lädt Blender, FFmpeg und die Python-Laufzeit von den offiziellen Seiten (ohne Admin-Rechte, per Prüfsumme
          kontrolliert) und misst dann kurz, was dieser Rechner am besten kann – Grafikkarte, Prozessor, Video-Encoder.
        </p>
        {hw?.state !== 'done' && (
          <button className="btn primary" disabled={running || starting} onClick={() => void start()}>
            {running || starting ? 'Läuft …' : 'Jetzt automatisch einrichten'}
          </button>
        )}
      </div>
      <div className="grid">
        <HardwareCard />
        <ToolsCard />
      </div>
    </>
  )
}

function AdobeStep(): React.JSX.Element {
  const [checks, setChecks] = useState<SetupChecks | null>(null)
  useEffect(() => {
    void window.moin.setupChecks().then(setChecks)
  }, [])
  if (!checks) return <p className="muted">Suche nach Adobe-Programmen …</p>
  return (
    <div className="setup-text">
      {checks.adobe.length === 0 ? (
        <>
          <h2>Kein Adobe gefunden – alles gut</h2>
          <p>
            MoinStudio läuft vollständig ohne Adobe: Thumbnails entstehen mit Blender und der eigenen Bildbearbeitung, Videos
            schneidet FFmpeg. Schnitte lassen sich zusätzlich als Premiere-Projekt (XML) exportieren.
          </p>
          <p className="muted">
            Sobald Premiere Pro, After Effects oder Photoshop installiert sind, erkennt MoinStudio sie beim Start. Die
            Adobe-Anbindung ist bis zum ersten erfolgreichen Test als „ungetestet“ markiert.
          </p>
        </>
      ) : (
        <>
          <h2>Adobe gefunden</h2>
          <ul>
            {checks.adobe.map((a) => (
              <li key={a.id}>{a.name}</li>
            ))}
          </ul>
          <p className="muted">Die Adobe-Anbindung ist noch „ungetestet“ und wird in einem späteren Update aktiviert.</p>
        </>
      )}
    </div>
  )
}

function Done(): React.JSX.Element {
  return (
    <div className="setup-text">
      <h2>Fertig eingerichtet 🎉</h2>
      <p>Gut zu wissen:</p>
      <ul>
        <li>
          <b>Updates:</b> MoinStudio prüft beim Start auf neue Versionen und installiert sie auf Knopfdruck.
        </li>
        <li>
          <b>Windows-Warnung:</b> Die App ist nicht signiert. Bei neuen Versionen kann SmartScreen fragen – „Weitere
          Informationen“ → „Trotzdem ausführen“. Steht <i>Smart App Control</i> auf „Ein“, blockiert Windows die App.
        </li>
        <li>
          <b>Nebenbei arbeiten:</b> Unten links in der Seitenleiste pausiert „Rechenlast pausieren“ alle Renders.
        </li>
        <li>
          <b>Claude-Kosten:</b> In claude.ai → Einstellungen → Nutzung die „Usage Credits“ ausgeschaltet lassen, dann bleibt
          alles im Abo.
        </li>
      </ul>
    </div>
  )
}

/** Einrichtungsassistent beim ersten Start (liegt über der ganzen App). */
export function SetupWizard({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [step, setStep] = useState(0)
  useEffect(() => window.moin.onSetupStep(setStep), [])
  const last = step === STEPS.length - 1
  const finish = async (): Promise<void> => {
    await window.moin.setupComplete(true)
    onDone()
  }
  return (
    <div className="setup-overlay" role="dialog" aria-modal="true" aria-label="Einrichtung">
      <div className="setup-panel">
        <ol className="setup-steps">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? 'active' : i < step ? 'done' : ''}>
              <span className="num">{i < step ? '✓' : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <div className="setup-body">
          {step === 0 && <Welcome />}
          {step === 1 && <DataDirCard />}
          {step === 2 && <ClaudeCard />}
          {step === 3 && <ToolsStep />}
          {step === 4 && <AdobeStep />}
          {step === 5 && <Done />}
        </div>
        <div className="setup-nav">
          <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Zurück
          </button>
          <span className="muted small">Schritt {step + 1} von {STEPS.length}</span>
          {last ? (
            <button className="btn primary" onClick={() => void finish()}>
              MoinStudio starten
            </button>
          ) : (
            <button className="btn primary" onClick={() => setStep(step + 1)}>
              {step === 0 ? "Los geht's" : 'Weiter'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
