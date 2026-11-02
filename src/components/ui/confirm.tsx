"use client";

import * as React from "react";
import { AlertDialog } from "radix-ui";
import { Button } from "@/components/ui/button";

/**
 * Confirmation for destructive or irreversible actions.
 * Usage: <ConfirmButton title="Delete client?" onConfirm={...}>Delete</ConfirmButton>
 */
export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<unknown> | void;
}) {
  const [pending, setPending] = React.useState(false);
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-[overlay-in_150ms_ease-out]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card border border-line bg-surface p-6 shadow-pop data-[state=open]:animate-[content-in_150ms_ease-out]">
          <AlertDialog.Title className="text-card font-bold">{title}</AlertDialog.Title>
          {description ? (
            <AlertDialog.Description className="mt-2 text-sm text-fg-2">{description}</AlertDialog.Description>
          ) : (
            <AlertDialog.Description className="sr-only">{title}</AlertDialog.Description>
          )}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialog.Cancel>
            <Button
              variant={danger ? "danger" : "primary"}
              loading={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await onConfirm();
                  onOpenChange(false);
                } finally {
                  setPending(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
