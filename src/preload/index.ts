import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC,
  isTabId,
  type ExternalLink,
  type JobAction,
  type MoinApi,
  type TabId,
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
}

contextBridge.exposeInMainWorld('moin', api)
