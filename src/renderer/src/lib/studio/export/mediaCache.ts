import { waitVideoEvent } from "@/lib/studio/playback/waitVideoFrame";
import { resolveStudioMediaUrl } from "@/lib/studio/resolveStudioMediaUrl";
import { STUDIO_MEDIA_CROSS_ORIGIN } from "@/lib/studio/studioMediaCrossOrigin";

function resolveMediaLoadUrl(url: string): string {
  return resolveStudioMediaUrl(url) ?? url;
}

const SEEK_EPS = 0.02;

export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = STUDIO_MEDIA_CROSS_ORIGIN;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = resolveMediaLoadUrl(url);
  });
}

export async function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = STUDIO_MEDIA_CROSS_ORIGIN;
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    const onReady = () => {
      video.removeEventListener("loadeddata", onReady);
      resolve(video);
    };
    video.addEventListener("error", () => reject(new Error(`Failed to load video: ${url}`)));
    video.addEventListener("loadeddata", onReady);
    video.src = resolveMediaLoadUrl(url);
    video.load();
  });
}

export function seekVideo(video: HTMLVideoElement, timeSec: number): void {
  if (Math.abs(video.currentTime - timeSec) > SEEK_EPS) {
    video.currentTime = timeSec;
  }
}

/** 设置 currentTime 并等待 seeked，供导出逐帧抓图 */
export async function seekVideoAsync(
  video: HTMLVideoElement,
  timeSec: number
): Promise<void> {
  const clamped = Math.max(0, Math.min(timeSec, video.duration || timeSec));
  if (
    Math.abs(video.currentTime - clamped) <= SEEK_EPS &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
  ) {
    return;
  }
  video.pause();
  video.currentTime = clamped;
  await waitVideoEvent(video, "seeked");
}
