import {
  createStudioAsset,
  createStudioAssetGeneration,
  listStudioAssetHistories,
  type StudioAssetHistoryResponse,
  type StudioAssetResponse,
} from "@/lib/api/studio";
import type { TranslationKey } from "@/lib/i18n/translations";
import {
  buildCreateAssetBody,
  buildGenerationBody,
  type AssetImageGenerationFormState,
} from "./assetImageGenerationForm";
import { runAssetGenerationAfterCreate } from "./pollAssetHistory";

const NON_TERMINAL = new Set(["pending", "processing"]);

function startBackgroundPoll(
  projectId: number,
  assetId: number,
  history: StudioAssetHistoryResponse | null,
  refreshAssets: () => Promise<unknown>,
  refreshHistories: () => Promise<unknown>,
  t: (key: TranslationKey) => string
): void {
  void (async () => {
    let target = history;
    if (!target || !NON_TERMINAL.has(target.status)) {
      const histories = await listStudioAssetHistories(projectId, assetId, {
        page: 1,
        size: 20,
      });
      target =
        histories.find((h) => NON_TERMINAL.has(h.status)) ??
        histories.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0] ??
        null;
    }
    if (target && NON_TERMINAL.has(target.status)) {
      runAssetGenerationAfterCreate({
        projectId,
        assetId,
        history: target,
        refreshHistories,
        refreshAssets,
        t,
      });
    }
  })();
}

export interface SubmitAssetCreateParams {
  projectId: number;
  state: AssetImageGenerationFormState;
  parentId?: number | null;
  refreshAssets: () => Promise<unknown>;
  refreshHistories: (assetId: number) => Promise<unknown>;
  t: (key: TranslationKey) => string;
}

export async function submitAssetCreate(
  params: SubmitAssetCreateParams
): Promise<StudioAssetResponse> {
  const { projectId, state, parentId, refreshAssets, refreshHistories, t } = params;

  const body = buildCreateAssetBody(state, { parentId, tab: "ai" });
  const asset = await createStudioAsset(projectId, body);
  await refreshAssets();

  if (asset.status === "processing") {
    startBackgroundPoll(
      projectId,
      asset.id,
      null,
      refreshAssets,
      () => refreshHistories(asset.id),
      t
    );
  }

  return asset;
}

export interface SubmitAssetGenerationParams {
  projectId: number;
  assetId: number;
  state: AssetImageGenerationFormState;
  refreshAssets: () => Promise<unknown>;
  refreshHistories: () => Promise<unknown>;
  t: (key: TranslationKey) => string;
}

export async function submitAssetGeneration(
  params: SubmitAssetGenerationParams
): Promise<StudioAssetHistoryResponse> {
  const { projectId, assetId, state, refreshAssets, refreshHistories, t } = params;

  const body = buildGenerationBody(state);
  const history = await createStudioAssetGeneration(projectId, assetId, body);
  await refreshHistories();

  if (NON_TERMINAL.has(history.status)) {
    startBackgroundPoll(projectId, assetId, history, refreshAssets, refreshHistories, t);
  }

  return history;
}
