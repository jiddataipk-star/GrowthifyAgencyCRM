import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-line bg-surface p-5 sm:p-6", className)} {...props} />;
}

/** BankDash pattern: the heading sits above the card, actions on the right. */
export function Section({
  title,
  actions,
  className,
  children,
  id,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  const headingId = id ?? (typeof title === "string" ? `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined);
  return (
    <section className={cn("min-w-0", className)} aria-labelledby={headingId}>
      <div className="mb-4 flex min-h-9 flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="text-[19px] font-bold tracking-[-0.01em] sm:text-section">
          {title}
        </h2>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export type Tone = "accent" | "success" | "danger" | "warning" | "info" | "neutral";

const toneVar: Record<Tone, string> = {
  accent: "var(--accent-fg)",
  success: "var(--success)",
  danger: "var(--danger)",
  warning: "var(--warning)",
  info: "var(--info)",
  neutral: "var(--text)",
};

/** Round tinted icon (13% tint of the tone colour). */
export function IconCircle({
  tone = "accent",
  size = "lg",
  className,
  children,
  style,
}: {
  tone?: Tone;
  size?: "lg" | "md" | "sm";
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const color = toneVar[tone];
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        size === "lg" && "size-[58px] [&_svg]:size-[26px]",
        size === "md" && "size-[46px] [&_svg]:size-5",
        size === "sm" && "size-9 [&_svg]:size-4",
        className,
      )}
      style={{ color, background: `color-mix(in srgb, ${color} 13%, transparent)`, ...style }}
    >
      {children}
    </span>
  );
}

export function KpiCard({
  icon,
  tone = "accent",
  label,
  value,
  sub,
  subTone = "success",
  className,
}: {
  icon: React.ReactNode;
  tone?: Tone;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  subTone?: "success" | "danger" | "warning" | "muted";
  className?: string;
}) {
  return (
    <Card className={cn("@container flex min-w-0 items-center gap-4 px-5 py-5 sm:px-[22px] sm:py-[22px]", className)}>
      <IconCircle tone={tone}>{icon}</IconCircle>
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-medium text-fg-2">{label}</p>
        <p className="tabular mt-1 truncate text-[20px] leading-tight font-extrabold tracking-[-0.01em] @[17rem]:text-[22px]">{value}</p>
        {sub ? (
          <p
            className={cn(
              "mt-1 truncate text-xs font-semibold",
              subTone === "success" && "text-success",
              subTone === "danger" && "text-danger",
              subTone === "warning" && "text-warning",
              subTone === "muted" && "text-muted",
            )}
          >
            {sub}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

/** Label/value pair for detail panels. */
export function Detail({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[13px] font-medium text-muted">{label}</dt>
      <dd className="mt-1 truncate text-[15px] font-semibold">{children}</dd>
    </div>
  );
}
