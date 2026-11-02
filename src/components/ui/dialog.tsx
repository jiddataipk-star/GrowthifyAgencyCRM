"use client";

import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/** Centered modal on desktop, bottom sheet on phones. */
export function DialogContent({
  title,
  description,
  size = "md",
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-[overlay-in_150ms_ease-out]" />
      <D.Content
        className={cn(
          "fixed z-50 flex max-h-[92dvh] w-full flex-col border border-line bg-surface shadow-pop focus:outline-none",
          "inset-x-0 bottom-0 rounded-t-[24px] data-[state=open]:animate-[sheet-up_220ms_cubic-bezier(.2,.8,.2,1)]",
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:data-[state=open]:animate-[content-in_180ms_ease-out]",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-xl",
          size === "lg" && "sm:max-w-3xl",
          size === "xl" && "sm:max-w-5xl",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 pt-6 pb-4">
          <div className="min-w-0">
            <D.Title className="text-card font-bold">{title}</D.Title>
            {description ? (
              <D.Description className="mt-1 text-sm text-fg-2">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close className="-mt-1 -mr-2 rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg" aria-label="Close">
            <X className="size-5" />
          </D.Close>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

/** Sticky footer row for dialog forms. */
export function DialogFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end", className)}>{children}</div>
  );
}
