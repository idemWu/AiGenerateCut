"use client";

import { useEffect, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

interface StudioClipContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function StudioClipContextMenu({
  open,
  x,
  y,
  onRename,
  onDelete,
  onClose,
}: StudioClipContextMenuProps) {
  const { t } = useLanguage();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[60] min-w-[9rem] overflow-hidden rounded-lg border border-white/10 bg-background/95 py-1 shadow-xl backdrop-blur-xl"
      style={{ left: x, top: y }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onRename();
        }}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-white/10"
      >
        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {t("studioClipRename")}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onDelete();
        }}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-red-400 transition-colors hover:bg-red-500/10"
      >
        <Trash2 className="h-3.5 w-3.5 shrink-0" />
        {t("studioTimelineDeleteClip")}
      </button>
    </div>
  );
}
