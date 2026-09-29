import type { Rhythmus } from './kalender'
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
  thumbSkinName: 'thumb:skin-name',
  thumbSkinUpdate: 'thumb:skin-update',
  thumbSkinBild: 'thumb:skin-bild',
  thumbStart: 'thumb:start',
  thumbAuftraege: 'thumb:auftraege',
  thumbErgebnis: 'thumb:ergebnis',
  thumbSpeichern: 'thumb:speichern',
  thumbVideo: 'thumb:video',
  thumbVideoErgebnis: 'thumb:video-ergebnis',
  thumbReaktion: 'thumb:reaktion',
  thumbSpielvorlage: 'thumb:spielvorlage',
  thumbAendern: 'thumb:aendern',
  thumbLoeschen: 'thumb:loeschen',
  schnittProjekte: 'schnitt:projekte',
  schnittImport: 'schnitt:import',
  schnittWellenform: 'schnitt:wellenform',
  schnittLoeschen: 'schnitt:loeschen',
  schnittTranskript: 'schnitt:transkript',
  schnittTranskriptStart: 'schnitt:transkript-start',
  schnittRohschnittStart: 'schnitt:rohschnitt-start',
  schnittListe: 'schnitt:liste',
  schnittUmschalten: 'schnitt:umschalten',
  schnittBereich: 'schnitt:bereich',
  schnittWunsch: 'schnitt:wunsch',
  schnittEinstellungen: 'schnitt:einstellungen',
  schnittVorschau: 'schnitt:vorschau',
  schnittExport: 'schnitt:export',
  schnittExportInfo: 'schnitt:export-info',
  schnittExportSpeichern: 'schnitt:export-speichern',
  schnittThumbnail: 'schnitt:thumbnail',
  schnittHighlightsStart: 'schnitt:highlights-start',
  schnittHighlights: 'schnitt:highlights',
  schnittClips: 'schnitt:clips',
  schnittClipDateien: 'schnitt:clip-dateien',
  schnittClipOrdner: 'schnitt:clip-ordner',
  planungKarten: 'planung:karten',
  planungNeu: 'planung:neu',
  planungAendern: 'planung:aendern',
  planungVerschieben: 'planung:verschieben',
  planungLoeschen: 'planung:loeschen',
  planungRhythmus: 'planung:rhythmus',
  planungRhythmusSetzen: 'planung:rhythmus-setzen',
  /** Ereignis: Karten im Datenordner haben sich geändert */
  planungGeaendert: 'planung:geaendert'
} as const

/** Planung (ROADMAP 7.2/7.3): Spalten des Boards in fester Reihenfolge */
export const PLANUNG_SPALTEN = [
  { id: 'idee', name: 'Idee' },
  { id: 'aufnahme', name: 'Aufnahme' },
  { id: 'schnitt', name: 'Schnitt' },
  { id: 'thumbnail', name: 'Thumbnail' },
  { id: 'upload', name: 'Upload' },
  { id: 'veroeffentlicht', name: 'Veröffentlicht' }
] as const
export type PlanungSpalte = (typeof PLANUNG_SPALTEN)[number]['id']
export type PlanungKanal = 'MoinMornhart' | 'MoinMorni'

/** Planungskarte, eine Datei pro Karte im Datenordner */
export interface PlanungKarte {
  id: string
  kanal: PlanungKanal
  spalte: PlanungSpalte
  ordnung: number
  titel: string
  notizen: string
  checkliste: { text: string; erledigt: boolean }[]
  /** Upload-Termin als lokale Zeit „2026-10-03T17:00“ */
  termin: string | null
  thumbnail: string | null
  schnitt: string | null
  youtube: { titel: string; beschreibung: string; kapitel: string } | null
  erstellt: string
  rev: number
  updatedAt: string
  updatedBy: string
}
export type PlanungAenderung = Partial<Pick<PlanungKarte, 'kanal' | 'spalte' | 'titel' | 'notizen' | 'checkliste' | 'termin' | 'thumbnail' | 'schnitt' | 'youtube'>>

