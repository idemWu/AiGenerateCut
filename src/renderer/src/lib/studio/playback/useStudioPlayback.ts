"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { StudioTimelineTrackResponse } from "@/lib/api/studio";
import { getContentEndSec } from "./playbackSchedule";
import {
  clipEffectiveEndSec,
  resolveTopVideoClipAtTime,
  sortTracksForRender,
  type TrackClipAtTime,
} from "./resolveClipsAtTime";
import {
  clipMediaTimeSec,
  preloadUpcomingVideos,
  resolveActiveVideoClipKeysSorted,
  syncPoolVideos,
} from "./syncActiveVideos";
import { clipPoolKey, ensurePoolVideoForClip } from "./videoPool";

export type PlayheadSubscriber = (sec: number) => void;

interface UseStudioPlaybackOptions {
  tracks: StudioTimelineTrackResponse[];
  durationSec: number;
  playheadSec: number;
  isPlaying: boolean;
  playheadRef: React.MutableRefObject<number>;
  videoPoolRef: React.MutableRefObject<Map<string, HTMLVideoElement>>;
  setPlayheadSec: (sec: number | ((prev: number) => number)) => void;
  setIsPlaying: (playing: boolean) => void;
}

const EPS = 0.02;
const LEADER_DRIFT_THRESHOLD = 0.05;
const LOOKAHEAD_SEC = 2;
const PRELOAD_THROTTLE_MS = 250;
const MONOTONIC_TOLERANCE_SEC = 0.25;
/** 播放态把 playheadSec 写入 zustand 的最小间隔，避免每帧全树重渲染。 */
const STORE_WRITE_THROTTLE_MS = 100;
/** 播放态 syncPoolVideos 的最小间隔（leader 已独立管理，drift 阈值 0.3s 容忍足够）。 */
const POOL_SYNC_THROTTLE_MS = 120;

/**
 * Studio 时间线播放调度（clip 级 pool 架构）。
 *
 * - 每个 video clip 在 `videoPoolRef` 中有独立 HTMLVideoElement（key = clipPoolKey）。
 * - 顶层 video clip = leader：muted=false，提供音频与时钟。
 * - `setLeader` 切换 leader；`syncPoolVideos` 按 clip 校准非 leader 的 currentTime。
 */
