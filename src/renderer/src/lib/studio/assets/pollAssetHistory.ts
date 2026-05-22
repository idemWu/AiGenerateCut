import { toast } from "sonner";
import {
  listStudioAssetHistories,
  type StudioAssetHistoryResponse,
} from "@/lib/api/studio";
import type { TranslationKey } from "@/lib/i18n/translations";
import { isStudioRequestTimeout } from "@/lib/studio/ai/runStudioNodeGeneration";

const TERMINAL = new Set(["succeeded", "failed"]);
const NON_TERMINAL = new Set(["pending", "processing"]);

export interface PollAssetHistoryOptions {
  projectId: number;
  assetId: number;
  historyId: number;
  intervalMs?: number;
  maxWaitMs?: number;
  onUpdate?: (history: StudioAssetHistoryResponse) => void;
}

export async function pollAssetHistory(
  options: PollAssetHistoryOptions
): Promise<StudioAssetHistoryResponse> {
  const {
    projectId,
    assetId,
    historyId,
    intervalMs = 2500,
    maxWaitMs = 300_000,
    onUpdate,
  } = options;

  const started = Date.now();

  while (true) {
    const histories = await listStudioAssetHistories(projectId, assetId, {
      page: 1,
      size: 50,
    });
    const current = histories.find((h) => h.id === historyId);
    if (current) {
      onUpdate?.(current);
      if (TERMINAL.has(current.status)) {
        return current;
      }
    }

    if (Date.now() - started > maxWaitMs) {
      if (current) return current;
      throw new Error("Asset generation polling timed out");
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }
}

export interface RunAssetGenerationAfterCreateParams {
  projectId: number;
  assetId: number;
  history: StudioAssetHistoryResponse;
  refreshHistories: () => Promise<unknown>;
  refreshAssets: () => Promise<unknown>;
  t: (key: TranslationKey) => string;
}

async function handleTerminalHistory(
  history: StudioAssetHistoryResponse,
  params: RunAssetGenerationAfterCreateParams
): Promise<void> {
  const { refreshHistories, refreshAssets, t } = params;
  await refreshHistories();
  await refreshAssets();

  if (history.status === "succeeded") {
    toast.success(t("studioAssetGenerateSuccess"));
    return;
  }

  if (history.status === "failed") {
    toast.error(history.error_message ?? t("studioTimelineSaveFailed"));
  }
}

export function runAssetGenerationAfterCreate(
  params: RunAssetGenerationAfterCreateParams
): void {
  void (async () => {
    const { projectId, assetId, history, refreshHistories } = params;
    try {
      let current = history;
      if (NON_TERMINAL.has(current.status)) {
        current = await pollAssetHistory({
          projectId,
          assetId,
          historyId: current.id,
          onUpdate: () => void refreshHistories(),
        });
      }
      await handleTerminalHistory(current, params);
    } catch (e) {
      const { t, refreshHistories, refreshAssets } = params;
      await refreshHistories();
      await refreshAssets();
      if (isStudioRequestTimeout(e)) {
        toast.message(t("studioAiGenerationStillRunning"));
      } else {
        toast.error(e instanceof Error ? e.message : t("studioTimelineSaveFailed"));
      }
    }
  })();
}