/** Skin in der Bibliothek des Datenordners (Philip lädt seine Skins selbst hoch). */
/** Transkript-Abschnitt mit Wortzeiten (ROADMAP 6.3) */
export interface SchnittAbschnitt {
  start: number
  ende: number
  text: string
  woerter: { start: number; ende: number; wort: string; p: number }[]
}

/** Schnittliste (ROADMAP 6.4): was vom Original bleibt und was mit welchem Grund rausfliegt */
export interface SchnittListe {
  version: 1
  dauer: number
  behalten: { start: number; ende: number }[]
  entfernt: { start: number; ende: number; grund: 'pause' | 'aehm' | 'wiederholung' | 'versprecher' | 'leerlauf' | 'manuell'; text?: string; aus?: boolean }[]
}

/** Höhepunkt aus einem Stream (ROADMAP 6.8) */
export interface SchnittHighlight {
  start: number
  ende: number
  titel: string
  grund: string
  wert: number
}

/** Export-Ergebnis (ROADMAP 6.7) */
export interface SchnittExport {
  url: string
  laenge: number
  titel: string[]
  beschreibung: string
  kapitel: { zeit: number; titel: string }[]
  kapitelText: string
  pruefung: { punkt: string; ok: boolean; wert: string }[]
}

/** Schnitt-Projekt für die Oberfläche (ROADMAP 6.2) */
export interface SchnittProjekt {
  id: string
  name: string
  kanal: string
  erstellt: string
  quelle: { pfad: string; dauer: number; breite: number; hoehe: number; fps: number; groesse: number; audio: boolean } | null
  /** moin-media://…-Adressen, sobald die Datei fertig ist */
  proxyUrl: string | null
  leisteUrl: string | null
  wellenform: boolean
  transkript: boolean
  rohschnitt: boolean
  einstellungen: { untertitel: 'aus' | 'an' | 'karaoke'; zooms: boolean }
  exportiert: boolean
  /** Stream-Highlights (ROADMAP 6.8): Anzahl oder null (noch nicht gesucht), Stand der Clips */
  highlights: number | null
  clipsStand: number | null
  /** geschnittene Vorschau (ROADMAP 6.6), sobald gerendert */
  vorschauUrl: string | null
  /** laufender Auftrag (Import, Transkript …) */
  auftrag: { state: string; progress: number | null; step: string; error: string | null } | null
}

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
  /** Mit Claude verbinden: installiert Claude Code falls nötig und öffnet die offizielle Anmeldung */
  claudeLogin(): Promise<{ installiert: boolean }>
  /** Skin-Bibliothek (Datenordner/skins) */
  thumbSkins(): Promise<ThumbSkin[]>
  /** Dateidialog: Skins hochladen; rolle „ich“ = Philips Hauptskin */
  thumbSkinAdd(rolle: 'ich' | 'freund'): Promise<ThumbSkin[]>
  /** Skin per Minecraft-Name laden (Mojang) */
  thumbSkinName(name: string, rolle: 'ich' | 'freund'): Promise<ThumbSkin[]>
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
  /** Änderungswunsch zu einer Variante → neuer Auftrag (ID) */
  thumbAendern(jobId: string, index: number, wunsch: string): Promise<string>
  /** Auftrag samt Bildern löschen */
  thumbLoeschen(jobId: string): Promise<void>
  /** Schnitt: Projekte, Import per Dateidialog (null bei Abbruch), Wellenform, Löschen */
  schnittProjekte(): Promise<SchnittProjekt[]>
  schnittImport(kanal?: string): Promise<string | null>
  schnittWellenform(id: string): Promise<{ aufloesung: number; werte: number[] } | null>
  schnittLoeschen(id: string): Promise<void>
  /** Transkript (Abschnitte mit Wortzeiten) oder null, falls noch keins da ist; Neustart des Transkripts */
  schnittTranskript(id: string): Promise<SchnittAbschnitt[] | null>
  schnittTranskriptStart(id: string): Promise<string>
  /** Rohschnitt neu berechnen; Schnittliste (behalten/entfernt) lesen */
  schnittRohschnittStart(id: string): Promise<string>
  schnittListe(id: string): Promise<SchnittListe | null>
  /** Schnitt ändern (ROADMAP 6.5): Stelle an/aus, Bereich raus/zurück, Wunsch in Worten (Auftrag) */
  schnittUmschalten(id: string, index: number): Promise<SchnittListe>
  schnittBereich(id: string, start: number, ende: number, raus: boolean, text?: string): Promise<SchnittListe>
  schnittWunsch(id: string, wunsch: string): Promise<string>
  /** Untertitel/Zooms einstellen, geschnittene Vorschau rendern (Auftrag) */
  schnittEinstellungen(id: string, patch: { untertitel?: 'aus' | 'an' | 'karaoke'; zooms?: boolean }): Promise<void>
  schnittVorschau(id: string): Promise<string>
  /** Export für YouTube (ROADMAP 6.7): Auftrag, Ergebnis mit Prüfung/Kapiteln, Speichern unter, Übergabe ans Thumbnail */
  schnittExport(id: string): Promise<string>
  schnittExportInfo(id: string): Promise<SchnittExport | null>
  schnittExportSpeichern(id: string): Promise<string | null>
  schnittThumbnail(id: string): Promise<string>
  /** Stream-Highlights und Shorts (ROADMAP 6.8) */
  schnittHighlightsStart(id: string): Promise<string>
  schnittHighlights(id: string): Promise<SchnittHighlight[] | null>
  schnittClips(id: string, auswahl: { index: number; art: 'clip' | 'short' }[]): Promise<string>
  schnittClipDateien(id: string): Promise<{ name: string; url: string }[]>
  schnittClipOrdner(id: string): Promise<void>
  /** Planung (ROADMAP 7.3) */
  planungKarten(): Promise<PlanungKarte[]>
  planungNeu(basis: { kanal: PlanungKanal; titel: string; spalte?: PlanungSpalte; termin?: string | null; notizen?: string }): Promise<PlanungKarte>
  planungAendern(id: string, aenderung: PlanungAenderung): Promise<PlanungKarte>
  planungVerschieben(id: string, ziel: { spalte: PlanungSpalte; index: number; kanal?: PlanungKanal }): Promise<PlanungKarte>
  planungLoeschen(id: string): Promise<void>
  /** Upload-Rhythmus je Kanal (ROADMAP 7.4) */
  planungRhythmus(): Promise<Rhythmus>
  planungRhythmusSetzen(rhythmus: Rhythmus): Promise<Rhythmus>
  onPlanungGeaendert(handler: () => void): () => void
  /** Speichern-unter-Dialog für eine Variante; liefert den Zielpfad oder null */
  thumbSpeichern(jobId: string, index: number): Promise<string | null>
  /** Dateidialog: Video wählen, Claude schlägt Thumbnails vor; liefert die Job-ID oder null */
  thumbVideo(kanal: string, titel?: string): Promise<string | null>
  thumbVideoErgebnis(jobId: string): Promise<ThumbVideoErgebnis | null>
  /** Reaction-Thumbnail: Dateidialog fürs Original, dann Job; liefert die Job-ID oder null */
  /** Spiele-Vorlage: Dateidialog, dann Auftrag; null bei Abbruch */
  thumbSpielvorlage(o: { wunsch?: string; freunde?: string[] }): Promise<string | null>
  thumbReaktion(o: { gefuehl?: string; wort?: string; kanal: string; spiel?: string; wunsch?: string; ohneExtras?: boolean; freunde?: string[] }): Promise<string | null>
}
