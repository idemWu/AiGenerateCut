// ffmpeg-static 是 CommonJS 包，默认导出为 ffmpeg 可执行文件的绝对路径。
// 该包未内置类型声明，这里使用 require() 可以避免额外维护 d.ts。
// eslint-disable-next-line @typescript-eslint/no-var-requires
import ffmpegStatic from 'ffmpeg-static'

/**
 * 解析原生 ffmpeg 可执行文件路径。
 * 生产环境中 electron-builder 会把 node_modules 打进 app.asar，
 * asar 内的二进制无法直接执行，因此要切到 app.asar.unpacked。
 */
export function resolveFfmpegPath(): string | null {
  if (typeof ffmpegStatic !== 'string' || ffmpegStatic.length === 0) {
    return null
  }

  if (ffmpegStatic.includes('app.asar')) {
    return ffmpegStatic.replace('app.asar', 'app.asar.unpacked')
  }

  return ffmpegStatic
}

export function isNativeFfmpegAvailable(): boolean {
  return resolveFfmpegPath() !== null
}
