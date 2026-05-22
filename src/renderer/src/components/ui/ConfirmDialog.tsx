"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  icon,
  confirmLabel,
  cancelLabel,
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useLanguage();
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    },
    [onCancel, loading],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current && !loading) onCancel();
    },
    [onCancel, loading],
  );

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
      role="dialog"
      aria-modal="true"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-studio-dialog p-5 shadow-2xl animate-dialog-in">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              destructive ? "bg-red-500/15" : "bg-primary/15"
            }`}
          >
            {icon ?? (
              <AlertTriangle
                className={`h-5 w-5 ${destructive ? "text-red-400" : "text-primary"}`}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-sm font-semibold text-foreground">
              {title}
            </h3>
            {description && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel ?? t("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              destructive
                ? "bg-red-500/80 hover:bg-red-500"
                : "bg-primary hover:bg-primary/90"
            }`}
          >
            {loading && (
              <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/30 border-t-white" />
            )}
            {confirmLabel ?? t("delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
