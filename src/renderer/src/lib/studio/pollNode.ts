import { getStudioWorkflowNode, type StudioWorkflowNodeResponse } from "@/lib/api/studio";

const TERMINAL = new Set(["succeeded", "failed"]);

export interface PollNodeOptions {
  projectId: number;
  workflowId: number;
  nodeId: number;
  intervalMs?: number;
  maxWaitMs?: number;
  signal?: AbortSignal;
  onUpdate?: (node: StudioWorkflowNodeResponse) => void;
}

export async function pollStudioNode(
  options: PollNodeOptions
): Promise<StudioWorkflowNodeResponse> {
  const {
    projectId,
    workflowId,
    nodeId,
    intervalMs = 2500,
    maxWaitMs = 300_000,
    signal,
    onUpdate,
  } = options;

  const started = Date.now();

  while (true) {
    if (signal?.aborted) {
      throw new DOMException("Polling aborted", "AbortError");
    }

    const node = await getStudioWorkflowNode(projectId, workflowId, nodeId);
    onUpdate?.(node);

    if (TERMINAL.has(node.status)) {
      return node;
    }

    if (Date.now() - started > maxWaitMs) {
      return node;
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, intervalMs);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new DOMException("Polling aborted", "AbortError"));
        },
        { once: true }
      );
    });
  }
}
