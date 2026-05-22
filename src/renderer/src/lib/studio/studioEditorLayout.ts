/** 侧栏贴边（全高）或收到上排 */
export type StudioPanelPlacement = "docked" | "topRow";

export function toggleStudioPanelPlacement(
  placement: StudioPanelPlacement
): StudioPanelPlacement {
  return placement === "docked" ? "topRow" : "docked";
}
