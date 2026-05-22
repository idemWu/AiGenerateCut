"use client";

import type { ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { StudioPanelPlacement } from "@/lib/studio/studioEditorLayout";

interface StudioWorkspaceLayoutProps {
  leftLayout: StudioPanelPlacement;
  rightLayout: StudioPanelPlacement;
  timelineCollapsed: boolean;
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  previewPanel: ReactNode;
  timelinePanel: ReactNode;
}

export default function StudioWorkspaceLayout({
  leftLayout,
  rightLayout,
  timelineCollapsed,
  leftPanel,
  rightPanel,
  previewPanel,
  timelinePanel,
}: StudioWorkspaceLayoutProps) {
  const leftDocked = leftLayout === "docked";
  const rightDocked = rightLayout === "docked";
  const layoutKey = `${leftLayout}-${rightLayout}`;
  const topDefaultSize = timelineCollapsed ? "100%" : "72%";

  const timelineBlock = !timelineCollapsed ? (
    <>
      <Separator className="studio-resize-handle studio-resize-handle-y" />
      <Panel id="studio-timeline" defaultSize="28%" minSize="20%" maxSize="55%">
        {timelinePanel}
      </Panel>
    </>
  ) : null;

  /** 左右皆贴边：左 | 预览+时间线 | 右 */
  if (leftDocked && rightDocked) {
    return (
      <Group key={layoutKey} orientation="vertical" className="min-h-0 flex-1">
        <Panel id="studio-main" defaultSize="100%" minSize="45%">
          <Group orientation="horizontal" className="h-full w-full">
            <Panel id="studio-left" defaultSize="24%" minSize="18%" maxSize="38%">
              {leftPanel}
            </Panel>
            <Separator className="studio-resize-handle studio-resize-handle-x" />
            <Panel id="studio-center" minSize="35%">
              <Group orientation="vertical" className="h-full w-full">
                <Panel
                  id="studio-preview"
                  defaultSize={topDefaultSize}
                  minSize="35%"
                >
                  {previewPanel}
                </Panel>
                {timelineBlock}
              </Group>
            </Panel>
            <Separator className="studio-resize-handle studio-resize-handle-x" />
            <Panel id="studio-right" defaultSize="22%" minSize="16%" maxSize="32%">
              {rightPanel}
            </Panel>
          </Group>
        </Panel>
      </Group>
    );
  }

  /** 左右皆上排：上 左|预览|右，下 时间线 */
  if (!leftDocked && !rightDocked) {
    return (
      <Group key={layoutKey} orientation="vertical" className="min-h-0 flex-1">
        <Panel id="studio-top" defaultSize={topDefaultSize} minSize="45%">
          <Group orientation="horizontal" className="h-full w-full">
            <Panel id="studio-left" defaultSize="24%" minSize="18%" maxSize="38%">
              {leftPanel}
            </Panel>
            <Separator className="studio-resize-handle studio-resize-handle-x" />
            <Panel id="studio-preview" minSize="35%">
              {previewPanel}
            </Panel>
            <Separator className="studio-resize-handle studio-resize-handle-x" />
            <Panel id="studio-right" defaultSize="22%" minSize="16%" maxSize="32%">
              {rightPanel}
            </Panel>
          </Group>
        </Panel>
        {timelineBlock}
      </Group>
    );
  }

  /** 左在上排、右贴边：上 左|预览，下 时间线；右侧全高 */
  if (!leftDocked && rightDocked) {
    return (
      <Group key={layoutKey} orientation="horizontal" className="min-h-0 flex-1">
        <Panel id="studio-main" minSize="45%">
          <Group orientation="vertical" className="h-full w-full">
            <Panel id="studio-top" defaultSize={topDefaultSize} minSize="35%">
              <Group orientation="horizontal" className="h-full w-full">
                <Panel id="studio-left" defaultSize="28%" minSize="18%" maxSize="42%">
                  {leftPanel}
                </Panel>
                <Separator className="studio-resize-handle studio-resize-handle-x" />
                <Panel id="studio-preview" minSize="35%">
                  {previewPanel}
                </Panel>
              </Group>
            </Panel>
            {timelineBlock}
          </Group>
        </Panel>
        <Separator className="studio-resize-handle studio-resize-handle-x" />
        <Panel id="studio-right" defaultSize="22%" minSize="16%" maxSize="32%">
          {rightPanel}
        </Panel>
      </Group>
    );
  }

  /** 左贴边、右在上排：左全高；上 预览|右，下 时间线 */
  return (
    <Group key={layoutKey} orientation="horizontal" className="min-h-0 flex-1">
      <Panel id="studio-left" defaultSize="24%" minSize="18%" maxSize="38%">
        {leftPanel}
      </Panel>
      <Separator className="studio-resize-handle studio-resize-handle-x" />
      <Panel id="studio-center" minSize="35%">
        <Group orientation="vertical" className="h-full w-full">
          <Panel id="studio-top" defaultSize={topDefaultSize} minSize="35%">
            <Group orientation="horizontal" className="h-full w-full">
              <Panel id="studio-preview" minSize="35%">
                {previewPanel}
              </Panel>
              <Separator className="studio-resize-handle studio-resize-handle-x" />
              <Panel id="studio-right" defaultSize="32%" minSize="16%" maxSize="42%">
                {rightPanel}
              </Panel>
            </Group>
          </Panel>
          {timelineBlock}
        </Group>
      </Panel>
    </Group>
  );
}
