"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, navFor, type NavItem } from "@/components/shell/nav";
import type { Role } from "@/types/db";
import { Logo, Symbol } from "@/components/shell/brand";

/**
 * Desktop sidebar. ≥1280px: full 250px with labels. 1024–1279px: 88px icon rail.
 * Below 1024px the mobile drawer takes over.
 */
export function Sidebar({ role }: { role: Role }) {
  const items = navFor(role);
  return (
    <aside className="hidden shrink-0 border-r border-line bg-sidebar lg:block lg:w-[88px] xl:w-[250px]">
      <div className="sticky top-0 flex h-dvh flex-col">
        <Link href="/" className="mt-[30px] mb-[34px] block px-[22px] xl:px-[38px]" aria-label="Growthify OS home">
          <Logo className="hidden w-[178px] xl:block" priority />
          <Symbol className="mx-auto w-10 xl:hidden" />
        </Link>
        <NavList items={items} />
      </div>
    </aside>
  );
}

export function NavList({ items, onNavigate, expanded }: { items: NavItem[]; onNavigate?: () => void; expanded?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="no-scrollbar flex-1 overflow-y-auto pb-6">
      <ul className="space-y-0.5">
        {items.map((item) => {
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
                  "group relative flex h-14 items-center gap-[22px] text-base font-semibold transition-colors",
                  expanded ? "px-[38px]" : "justify-center px-0 xl:justify-start xl:px-[38px]",
                  active ? "text-accent-fg" : "text-muted hover:text-fg",
                )}
              >
                {active ? <span className="absolute top-2.5 bottom-2.5 left-0 w-1.5 rounded-r-lg bg-accent-fg light:bg-accent" /> : null}
                <Icon className="size-[22px] shrink-0" strokeWidth={active ? 2.2 : 1.9} aria-hidden />
                <span className={cn(expanded ? "inline" : "sr-only xl:not-sr-only")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
