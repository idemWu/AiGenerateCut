"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useNavigate } from "react-router-dom";
import { Clapperboard, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Locale } from "@/lib/i18n/translations";
import { withLocalePath } from "@/lib/i18n/routing";
import { createStudioProject } from "@/lib/api/studio";
import { useStudioProjects } from "@/lib/hooks/useStudio";
import { useRequireLogin } from "@/lib/hooks/useRequireLogin";
import { useAuthStore } from "@/lib/stores/authStore";
import type { components } from "@/lib/api/schema";

type StudioAspectRatio = components["schemas"]["StudioAspectRatio"];

const PAGE_SIZE = 24;
const ASPECT_RATIOS: StudioAspectRatio[] = ["16:9", "9:16", "1:1", "4:3", "3:4"];
const PAGINATION_COPY: Record<
  Locale,
  {
    previous: string;
    next: string;
    status: (page: number, totalPages: number, total: number) => string;
  }
> = {
  en: {
    previous: "Previous",
    next: "Next",
    status: (page, totalPages, total) => `Page ${page} of ${totalPages} · ${total} projects`,
  },
  zh: {
    previous: "上一页",
    next: "下一页",
    status: (page, totalPages, total) => `第 ${page} / ${totalPages} 页 · 共 ${total} 个项目`,
  },
  ja: {
    previous: "前へ",
    next: "次へ",
    status: (page, totalPages, total) => `${page} / ${totalPages} ページ · 全 ${total} 件`,
  },
};

export default function StudioProjectList() {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const requireLogin = useRequireLogin();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [page, setPage] = useState(1);
  const { projects, total, isLoading, mutate } = useStudioProjects(page, PAGE_SIZE, {
    enabled: isLoggedIn,
  });
  const wasLoggedInRef = useRef(isLoggedIn);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [aspectRatio, setAspectRatio] = useState<StudioAspectRatio>("16:9");
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginationCopy = PAGINATION_COPY[locale];
  const showPagination = totalPages > 1;

  useEffect(() => {
    if (!wasLoggedInRef.current && isLoggedIn) {
      setPage(1);
      void mutate();
    }
    wasLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn, mutate]);

  useEffect(() => {
    if (!isLoading && page > totalPages) {
      setPage(totalPages);
    }
  }, [isLoading, page, totalPages]);

  const handlePreviousPage = useCallback(() => {
    setPage((current) => Math.max(1, current - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setPage((current) => Math.min(totalPages, current + 1));
  }, [totalPages]);

  const handleCreate = useCallback(() => {
    requireLogin(async () => {
      const trimmed = title.trim();
      if (!trimmed) {
        toast.error(t("studioPromptRequired"));
        return;
      }
      setCreating(true);
      try {
        const project = await createStudioProject({
          title: trimmed,
          aspect_ratio: aspectRatio,
        });
        setDialogOpen(false);
        setTitle("");
        await mutate();
        navigate(withLocalePath(locale, `/studio/${project.id}`));
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("studioTimelineSaveFailed");
        toast.error(msg);
      } finally {
        setCreating(false);
      }
    });
  }, [aspectRatio, locale, mutate, navigate, requireLogin, t, title]);

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-12 sm:px-6 lg:px-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            {t("studioTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            {t("studioSubtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => requireLogin(() => setDialogOpen(true))}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {t("studioStartCreate")}
        </button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : projects.length === 0 ? (
        <div className="glass flex flex-col items-center gap-4 rounded-xl border border-white/10 px-6 py-16 text-center">
          <Clapperboard className="h-12 w-12 text-primary" />
          <p className="text-muted-foreground">{t("studioInputPlaceholder")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={withLocalePath(locale, `/studio/${p.id}`)}
              className="glass group cursor-pointer rounded-xl border border-white/10 p-4 transition-all duration-300 hover:border-primary/40"
            >
              <div className="mb-3 flex aspect-video items-center justify-center rounded-lg bg-white/5">
                <Clapperboard className="h-8 w-8 text-primary/60 group-hover:text-primary" />
              </div>
              <h2 className="truncate font-display font-semibold text-foreground">{p.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{p.aspect_ratio}</p>
            </Link>
          ))}
        </div>
      )}

      {showPagination ? (
        <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted-foreground sm:flex-row">
          <span>{paginationCopy.status(page, totalPages, total)}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={handlePreviousPage}
              className="cursor-pointer rounded-lg border border-white/10 px-3 py-1.5 text-foreground transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {paginationCopy.previous}
            </button>
            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={handleNextPage}
              className="cursor-pointer rounded-lg border border-white/10 px-3 py-1.5 text-foreground transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {paginationCopy.next}
            </button>
          </div>
        </div>
      ) : null}

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal
        >
          <div className="glass w-full max-w-md rounded-xl border border-white/10 p-6">
            <h2 className="font-display text-lg font-semibold">{t("studioStartCreate")}</h2>
            <label className="mt-4 block text-sm text-muted-foreground">
              {t("studioPreviewTitle")}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-foreground outline-none focus:border-primary"
              />
            </label>
            <label className="mt-4 block text-sm text-muted-foreground">
              Aspect
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as StudioAspectRatio)}
                className="mt-1 w-full cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              >
                {ASPECT_RATIOS.map((ar) => (
                  <option key={ar} value={ar}>
                    {ar}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm"
              >
                {t("studioAgentCancel")}
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={handleCreate}
                className="cursor-pointer rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : t("studioStartCreate")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
