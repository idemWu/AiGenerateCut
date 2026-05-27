import { ElectronAPI } from '@electron-toolkit/preload'

export type LocalAssetMediaType = 'image' | 'video'

export interface LocalAssetRecord {
  id: string
  name: string
  relativePath: string
  absolutePath: string
  mediaType: LocalAssetMediaType
  size: number
  mtimeMs: number
  durationSec?: number
}

export interface LocalAssetView extends LocalAssetRecord {
  exists: boolean
}

export interface LocalAssetProjectView {
  folderPath: string | null
  assets: LocalAssetView[]
}

export interface LocalMediaAPI {
  pickFolder: () => Promise<string | null>
  setFolder: (projectId: number, folderPath: string) => Promise<LocalAssetProjectView>
  list: (projectId: number) => Promise<LocalAssetProjectView>
  get: (projectId: number, assetId: string) => Promise<LocalAssetView | null>
  setDuration: (
    projectId: number,
    assetId: string,
    durationSec: number
  ) => Promise<LocalAssetView | null>
}

export interface StudioExportStartPayload {
  width: number
  height: number
  fps: number
  totalFrames: number
  defaultFilename: string
}

export interface StudioExportProgressPayload {
  phase: 'encode' | 'mux'
  progress: number
  nativeMode: true
}

export type StudioExportFinalizeResult = { outputPath: string } | { canceled: true }

export interface StudioExportAPI {
  isAvailable: () => Promise<boolean>
  start: (payload: StudioExportStartPayload) => Promise<{ exportId: string }>
  writeFrame: (exportId: string, frameIndex: number, buffer: ArrayBuffer) => Promise<void>
  finalize: (exportId: string) => Promise<StudioExportFinalizeResult>
  cancel: (exportId: string) => Promise<void>
  onProgress: (callback: (payload: StudioExportProgressPayload) => void) => void
  offProgress: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    localMedia: LocalMediaAPI
    studioExport: StudioExportAPI
  }
}
