"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUP_LABELS, isActive, navFor, type NavItem } from "@/components/shell/nav";
import { Logo, Symbol } from "@/components/shell/brand";
import type { Role } from "@/types/db";

/**
 * Dark-green brand frame. ≥1280px: 248px with labels. 1024–1279px: 76px icon rail.
 * Below 1024px the mobile drawer takes over.
 */
export function Sidebar({ role }: { role: Role }) {
  const items = navFor(role);
  return (
    <aside className="hidden shrink-0 bg-frame lg:block lg:w-[76px] xl:w-[248px]">
      <div className="sticky top-0 flex h-dvh flex-col">
        <Link href="/" className="flex h-[72px] items-center px-4 xl:px-6" aria-label="Growthify OS home">
          <Logo className="hidden w-[150px] xl:block" priority />
          <Symbol className="mx-auto w-9 xl:hidden" />
        </Link>
        <NavList items={items} />
        <p className="hidden px-6 pb-5 text-[11px] text-frame-muted xl:block">Growthify OS · Faisalabad</p>
      </div>
    </aside>
  );
}

export function NavList({ items, onNavigate, expanded }: { items: NavItem[]; onNavigate?: () => void; expanded?: boolean }) {
  const pathname = usePathname();
  const groups = (["work", "money", "agency"] as const).map((group) => ({ group, items: items.filter((i) => i.group === group) })).filter((g) => g.items.length);
  return (
    <nav aria-label="Main" className="no-scrollbar flex-1 overflow-y-auto px-3 pt-2 pb-6">
      {groups.map(({ group, items: groupItems }) => (
        <div key={group} className="mb-4">
          <p className={cn("px-3 pb-1.5 text-[10.5px] font-semibold tracking-[0.12em] text-frame-muted/80 uppercase", expanded ? "block" : "hidden xl:block")}>
            {NAV_GROUP_LABELS[group]}
          </p>
          <ul className="space-y-0.5">
            {groupItems.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={item.label}
                    className={cn(
                      "group relative flex h-10 items-center gap-3 rounded-[10px] text-[14px] font-medium transition-colors",
                      expanded ? "px-3" : "justify-center px-0 xl:justify-start xl:px-3",
                      active ? "bg-frame-2 text-white" : "text-frame-text hover:bg-frame-2/60 hover:text-white",
                    )}
                  >
                    {active ? <span className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-accent" /> : null}
                    <Icon className={cn("size-[18px] shrink-0", active ? "text-accent" : "text-frame-muted group-hover:text-frame-text")} strokeWidth={2} aria-hidden />
                    <span className={cn(expanded ? "inline" : "sr-only xl:not-sr-only")}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
