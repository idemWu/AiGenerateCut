import { spawn } from 'child_process'
import { once } from 'events'
import { resolveFfmpegPath } from './resolveFfmpegPath'

const DEBUG_STUDIO_EXPORT = process.env['STUDIO_EXPORT_DEBUG'] === '1'

export interface RawVideoPipeEncoderOptions {
  exportId?: string
  outputPath: string
  width: number
  height: number
  fps: number
  /** 仅用于把 ffmpeg stderr 中的 time= 日志换算为 mux 阶段进度。 */
  expectedDurationSec: number
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}

export interface RawVideoPipeEncoder {
  writeFrame(buffer: Buffer): Promise<void>
  finish(): Promise<void>
  cancel(): Promise<void>
}

function logFfmpeg(message: string, payload?: unknown): void {
  if (!DEBUG_STUDIO_EXPORT) return
  if (payload === undefined) {
    console.log(`[StudioExport][FFmpeg] ${message}`)
    return
  }
  console.log(`[StudioExport][FFmpeg] ${message}`, payload)
}

function parseFfmpegTimeSec(line: string): number | null {
  const match = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  if (!Number.isFinite(hours + minutes + seconds)) return null
  return hours * 3600 + minutes * 60 + seconds
}

function parseLatestFfmpegTimeSec(stderr: string): number | null {
  const matches = Array.from(stderr.matchAll(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/g))
  const last = matches.at(-1)
  if (!last) return null
  return parseFfmpegTimeSec(last[0])
}

function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

/**
 * 启动内置原生 ffmpeg，并通过 stdin pipe 持续喂入 RGBA raw 帧。
 *
 * Renderer 每写一帧都会等待 writeFrame resolve；当 stdin backpressure 触发时，
 * writeFrame 会等到 drain 后再返回，从而让 IPC 自然限速，避免主进程堆积完整视频。
 */
export function createRawVideoPipeEncoder(options: RawVideoPipeEncoderOptions): RawVideoPipeEncoder {
  const ffmpegPath = resolveFfmpegPath()
  if (!ffmpegPath) {
    throw new Error('FFmpeg binary not found')
  }

  const {
    exportId,
    outputPath,
    width,
    height,
    fps,
    expectedDurationSec,
    onProgress,
    signal
  } = options

  logFfmpeg('启动 FFmpeg stdin pipe 编码器', {
    exportId,
    outputPath,
    width,
    height,
    fps,
    expectedDurationSec
  })

  const child = spawn(
    ffmpegPath,
    [
      '-y',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      '-s',
      `${width}x${height}`,
      '-r',
      String(fps),
      '-i',
      'pipe:0',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputPath
    ],
    { windowsHide: true }
  )

  // ffmpeg 进度只会输出到 stderr；保留尾部即可用于进度解析和错误提示。
  let stderrTail = ''
  let aborted = false
  let finishStarted = false
  let closeSettled = false
  let closeError: Error | DOMException | null = null
  let lastLoggedProgressBucket = -1

  const rejectIfClosed = (): void => {
    if (aborted || signal?.aborted) {
      throw createAbortError()
    }
    if (!closeSettled) return
    if (closeError) throw closeError
    throw new Error('FFmpeg process closed before export finished')
  }

  let closeResolve: (() => void) | null = null
  let closeReject: ((reason: Error | DOMException) => void) | null = null
  const closePromise = new Promise<void>((resolve, reject) => {
    closeResolve = resolve
    closeReject = reject
  })

  const settleCloseReject = (err: Error | DOMException): void => {
    if (closeSettled) return
    closeSettled = true
    closeError = err
    if (signal) signal.removeEventListener('abort', onAbort)
    logFfmpeg('ffmpeg 启动或运行失败', { exportId, message: err.message })
    closeReject?.(err)
  }

  const onAbort = (): void => {
    aborted = true
    logFfmpeg('收到取消信号，终止 ffmpeg 进程', { exportId })
    child.kill('SIGTERM')
  }

  child.stderr?.on('data', (chunk: Buffer) => {
    stderrTail = (stderrTail + chunk.toString()).slice(-2000)
    if (!onProgress || expectedDurationSec <= 0) return
    // ffmpeg 的进度行常用 \r 覆盖同一行，chunk 边界也可能切在行中间；
    // 不能只看最后一行，要从保留的 stderr 尾部取最新的 time=。
    const timeSec = parseLatestFfmpegTimeSec(stderrTail)
    if (timeSec == null) return
    const progress = Math.min(1, timeSec / expectedDurationSec)
    onProgress(progress)

    const bucket = Math.floor(progress * 4) * 25
    if (bucket > lastLoggedProgressBucket) {
      lastLoggedProgressBucket = bucket
      logFfmpeg(`mux 进度 ${bucket}%`, { exportId, timeSec })
    }
  })

  child.on('error', (err) => {
    settleCloseReject(err)
  })

  child.stdin.on('error', (err) => {
    // pipe 写入失败通常意味着 ffmpeg 已退出；让后续 writeFrame/finalize 拿到明确错误。
    settleCloseReject(aborted || signal?.aborted ? createAbortError() : err)
  })

  child.on('close', (code) => {
    if (closeSettled) return
    closeSettled = true
    if (signal) signal.removeEventListener('abort', onAbort)
    if (aborted || signal?.aborted) {
      closeError = createAbortError()
      closeReject?.(closeError)
      return
    }
    if (code === 0) {
      onProgress?.(1)
      logFfmpeg('编码完成', { exportId, outputPath })
      closeResolve?.()
      return
    }
    closeError = new Error(`FFmpeg exited with code ${code ?? 'unknown'}: ${stderrTail.slice(-500)}`)
    logFfmpeg('编码失败', { exportId, code, stderrTail: stderrTail.slice(-500) })
    closeReject?.(closeError)
  })

  if (signal) {
    if (signal.aborted) {
      onAbort()
    } else {
      signal.addEventListener('abort', onAbort, { once: true })
    }
  }

  // closePromise 会由 finish/writeFrame 显式等待；这里先挂一个 catch，避免取消时产生未处理拒绝。
  void closePromise.catch(() => {})

  return {
    async writeFrame(buffer: Buffer): Promise<void> {
      if (finishStarted) {
        throw new Error('Cannot write frame after encoder finish started')
      }
      rejectIfClosed()

      const ok = child.stdin.write(buffer)
      if (!ok) {
        // stdin 的内部队列满时等待 drain；若 ffmpeg 在此期间退出，则优先抛出 close 错误。
        await Promise.race([once(child.stdin, 'drain').then(() => undefined), closePromise])
      }
      rejectIfClosed()
    },

    async finish(): Promise<void> {
      if (finishStarted) {
        await closePromise
        return
      }
      finishStarted = true
      rejectIfClosed()

      if (!child.stdin.destroyed && !child.stdin.writableEnded) {
        // 所有帧写完后关闭 stdin，ffmpeg 才会开始收尾并写完整 MP4 moov 信息。
        await Promise.race([new Promise<void>((resolve) => child.stdin.end(resolve)), closePromise])
      }
      await closePromise
    },

    async cancel(): Promise<void> {
      if (aborted) {
        await closePromise.catch(() => {})
        return
      }
      aborted = true
      logFfmpeg('取消 FFmpeg stdin pipe 编码器', { exportId })
      child.kill('SIGTERM')
      await closePromise.catch(() => {})
    }
  }
}