export function useStudioPlayback({
  tracks,
  durationSec,
  playheadSec,
  isPlaying,
  playheadRef,
  videoPoolRef,
  setPlayheadSec,
  setIsPlaying,
}: UseStudioPlaybackOptions) {
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const lastPreloadAtMsRef = useRef<number>(0);
  const lastStoreWriteAtMsRef = useRef<number>(0);
  const lastPoolSyncAtMsRef = useRef<number>(0);
  const tracksRef = useRef(tracks);
  const sortedTracks = useMemo(() => sortTracksForRender(tracks), [tracks]);
  const sortedTracksRef = useRef(sortedTracks);
  const durationRef = useRef(durationSec);
  const isPlayingRef = useRef(isPlaying);
  const leaderClipIdRef = useRef<number | null>(null);
  const leaderVideoRef = useRef<HTMLVideoElement | null>(null);
  const leaderTokenRef = useRef(0);
  const pendingLeaderClipIdRef = useRef<number | null>(null);
  const subscribersRef = useRef<Set<PlayheadSubscriber>>(new Set());

  playheadRef.current = playheadSec;
  tracksRef.current = tracks;
  sortedTracksRef.current = sortedTracks;
  durationRef.current = durationSec;
  isPlayingRef.current = isPlaying;

  const notifySubscribers = useCallback((sec: number): void => {
    const subs = subscribersRef.current;
    if (subs.size === 0) return;
    for (const fn of subs) {
      try {
        fn(sec);
      } catch {
        // 单个订阅者异常不影响其他订阅者与 RAF 循环。
      }
    }
  }, []);

  const subscribePlayhead = useCallback(
    (fn: PlayheadSubscriber): (() => void) => {
      subscribersRef.current.add(fn);
      return () => {
        subscribersRef.current.delete(fn);
      };
    },
    []
  );

  const commitPlayhead = useCallback(
    (sec: number, opts?: { force?: boolean; now?: number }): void => {
      playheadRef.current = sec;
      notifySubscribers(sec);
      const force = opts?.force ?? false;
      const now = opts?.now ?? performance.now();
      if (force || now - lastStoreWriteAtMsRef.current >= STORE_WRITE_THROTTLE_MS) {
        lastStoreWriteAtMsRef.current = now;
        setPlayheadSec(sec);
      }
    },
    [notifySubscribers, playheadRef, setPlayheadSec]
  );

  const runSyncPool = useCallback(
    (sec: number, playing: boolean): void => {
      const leaderClipId =
        pendingLeaderClipIdRef.current ?? leaderClipIdRef.current;
      void syncPoolVideos(tracksRef.current, sec, videoPoolRef.current, {
        isPlaying: playing,
        leaderClipId,
        sortedTracks: sortedTracksRef.current,
      });
    },
    [videoPoolRef]
  );

  const setPlayhead = useCallback(
    (sec: number, opts?: { force?: boolean; now?: number }) => {
      const clamped = Math.max(0, Math.min(durationRef.current, sec));
      commitPlayhead(clamped, opts);
    },
    [commitPlayhead]
  );

  const releaseLeader = useCallback(() => {
    leaderTokenRef.current += 1;
    pendingLeaderClipIdRef.current = null;
    const old = leaderVideoRef.current;
    if (old) old.muted = true;
    leaderVideoRef.current = null;
    leaderClipIdRef.current = null;
  }, []);

  const setLeader = useCallback(
    async (layer: TrackClipAtTime): Promise<void> => {
      const clip = layer.clip;
      const url = clip.media_url;
      if (!url) return;
      const token = ++leaderTokenRef.current;
      pendingLeaderClipIdRef.current = clip.id;
      const pool = videoPoolRef.current;

      try {
        let video: HTMLVideoElement;
        try {
          video = await ensurePoolVideoForClip(pool, clip);
        } catch {
          return;
        }
        if (token !== leaderTokenRef.current) return;

        const latestPlayhead = playheadRef.current;
        const target = clipMediaTimeSec(clip, latestPlayhead);
        if (Math.abs(video.currentTime - target) > LEADER_DRIFT_THRESHOLD) {
          video.currentTime = target;
        }

        const oldVideo = leaderVideoRef.current;
        if (oldVideo && oldVideo !== video) {
          oldVideo.muted = true;
        }

        if (isPlayingRef.current && video.paused) {
          if (!video.muted) video.muted = true;
          try {
            await video.play();
          } catch {
            // 兜底：保持 muted 让 syncPoolVideos 后续重试 play。
          }
          if (token !== leaderTokenRef.current) return;
        }

        video.muted = false;
        leaderClipIdRef.current = clip.id;
        leaderVideoRef.current = video;
      } finally {
        if (token === leaderTokenRef.current) {
          pendingLeaderClipIdRef.current = null;
        }
      }
    },
    [playheadRef, videoPoolRef]
  );

  const applyLeaderForTime = useCallback(
    (sec: number): void => {
      const top = resolveTopVideoClipAtTime(tracksRef.current, sec);
      if (top) {
        void setLeader(top);
      } else {
        releaseLeader();
      }
    },
    [releaseLeader, setLeader]
  );

  const seek = useCallback(
    (sec: number) => {
      const clamped = Math.max(0, Math.min(durationRef.current, sec));
      commitPlayhead(clamped, { force: true });
      applyLeaderForTime(clamped);
      runSyncPool(clamped, isPlayingRef.current);
      lastPoolSyncAtMsRef.current = performance.now();
    },
    [applyLeaderForTime, commitPlayhead, runSyncPool]
  );

  const togglePlay = useCallback(() => {
    const willPlay = !isPlayingRef.current;
    if (willPlay) {
      const end = getContentEndSec(tracksRef.current);
      if (end > EPS && playheadRef.current >= end - EPS) {
        commitPlayhead(0, { force: true });
        applyLeaderForTime(0);
        runSyncPool(0, false);
        lastPoolSyncAtMsRef.current = performance.now();
      }
    }
    setIsPlaying(willPlay);
  }, [applyLeaderForTime, commitPlayhead, playheadRef, runSyncPool, setIsPlaying]);

  const stopAtContentEnd = useCallback(() => {
    const end = getContentEndSec(tracksRef.current);
    isPlayingRef.current = false;
    setIsPlaying(false);
    commitPlayhead(end, { force: true });
    runSyncPool(end, false);
    lastPoolSyncAtMsRef.current = performance.now();
  }, [commitPlayhead, runSyncPool, setIsPlaying]);

  const skipToStart = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    commitPlayhead(0, { force: true });
    applyLeaderForTime(0);
    runSyncPool(0, false);
    lastPoolSyncAtMsRef.current = performance.now();
  }, [applyLeaderForTime, commitPlayhead, runSyncPool, setIsPlaying]);

  const skipToEnd = useCallback(() => {
    const end = getContentEndSec(tracksRef.current);
    isPlayingRef.current = false;
    setIsPlaying(false);
    commitPlayhead(end, { force: true });
    applyLeaderForTime(end);
    runSyncPool(end, false);
    lastPoolSyncAtMsRef.current = performance.now();
  }, [applyLeaderForTime, commitPlayhead, runSyncPool, setIsPlaying]);

  useEffect(() => {
    if (!isPlaying) return;

    const pool = videoPoolRef.current;
    let cancelled = false;

    const tick = (now: number): void => {
      if (cancelled || !isPlayingRef.current) return;

      const tracksNow = tracksRef.current;
      const contentEnd = getContentEndSec(tracksNow);
      const t0 = playheadRef.current;

      if (contentEnd <= EPS || t0 >= contentEnd - EPS) {
        stopAtContentEnd();
        return;
      }

      const dt = lastTickRef.current === 0 ? 0 : (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      const sortedNow = sortedTracksRef.current;
      const top = resolveTopVideoClipAtTime(tracksNow, t0);

      let nextPlayhead = t0;
      let shouldStop = false;

      if (top?.clip.media_url) {
        const leader = leaderVideoRef.current;
        const leaderMatchesClip =
          leaderClipIdRef.current === top.clip.id &&
          leader != null &&
          videoPoolRef.current.get(clipPoolKey(top.clip)) === leader;
        const leaderPending = pendingLeaderClipIdRef.current === top.clip.id;
        const leaderEffectivelyMatches = leaderMatchesClip || leaderPending;

        const driveFromLeader =
          leaderMatchesClip &&
          leader != null &&
          leader.readyState >= 2 &&
          !leader.paused;

        if (driveFromLeader && leader) {
          const mediaStart = top.clip.media_start_sec ?? 0;
          const tLeader = top.clip.start_sec + (leader.currentTime - mediaStart);
          const effectiveEnd = clipEffectiveEndSec(top.clip);
          if (tLeader >= effectiveEnd - EPS) {
            const resumeSec = Math.min(effectiveEnd + EPS, contentEnd);
            if (resumeSec >= contentEnd - EPS) {
              shouldStop = true;
              nextPlayhead = contentEnd;
            } else {
              nextPlayhead = resumeSec;
            }
          } else if (tLeader >= contentEnd - EPS) {
            shouldStop = true;
            nextPlayhead = contentEnd;
          } else {
            if (tLeader < t0 && t0 - tLeader < MONOTONIC_TOLERANCE_SEC) {
              nextPlayhead = t0;
            } else {
              nextPlayhead = tLeader;
            }
          }
        } else {
          if (!leaderEffectivelyMatches) {
            void setLeader(top);
          } else if (
            leaderMatchesClip &&
            leader &&
            leader.paused &&
            !leader.ended
          ) {
            void leader.play().catch(() => {
              if (!leader.muted) {
                leader.muted = true;
                void leader.play().catch(() => undefined);
              }
            });
          }
          const t = t0 + dt;
          if (t >= contentEnd - EPS) {
            shouldStop = true;
            nextPlayhead = contentEnd;
          } else {
            nextPlayhead = t;
          }
        }
      } else {
        if (leaderClipIdRef.current != null) {
          releaseLeader();
        }
        const t = t0 + dt;
        if (t >= contentEnd - EPS) {
          shouldStop = true;
          nextPlayhead = contentEnd;
        } else {
          nextPlayhead = t;
        }
      }

      if (shouldStop) {
        stopAtContentEnd();
        return;
      }

      if (nextPlayhead < playheadRef.current) {
        nextPlayhead = playheadRef.current;
      }

      setPlayhead(nextPlayhead, { now });

      if (now - lastPreloadAtMsRef.current >= PRELOAD_THROTTLE_MS) {
        lastPreloadAtMsRef.current = now;
        const activeKeys = resolveActiveVideoClipKeysSorted(
          sortedNow,
          playheadRef.current
        );
        preloadUpcomingVideos(
          tracksNow,
          videoPoolRef.current,
          playheadRef.current,
          LOOKAHEAD_SEC,
          activeKeys
        );
      }

      if (now - lastPoolSyncAtMsRef.current >= POOL_SYNC_THROTTLE_MS) {
        lastPoolSyncAtMsRef.current = now;
        runSyncPool(playheadRef.current, true);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    lastTickRef.current = 0;
    lastPreloadAtMsRef.current = 0;
    lastStoreWriteAtMsRef.current = 0;
    lastPoolSyncAtMsRef.current = performance.now();
    applyLeaderForTime(playheadRef.current);
    runSyncPool(playheadRef.current, true);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      for (const v of pool.values()) {
        if (!v.paused) v.pause();
      }
    };
  }, [
    isPlaying,
    applyLeaderForTime,
    playheadRef,
    releaseLeader,
    runSyncPool,
    setLeader,
    setPlayhead,
    stopAtContentEnd,
    videoPoolRef,
  ]);

  useEffect(() => {
    if (isPlaying) return;
    notifySubscribers(playheadSec);
    applyLeaderForTime(playheadSec);
    runSyncPool(playheadSec, false);
  }, [playheadSec, isPlaying, applyLeaderForTime, notifySubscribers, runSyncPool]);

  return { seek, togglePlay, skipToStart, skipToEnd, subscribePlayhead };
}
