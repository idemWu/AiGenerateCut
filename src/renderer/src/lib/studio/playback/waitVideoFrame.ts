/** 等待 video 事件，超时后仍 resolve（避免 seek 卡死） */
export function waitVideoEvent(
  video: HTMLVideoElement,
  eventName: "seeked" | "loadeddata" | "loadedmetadata",
  timeoutMs = 2000
): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      video.removeEventListener(eventName, onEvent);
      resolve();
    }, timeoutMs);
    const onEvent = () => {
      window.clearTimeout(timer);
      video.removeEventListener(eventName, onEvent);
      resolve();
    };
    video.addEventListener(eventName, onEvent);
  });
}
