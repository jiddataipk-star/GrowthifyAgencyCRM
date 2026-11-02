"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { FileText, Filter, Folder, Loader2, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Result = { kind: "client" | "project" | "invoice" | "lead"; id: string; title: string; subtitle: string | null };

const KIND = {
  client: { label: "Clients", icon: Users, href: (id: string) => `/clients/${id}` },
  project: { label: "Projects", icon: Folder, href: (id: string) => `/projects/${id}` },
  invoice: { label: "Invoices", icon: FileText, href: (id: string) => `/invoices/${id}` },
  lead: { label: "Leads", icon: Filter, href: (id: string) => `/leads?lead=${id}` },
} as const;

/** Pill search in the top bar; opens a command palette (also on Ctrl/⌘ K). */
export function GlobalSearch({ className, finance }: { className?: string; finance: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Result[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (response.ok) setResults((await response.json()).results ?? []);
      } catch {
        // Aborted or offline: keep the previous results.
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const visible = query.trim().length >= 2 ? results : [];
  const groups = (Object.keys(KIND) as Result["kind"][])
    .map((kind) => ({ kind, items: visible.filter((r) => r.kind === kind) }))
    .filter((group) => group.items.length > 0);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className={cn(
          "flex h-[50px] items-center gap-3 rounded-full bg-surface px-[22px] text-[15px] text-muted transition-colors hover:text-fg-2 light:bg-surface-2",
          className,
        )}
      >
        <Search className="size-5 shrink-0" aria-hidden />
        <span className="truncate">{finance ? "Search clients, projects…" : "Search projects…"}</span>
        <kbd className="ml-auto hidden rounded-md border border-line px-1.5 py-0.5 text-[11px] font-semibold text-muted 2xl:inline">
          Ctrl K
        </kbd>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-[overlay-in_150ms_ease-out]" />
        <Dialog.Content className="fixed top-[12vh] left-1/2 z-50 w-[calc(100%-32px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-card border border-line bg-surface shadow-pop data-[state=open]:animate-[content-in_150ms_ease-out]">
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Dialog.Description className="sr-only">Search clients, projects, invoices and leads</Dialog.Description>
          <Command shouldFilter={false} label="Global search">
            <div className="flex items-center gap-3 border-b border-line px-5">
              {loading ? <Loader2 className="size-5 animate-spin text-muted" /> : <Search className="size-5 text-muted" />}
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Type a client, project, invoice no. or lead…"
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
              />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              {query.trim().length >= 2 && !loading ? (
                <Command.Empty className="px-4 py-10 text-center text-sm text-fg-2">No matches for “{query.trim()}”.</Command.Empty>
              ) : null}
              {query.trim().length < 2 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">Type at least 2 characters.</p>
              ) : null}
              {groups.map(({ kind, items }) => {
                const meta = KIND[kind];
                const Icon = meta.icon;
                return (
                  <Command.Group
                    key={kind}
                    heading={meta.label}
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase"
                  >
                    {items.map((item) => (
                      <Command.Item
                        key={`${kind}-${item.id}`}
                        value={`${kind}-${item.id}`}
                        onSelect={() => go(meta.href(item.id))}
                        className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 data-[selected=true]:bg-surface-2"
                      >
                        <Icon className="size-4 shrink-0 text-accent-fg" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{item.title}</span>
                          {item.subtitle ? <span className="block truncate text-xs text-muted">{item.subtitle}</span> : null}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
