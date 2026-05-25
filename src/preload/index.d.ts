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

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    localMedia: LocalMediaAPI
  }
}
