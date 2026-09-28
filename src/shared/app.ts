import type { HardwareState } from './hardware'
import type { QueueState } from './jobs'

/** Reiter der Hauptoberfläche. Reihenfolge = Reihenfolge in der Navigation. */
export const TABS = [
  { id: 'thumbnail', label: 'Thumbnail', icon: '🎨' },
  { id: 'schnitt', label: 'Schnitt', icon: '✂️' },
  { id: 'planung', label: 'Planung', icon: '🗂️' },
  { id: 'einstellungen', label: 'Einstellungen', icon: '⚙️' }
] as const

export type TabId = (typeof TABS)[number]['id']

export function isTabId(value: unknown): value is TabId {
  return typeof value === 'string' && TABS.some((t) => t.id === value)
}

/** IPC-Kanalnamen zwischen Main und Renderer an einer Stelle. */
export const IPC = {
  appInfo: 'app:info',
  selectTab: 'ui:select-tab',
  autostartGet: 'autostart:get',
  autostartSet: 'autostart:set',
  updateCheck: 'update:check',
  updateDownload: 'update:download',
  updateInstall: 'update:install',
  updateStatus: 'update:status',
  openLogs: 'app:open-logs',
  dataStatus: 'data:status',
  dataChoose: 'data:choose',
  dataOpen: 'data:open',
  toolsStatus: 'tools:status',
  toolsInstall: 'tools:install',
  toolsProgress: 'tools:progress',
  /** invoke: aktuellen Zustand holen · event: Zustandsänderung */
  hwState: 'hw:state',
  hwRun: 'hw:run',
  hwProbe: 'hw:probe',
  jobsState: 'jobs:state',
  jobsAction: 'jobs:action',
  jobsImage: 'jobs:image',
  claudeStatus: 'claude:status',
  mcpStatus: 'mcp:status',
  mcpInstall: 'mcp:install',
  setupState: 'setup:state',
  setupComplete: 'setup:complete',
  setupChecks: 'setup:checks',
  setupStep: 'ui:setup-step',
  openLink: 'app:open-link',
  claudeLogin: 'claude:login',
} as const

export interface SetupChecks {
  claudeDesktop: boolean
  adobe: { id: string; name: string }[]
}

export type ExternalLink = 'claude-code' | 'claude-desktop'

/** Ist MoinStudio in Claude Desktop eingetragen? (eine Zeile pro gefundener Konfigurationsdatei) */
export interface McpStatus {
  configs: { path: string; installed: boolean; current: boolean }[]
  packaged: boolean
}

/** Zustand der Claude-Code-Anbindung (nur Abo-Login ist zulässig). */
export interface ClaudeStatusInfo {
  cli: string | null
  version: string | null
  loggedIn: boolean
  authMethod: string | null
  subscription: string | null
  usable: boolean
  warnings: string[]
  problem: string | null
}

export type JobAction = 'pause' | 'resume' | 'cancel' | 'pauseAll' | 'resumeAll'

export interface ToolStatus {
  id: 'blender' | 'ffmpeg' | 'uv'
  label: string
  version: string
  installed: boolean
  path: string | null
  sizeBytes: number
}

export interface ToolProgressEvent {
  id: ToolStatus['id']
  version: string
  phase: 'check' | 'download' | 'verify' | 'extract' | 'done' | 'error'
  percent: number | null
  message?: string
}

export interface DataDirStatus {
  /** Gewählter Datenordner oder null, wenn noch keiner eingerichtet ist */
  dataDir: string | null
  /** false, wenn der Ordner fehlt (z. B. OneDrive noch nicht synchronisiert oder Laufwerk getrennt) */
  available: boolean
  /** OneDrive-Konfliktkopien (relativ zum Datenordner) */
  conflicts: { original: string; copy: string }[]
}

/** Zustand der Update-Funktion (GitHub-Releases über electron-updater). */
export type UpdateStatus =
  | { state: 'dev' }
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'none'; version: string }
  | { state: 'available'; version: string; notes: string }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

export interface AutostartState {
  /** false in der Entwicklungsumgebung: dort würde sonst electron.exe eingetragen. */
  available: boolean
  enabled: boolean
}

export interface AppInfo {
  name: string
  version: string
  platform: string
  arch: string
  electron: string
  chrome: string
  node: string
}

