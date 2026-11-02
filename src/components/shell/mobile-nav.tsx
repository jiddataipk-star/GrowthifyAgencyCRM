"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/shell/brand";
import { NavList } from "@/components/shell/sidebar";
import { navFor } from "@/components/shell/nav";
import type { Role } from "@/types/db";

/** Hamburger + slide-in drawer for phones and small tablets (< 1024px). */
export function MobileNav({ role }: { role: Role }) {
  const items = navFor(role);
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="-ml-2 inline-flex size-10 items-center justify-center rounded-full text-fg hover:bg-surface-2 lg:hidden" aria-label="Open menu">
        <Menu className="size-[22px]" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0b1210]/45 data-[state=open]:animate-[overlay-in_150ms_ease-out] lg:hidden" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[272px] max-w-[85vw] flex-col bg-frame data-[state=open]:animate-[sheet-in_220ms_cubic-bezier(.2,.8,.2,1)] focus:outline-none lg:hidden">
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <Dialog.Description className="sr-only">Main navigation</Dialog.Description>
          <div className="flex h-[72px] items-center justify-between px-5">
            <Logo className="w-[140px]" />
            <Dialog.Close className="rounded-full p-2 text-frame-text hover:bg-frame-2" aria-label="Close menu">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <NavList items={items} expanded onNavigate={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
