const INVALID_FILENAME_CHARS = /[/\\?%*:|"<>]/g;

function sanitizeFilenameBase(name: string): string {
  const trimmed = name.replace(INVALID_FILENAME_CHARS, "-").trim();
  return trimmed.length > 0 ? trimmed : "studio";
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 导出文件名：{项目名}-YYYYMMDD-HHMMSS.mp4 */
export function buildStudioExportFilename(projectTitle: string, ext = "mp4"): string {
  const base = sanitizeFilenameBase(projectTitle);
  const now = new Date();
  const ts = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `${base}-${ts}.${ext}`;
}
