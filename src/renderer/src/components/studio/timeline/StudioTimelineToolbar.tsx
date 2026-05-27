"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  ChevronDown,
  Loader2,
  MousePointer2,
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
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" strokeDasharray="1.5 2.5" />
      <path d="M4.5 7H7v3" />
      <path d="M7 14v3H4.5" />
      <path d="M19.5 7H17v3" />
      <path d="M17 14v3h2.5" />
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
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.5 7H9v3" />
      <path d="M9 14v3H6.5" />
      <path d="M16 5v14" strokeDasharray="1.5 2.5" />
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
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.5 7H15v3" />
      <path d="M15 14v3h2.5" />
      <path d="M8 5v14" strokeDasharray="1.5 2.5" />
    </svg>
  );
}

function RazorToolIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 8h14v2.2c-1 .42-1.55 1.05-1.55 1.8s.55 1.38 1.55 1.8V16H5v-2.2c1-.42 1.55-1.05 1.55-1.8S6 10.62 5 10.2V8Z" />
      <path d="M8.75 12h6.5" />
      <path d="M10.25 10.2h3.5" />
      <path d="M10.25 13.8h3.5" />
    </svg>
  );
}

function SelectAllLeftIcon({ className }: { className?: string }) {
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
      <path d="M10 5 5 8.5 10 12" />
      <path d="M5 8.5h14" />
      <path d="M10 12 5 15.5 10 19" />
      <path d="M5 15.5h14" />
    </svg>
  );
}

function SelectAllRightIcon({ className }: { className?: string }) {
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
      <path d="M14 5 19 8.5 14 12" />
      <path d="M5 8.5h14" />
      <path d="M14 12 19 15.5 14 19" />
      <path d="M5 15.5h14" />
    </svg>
  );
}

function ButtonTooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  );
}

type ClipEditOperation = "trimLeft" | "split" | "trimRight";
export type TimelineSelectTool = "select" | "razor";

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
  activeTimelineTool: TimelineSelectTool;
  onTimelineToolChange: (tool: TimelineSelectTool) => void;
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
  activeTimelineTool,
  onTimelineToolChange,
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
  const iconActionButtonClass =
    "group relative inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs text-foreground hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50";
  const toolButtonClass =
    "group relative inline-flex h-6 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-xs text-muted-foreground hover:bg-white/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

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
              className={iconActionButtonClass}
              aria-label={t("studioTimelineCreateClip")}
            >
              {creatingClip ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <ButtonTooltip label={t("studioTimelineCreateClip")} />
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={onUploadClick}
              className={iconActionButtonClass}
              aria-label={uploading ? t("studioTimelineUploading") : t("studioTimelineUpload")}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <ButtonTooltip
                label={uploading ? t("studioTimelineUploading") : t("studioTimelineUpload")}
              />
            </button>
            <button
              type="button"
              disabled={capturingKeyframe}
              onClick={onCaptureKeyframe}
              className={iconActionButtonClass}
              aria-label={t("studioTimelineCaptureKeyframe")}
            >
              {capturingKeyframe ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              <ButtonTooltip label={t("studioTimelineCaptureKeyframe")} />
            </button>
          </div>
          <div className="h-5 w-px shrink-0 bg-white/10" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={selectedClipCount !== 1}
              onClick={onRenameClip}
              className={iconActionButtonClass}
              aria-label={t("studioClipRename")}
            >
              <Pencil className="h-4 w-4" />
              <ButtonTooltip label={t("studioClipRename")} />
            </button>
            <button
              type="button"
              disabled={selectedClipCount === 0}
              onClick={onDeleteClip}
              className={`${iconActionButtonClass} text-red-400 hover:border-red-400/40 hover:bg-red-500/10`}
              aria-label={t("studioTimelineDeleteClip")}
            >
              <Trash2 className="h-4 w-4" />
              <ButtonTooltip label={t("studioTimelineDeleteClip")} />
            </button>
          </div>
          <div className="h-5 w-px shrink-0 bg-white/10" />
          <div className="flex shrink-0 items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => onTimelineToolChange("select")}
              className={`${toolButtonClass} ${
                activeTimelineTool === "select" ? "bg-accent/20 text-accent" : ""
              }`}
              aria-label={t("studioTimelineSelectTool")}
              aria-pressed={activeTimelineTool === "select"}
            >
              <MousePointer2 className="h-4 w-4" />
              <ButtonTooltip label={t("studioTimelineSelectTool")} />
            </button>
            <button
              type="button"
              disabled={editingClip}
              onClick={() => onTimelineToolChange("razor")}
              className={`${toolButtonClass} ${
                activeTimelineTool === "razor" ? "bg-accent/20 text-accent" : ""
              }`}
              aria-label={t("studioTimelineRazorTool")}
              aria-pressed={activeTimelineTool === "razor"}
            >
              {activeClipEditOperation === "split" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RazorToolIcon className="h-5 w-5" />
              )}
              <ButtonTooltip label={t("studioTimelineRazorTool")} />
            </button>
          </div>
          <div className="h-5 w-px shrink-0 bg-white/10" />
          <button
            type="button"
            disabled={!canEditClipAtPlayhead || editingClip}
            onClick={onTrimClipLeftAtPlayhead}
            className={`${iconActionButtonClass} w-10 ${
              canEditClipAtPlayhead ? "border-accent/60 bg-accent/20 text-accent" : ""
            }`}
            aria-label={t("studioTimelineTrimLeft")}
          >
            {activeClipEditOperation === "trimLeft" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TrimLeftIcon className="h-5 w-5" />
            )}
            <ButtonTooltip label={t("studioTimelineTrimLeft")} />
          </button>
          <button
            type="button"
            disabled={!canEditClipAtPlayhead || editingClip}
            onClick={onSplitClipAtPlayhead}
            className={`${iconActionButtonClass} ${
              canEditClipAtPlayhead ? "border-accent/60 bg-accent/20 text-accent" : ""
            }`}
            aria-label={t("studioTimelineCutTool")}
          >
            {activeClipEditOperation === "split" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SplitClipIcon className="h-5 w-8" />
            )}
            <ButtonTooltip label={t("studioTimelineCutTool")} />
          </button>
          <button
            type="button"
            disabled={!canEditClipAtPlayhead || editingClip}
            onClick={onTrimClipRightAtPlayhead}
            className={`${iconActionButtonClass} ${
              canEditClipAtPlayhead ? "border-accent/60 bg-accent/20 text-accent" : ""
            }`}
            aria-label={t("studioTimelineTrimRight")}
          >
            {activeClipEditOperation === "trimRight" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TrimRightIcon className="h-5 w-5" />
            )}
            <ButtonTooltip label={t("studioTimelineTrimRight")} />
          </button>
          <button
            type="button"
            disabled={leftSelectableClipCount === 0}
            onClick={onSelectAllLeft}
            className={iconActionButtonClass}
            aria-label={t("studioTimelineSelectAllLeft")}
          >
            <SelectAllLeftIcon className="h-5 w-5" />
            <ButtonTooltip label={t("studioTimelineSelectAllLeft")} />
          </button>
          <button
            type="button"
            disabled={rightSelectableClipCount === 0}
            onClick={onSelectAllRight}
            className={iconActionButtonClass}
            aria-label={t("studioTimelineSelectAllRight")}
          >
            <SelectAllRightIcon className="h-5 w-5" />
            <ButtonTooltip label={t("studioTimelineSelectAllRight")} />
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
