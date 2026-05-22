"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { StudioPanelPlacement } from "@/lib/studio/studioEditorLayout";

interface StudioLayoutToggleButtonProps {
  placement: StudioPanelPlacement;
  onToggle: () => void;
  title: string;
}

export default function StudioLayoutToggleButton({
  placement,
  onToggle,
  title,
}: StudioLayoutToggleButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onToggle}
      className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground hover:bg-white/5"
    >
      {placement === "docked" ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      )}
    </button>
  );
}
