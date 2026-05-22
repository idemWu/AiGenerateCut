"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

interface StudioClipRenameDialogProps {
  open: boolean;
  initialTitle: string;
  loading?: boolean;
  onConfirm: (title: string) => void;
  onCancel: () => void;
}

export default function StudioClipRenameDialog({
  open,
  initialTitle,
  loading = false,
  onConfirm,
  onCancel,
}: StudioClipRenameDialogProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      const id = window.requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
      return () => window.cancelAnimationFrame(id);
    }
    return undefined;
  }, [open, initialTitle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
      if (e.key === "Enter" && !loading) {
        e.preventDefault();
        onConfirm(title.trim());
      }
    },
    [loading, onCancel, onConfirm, title]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-studio-dialog p-5 shadow-2xl animate-dialog-in">
        <h3 className="font-display text-sm font-semibold text-foreground">
          {t("studioClipRenameTitle")}
        </h3>
        <input
          ref={inputRef}
          type="text"
          value={title}
          disabled={loading}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 disabled:opacity-50"
        />
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(title.trim())}
            disabled={loading}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && (
              <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/30 border-t-white" />
            )}
            {t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
