"use client";

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { LogOut, Moon, Sun, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/lib/constants";
import { setTheme, useTheme } from "@/components/shell/theme";
import type { Role } from "@/types/db";

export function UserMenu({ name, email, role, avatarUrl }: { name: string; email: string; role: Role; avatarUrl: string | null }) {
  const theme = useTheme();
  const item =
    "flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none data-[highlighted]:bg-surface-2 [&_svg]:size-4";
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className="shrink-0 rounded-full" aria-label="Account menu">
        <span className="hidden md:block">
          <Avatar src={avatarUrl ?? "/brand/growthify-icon-256.png"} name={name} size={56} className="border-2" />
        </span>
        <span className="md:hidden">
          <Avatar src={avatarUrl ?? "/brand/growthify-icon-256.png"} name={name} size={40} className="border-2" />
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={10}
          className="z-50 w-64 rounded-card border border-line bg-surface p-2 shadow-pop data-[state=open]:animate-[content-in_120ms_ease-out]"
        >
          <div className="px-3 pt-2 pb-3">
            <p className="truncate font-bold">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
            <p className="mt-2 inline-flex rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-accent-fg">{ROLE_LABELS[role]}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild className={item}>
            <Link href="/settings?tab=profile">
              <UserRound /> My profile
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun /> : <Moon />} {theme === "dark" ? "Light theme" : "Dark theme"}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <form action="/auth/signout" method="post">
            <DropdownMenu.Item asChild className={`${item} text-danger`}>
              <button type="submit">
                <LogOut /> Sign out
              </button>
            </DropdownMenu.Item>
          </form>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
