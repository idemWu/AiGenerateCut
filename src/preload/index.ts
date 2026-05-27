import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 预留给 renderer 的自定义 API；具体能力通过 contextBridge 安全暴露。
const api = {}

const localMedia = {
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('local-media:pick-folder'),
  setFolder: (projectId: number, folderPath: string) =>
    ipcRenderer.invoke('local-media:set-folder', projectId, folderPath),
  list: (projectId: number) => ipcRenderer.invoke('local-media:list', projectId),
  get: (projectId: number, assetId: string) =>
    ipcRenderer.invoke('local-media:get', projectId, assetId),
  setDuration: (projectId: number, assetId: string, durationSec: number) =>
    ipcRenderer.invoke('local-media:set-duration', projectId, assetId, durationSec)
}

interface StudioExportStartPayload {
  width: number
  height: number
  fps: number
  totalFrames: number
  defaultFilename: string
}

interface StudioExportProgressPayload {
  phase: 'encode' | 'mux'
  progress: number
  nativeMode: true
}

type StudioExportFinalizeResult = { outputPath: string } | { canceled: true }

let studioExportProgressHandler:
  | ((_event: IpcRendererEvent, payload: StudioExportProgressPayload) => void)
  | null = null

const studioExport = {
  isAvailable: (): Promise<boolean> => ipcRenderer.invoke('studio-export:is-available'),
  start: (payload: StudioExportStartPayload): Promise<{ exportId: string }> =>
    ipcRenderer.invoke('studio-export:start', payload),
  writeFrame: (exportId: string, frameIndex: number, buffer: ArrayBuffer): Promise<void> =>
    ipcRenderer.invoke('studio-export:write-frame', exportId, frameIndex, buffer),
  finalize: (exportId: string): Promise<StudioExportFinalizeResult> =>
    ipcRenderer.invoke('studio-export:finalize', exportId),
  cancel: (exportId: string): Promise<void> =>
    ipcRenderer.invoke('studio-export:cancel', exportId),
  onProgress: (callback: (payload: StudioExportProgressPayload) => void): void => {
    // 不从 contextBridge 返回函数，避免跨隔离边界代理 unsubscribe 函数导致 preload 运行期问题。
    if (studioExportProgressHandler) {
      ipcRenderer.removeListener('studio-export:progress', studioExportProgressHandler)
    }
    studioExportProgressHandler = (
      _event: IpcRendererEvent,
      payload: StudioExportProgressPayload
    ): void => {
      callback(payload)
    }
    ipcRenderer.on('studio-export:progress', studioExportProgressHandler)
  },
  offProgress: (): void => {
    if (studioExportProgressHandler) {
      ipcRenderer.removeListener('studio-export:progress', studioExportProgressHandler)
      studioExportProgressHandler = null
    }
  }
}

// contextIsolation 开启时必须通过 contextBridge 暴露；否则直接挂到 window。
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('localMedia', localMedia)
    contextBridge.exposeInMainWorld('studioExport', studioExport)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.localMedia = localMedia
  // @ts-ignore (define in dts)
  window.studioExport = studioExport
}
