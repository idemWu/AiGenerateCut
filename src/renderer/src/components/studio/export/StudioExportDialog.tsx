"use client";

import { useCallback, useRef, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { StudioAspectRatio, StudioTimelineTrackResponse } from "@/lib/api/studio";
import { useRequireLogin } from "@/lib/hooks/useRequireLogin";
import { buildStudioExportFilename } from "@/lib/studio/export/buildExportFilename";
import {
  exportTimelineMp4,
  isStudioExportSupported,
  type ExportProgress,
} from "@/lib/studio/export/exportTimelineMp4";

interface StudioExportDialogProps {
  open: boolean;
  onClose: () => void;
  tracks: StudioTimelineTrackResponse[];
  /** 导出时长：最后一个 clip 的结束时间（非标尺总长度） */
  contentEndSec: number;
  aspectRatio: StudioAspectRatio;
  projectTitle: string;
}

// 各 phase 在全局进度条上的区间。三条导出路径各有不同。
const PHASE_RANGES_WEBCODECS = {
  prepare: [0, 10],
  encode: [10, 95],
  mux: [95, 100],
} as const;

const PHASE_RANGES_FFMPEG = {
  loadWasm: [0, 8],
  prepare: [8, 15],
  encode: [15, 70],
  mux: [70, 100],
} as const;

const PHASE_RANGES_NATIVE = {
  prepare: [0, 10],
  encode: [10, 75],
  mux: [75, 100],
} as const;

function phaseToGlobalPct(p: ExportProgress): number {
  const ranges = p.nativeMode
    ? PHASE_RANGES_NATIVE
    : p.compatMode
      ? PHASE_RANGES_FFMPEG
      : PHASE_RANGES_WEBCODECS;
  const range = (ranges as Record<string, readonly [number, number]>)[p.phase];
  if (!range) return 0;
  const [lo, hi] = range;
  const clamped = Math.max(0, Math.min(1, p.progress));
  return lo + (hi - lo) * clamped;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function StudioExportDialog({
  open,
  onClose,
  tracks,
  contentEndSec,
  aspectRatio,
  projectTitle,
}: StudioExportDialogProps) {
  const { t } = useLanguage();
  const requireLogin = useRequireLogin();
  const abortRef = useRef<AbortController | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [compatMode, setCompatMode] = useState(false);
  // 全局映射后的进度（单调递增），避免 phase 切换时进度条回退。
  const [displayPct, setDisplayPct] = useState(0);

  const hasClips = tracks.some((tr) => (tr.clips ?? []).length > 0);

  const handleExport = useCallback(() => {
    requireLogin(() => {
      if (!isStudioExportSupported()) {
        toast.error(t("studioExportUnsupported"));
        return;
      }
      if (!hasClips) {
        toast.error(t("studioExportNoClips"));
        return;
      }
      if (contentEndSec <= 0) {
        toast.error(t("studioExportNoClips"));
        return;
      }
      if (contentEndSec > 300) {
        toast.error(t("studioExportTooLong"));
        return;
      }

      void (async () => {
        setExporting(true);
        setCompatMode(false);
        setProgress({ phase: "prepare", progress: 0 });
        setDisplayPct(0);
        const ac = new AbortController();
        abortRef.current = ac;
        const defaultFilename = buildStudioExportFilename(projectTitle || "studio");
        try {
          const result = await exportTimelineMp4({
            tracks,
            durationSec: contentEndSec,
            aspectRatio,
            defaultFilename,
            onProgress: (p) => {
              if (p.compatMode) setCompatMode(true);
              setProgress(p);
              const next = phaseToGlobalPct(p);
              setDisplayPct((prev) => (next > prev ? next : prev));
            },
            signal: ac.signal,
          });
          setDisplayPct(100);
          if (result.kind === "file") {
            const message = t("studioExportSavedTo").replace("{path}", result.outputPath);
            toast.success(message);
            // Native 保存完成后稍作停留，让用户能看到进度条到达 100%，避免观感停在 75%。
            await delay(300);
          } else {
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = defaultFilename;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(t("studioExportSuccess"));
          }
          onClose();
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") {
            toast.info(t("studioExportCancelled"));
          } else {
            toast.error(e instanceof Error ? e.message : t("studioExportFailed"));
          }
        } finally {
          setExporting(false);
          setProgress(null);
          setCompatMode(false);
          setDisplayPct(0);
          abortRef.current = null;
        }
      })();
    });
  }, [
    aspectRatio,
    contentEndSec,
    hasClips,
    onClose,
    projectTitle,
    requireLogin,
    t,
    tracks,
  ]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    if (!exporting) onClose();
  }, [exporting, onClose]);

  if (!open) return null;

  const pct = Math.min(100, Math.max(0, Math.round(displayPct)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal
        className="w-full max-w-md rounded-xl border border-white/10 bg-background p-6 shadow-xl"
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {t("studioExportTitle")}
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            className="cursor-pointer rounded-lg p-1 text-muted-foreground hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <p className="mb-4 text-sm text-muted-foreground">{t("studioExportDesc")}</p>
        {exporting && compatMode ? (
          <p className="mb-3 text-xs text-muted-foreground">{t("studioExportCompatMode")}</p>
        ) : null}
        {exporting && progress ? (
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>
                {progress.phase === "loadWasm"
                  ? t("studioExportPhaseLoadWasm")
                  : progress.phase === "prepare"
                    ? t("studioExportPhasePrepare")
                    : progress.phase === "encode"
                      ? t("studioExportPhaseEncode")
                      : t("studioExportPhaseMux")}
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : null}
        <footer className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="cursor-pointer rounded-xl border border-white/10 px-4 py-2 text-sm text-foreground hover:bg-white/5"
          >
            {exporting ? t("studioAgentCancel") : t("studioExportClose")}
          </button>
          <button
            type="button"
            disabled={exporting || !hasClips}
            onClick={handleExport}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t("studioExportStart")}
          </button>
        </footer>
      </div>
    </div>
  );
}
