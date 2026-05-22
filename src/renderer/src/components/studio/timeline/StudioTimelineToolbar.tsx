"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  ChevronDown,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { formatTimelineTime } from "./pointerToSec";
import {
  clampTimelineZoom,
  nudgeTimelineZoom,
  TIMELINE_ZOOM_MAX,
  TIMELINE_ZOOM_MIN,
  TIMELINE_ZOOM_STEP,
} from "./timelineZoom";

function SplitClipIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M12 4v16" />
      <path d="M8 12h2" />
      <path d="M14 12h2" />
    </svg>
  );
}

function TrimLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M12 4v16" />
      <path d="M8 12h2" />
      <path d="M16 10l-2 2 2 2" />
    </svg>
  );
}

function TrimRightIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M12 4v16" />
      <path d="M8 10l2 2-2 2" />
      <path d="M14 12h2" />
    </svg>
  );
}

type ClipEditOperation = "trimLeft" | "split" | "trimRight";

const TOOLBAR_TWO_ROW_BREAKPOINT_PX = 2060;

interface StudioTimelineToolbarProps {
  playheadSec: number;
  contentEndSec: number;
  timelineZoom: number;
  isPlaying: boolean;
  creatingClip: boolean;
  uploading: boolean;
  capturingKeyframe: boolean;
  onCaptureKeyframe: () => void;
  onSkipToStart: () => void;
  onSkipToEnd: () => void;
  onTogglePlay: () => void;
  onZoomChange: (zoom: number) => void;
  onCreateClip: () => void;
  onUploadClick: () => void;
  selectedClipCount: number;
  onRenameClip: () => void;
  onDeleteClip: () => void;
  canEditClipAtPlayhead: boolean;
  activeClipEditOperation: ClipEditOperation | null;
  onTrimClipLeftAtPlayhead: () => void;
  onSplitClipAtPlayhead: () => void;
  onTrimClipRightAtPlayhead: () => void;
  leftSelectableClipCount: number;
  rightSelectableClipCount: number;
  onSelectAllLeft: () => void;
  onSelectAllRight: () => void;
  onCollapse: () => void;
}

