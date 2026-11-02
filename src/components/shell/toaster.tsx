"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "!bg-surface !text-fg !border !border-line !rounded-2xl !shadow-pop !font-sans !text-[14px] !font-semibold",
          description: "!text-fg-2 !font-medium",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-danger",
          actionButton: "!bg-primary !text-primary-ink !rounded-lg !font-bold",
        },
      }}
    />
  );
}