/** Die über die Preload-Brücke erreichbare API (`window.moin`). */
export interface MoinApi {
  appInfo(): Promise<AppInfo>
  onSelectTab(handler: (tab: TabId) => void): () => void
  getAutostart(): Promise<AutostartState>
  setAutostart(enabled: boolean): Promise<AutostartState>
  checkForUpdate(): Promise<UpdateStatus>
  downloadUpdate(): Promise<void>
  installUpdate(): Promise<void>
  onUpdateStatus(handler: (status: UpdateStatus) => void): () => void
  openLogs(): Promise<void>
  dataStatus(): Promise<DataDirStatus>
  /** Öffnet den Ordner-Dialog; null, wenn abgebrochen */
  chooseDataDir(): Promise<DataDirStatus | null>
  openDataDir(): Promise<void>
  toolsStatus(): Promise<ToolStatus[]>
  installTool(id: ToolStatus['id']): Promise<ToolStatus[]>
  onToolProgress(handler: (p: ToolProgressEvent) => void): () => void
  hardwareState(): Promise<HardwareState>
  runHardwareTest(): Promise<HardwareState>
  onHardwareState(handler: (s: HardwareState) => void): () => void
  /** Startet den Job „Probebild“ mit der Vorschau-Einstellung; liefert die Job-ID */
  probeRender(): Promise<string>
  jobsState(): Promise<QueueState>
  jobAction(action: JobAction, id?: string): Promise<QueueState>
  onJobsState(handler: (s: QueueState) => void): () => void
  /** Ergebnisbild eines Jobs als Data-URL (oder null) */
  jobImage(id: string): Promise<string | null>
  claudeStatus(): Promise<ClaudeStatusInfo>
  mcpStatus(): Promise<McpStatus>
  /** Trägt MoinStudio als MCP-Server in Claude Desktop ein (mit Backup) */
  mcpInstall(): Promise<McpStatus>
  /** true = Einrichtungsassistent wurde abgeschlossen */
  setupState(): Promise<boolean>
  setupComplete(done: boolean): Promise<boolean>
  setupChecks(): Promise<SetupChecks>
  onSetupStep(handler: (step: number) => void): () => void
  openLink(key: ExternalLink): Promise<void>
  /** Öffnet ein Terminal mit Anthropics offiziellem Login (claude auth login) */
  claudeLogin(): Promise<void>
  /** null = noch kein Datenordner */
  /** Skin eines Freundes per Minecraft-Name holen (Mojang, Cache im Datenordner) und in die Bibliothek legen */
  /** Einmal-Outfit: neuer Skin mit umgefärbter Kleidung (part: hose, schuhe, oberteil, aermel; color: rot, blau …) */
  /** Startet den Job „Thumbnail planen“ (Claude-Abo); liefert die Job-ID */
  /** Logo auswählen (Server-Logo oder Projekt-Logo): Pfad und kleine Vorschau; null = abgebrochen */
  /** Reaction-Thumbnail: öffnet den Dateidialog fürs Original und startet den Job; null = abgebrochen */
  /** Spiele-Vorlage: fremdes Thumbnail wählen, Philip ersetzt die Person darin */
  /** Veränderungen (ROADMAP 6): Referenz-Thumbnail wählen, Claude analysiert es und baut es eigenständig mit Philips Skin neu */
  /** Alle Thumbnail-Aufträge (neueste zuerst) mit Status und fertigen Varianten */
  /** Bild eines Auftrags als Data-URL (nur Dateien im Datenordner) */
  /** Speichern-unter-Dialog; liefert den Zielpfad oder null */
  /** Blender-Datei einer Variante sichtbar in Blender öffnen, mit MoinStudio-Add-on (ROADMAP 6.6) */
  /** Add-on dauerhaft installieren und Startmenü-Verknüpfung anlegen (ROADMAP 6.6) */
  /** Schnitt (ROADMAP 7.1): Video wählen und importieren (Analyse, Waveform, Vorschau); null = abgebrochen */
  /** Schnitt planen (ROADMAP 7.5): mit Claude oder nur Rohschnitt; target = Sekunden (0 = Rohschnitt-Länge) */
  /** Von Hand geänderten Plan speichern (Timeline, ROADMAP 7.6) */
  /** Datei für Musik, Intro oder Outro wählen (ROADMAP 7.7); null = abgebrochen */
  /** Fertiges Video rendern (ROADMAP 7.7) */
  /** Soundeffekte im Sound-Ordner (Datenordner/sounds) */
  /** Sound- oder Meme-Ordner im Explorer öffnen (wird angelegt) */
  /** Fertiges Video an einen Ort nach Wahl kopieren */
  /** Kapitelmarken als Text für die YouTube-Beschreibung (ROADMAP 7.9); null = keine */
  /** Nachbearbeitung per Freitext: Variante `index` eines Auftrags ändern („Apfel größer“); liefert die Job-ID */
}