export default function StudioTimelineToolbar({
  playheadSec,
  contentEndSec,
  timelineZoom,
  isPlaying,
  creatingClip,
  uploading,
  capturingKeyframe,
  onCaptureKeyframe,
  onSkipToStart,
  onSkipToEnd,
  onTogglePlay,
  onZoomChange,
  onCreateClip,
  onUploadClick,
  selectedClipCount,
  onRenameClip,
  onDeleteClip,
  canEditClipAtPlayhead,
  activeClipEditOperation,
  onTrimClipLeftAtPlayhead,
  onSplitClipAtPlayhead,
  onTrimClipRightAtPlayhead,
  leftSelectableClipCount,
  rightSelectableClipCount,
  onSelectAllLeft,
  onSelectAllRight,
  onCollapse,
}: StudioTimelineToolbarProps) {
  const { t } = useLanguage();
  const toolbarRef = useRef<HTMLElement>(null);
  const [twoRowLayout, setTwoRowLayout] = useState(false);
  const editingClip = activeClipEditOperation != null;
  const actionButtonClass =
    "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-foreground hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50";

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;

    const updateLayout = (width: number) => {
      setTwoRowLayout(width <= TOOLBAR_TWO_ROW_BREAKPOINT_PX);
    };

    const ro = new ResizeObserver(() => {
      updateLayout(el.getBoundingClientRect().width);
    });

    ro.observe(el);
    updateLayout(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  return (
    <header ref={toolbarRef} className="shrink-0 border-b border-white/10 px-2 py-1.5 sm:px-3">
      <div
        className={`grid items-center gap-2 ${
          twoRowLayout
            ? "grid-cols-[minmax(0,1fr)_auto]"
            : "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
        }`}
      >
        <div
          className={`flex min-w-0 items-center gap-2 ${
            twoRowLayout
              ? "col-start-1 row-start-1 flex-wrap"
              : "col-start-1 row-start-1 justify-self-start"
          }`}
        >
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              disabled={creatingClip}
              onClick={onCreateClip}
              className={actionButtonClass}
            >
              {creatingClip ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              {t("studioTimelineCreateClip")}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={onUploadClick}
              className={actionButtonClass}
            >
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              {uploading ? t("studioTimelineUploading") : t("studioTimelineUpload")}
            </button>
            <button
              type="button"
              disabled={capturingKeyframe}
              onClick={onCaptureKeyframe}
              title={t("studioTimelineCaptureKeyframe")}
              className={actionButtonClass}
            >
              {capturingKeyframe ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Camera className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">{t("studioImageKeyframe")}</span>
            </button>
          </div>
          <div className="h-5 w-px shrink-0 bg-white/10" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={selectedClipCount !== 1}
              onClick={onRenameClip}
              className={actionButtonClass}
              title={t("studioClipRename")}
            >
              <Pencil className="h-3 w-3" />
              <span className="hidden sm:inline">{t("studioClipRename")}</span>
            </button>
            <button
              type="button"
              disabled={selectedClipCount === 0}
              onClick={onDeleteClip}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-red-400 hover:border-red-400/40 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              title={t("studioTimelineDeleteClip")}
            >
              <Trash2 className="h-3 w-3" />
              <span className="hidden sm:inline">{t("studioTimelineDeleteClip")}</span>
            </button>
          </div>
          <div className="h-5 w-px shrink-0 bg-white/10" />
          <button
            type="button"
            disabled={!canEditClipAtPlayhead || editingClip}
            onClick={onTrimClipLeftAtPlayhead}
            className={`${actionButtonClass} ${
              canEditClipAtPlayhead ? "border-accent/60 bg-accent/20 text-accent" : ""
            }`}
            title={t("studioTimelineTrimLeft")}
          >
            {activeClipEditOperation === "trimLeft" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <TrimLeftIcon className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">{t("studioTimelineTrimLeft")}</span>
          </button>
          <button
            type="button"
            disabled={!canEditClipAtPlayhead || editingClip}
            onClick={onSplitClipAtPlayhead}
            className={`${actionButtonClass} ${
              canEditClipAtPlayhead ? "border-accent/60 bg-accent/20 text-accent" : ""
            }`}
            title={t("studioTimelineCutTool")}
          >
            {activeClipEditOperation === "split" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <SplitClipIcon className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">{t("studioTimelineCutTool")}</span>
          </button>
          <button
            type="button"
            disabled={!canEditClipAtPlayhead || editingClip}
            onClick={onTrimClipRightAtPlayhead}
            className={`${actionButtonClass} ${
              canEditClipAtPlayhead ? "border-accent/60 bg-accent/20 text-accent" : ""
            }`}
            title={t("studioTimelineTrimRight")}
          >
            {activeClipEditOperation === "trimRight" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <TrimRightIcon className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">{t("studioTimelineTrimRight")}</span>
          </button>
          <button
            type="button"
            disabled={leftSelectableClipCount === 0}
            onClick={onSelectAllLeft}
            className={actionButtonClass}
            title={t("studioTimelineSelectAllLeft")}
          >
            <SkipBack className="h-3 w-3" />
            <span className="hidden sm:inline">{t("studioTimelineSelectAllLeft")}</span>
          </button>
          <button
            type="button"
            disabled={rightSelectableClipCount === 0}
            onClick={onSelectAllRight}
            className={actionButtonClass}
            title={t("studioTimelineSelectAllRight")}
          >
            <SkipForward className="h-3 w-3" />
            <span className="hidden sm:inline">{t("studioTimelineSelectAllRight")}</span>
          </button>
        </div>

        <div
          className={`flex items-center justify-center gap-1 sm:gap-2 ${
            twoRowLayout ? "col-span-2 col-start-1 row-start-2" : "col-start-2 row-start-1"
          }`}
        >
          <button
            type="button"
            onClick={onSkipToStart}
            className="cursor-pointer rounded-lg p-1.5 text-foreground hover:bg-white/5"
            title={t("studioTimelineSkipStart")}
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            className="cursor-pointer rounded-lg bg-white/5 p-1.5 text-foreground hover:bg-primary/20 hover:text-primary"
            title={isPlaying ? t("studioTimelinePause") : t("studioTimelinePlay")}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onSkipToEnd}
            className="cursor-pointer rounded-lg p-1.5 text-foreground hover:bg-white/5"
            title={t("studioTimelineSkipEnd")}
          >
            <SkipForward className="h-4 w-4" />
          </button>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground sm:text-xs">
            {formatTimelineTime(playheadSec)} / {formatTimelineTime(contentEndSec)}
          </span>
        </div>

        <div
          className={`flex items-center justify-end gap-0.5 ${
            twoRowLayout ? "col-start-2 row-start-1" : "col-start-3 row-start-1 justify-self-end"
          }`}
        >
          <button
            type="button"
            onClick={() => onZoomChange(nudgeTimelineZoom(timelineZoom, -TIMELINE_ZOOM_STEP))}
            className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
            title={t("studioTimelineZoomOut")}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <input
            type="range"
            min={TIMELINE_ZOOM_MIN}
            max={TIMELINE_ZOOM_MAX}
            step={TIMELINE_ZOOM_STEP}
            value={timelineZoom}
            onChange={(e) => onZoomChange(clampTimelineZoom(Number(e.target.value)))}
            aria-label={t("studioTimelineZoomSlider")}
            className="h-1 w-14 cursor-pointer accent-primary sm:w-16"
          />
          <button
            type="button"
            onClick={() => onZoomChange(nudgeTimelineZoom(timelineZoom, TIMELINE_ZOOM_STEP))}
            className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
            title={t("studioTimelineZoomIn")}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onCollapse}
            className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
