"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StudioAiOperationType } from "@/lib/studio/studioAiModels";

export type StudioToolMode = "ai" | "workflows" | "filters" | "local";

export type StudioSelectedModelByType = Partial<
  Record<StudioAiOperationType, string>
>;

interface StudioEditorState {
  toolMode: StudioToolMode;
  activeWorkflowId: number | null;
  selectedModelByType: StudioSelectedModelByType;
  playheadSec: number;
  isPlaying: boolean;
  selectedClipId: number | null;
  timelineZoom: number;
  setToolMode: (mode: StudioToolMode) => void;
  setActiveWorkflowId: (id: number | null) => void;
  setSelectedModelForType: (type: StudioAiOperationType, modelId: string) => void;
  setPlayheadSec: (sec: number | ((prev: number) => number)) => void;
  setIsPlaying: (playing: boolean) => void;
  pausePlayback: () => void;
  setSelectedClipId: (id: number | null) => void;
  setTimelineZoom: (zoom: number) => void;
}

interface PersistedStudioEditorSlice {
  timelineZoom: number;
  selectedModelByType: StudioSelectedModelByType;
  /** @deprecated migrated to selectedModelByType */
  selectedModelId?: string;
}

export const useStudioEditorStore = create<StudioEditorState>()(
  persist(
    (set) => ({
      toolMode: "ai",
      activeWorkflowId: null,
      selectedModelByType: {},
      playheadSec: 0,
      isPlaying: false,
      selectedClipId: null,
      timelineZoom: 80,
      setToolMode: (toolMode) => set({ toolMode }),
      setActiveWorkflowId: (activeWorkflowId) => set({ activeWorkflowId }),
      setSelectedModelForType: (type, modelId) =>
        set((s) => ({
          selectedModelByType: { ...s.selectedModelByType, [type]: modelId },
        })),
      setPlayheadSec: (playheadSec) =>
        set((s) => ({
          playheadSec:
            typeof playheadSec === "function" ? playheadSec(s.playheadSec) : playheadSec,
        })),
      setIsPlaying: (isPlaying) =>
        set(() => ({
          isPlaying,
          ...(isPlaying ? { selectedClipId: null } : {}),
        })),
      pausePlayback: () => set((s) => (s.isPlaying ? { isPlaying: false } : s)),
      setSelectedClipId: (selectedClipId) => set({ selectedClipId }),
      setTimelineZoom: (timelineZoom) => set({ timelineZoom }),
    }),
    {
      name: "studio-editor-ui",
      partialize: (s) => ({
        timelineZoom: s.timelineZoom,
        selectedModelByType: s.selectedModelByType,
      }),
      merge: (persisted, current) => {
        const p = persisted as PersistedStudioEditorSlice | undefined;
        const merged = { ...current, ...p };
        if (
          p?.selectedModelId &&
          (!p.selectedModelByType || Object.keys(p.selectedModelByType).length === 0)
        ) {
          merged.selectedModelByType = {
            image: p.selectedModelId,
          };
        }
        return merged;
      },
    }
  )
);
