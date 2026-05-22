"use client";

import { Loader2, Minus, Plus } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { StudioTimelineTrackResponse } from "@/lib/api/studio";
import { RULER_HEIGHT, trackRowStride } from "./timelineLayout";

interface StudioTrackLabelColumnProps {
  tracks: StudioTimelineTrackResponse[];
  selectedTrackId: number | null;
  creatingTrack: boolean;
  deletingTrack: boolean;
  onSelectTrack: (trackId: number) => void;
  onCreateTrack: () => void;
  onDeleteTrack: () => void;
}

function formatTrackLabel(
  track: StudioTimelineTrackResponse,
  t: (key: TranslationKey) => string
): string {
  return (
    track.title ||
    t("studioTimelineTrackDefault").replace("{number}", String(track.sort_order + 1))
  );
}

export default function StudioTrackLabelColumn({
  tracks,
  selectedTrackId,
  creatingTrack,
  deletingTrack,
  onSelectTrack,
  onCreateTrack,
  onDeleteTrack,
}: StudioTrackLabelColumnProps) {
  const { t } = useLanguage();
  const canDelete = selectedTrackId != null && !deletingTrack;

  return (
    <div className="shrink-0 border-r border-white/10 bg-white/[0.02]">
      <div
        className="flex items-center justify-center gap-0.5 border-b border-white/10"
        style={{ height: RULER_HEIGHT }}
      >
        <button
          type="button"
          disabled={creatingTrack}
          onClick={onCreateTrack}
          title={t("studioTimelineAddTrack")}
          className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creatingTrack ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          disabled={!canDelete}
          onClick={onDeleteTrack}
          title={t("studioTimelineDeleteTrack")}
          className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {deletingTrack ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Minus className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {tracks.length === 0 ? (
        <div className="px-2 py-4 text-center text-[10px] text-muted-foreground">—</div>
      ) : (
        tracks.map((track) => {
          const isSelected = selectedTrackId === track.id;
          return (
            <button
              key={track.id}
              type="button"
              onClick={() => onSelectTrack(track.id)}
              className={
                "flex w-full cursor-pointer items-center justify-center px-2 text-center text-[10px] transition-colors " +
                (isSelected
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground")
              }
              style={{ height: trackRowStride() }}
              title={track.title ?? undefined}
            >
              <span className="max-w-full truncate">
                {formatTrackLabel(track, t)}
                {track.is_locked ? " 🔒" : ""}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
