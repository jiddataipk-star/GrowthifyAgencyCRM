import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-line bg-surface p-5 shadow-card sm:p-6", className)} {...props} />;
}

/** Section heading above a card, actions on the right. */
export function Section({
  title,
  description,
  actions,
  className,
  children,
  id,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  const headingId = id ?? (typeof title === "string" ? `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined);
  return (
    <section className={cn("min-w-0", className)} aria-labelledby={headingId}>
      <div className="mb-3.5 flex min-h-9 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-section font-bold text-fg">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-[13.5px] text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export type Tone = "accent" | "success" | "danger" | "warning" | "info" | "neutral";

const toneClass: Record<Tone, string> = {
  accent: "bg-primary-tint text-primary",
  info: "bg-primary-tint text-primary",
  success: "bg-success-tint text-success",
  danger: "bg-danger-tint text-danger",
  warning: "bg-surface-3 text-fg",
  neutral: "bg-surface-2 text-fg-2",
};

/** Round tinted icon. */
export function IconCircle({
  tone = "accent",
  size = "lg",
  className,
  children,
}: {
  tone?: Tone;
  size?: "lg" | "md" | "sm";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        size === "lg" && "size-12 [&_svg]:size-[22px]",
        size === "md" && "size-10 [&_svg]:size-[18px]",
        size === "sm" && "size-8 [&_svg]:size-4",
        toneClass[tone],
        className,
      )}
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
  subTone = "muted",
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
    <Card className={cn("@container flex min-w-0 items-start gap-4 px-4 py-4 sm:px-5 sm:py-5", className)}>
      <IconCircle tone={tone} className="hidden @[13rem]:flex">{icon}</IconCircle>
      <div className="min-w-0">
        <p className="line-clamp-2 text-[13px] leading-snug font-medium text-muted">{label}</p>
        <p className="font-display tabular mt-1 truncate text-[18px] leading-tight font-bold tracking-[-0.02em] text-fg @[12rem]:text-[21px] @[16rem]:text-[23px]">
          {value}
        </p>
        {sub ? (
          <p
            className={cn(
              "mt-1 line-clamp-2 text-xs font-medium",
              subTone === "success" && "text-success",
              subTone === "danger" && "font-semibold text-danger",
              subTone === "warning" && "font-semibold text-fg",
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
      <dt className="text-[12.5px] font-medium text-muted">{label}</dt>
      <dd className="mt-1 truncate text-[14.5px] font-semibold">{children}</dd>
    </div>
  );
}
