import axios from "axios";
import { toast } from "sonner";
import type { StudioWorkflowNodeResponse } from "@/lib/api/studio";
import type { TranslationKey } from "@/lib/i18n/translations";
import { pollStudioNode } from "@/lib/studio/pollNode";

const NON_TERMINAL = new Set(["pending", "processing"]);

export interface RunStudioGenerationAfterCreateParams {
  projectId: number;
  workflowId: number;
  node: StudioWorkflowNodeResponse;
  refreshNodes: () => Promise<unknown>;
  autoApplyToClipId?: number | null;
  applyOutputToClip?: (clipId: number, outputId: number) => Promise<void>;
  t: (key: TranslationKey) => string;
}

export function isStudioRequestTimeout(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return error.code === "ECONNABORTED" || error.message.toLowerCase().includes("timeout");
  }
  if (error instanceof Error) {
    return error.message.toLowerCase().includes("timeout");
  }
  return false;
}

async function handleTerminalNode(
  node: StudioWorkflowNodeResponse,
  params: RunStudioGenerationAfterCreateParams
): Promise<void> {
  const { refreshNodes, autoApplyToClipId, applyOutputToClip, t } = params;
  await refreshNodes();

  const output = node.outputs?.[0];
  if (node.status === "succeeded") {
    if (autoApplyToClipId != null && output && applyOutputToClip) {
      try {
        await applyOutputToClip(autoApplyToClipId, output.id);
        toast.success(t("studioAiApplyToClipSuccess"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("studioTimelineSaveFailed"));
      }
    } else {
      toast.success(t("studioAiSend"));
    }
    return;
  }

  if (node.status === "failed") {
    toast.error(node.error_message ?? t("studioTimelineSaveFailed"));
  }
}

/**
 * 创建 node 后在后台轮询至终端态；不阻塞 Composer 发送按钮。
 */
export function runStudioGenerationAfterCreate(
  params: RunStudioGenerationAfterCreateParams
): void {
  void (async () => {
    const { projectId, workflowId, node, refreshNodes } = params;
    try {
      let current = node;
      if (NON_TERMINAL.has(current.status)) {
        current = await pollStudioNode({
          projectId,
          workflowId,
          nodeId: current.id,
          onUpdate: () => void refreshNodes(),
        });
      }
      await handleTerminalNode(current, params);
    } catch (e) {
      const { t } = params;
      await refreshNodes();
      if (isStudioRequestTimeout(e)) {
        toast.message(t("studioAiGenerationStillRunning"));
      } else {
        toast.error(e instanceof Error ? e.message : t("studioTimelineSaveFailed"));
      }
    }
  })();
}
