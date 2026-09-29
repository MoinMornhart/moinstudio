import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC,
  isTabId,
  type ExternalLink,
  type JobAction,
  type MoinApi,
  type PlanungAenderung,
  type TabId,
  type ThumbStart,
  type ToolProgressEvent,
  type ToolStatus,
  type UpdateStatus
} from '@shared/app'
import type { HardwareState } from '@shared/hardware'
import type { QueueState } from '@shared/jobs'

const api: MoinApi = {
  appInfo: () => ipcRenderer.invoke(IPC.appInfo),
  onSelectTab(handler: (tab: TabId) => void) {
    const listener = (_e: IpcRendererEvent, tab: unknown): void => {
      if (isTabId(tab)) handler(tab)
    }
    ipcRenderer.on(IPC.selectTab, listener)
    return () => ipcRenderer.removeListener(IPC.selectTab, listener)
  },
  getAutostart: () => ipcRenderer.invoke(IPC.autostartGet),
  setAutostart: (enabled: boolean) => ipcRenderer.invoke(IPC.autostartSet, enabled === true),
  checkForUpdate: () => ipcRenderer.invoke(IPC.updateCheck),
  downloadUpdate: () => ipcRenderer.invoke(IPC.updateDownload),
  installUpdate: () => ipcRenderer.invoke(IPC.updateInstall),
  onUpdateStatus(handler: (status: UpdateStatus) => void) {
    const listener = (_e: IpcRendererEvent, status: UpdateStatus): void => handler(status)
    ipcRenderer.on(IPC.updateStatus, listener)
    return () => ipcRenderer.removeListener(IPC.updateStatus, listener)
  },
  openLogs: () => ipcRenderer.invoke(IPC.openLogs),
  dataStatus: () => ipcRenderer.invoke(IPC.dataStatus),
  chooseDataDir: () => ipcRenderer.invoke(IPC.dataChoose),
  openDataDir: () => ipcRenderer.invoke(IPC.dataOpen),
  toolsStatus: () => ipcRenderer.invoke(IPC.toolsStatus),
  installTool: (id: ToolStatus['id']) => ipcRenderer.invoke(IPC.toolsInstall, id),
  onToolProgress(handler: (p: ToolProgressEvent) => void) {
    const listener = (_e: IpcRendererEvent, p: ToolProgressEvent): void => handler(p)
    ipcRenderer.on(IPC.toolsProgress, listener)
    return () => ipcRenderer.removeListener(IPC.toolsProgress, listener)
  },
  hardwareState: () => ipcRenderer.invoke(IPC.hwState),
  runHardwareTest: () => ipcRenderer.invoke(IPC.hwRun),
  onHardwareState(handler: (s: HardwareState) => void) {
    const listener = (_e: IpcRendererEvent, s: HardwareState): void => handler(s)
    ipcRenderer.on(IPC.hwState, listener)
    return () => ipcRenderer.removeListener(IPC.hwState, listener)
  },
  probeRender: () => ipcRenderer.invoke(IPC.hwProbe),
  jobsState: () => ipcRenderer.invoke(IPC.jobsState),
  jobAction: (action: JobAction, id?: string) => ipcRenderer.invoke(IPC.jobsAction, action, id),
  onJobsState(handler: (s: QueueState) => void) {
    const listener = (_e: IpcRendererEvent, s: QueueState): void => handler(s)
    ipcRenderer.on(IPC.jobsState, listener)
    return () => ipcRenderer.removeListener(IPC.jobsState, listener)
  },
  jobImage: (id: string) => ipcRenderer.invoke(IPC.jobsImage, id),
  claudeStatus: () => ipcRenderer.invoke(IPC.claudeStatus),
  mcpStatus: () => ipcRenderer.invoke(IPC.mcpStatus),
  mcpInstall: () => ipcRenderer.invoke(IPC.mcpInstall),
  setupState: () => ipcRenderer.invoke(IPC.setupState),
  setupComplete: (done: boolean) => ipcRenderer.invoke(IPC.setupComplete, done),
  setupChecks: () => ipcRenderer.invoke(IPC.setupChecks),
  onSetupStep(handler: (step: number) => void) {
    const listener = (_e: IpcRendererEvent, step: unknown): void => {
      if (typeof step === 'number') handler(step)
    }
    ipcRenderer.on(IPC.setupStep, listener)
    return () => ipcRenderer.removeListener(IPC.setupStep, listener)
  },
  openLink: (key: ExternalLink) => ipcRenderer.invoke(IPC.openLink, key),
  claudeLogin: () => ipcRenderer.invoke(IPC.claudeLogin),
  thumbSkins: () => ipcRenderer.invoke(IPC.thumbSkins),
  thumbSkinAdd: (rolle: 'ich' | 'freund') => ipcRenderer.invoke(IPC.thumbSkinAdd, rolle),
  thumbSkinName: (name: string, rolle: 'ich' | 'freund') => ipcRenderer.invoke(IPC.thumbSkinName, name, rolle),
  thumbSkinUpdate: (id: string, patch: { name?: string; rolle?: 'ich'; entfernen?: boolean }) => ipcRenderer.invoke(IPC.thumbSkinUpdate, id, patch),
  thumbSkinBild: (id: string) => ipcRenderer.invoke(IPC.thumbSkinBild, id),
  thumbStart: (start: ThumbStart) => ipcRenderer.invoke(IPC.thumbStart, start),
  thumbAuftraege: () => ipcRenderer.invoke(IPC.thumbAuftraege),
  thumbErgebnis: (jobId: string) => ipcRenderer.invoke(IPC.thumbErgebnis, jobId),
  thumbSpeichern: (jobId: string, index: number) => ipcRenderer.invoke(IPC.thumbSpeichern, jobId, index),
  thumbAendern: (jobId: string, index: number, wunsch: string) => ipcRenderer.invoke(IPC.thumbAendern, jobId, index, wunsch),
  thumbLoeschen: (jobId: string) => ipcRenderer.invoke(IPC.thumbLoeschen, jobId),
  schnittProjekte: () => ipcRenderer.invoke(IPC.schnittProjekte),
  schnittImport: (kanal?: string) => ipcRenderer.invoke(IPC.schnittImport, kanal),
  schnittWellenform: (id: string) => ipcRenderer.invoke(IPC.schnittWellenform, id),
  schnittLoeschen: (id: string) => ipcRenderer.invoke(IPC.schnittLoeschen, id),
  schnittTranskript: (id: string) => ipcRenderer.invoke(IPC.schnittTranskript, id),
  schnittTranskriptStart: (id: string) => ipcRenderer.invoke(IPC.schnittTranskriptStart, id),
  schnittRohschnittStart: (id: string) => ipcRenderer.invoke(IPC.schnittRohschnittStart, id),
  schnittListe: (id: string) => ipcRenderer.invoke(IPC.schnittListe, id),
  schnittUmschalten: (id: string, index: number) => ipcRenderer.invoke(IPC.schnittUmschalten, id, index),
  schnittBereich: (id: string, start: number, ende: number, raus: boolean, text?: string) => ipcRenderer.invoke(IPC.schnittBereich, id, start, ende, raus, text),
  schnittWunsch: (id: string, wunsch: string) => ipcRenderer.invoke(IPC.schnittWunsch, id, wunsch),
  schnittEinstellungen: (id: string, patch: { untertitel?: 'aus' | 'an' | 'karaoke'; zooms?: boolean }) => ipcRenderer.invoke(IPC.schnittEinstellungen, id, patch),
  schnittVorschau: (id: string) => ipcRenderer.invoke(IPC.schnittVorschau, id),
  schnittExport: (id: string) => ipcRenderer.invoke(IPC.schnittExport, id),
  schnittExportInfo: (id: string) => ipcRenderer.invoke(IPC.schnittExportInfo, id),
  schnittExportSpeichern: (id: string) => ipcRenderer.invoke(IPC.schnittExportSpeichern, id),
  schnittThumbnail: (id: string) => ipcRenderer.invoke(IPC.schnittThumbnail, id),
  schnittHighlightsStart: (id: string) => ipcRenderer.invoke(IPC.schnittHighlightsStart, id),
  schnittHighlights: (id: string) => ipcRenderer.invoke(IPC.schnittHighlights, id),
  schnittClips: (id: string, auswahl: { index: number; art: 'clip' | 'short' }[]) => ipcRenderer.invoke(IPC.schnittClips, id, auswahl),
  schnittClipDateien: (id: string) => ipcRenderer.invoke(IPC.schnittClipDateien, id),
  schnittClipOrdner: (id: string) => ipcRenderer.invoke(IPC.schnittClipOrdner, id),
  planungKarten: () => ipcRenderer.invoke(IPC.planungKarten),
  planungNeu: (basis: Parameters<MoinApi['planungNeu']>[0]) => ipcRenderer.invoke(IPC.planungNeu, basis),
  planungAendern: (id: string, aenderung: PlanungAenderung) => ipcRenderer.invoke(IPC.planungAendern, id, aenderung),
  planungVerschieben: (id: string, ziel: Parameters<MoinApi['planungVerschieben']>[1]) => ipcRenderer.invoke(IPC.planungVerschieben, id, ziel),
  planungLoeschen: (id: string) => ipcRenderer.invoke(IPC.planungLoeschen, id),
  planungRhythmus: () => ipcRenderer.invoke(IPC.planungRhythmus),
  planungSchneiden: (id: string) => ipcRenderer.invoke(IPC.planungSchneiden, id),
  planungThumbnail: (id: string) => ipcRenderer.invoke(IPC.planungThumbnail, id),
  planungThumbVarianten: (id: string) => ipcRenderer.invoke(IPC.planungThumbVarianten, id),
  planungThumbWaehlen: (id: string, pfad: string) => ipcRenderer.invoke(IPC.planungThumbWaehlen, id, pfad),
  planungClaude: (art: Parameters<MoinApi['planungClaude']>[0], o?: Parameters<MoinApi['planungClaude']>[1]) => ipcRenderer.invoke(IPC.planungClaude, art, o),
  planungClaudeStand: (auftrag: string) => ipcRenderer.invoke(IPC.planungClaudeStand, auftrag),
  adobeStatus: (neu?: boolean) => ipcRenderer.invoke(IPC.adobeStatus, neu),
  schnittPremiere: (id: string) => ipcRenderer.invoke(IPC.schnittPremiere, id),
  thumbPhotoshop: (jobId: string, index: number) => ipcRenderer.invoke(IPC.thumbPhotoshop, jobId, index),
  adobeSelbsttest: () => ipcRenderer.invoke(IPC.adobeSelbsttest),
  planungRhythmusSetzen: (rhythmus: Parameters<MoinApi['planungRhythmusSetzen']>[0]) => ipcRenderer.invoke(IPC.planungRhythmusSetzen, rhythmus),
  onPlanungGeaendert(handler: () => void) {
    const listener = (): void => handler()
    ipcRenderer.on(IPC.planungGeaendert, listener)
    return () => ipcRenderer.removeListener(IPC.planungGeaendert, listener)
  },
  thumbVideo: (kanal: string, titel?: string) => ipcRenderer.invoke(IPC.thumbVideo, kanal, titel),
  thumbVideoErgebnis: (jobId: string) => ipcRenderer.invoke(IPC.thumbVideoErgebnis, jobId),
  thumbSpielvorlage: (o: { wunsch?: string; freunde?: string[] }) => ipcRenderer.invoke(IPC.thumbSpielvorlage, o),
  thumbReaktion: (o: { gefuehl?: string; wort?: string; kanal: string; spiel?: string; wunsch?: string; ohneExtras?: boolean; freunde?: string[] }) => ipcRenderer.invoke(IPC.thumbReaktion, o)
}

contextBridge.exposeInMainWorld('moin', api)
