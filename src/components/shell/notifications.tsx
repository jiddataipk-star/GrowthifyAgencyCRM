"use client";

import Link from "next/link";
import { Popover } from "radix-ui";
import { Bell, CalendarClock, FileWarning, PhoneCall, Unplug } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconCircle } from "@/components/ui/card";

export type AppNotification = {
  id: string;
  kind: "renewal" | "followup" | "invoice" | "social";
  title: string;
  detail: string;
  href: string;
  urgent: boolean;
};

const ICONS = { renewal: CalendarClock, followup: PhoneCall, invoice: FileWarning, social: Unplug };

/** Bell with live items: renewals due, follow-ups due, overdue invoices, broken social tokens. */
export function NotificationsMenu({ items }: { items: AppNotification[] }) {
  const urgent = items.filter((item) => item.urgent).length;
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={items.length ? `Notifications: ${items.length}` : "Notifications"}
        className="relative inline-flex size-[50px] items-center justify-center rounded-full bg-surface text-[var(--danger)] transition-colors hover:bg-surface-2 light:bg-surface-2"
      >
        <Bell className="size-[22px]" aria-hidden />
        {items.length ? (
          <span
            className={cn(
              "tabular absolute top-2 right-2 flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] leading-[18px] font-extrabold",
              urgent ? "bg-danger text-white" : "bg-accent text-accent-ink",
            )}
          >
            {items.length > 9 ? "9+" : items.length}
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={10}
          collisionPadding={16}
          className="z-50 w-[min(380px,calc(100vw-32px))] rounded-card border border-line bg-surface shadow-pop data-[state=open]:animate-[content-in_120ms_ease-out]"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <p className="font-bold">Notifications</p>
            <span className="text-xs font-semibold text-muted">{items.length ? `${items.length} need attention` : "All clear"}</span>
          </div>
          {items.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-fg-2">Nothing due. Renewals, follow-ups and overdue invoices will show here.</p>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto p-2">
              {items.map((item) => {
                const Icon = ICONS[item.kind];
                return (
                  <li key={item.id}>
                    <Popover.Close asChild>
                      <Link href={item.href} className="flex items-start gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-surface-2">
                        <IconCircle tone={item.urgent ? "danger" : "warning"} size="sm">
                          <Icon />
                        </IconCircle>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{item.title}</span>
                          <span className={cn("block text-xs", item.urgent ? "text-danger" : "text-muted")}>{item.detail}</span>
                        </span>
                      </Link>
                    </Popover.Close>
                  </li>
                );
              })}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
