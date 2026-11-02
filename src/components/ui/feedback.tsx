import * as React from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, IconCircle } from "@/components/ui/card";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-xl bg-surface-2 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-[color-mix(in_srgb,var(--text)_5%,transparent)] before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      <IconCircle tone="accent" size={compact ? "md" : "lg"}>
        {icon ?? <Inbox />}
      </IconCircle>
      <p className={cn("font-display mt-4 font-bold", compact ? "text-[15px]" : "text-[17px]")}>{title}</p>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-fg-2">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = "Couldn't load this", description, action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return (
    <Card role="alert">
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <IconCircle tone="danger">
          <AlertTriangle />
        </IconCircle>
        <p className="font-display mt-4 text-[17px] font-bold">{title}</p>
        <p className="mt-1.5 max-w-md text-sm text-fg-2">{description ?? "Something went wrong while loading. Check your connection and try again."}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </Card>
  );
}

/** Generic page skeleton: KPI row + two cards. */
export function PageSkeleton({ kpis = 4, rows = 6 }: { kpis?: number; rows?: number }) {
  return (
    <div className="flex flex-col gap-7" aria-busy="true" aria-label="Loading">
      {kpis > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: kpis }, (_, i) => (
            <Card key={i} className="flex items-center gap-4">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      <div>
        <Skeleton className="mb-4 h-6 w-48" />
        <ListSkeleton rows={rows} />
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </Card>
  );
}
