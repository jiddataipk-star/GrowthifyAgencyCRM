import * as React from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/components/ui/card";

const toneClass: Record<Tone, string> = {
  accent: "text-accent-fg bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]",
  success: "text-success bg-[color-mix(in_srgb,var(--success)_14%,transparent)]",
  danger: "text-danger bg-[color-mix(in_srgb,var(--danger)_14%,transparent)]",
  warning: "text-warning bg-[color-mix(in_srgb,var(--warning)_15%,transparent)]",
  info: "text-info bg-[color-mix(in_srgb,var(--info)_14%,transparent)]",
  neutral: "text-fg-2 bg-surface-2",
};

/** Small status pill. */
export function Pill({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs leading-none font-bold whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  // generic
  active: "success",
  paused: "warning",
  former: "neutral",
  cancelled: "neutral",
  // projects
  planning: "info",
  in_progress: "accent",
  review: "warning",
  delivered: "success",
  on_hold: "neutral",
  // invoices
  draft: "neutral",
  sent: "info",
  partial: "warning",
  paid: "success",
  void: "neutral",
  overdue: "danger",
  // leads
  new: "info",
  contacted: "accent",
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
