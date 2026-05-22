"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { resolveStudioMediaUrl } from "@/lib/studio/resolveStudioMediaUrl";
import { uploadStudioAiReferenceFile } from "@/lib/studio/uploadStudioAiReference";

interface StudioAssetReferenceUploadProps {
  label: string;
  urls: string[];
  onUrlsChange: (urls: string[]) => void;
  maxCount?: number;
  imagesOnly?: boolean;
}

export default function StudioAssetReferenceUpload({
  label,
  urls,
  onUrlsChange,
  maxCount = 20,
  imagesOnly = true,
}: StudioAssetReferenceUploadProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const remaining = maxCount - urls.length;
      if (remaining <= 0) return;

      const batch = Array.from(files).slice(0, remaining);
      setUploading(true);
      const added: string[] = [];
      try {
        for (const file of batch) {
          if (imagesOnly && !file.type.startsWith("image/")) {
            toast.error(t("studioTimelineSaveFailed"));
            continue;
          }
          const { objectKey } = await uploadStudioAiReferenceFile(file);
          added.push(objectKey);
        }
        if (added.length > 0) {
          onUrlsChange([...urls, ...added]);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("studioTimelineSaveFailed"));
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [imagesOnly, maxCount, onUrlsChange, t, urls]
  );

  const handleRemove = useCallback(
    (index: number) => {
      onUrlsChange(urls.filter((_, i) => i !== index));
    },
    [onUrlsChange, urls]
  );

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {urls.map((url, index) => {
          const src = resolveStudioMediaUrl(url) ?? url;
          return (
            <div
              key={`${url}-${index}`}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="absolute right-0.5 top-0.5 cursor-pointer rounded-full bg-black/70 p-0.5 text-white hover:bg-destructive"
                aria-label={t("cancel")}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        {urls.length < maxCount ? (
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex h-16 w-16 shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/5 text-muted-foreground hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={imagesOnly ? "image/*" : "image/*,video/*"}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </div>
  );
}
