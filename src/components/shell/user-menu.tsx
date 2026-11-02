"use client";

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/types/db";

export function UserMenu({ name, email, role, avatarUrl }: { name: string; email: string; role: Role; avatarUrl: string | null }) {
  const item =
    "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium outline-none data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted";
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className="flex shrink-0 items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-surface-2" aria-label="Account menu">
        <Avatar src={avatarUrl} name={name} size={34} />
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-[140px] truncate text-[13.5px] font-semibold">{name}</span>
          <span className="block text-[11.5px] text-muted">{ROLE_LABELS[role]}</span>
        </span>
        <ChevronDown className="hidden size-4 text-muted md:block" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-pop data-[state=open]:animate-[content-in_120ms_ease-out]">
          <div className="px-2.5 pt-2 pb-2.5">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild className={item}>
            <Link href="/settings?tab=profile">
              <UserRound /> My profile
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={item}>
            <Link href="/settings?tab=security">
              <ShieldCheck /> Security & sessions
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <form action="/auth/signout" method="post">
            <DropdownMenu.Item asChild className={`${item} text-danger [&_svg]:!text-danger`}>
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
