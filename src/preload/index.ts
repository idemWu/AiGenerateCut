import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
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

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('localMedia', localMedia)
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
}
