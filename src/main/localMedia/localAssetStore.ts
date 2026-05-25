import { app } from 'electron'
import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises'
import { join, relative } from 'path'

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

export interface LocalAssetProjectState {
  folderPath: string | null
  assets: LocalAssetRecord[]
}

export interface LocalAssetProjectView {
  folderPath: string | null
  assets: LocalAssetView[]
}

const EMPTY_STATE: LocalAssetProjectState = {
  folderPath: null,
  assets: []
}

function getStoreDir(): string {
  return join(app.getPath('userData'), 'local-assets')
}

function getProjectFile(projectId: number): string {
  return join(getStoreDir(), `${projectId}.json`)
}

function buildLocalAssetId(absolutePath: string): string {
  return createHash('sha1').update(absolutePath).digest('hex').slice(0, 16)
}

function toView(asset: LocalAssetRecord): LocalAssetView {
  return {
    ...asset,
    exists: existsSync(asset.absolutePath)
  }
}

async function readProjectState(projectId: number): Promise<LocalAssetProjectState> {
  try {
    const raw = await readFile(getProjectFile(projectId), 'utf8')
    const parsed = JSON.parse(raw) as LocalAssetProjectState
    return {
      folderPath: parsed.folderPath ?? null,
      assets: Array.isArray(parsed.assets) ? parsed.assets : []
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY_STATE
    throw error
  }
}

async function writeProjectState(
  projectId: number,
  state: LocalAssetProjectState
): Promise<void> {
  await mkdir(getStoreDir(), { recursive: true })
  await writeFile(getProjectFile(projectId), JSON.stringify(state, null, 2), 'utf8')
}

export function createLocalAssetRecord(
  folderPath: string,
  absolutePath: string,
  mediaType: LocalAssetMediaType,
  size: number,
  mtimeMs: number
): LocalAssetRecord {
  return {
    id: buildLocalAssetId(absolutePath),
    name: absolutePath.split(/[\\/]/).pop() ?? absolutePath,
    relativePath: relative(folderPath, absolutePath).replace(/\\/g, '/'),
    absolutePath,
    mediaType,
    size,
    mtimeMs
  }
}

export async function listLocalAssets(projectId: number): Promise<LocalAssetProjectView> {
  const state = await readProjectState(projectId)
  return {
    folderPath: state.folderPath,
    assets: state.assets.map(toView)
  }
}

export async function replaceLocalAssets(
  projectId: number,
  folderPath: string,
  assets: LocalAssetRecord[]
): Promise<LocalAssetProjectView> {
  const next = {
    folderPath,
    assets: [...assets].sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  }
  await writeProjectState(projectId, next)
  return listLocalAssets(projectId)
}

export async function getLocalAsset(
  projectId: number,
  assetId: string
): Promise<LocalAssetView | null> {
  const state = await readProjectState(projectId)
  const asset = state.assets.find((item) => item.id === assetId)
  return asset ? toView(asset) : null
}

export async function getLocalAssetByGlobalId(
  assetId: string
): Promise<LocalAssetView | null> {
  try {
    const dir = getStoreDir()
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      const projectId = Number(entry.name.replace(/\.json$/, ''))
      if (!Number.isFinite(projectId)) continue
      const asset = await getLocalAsset(projectId, assetId)
      if (asset) return asset
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
  return null
}

export async function setLocalAssetDuration(
  projectId: number,
  assetId: string,
  durationSec: number
): Promise<LocalAssetView | null> {
  const state = await readProjectState(projectId)
  const nextAssets = state.assets.map((asset) =>
    asset.id === assetId ? { ...asset, durationSec } : asset
  )
  await writeProjectState(projectId, { ...state, assets: nextAssets })
  return getLocalAsset(projectId, assetId)
}

export async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    const info = await stat(absolutePath)
    return info.isFile()
  } catch {
    return false
  }
}
