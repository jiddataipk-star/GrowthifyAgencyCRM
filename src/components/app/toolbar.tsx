"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { FilterSelect } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type FilterDef = { param: string; placeholder: string; options: { value: string; label: string }[] };

/**
 * Search + filters bound to the URL (shareable, back-button friendly, server-rendered).
 * Changing any filter resets pagination.
 */
export function ListToolbar({
  searchPlaceholder = "Search…",
  filters = [],
  dates = false,
  actions,
  className,
}: {
  searchPlaceholder?: string | null;
  filters?: FilterDef[];
  dates?: boolean;
  actions?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = React.useState(params.get("q") ?? "");

  const update = React.useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      next.delete("page");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    },
    [params, pathname, router],
  );

  React.useEffect(() => {
    const current = params.get("q") ?? "";
    if (query === current) return;
    const timer = setTimeout(() => update({ q: query.trim() || null }), 300);
    return () => clearTimeout(timer);
  }, [query, params, update]);

  const active = filters.some((f) => params.get(f.param)) || params.get("from") || params.get("to") || params.get("q");

  return (
    <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-center", className)}>
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        {searchPlaceholder !== null ? (
          <label className="relative w-full sm:w-[280px]">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-full rounded-full border border-line bg-surface pr-4 pl-10 text-sm text-fg placeholder:text-muted hover:border-line-strong focus-visible:border-primary focus-visible:outline-none"
            />
          </label>
        ) : null}
        {filters.map((filter) => (
          <FilterSelect
            key={filter.param}
            aria-label={filter.placeholder}
            placeholder={filter.placeholder}
            options={filter.options}
            value={params.get(filter.param) ?? ""}
            onChange={(event) => update({ [filter.param]: event.target.value || null })}
          />
        ))}
        {dates ? (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <input
              type="date"
              aria-label="From date"
              value={params.get("from") ?? ""}
              onChange={(event) => update({ from: event.target.value || null })}
              className="h-10 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm text-fg focus-visible:border-primary focus-visible:outline-none sm:flex-none"
            />
            <span className="text-sm text-muted">to</span>
            <input
              type="date"
              aria-label="To date"
              value={params.get("to") ?? ""}
              onChange={(event) => update({ to: event.target.value || null })}
              className="h-10 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm text-fg focus-visible:border-primary focus-visible:outline-none sm:flex-none"
            />
          </div>
        ) : null}
        {active ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              router.replace(pathname, { scroll: false });
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted hover:text-fg"
          >
            <X className="size-4" /> Clear
          </button>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}
