import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import {
  createLocalAssetRecord,
  type LocalAssetMediaType,
  type LocalAssetRecord
} from './localAssetStore'

const MEDIA_EXTENSIONS: Record<string, LocalAssetMediaType> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
  gif: 'image',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  m4v: 'video'
}

function mediaTypeFromPath(filePath: string): LocalAssetMediaType | null {
  const ext = filePath.split('.').pop()?.toLowerCase()
  return ext ? (MEDIA_EXTENSIONS[ext] ?? null) : null
}

async function walk(folderPath: string, currentPath: string, assets: LocalAssetRecord[]): Promise<void> {
  const entries = await readdir(currentPath, { withFileTypes: true })

  for (const entry of entries) {
    const absolutePath = join(currentPath, entry.name)
    if (entry.isDirectory()) {
      await walk(folderPath, absolutePath, assets)
      continue
    }
    if (!entry.isFile()) continue

    const mediaType = mediaTypeFromPath(entry.name)
    if (!mediaType) continue

    const info = await stat(absolutePath)
    assets.push(
      createLocalAssetRecord(folderPath, absolutePath, mediaType, info.size, info.mtimeMs)
    )
  }
}

export async function scanLocalMediaFolder(folderPath: string): Promise<LocalAssetRecord[]> {
  const assets: LocalAssetRecord[] = []
  await walk(folderPath, folderPath, assets)
  return assets
}
