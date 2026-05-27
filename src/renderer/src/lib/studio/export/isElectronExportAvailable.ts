/**
 * 检测当前环境是否可走 Electron 主进程原生 FFmpeg 导出路径。
 * 需同时满足：preload 暴露了 window.studioExport，且主进程能定位到 ffmpeg 可执行文件。
 */
export async function isElectronExportAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const api = (window as unknown as { studioExport?: { isAvailable: () => Promise<boolean> } })
    .studioExport;
  if (!api || typeof api.isAvailable !== "function") return false;
  try {
    return await api.isAvailable();
  } catch {
    return false;
  }
}
