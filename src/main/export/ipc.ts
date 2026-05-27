import { app, BrowserWindow, dialog, ipcMain, type WebContents } from 'electron'
import { randomUUID } from 'crypto'
import { mkdtemp, copyFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createRawVideoPipeEncoder, type RawVideoPipeEncoder } from './ffmpegRunner'
import { isNativeFfmpegAvailable } from './resolveFfmpegPath'

const DEBUG_STUDIO_EXPORT = process.env['STUDIO_EXPORT_DEBUG'] === '1'

interface ExportSession {
  exportId: string
  tempDir: string
  outputPath: string
  encoder: RawVideoPipeEncoder
  width: number
  height: number
  fps: number
  totalFrames: number
  frameBytes: number
  framesWritten: number
  defaultFilename: string
  webContentsId: number
  finalized: boolean
  cancelled: boolean
}

// 每次导出都对应一个 session，用 exportId 串起 start/write-frame/finalize/cancel。
// session 只保存在主进程内存中，避免 renderer 直接接触临时文件路径和子进程。
const sessions = new Map<string, ExportSession>()

export interface StartExportPayload {
  width: number
  height: number
  fps: number
  totalFrames: number
  defaultFilename: string
}

export interface StudioExportProgress {
  phase: 'encode' | 'mux'
  progress: number
  nativeMode: true
}

function logExport(message: string, payload?: unknown): void {
  if (!DEBUG_STUDIO_EXPORT) return
  if (payload === undefined) {
    console.log(`[StudioExport][Main] ${message}`)
    return
  }
  console.log(`[StudioExport][Main] ${message}`, payload)
}

function assertSession(exportId: unknown): ExportSession {
  if (typeof exportId !== 'string' || exportId.length === 0) {
    throw new Error('Invalid exportId')
  }
  const session = sessions.get(exportId)
  if (!session) {
    throw new Error(`Export session not found: ${exportId}`)
  }
  return session
}

function assertPositiveInt(value: unknown, label: string): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid ${label}`)
  }
  return n
}

function assertFiniteString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid ${label}`)
  }
  return value
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function cleanupSession(session: ExportSession): Promise<void> {
  sessions.delete(session.exportId)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(session.tempDir, { recursive: true, force: true })
      logExport('已清理导出临时目录', { exportId: session.exportId, tempDir: session.tempDir })
      return
    } catch {
      // Windows 上 ffmpeg 刚被 kill 时可能还短暂占用 output.mp4，稍等后重试清理。
      if (attempt < 4) {
        await delay(100 * (attempt + 1))
        continue
      }
      // 清理失败不影响主流程；临时目录后续可由系统回收。
      logExport('清理导出临时目录失败，已忽略', {
        exportId: session.exportId,
        tempDir: session.tempDir
      })
    }
  }
}

function sendProgress(webContents: WebContents | null, payload: StudioExportProgress): void {
  if (!webContents || webContents.isDestroyed()) return
  webContents.send('studio-export:progress', payload)
}

function getSenderWebContents(senderId: number): WebContents | null {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.webContents.id === senderId) return win.webContents
  }
  return null
}

