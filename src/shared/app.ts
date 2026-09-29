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
  thumbSkins: 'thumb:skins',
  thumbSkinAdd: 'thumb:skin-add',
  thumbSkinUpdate: 'thumb:skin-update',
  thumbSkinBild: 'thumb:skin-bild',
  thumbStart: 'thumb:start',
  thumbAuftraege: 'thumb:auftraege',
  thumbErgebnis: 'thumb:ergebnis',
  thumbSpeichern: 'thumb:speichern',
  thumbVideo: 'thumb:video',
  thumbVideoErgebnis: 'thumb:video-ergebnis'
} as const

/** Skin in der Bibliothek des Datenordners (Philip lädt seine Skins selbst hoch). */
export interface ThumbSkin {
  id: string
  name: string
  datei: string
  /** „ich“ = Philips Hauptskin (genau einer), sonst Freund */
  rolle: 'ich' | 'freund'
  slim: boolean | null
}

export interface ThumbStart {
  beschreibung: string
  kanal?: string
  /** Skin-IDs der Freunde, die mit ins Bild sollen */
  freunde?: string[]
  anzahl?: number
}

export interface ThumbAuftrag {
  id: string
  /** Thumbnail-Auftrag oder Video-Auswertung */
  art: 'thumbnail' | 'video'
  titel: string
  state: string
  progress: number | null
  step: string
  error: string | null
  createdAt: string
}

/** Video-Auswertung: Inhalt, Vorschläge (Freunde als Skin-IDs) und die Bildbögen, die Claude gesehen hat */
export interface ThumbVideoErgebnis {
  inhalt: string
  vorschlaege: { beschreibung: string; warum: string; freunde: string[]; zeitpunkt?: string }[]
  boegen: string[]
}

export interface ThumbErgebnis {
  varianten: {
    titel: string
    warum: string
    vorbild: { kanal: string; titel: string; url: string } | null
    bild: string | null
    warnungen: string[]
    fehler: string | null
  }[]
}

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
  /** Skin-Bibliothek (Datenordner/skins) */
  thumbSkins(): Promise<ThumbSkin[]>
  /** Dateidialog: Skins hochladen; rolle „ich“ = Philips Hauptskin */
  thumbSkinAdd(rolle: 'ich' | 'freund'): Promise<ThumbSkin[]>
  /** Umbenennen, zum Hauptskin machen oder entfernen */
  thumbSkinUpdate(id: string, patch: { name?: string; rolle?: 'ich'; entfernen?: boolean }): Promise<ThumbSkin[]>
  /** Skin-Bild als Data-URL */
  thumbSkinBild(id: string): Promise<string | null>
  /** Startet den Job „Thumbnail“ (Claude plant, Blender rendert); liefert die Job-ID */
  thumbStart(start: ThumbStart): Promise<string>
  /** Alle Thumbnail-Aufträge, neueste zuerst */
  thumbAuftraege(): Promise<ThumbAuftrag[]>
  /** Fertige Varianten eines Auftrags mit Bild und Vorbild */
  thumbErgebnis(jobId: string): Promise<ThumbErgebnis | null>
  /** Speichern-unter-Dialog für eine Variante; liefert den Zielpfad oder null */
  thumbSpeichern(jobId: string, index: number): Promise<string | null>
  /** Dateidialog: Video wählen, Claude schlägt Thumbnails vor; liefert die Job-ID oder null */
  thumbVideo(kanal: string, titel?: string): Promise<string | null>
  thumbVideoErgebnis(jobId: string): Promise<ThumbVideoErgebnis | null>
}
