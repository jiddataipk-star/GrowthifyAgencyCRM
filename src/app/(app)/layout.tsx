import { Suspense } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { requireMember, canSeeFinance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadNotifications } from "@/lib/data/notifications";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { GlobalSearch } from "@/components/shell/global-search";
import { NotificationsMenu } from "@/components/shell/notifications";
import { UserMenu } from "@/components/shell/user-menu";
import { PageTitle } from "@/components/shell/page-title";
import { Logo, Symbol } from "@/components/shell/brand";
import { Skeleton } from "@/components/ui/feedback";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  const finance = canSeeFinance(member.role);
  const notifications = finance ? await loadNotifications(await createClient()) : [];

  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar role={member.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:h-[72px] lg:gap-4 lg:px-8">
            <MobileNav role={member.role} />
            <PageTitle className="min-w-0 flex-1 truncate text-lg font-bold lg:text-page" />
            <GlobalSearch finance={finance} shortcut className="hidden w-[280px] md:flex" />
            <Link
              href="/settings"
              aria-label="Settings"
              className="hidden size-10 items-center justify-center rounded-full border border-line text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg sm:inline-flex"
            >
              <Settings className="size-[18px]" aria-hidden />
            </Link>
            {finance ? <NotificationsMenu items={notifications} /> : null}
            <span aria-hidden className="hidden h-6 w-px bg-line sm:block" />
            <UserMenu name={member.name} email={member.email} role={member.role} avatarUrl={member.avatarUrl} />
          </div>
          <div className="px-4 pb-3 sm:px-6 md:hidden">
            <GlobalSearch finance={finance} className="w-full" />
          </div>
        </header>
        <main id="main" className="w-full max-w-[1520px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Static shell shown instantly while the session is verified. */
function ShellFallback() {
  return (
    <div className="flex min-h-dvh" aria-busy="true">
      <aside className="hidden h-dvh w-[76px] shrink-0 flex-col bg-frame lg:flex xl:w-[248px]">
        <div className="flex h-[72px] items-center px-4 xl:px-6">
          <Logo className="hidden w-[150px] xl:block" priority />
          <Symbol className="mx-auto w-9 xl:hidden" />
        </div>
        <div className="space-y-3 px-4 pt-6 xl:px-6">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="h-7 w-7 rounded-lg bg-frame-2 xl:w-40" />
          ))}
        </div>
      </aside>
      <div className="flex-1">
        <div className="flex h-16 items-center gap-4 border-b border-line px-4 lg:h-[72px] lg:px-8">
          <Skeleton className="h-7 w-40" />
          <div className="flex-1" />
          <Skeleton className="hidden h-10 w-[280px] rounded-full md:block" />
          <Skeleton className="size-10 rounded-full" />
        </div>
        <div className="px-4 py-6 lg:px-8 lg:py-7">
          <Skeleton className="h-[148px] rounded-card" />
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[96px] rounded-card" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