export function registerStudioExportIpc(): void {
  ipcMain.handle('studio-export:is-available', async () => {
    const available = isNativeFfmpegAvailable()
    logExport('Native FFmpeg 可用性检查', { available })
    return available
  })

  ipcMain.handle('studio-export:start', async (event, payloadArg) => {
    if (!isNativeFfmpegAvailable()) {
      throw new Error('Native FFmpeg is not available on this platform')
    }
    const payload = (payloadArg ?? {}) as Partial<StartExportPayload>
    const width = assertPositiveInt(payload.width, 'width')
    const height = assertPositiveInt(payload.height, 'height')
    const fps = assertPositiveInt(payload.fps, 'fps')
    const totalFrames = assertPositiveInt(payload.totalFrames, 'totalFrames')
    const defaultFilename = assertFiniteString(payload.defaultFilename, 'defaultFilename')

    const tempDir = await mkdtemp(join(tmpdir(), 'studio-export-'))
    const outputPath = join(tempDir, 'output.mp4')

    const exportId = randomUUID()
    let encoder: RawVideoPipeEncoder
    try {
      // start 阶段即启动 ffmpeg，后续 write-frame 会直接把 Raw RGBA 帧写进 stdin。
      encoder = createRawVideoPipeEncoder({
        exportId,
        outputPath,
        width,
        height,
        fps,
        expectedDurationSec: totalFrames / fps,
        onProgress: (progress) => {
          sendProgress(getSenderWebContents(event.sender.id), {
            phase: 'mux',
            progress,
            nativeMode: true
          })
        }
      })
    } catch (err) {
      await rm(tempDir, { recursive: true, force: true })
      throw err
    }

    const session: ExportSession = {
      exportId,
      tempDir,
      outputPath,
      encoder,
      width,
      height,
      fps,
      totalFrames,
      frameBytes: width * height * 4,
      framesWritten: 0,
      defaultFilename,
      webContentsId: event.sender.id,
      finalized: false,
      cancelled: false
    }
    sessions.set(exportId, session)
    logExport('创建导出 session', {
      exportId,
      size: `${width}x${height}`,
      fps,
      totalFrames,
      frameBytes: session.frameBytes,
      tempDir,
      outputPath
    })
    return { exportId }
  })

  ipcMain.handle(
    'studio-export:write-frame',
    async (_event, exportIdArg, frameIndexArg, bufferArg) => {
      const session = assertSession(exportIdArg)
      if (session.finalized) {
        throw new Error('Session already finalized')
      }
      const frameIndex = Number(frameIndexArg)
      if (!Number.isInteger(frameIndex) || frameIndex < 0) {
        throw new Error('Invalid frameIndex')
      }
      if (frameIndex !== session.framesWritten) {
        // rawvideo pipe 没有帧边界信息，必须严格按序写入，否则视频会错帧或花屏。
        throw new Error(
          `Frame out of order: got ${frameIndex}, expected ${session.framesWritten}`
        )
      }

      let buf: Buffer
      if (bufferArg instanceof ArrayBuffer) {
        buf = Buffer.from(new Uint8Array(bufferArg))
      } else if (ArrayBuffer.isView(bufferArg)) {
        buf = Buffer.from(
          (bufferArg as ArrayBufferView).buffer,
          (bufferArg as ArrayBufferView).byteOffset,
          (bufferArg as ArrayBufferView).byteLength
        )
      } else {
        throw new Error('Invalid frame buffer')
      }

      if (buf.byteLength !== session.frameBytes) {
        // 每帧大小必须等于 width * height * 4（RGBA），否则 ffmpeg 会按错误边界解码。
        throw new Error(
          `Frame buffer size mismatch: got ${buf.byteLength}, expected ${session.frameBytes}`
        )
      }

      try {
        await session.encoder.writeFrame(buf)
      } catch (err) {
        if (session.cancelled && isAbortError(err)) {
          // 取消时 renderer 可能已有一帧 write-frame IPC 在途；这是预期竞态，直接返回避免主进程刷错误栈。
          return
        }
        throw err
      }
      session.framesWritten += 1
      const milestone = Math.max(1, Math.floor(session.totalFrames / 4))
      if (
        session.framesWritten === 1 ||
        session.framesWritten === session.totalFrames ||
        session.framesWritten % milestone === 0
      ) {
        logExport('Raw 帧 pipe 写入进度', {
          exportId: session.exportId,
          framesWritten: session.framesWritten,
          totalFrames: session.totalFrames,
          pipedMB: Math.round((session.framesWritten * session.frameBytes) / 1024 / 1024)
        })
      }
    }
  )

  ipcMain.handle('studio-export:finalize', async (_event, exportIdArg) => {
    const session = assertSession(exportIdArg)
    if (session.finalized) {
      throw new Error('Session already finalized')
    }
    session.finalized = true

    const webContents = getSenderWebContents(session.webContentsId)

    try {
      if (session.framesWritten !== session.totalFrames) {
        throw new Error(
          `Cannot finalize incomplete export: got ${session.framesWritten} frames, expected ${session.totalFrames}`
        )
      }

      logExport('开始 finalize，准备关闭 FFmpeg stdin 并等待输出', {
        exportId: session.exportId,
        tempOutputPath: session.outputPath,
        framesWritten: session.framesWritten,
        totalFrames: session.totalFrames
      })
      // 所有帧已经通过 stdin pipe 写入；finalize 只负责结束 stdin 并等待 ffmpeg close。
      await session.encoder.finish()
      // FFmpeg 完成后先明确推一次 100%，再弹保存框，避免 UI 停在 Native mux 起点 75%。
      sendProgress(webContents, { phase: 'mux', progress: 1, nativeMode: true })

      const owner = webContents ? BrowserWindow.fromWebContents(webContents) : null
      // 保存对话框放在编码完成后，避免用户取消时还保留半成品输出。
      const saveOptions = {
        defaultPath: session.defaultFilename,
        filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
      }
      const saveResult = owner
        ? await dialog.showSaveDialog(owner, saveOptions)
        : await dialog.showSaveDialog(saveOptions)

      if (saveResult.canceled || !saveResult.filePath) {
        logExport('用户取消保存导出文件', { exportId: session.exportId })
        await cleanupSession(session)
        return { canceled: true as const }
      }

      await copyFile(session.outputPath, saveResult.filePath)
      logExport('导出文件已保存', {
        exportId: session.exportId,
        outputPath: saveResult.filePath
      })
      await cleanupSession(session)
      return { outputPath: saveResult.filePath }
    } catch (err) {
      logExport('导出 finalize 失败，准备清理 session', {
        exportId: session.exportId,
        message: err instanceof Error ? err.message : String(err)
      })
      session.cancelled = true
      await session.encoder.cancel()
      await cleanupSession(session)
      throw err
    }
  })

  ipcMain.handle('studio-export:cancel', async (_event, exportIdArg) => {
    if (typeof exportIdArg !== 'string') return
    const session = sessions.get(exportIdArg)
    if (!session) return
    logExport('收到取消导出请求', { exportId: session.exportId })
    session.cancelled = true
    await session.encoder.cancel()
    await cleanupSession(session)
  })

  app.on('browser-window-created', (_, window) => {
    const wcId = window.webContents.id
    window.on('closed', () => {
      // 窗口关闭时主动中止属于该窗口的导出，避免 ffmpeg 和临时目录泄漏。
      for (const session of Array.from(sessions.values())) {
        if (session.webContentsId === wcId) {
          logExport('窗口关闭，中止关联导出 session', { exportId: session.exportId })
          session.cancelled = true
          void session.encoder.cancel().finally(() => {
            void cleanupSession(session)
          })
        }
      }
    })
  })
}
