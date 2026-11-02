"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DropdownMenu, Switch as RSwitch } from "radix-ui";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Toggle (BankDash style; "on" uses the accent) ─────────────────────────── */
export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof RSwitch.Root>) {
  return (
    <RSwitch.Root
      className={cn(
        "relative inline-flex h-[30px] w-[54px] shrink-0 cursor-pointer items-center rounded-full border border-line bg-surface-3 transition-colors data-[state=checked]:border-transparent data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RSwitch.Thumb className="block size-6 translate-x-[3px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.25)] transition-transform data-[state=checked]:translate-x-[26px] data-[state=checked]:bg-accent-ink" />
    </RSwitch.Root>
  );
}

/* ── Row overflow menu ─────────────────────────────────────────────────────── */
export function RowMenu({ label = "More actions", children }: { label?: string; children: React.ReactNode }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={label}
        className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg data-[state=open]:bg-surface-2"
      >
        <MoreHorizontal className="size-5" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[200px] rounded-2xl border border-line bg-surface p-1.5 shadow-pop data-[state=open]:animate-[content-in_120ms_ease-out]"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function RowMenuItem({
  onSelect,
  href,
  danger,
  icon,
  children,
  disabled,
}: {
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const className = cn(
    "flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2 [&_svg]:size-4",
    danger ? "text-danger" : "text-fg",
  );
  if (href) {
    const external = href.startsWith("http");
    return (
      <DropdownMenu.Item asChild disabled={disabled} className={className}>
        <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
          {icon}
          {children}
        </a>
      </DropdownMenu.Item>
    );
  }
  return (
    <DropdownMenu.Item className={className} onSelect={onSelect} disabled={disabled}>
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

export const RowMenuSeparator = () => <DropdownMenu.Separator className="my-1 h-px bg-line" />;

/* ── URL-driven tabs (All / Income / Expense) ──────────────────────────────── */
export function LinkTabs({
  param = "tab",
  tabs,
  className,
  keep = [],
}: {
  param?: string;
  tabs: { value: string; label: string; count?: number }[];
  className?: string;
  /** Other search params to keep when switching tabs. */
  keep?: string[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? tabs[0]?.value;
  return (
    <nav className={cn("no-scrollbar -mb-px flex gap-7 overflow-x-auto border-b border-line", className)} aria-label="Tabs">
      {tabs.map((tab, index) => {
        const next = new URLSearchParams();
        for (const key of keep) {
          const value = searchParams.get(key);
          if (value) next.set(key, value);
        }
        if (index > 0) next.set(param, tab.value);
        const active = current === tab.value;
        return (
          <Link
            key={tab.value}
            href={`${pathname}${next.size ? `?${next}` : ""}`}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative shrink-0 pb-3.5 text-[15px] font-semibold whitespace-nowrap transition-colors",
              active ? "text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            {tab.label}
            {tab.count !== undefined ? <span className="ml-1.5 text-xs text-muted">{tab.count}</span> : null}
            {active ? <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-t-full bg-accent-fg" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/* ── Pagination (Previous 1 2 3 Next) ──────────────────────────────────────── */
export function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const next = new URLSearchParams(searchParams);
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    return `${pathname}${next.size ? `?${next}` : ""}`;
  };
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
  );
  const item = "inline-flex h-9 min-w-9 items-center justify-center rounded-[10px] px-2 text-sm font-semibold";
  return (
    <nav className="mt-5 flex items-center justify-end gap-1" aria-label="Pagination">
      <PageLink href={href(page - 1)} disabled={page <= 1} className={cn(item, "gap-1 text-accent-fg")}>
        <ChevronLeft className="size-4" /> Previous
      </PageLink>
      {pages.map((p, i) => (
        <React.Fragment key={p}>
          {i > 0 && p - pages[i - 1] > 1 ? <span className="px-1 text-muted">…</span> : null}
          <Link
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(item, p === page ? "bg-primary text-primary-ink" : "text-fg-2 hover:bg-surface-2")}
          >
            {p}
          </Link>
        </React.Fragment>
      ))}
      <PageLink href={href(page + 1)} disabled={page >= pageCount} className={cn(item, "gap-1 text-accent-fg")}>
        Next <ChevronRight className="size-4" />
      </PageLink>
    </nav>
  );
}

function PageLink({ href, disabled, className, children }: { href: string; disabled: boolean; className: string; children: React.ReactNode }) {
  if (disabled) return <span className={cn(className, "pointer-events-none opacity-40")}>{children}</span>;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/* ── Progress ──────────────────────────────────────────────────────────────── */
export function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}
