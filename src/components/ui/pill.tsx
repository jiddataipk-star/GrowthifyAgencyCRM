import * as React from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/components/ui/card";

const toneClass: Record<Tone, string> = {
  accent: "bg-primary text-primary-ink",
  info: "bg-primary-tint text-primary",
  success: "bg-success-tint text-success",
  danger: "bg-danger-tint text-danger",
  warning: "bg-surface-3 text-fg",
  neutral: "bg-surface-2 text-muted",
};

/** Small status pill. Green = good, red = needs action, grey = neutral. */
export function Pill({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11.5px] leading-[1.35] font-semibold whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  // clients / subscriptions
  active: "success",
  paused: "warning",
  former: "neutral",
  cancelled: "neutral",
  expiring: "warning",
  expired: "danger",
  // projects
  planning: "info",
  in_progress: "info",
  review: "warning",
  delivered: "success",
  on_hold: "neutral",
  // collections
  pending: "info",
  due_today: "warning",
  partial: "warning",
  paid: "success",
  overdue: "danger",
  // leads
  new: "info",
  contacted: "info",
  proposal_sent: "warning",
  negotiation: "warning",
  won: "success",
  lost: "danger",
  // team / social
  on_leave: "warning",
  left: "neutral",
  connected: "success",
  needs_reconnect: "danger",
  not_connected: "neutral",
};

export function StatusPill({ status, label }: { status: string; label: string }) {
  return <Pill tone={STATUS_TONES[status] ?? "neutral"}>{label}</Pill>;
}
