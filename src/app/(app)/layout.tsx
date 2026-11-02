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
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 font-bold text-primary-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar role={member.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/85">
          <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6 lg:h-[100px] lg:gap-6 lg:px-10">
            <MobileNav role={member.role} />
            <PageTitle className="min-w-0 flex-1 truncate text-center text-xl font-bold tracking-[-0.01em] lg:text-left lg:text-page" />
            <GlobalSearch finance={finance} className="hidden w-[300px] md:flex" />
            <Link
              href="/settings"
              aria-label="Settings"
              className="hidden size-[50px] items-center justify-center rounded-full bg-surface text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg sm:inline-flex light:bg-surface-2"
            >
              <Settings className="size-[22px]" aria-hidden />
            </Link>
            {finance ? <NotificationsMenu items={notifications} /> : null}
            <UserMenu name={member.name} email={member.email} role={member.role} avatarUrl={member.avatarUrl} />
          </div>
          <div className="px-4 pb-4 sm:px-6 md:hidden">
            <GlobalSearch finance={finance} className="w-full" />
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-7">
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
      <aside className="hidden h-dvh w-[88px] shrink-0 flex-col border-r border-line bg-sidebar lg:flex xl:w-[250px]">
        <div className="mt-[30px] mb-[34px] px-[22px] xl:px-[38px]">
          <Logo className="hidden w-[178px] xl:block" priority />
          <Symbol className="mx-auto w-10 xl:hidden" />
        </div>
        <div className="space-y-6 px-[30px] xl:px-[38px]">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-6 xl:w-36" />
          ))}
        </div>
      </aside>
      <div className="flex-1">
        <div className="flex h-[72px] items-center gap-6 border-b border-line bg-sidebar px-4 lg:h-[100px] lg:px-10">
          <Skeleton className="h-8 w-40" />
          <div className="flex-1" />
          <Skeleton className="hidden h-[50px] w-[300px] rounded-full md:block" />
          <Skeleton className="size-[50px] rounded-full" />
        </div>
        <div className="px-4 py-6 lg:px-10 lg:py-7">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-card" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
