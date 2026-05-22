"use client";

import {
  Content,
  Icon,
  Item,
  ItemIndicator,
  ItemText,
  Portal,
  Root,
  Trigger,
  Viewport,
} from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StudioAiPillSelectOption {
  value: string;
  label: string;
  /** Pill 触发器上显示的短标签；未设置则用 label */
  pillLabel?: string;
  /** 下拉项 title（完整名称提示） */
  title?: string;
}

interface StudioAiPillSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: StudioAiPillSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export default function StudioAiPillSelect({
  value,
  onChange,
  options,
  placeholder = "—",
  disabled = false,
  className,
  icon,
}: StudioAiPillSelectProps) {
  const selected = options.find((o) => o.value === value);
  const triggerLabel = selected?.pillLabel ?? selected?.label;

  return (
    <Root value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <Trigger
        className={cn(
          "inline-flex h-8 min-w-0 max-w-[9rem] shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-foreground outline-none transition-colors",
          "hover:border-primary/30 hover:bg-white/10",
          "focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        title={selected?.title ?? selected?.label}
      >
        {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
        <span
          className={cn(
            "min-w-0 truncate",
            triggerLabel ? undefined : "text-muted-foreground"
          )}
        >
          {triggerLabel ?? placeholder}
        </span>
        <Icon className="shrink-0 text-muted-foreground">
          <ChevronDown className="h-3 w-3 opacity-80" aria-hidden />
        </Icon>
      </Trigger>
      <Portal>
        <Content
          position="popper"
          side="top"
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-[100] max-h-[min(16rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-white/10 bg-background/95 py-1 shadow-lg backdrop-blur-xl",
            "origin-[var(--radix-select-content-transform-origin)]"
          )}
        >
          <Viewport className="p-1">
            {options.map((opt) => (
              <Item
                key={opt.value}
                value={opt.value}
                title={opt.title}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-3 text-xs text-foreground outline-none",
                  "data-[highlighted]:bg-white/10",
                  "data-[state=checked]:text-primary"
                )}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <ItemIndicator>
                    <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
                  </ItemIndicator>
                </span>
                <ItemText>{opt.label}</ItemText>
              </Item>
            ))}
          </Viewport>
        </Content>
      </Portal>
    </Root>
  );
}
