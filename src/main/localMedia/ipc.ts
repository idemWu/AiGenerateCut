import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { getLocalAsset, listLocalAssets, replaceLocalAssets, setLocalAssetDuration } from './localAssetStore'
import { scanLocalMediaFolder } from './scanFolder'

function assertProjectId(value: unknown): number {
  const projectId = Number(value)
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new Error('Invalid project id')
  }
  return projectId
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid ${label}`)
  }
  return value
}

export function registerLocalMediaIpc(): void {
  ipcMain.handle('local-media:pick-folder', async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options: OpenDialogOptions = {
      properties: ['openDirectory']
    }
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle('local-media:set-folder', async (_event, projectIdArg, folderPathArg) => {
    const projectId = assertProjectId(projectIdArg)
    const folderPath = assertString(folderPathArg, 'folder path')
    const assets = await scanLocalMediaFolder(folderPath)
    return replaceLocalAssets(projectId, folderPath, assets)
  })

  ipcMain.handle('local-media:list', async (_event, projectIdArg) => {
    const projectId = assertProjectId(projectIdArg)
    return listLocalAssets(projectId)
  })

  ipcMain.handle('local-media:get', async (_event, projectIdArg, assetIdArg) => {
    const projectId = assertProjectId(projectIdArg)
    const assetId = assertString(assetIdArg, 'asset id')
    return getLocalAsset(projectId, assetId)
  })

  ipcMain.handle('local-media:set-duration', async (_event, projectIdArg, assetIdArg, durationArg) => {
    const projectId = assertProjectId(projectIdArg)
    const assetId = assertString(assetIdArg, 'asset id')
    const durationSec = Number(durationArg)
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      throw new Error('Invalid duration')
    }
    return setLocalAssetDuration(projectId, assetId, durationSec)
  })
}
