import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Eye, Plug, TrendingUp, Users } from "lucide-react";
import { requireFinance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PLATFORM_COLORS, PLATFORM_LABELS, SOCIAL_STATUS_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/money";
import { addDays, formatDayMonth, timeAgo, todayPK } from "@/lib/dates";
import { Card, KpiCard, Section } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { DualBarChart, Legend, MultiLineChart } from "@/components/charts/charts";
import { PlatformMark } from "@/components/app/domain";
import { ADAPTERS } from "@/lib/social/sync";
import { AddManualAccountDialog, ManualCountDialog, SyncButton } from "./social-widgets";
import type { Enums } from "@/types/db";

export const metadata: Metadata = { title: "Social" };

export default function SocialPage() {
  return (
    <Suspense fallback={<PageSkeleton kpis={3} />}>
      <Social />
    </Suspense>
  );
}

const CONNECT_PATH: Partial<Record<Enums<"social_platform">, string>> = {
  youtube: "/api/integrations/youtube/connect",
  facebook: "/settings?tab=integrations",
  instagram: "/settings?tab=integrations",
  threads: "/api/integrations/threads/connect",
};

async function Social() {
  await requireFinance();
  const supabase = await createClient();
  const today = todayPK();
  const since = addDays(today, -60);

  const [accountsRes, metricsRes, postsRes] = await Promise.all([
    supabase.from("social_accounts").select("id, platform, connection, name, handle, avatar_url, profile_url, status, last_synced_at, last_error").order("platform"),
    supabase.from("social_metrics_daily").select("social_account_id, date, followers, reach, views, engagement").gte("date", since).order("date"),
    supabase.from("social_posts").select("id, social_account_id, title, url, published_at, views, likes, comments, engagement").order("published_at", { ascending: false }).limit(12),
  ]);
  const accounts = accountsRes.data ?? [];
  const metrics = metricsRes.data ?? [];

  const stats = accounts.map((account) => {
    const rows = metrics.filter((m) => m.social_account_id === account.id);
    const withFollowers = rows.filter((m) => m.followers !== null);
    const latest = withFollowers.at(-1);
    const at = (days: number) => [...withFollowers].reverse().find((m) => m.date <= addDays(latest?.date ?? today, -days)) ?? withFollowers[0];
    const last30 = rows.filter((m) => m.date > addDays(today, -30));
    return {
      ...account,
      followers: latest?.followers ?? null,
      change7: latest && at(7) && at(7) !== latest ? (latest.followers ?? 0) - (at(7)?.followers ?? 0) : null,
      change30: latest && at(30) && at(30) !== latest ? (latest.followers ?? 0) - (at(30)?.followers ?? 0) : 0,
      views30: last30.reduce((s, m) => s + (m.views ?? 0), 0),
      reach30: last30.reduce((s, m) => s + (m.reach ?? 0), 0),
    };
  });
  const totalFollowers = stats.reduce((s, a) => s + (a.followers ?? 0), 0);
  const gained30 = stats.reduce((s, a) => s + (a.change30 ?? 0), 0);
  const views30 = stats.reduce((s, a) => s + a.views30, 0);
  const reach30 = stats.reduce((s, a) => s + a.reach30, 0);
  const needsReconnect = stats.filter((a) => a.status === "needs_reconnect");

  // Followers over time: one series per platform.
  const dates = [...new Set(metrics.map((m) => m.date))].sort();
  const tracked = stats.filter((a) => metrics.some((m) => m.social_account_id === a.id && m.followers !== null));
  const followerSeries = dates.map((date) => {
    const point: Record<string, string | number | null> = { label: formatDayMonth(date) };
    for (const account of tracked) {
      point[account.id] = metrics.find((m) => m.social_account_id === account.id && m.date === date)?.followers ?? null;
    }
    return point;
  });
  const recentDates = dates.filter((d) => d > addDays(today, -30));
  const viewSeries = recentDates.map((date) => {
    const day = metrics.filter((m) => m.date === date);
    return { label: formatDayMonth(date), views: day.reduce((s, m) => s + (m.views ?? 0), 0), reach: day.reduce((s, m) => s + (m.reach ?? 0), 0) };
  });
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const posts = postsRes.data ?? [];

  return (
    <div className="flex flex-col gap-7">
      {needsReconnect.length ? (
        <Card role="alert" className="flex flex-wrap items-center gap-4 border-danger/50">
          <Plug className="size-5 text-danger" />
          <p className="flex-1 text-sm font-semibold">
            {needsReconnect.map((a) => PLATFORM_LABELS[a.platform]).join(", ")} need{needsReconnect.length === 1 ? "s" : ""} reconnecting — daily stats are paused.
          </p>
          <Button asChild size="sm"><Link href="/settings?tab=integrations">Fix in Integrations</Link></Button>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 wide:grid-cols-3">
        <KpiCard icon={<Users />} tone="accent" label="Total followers" value={formatNumber(totalFollowers)} sub={`${tracked.length} platforms tracked`} subTone="muted" />
        <KpiCard icon={<TrendingUp />} tone="success" label="Gained in 30 days" value={`${gained30 >= 0 ? "+" : "−"}${formatNumber(Math.abs(gained30))}`} subTone={gained30 >= 0 ? "success" : "danger"} sub="Across platforms" />
        <KpiCard icon={<Eye />} tone="info" label="Views in 30 days" value={formatNumber(views30)} sub={reach30 ? `${formatNumber(reach30)} reach` : "Reach when available"} subTone="muted" />
      </div>

      <Section title="Platforms" actions={<><AddManualAccountDialog /><SyncButton label="Sync all" variant="secondary" /></>}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 wide:grid-cols-3">
          {stats.map((account) => {
            const automatic = Boolean(ADAPTERS[account.platform]) && account.connection !== "manual";
            const connected = account.status === "connected";
            return (
              <Card key={account.id} className="flex flex-col gap-4">
                <div className="flex items-center gap-3.5">
                  {account.avatar_url ? <Avatar src={account.avatar_url} name={account.name} size={46} /> : <PlatformMark platform={account.platform} />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{PLATFORM_LABELS[account.platform]}</p>
                    {account.profile_url ? (
                      <a href={account.profile_url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-muted hover:text-accent-fg">
                        {account.handle ? (account.handle.startsWith("@") ? account.handle : `@${account.handle}`) : account.name}
                      </a>
                    ) : (
                      <p className="truncate text-sm text-muted">{account.name ?? "—"}</p>
                    )}
                  </div>
                  <StatusPill status={account.status} label={account.connection === "manual" && connected ? "Manual" : SOCIAL_STATUS_LABELS[account.status]} />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="tabular text-[26px] leading-none font-extrabold">{account.followers === null ? "—" : formatNumber(account.followers)}</p>
                    <p className="mt-1 text-xs text-muted">followers</p>
                  </div>
                  <p className={`text-sm font-semibold ${account.change7 === null ? "text-muted" : account.change7 >= 0 ? "text-success" : "text-danger"}`}>
                    {account.change7 === null ? "No trend yet" : `${account.change7 >= 0 ? "+" : "−"}${formatNumber(Math.abs(account.change7))} in 7 days`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                  <p className="text-xs text-muted">{automatic ? (account.last_synced_at ? `Synced ${timeAgo(account.last_synced_at)}` : "Not synced yet") : "Manual entry"}</p>
                  <div className="flex gap-2">
                    {automatic ? (
                      <>
                        {connected ? <SyncButton id={account.id} /> : null}
                        {!connected || account.status === "needs_reconnect" ? (
                          <Button asChild size="pill" variant={account.status === "needs_reconnect" ? "danger-outline" : "outline"}>
                            <a href={CONNECT_PATH[account.platform] ?? "/settings?tab=integrations"}>{account.status === "needs_reconnect" ? "Reconnect" : "Connect"}</a>
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <ManualCountDialog accountId={account.id} platformLabel={PLATFORM_LABELS[account.platform]} trigger={<Button variant="outline" size="pill">Add today&apos;s count</Button>} />
                    )}
                  </div>
                </div>
                {account.last_error && account.status !== "not_connected" ? <p className="-mt-2 line-clamp-2 text-xs text-warning" title={account.last_error}>{account.last_error}</p> : null}
              </Card>
            );
          })}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-7 wide:grid-cols-2">
        <Section title="Followers over time" actions={<Legend items={tracked.map((a) => ({ label: PLATFORM_LABELS[a.platform], color: PLATFORM_COLORS[a.platform] }))} />}>
          <Card className="pt-6 pb-4">
            {tracked.length ? (
              <MultiLineChart data={followerSeries} series={tracked.map((a) => ({ key: a.id, label: PLATFORM_LABELS[a.platform], color: PLATFORM_COLORS[a.platform] }))} />
            ) : (
              <EmptyState compact title="No follower history yet" description="Connect a platform or add a manual count; daily snapshots start charting here." />
            )}
          </Card>
        </Section>
        <Section title="Views & reach per day" actions={<Legend items={[{ label: "Views", color: "var(--chart-1)" }, { label: "Reach", color: "var(--chart-2)" }]} />}>
          <Card className="pt-6 pb-4">
            {viewSeries.some((d) => d.views || d.reach) ? (
              <DualBarChart data={viewSeries} series={[{ key: "views", label: "Views", color: "var(--chart-1)" }, { key: "reach", label: "Reach", color: "var(--chart-2)" }]} />
            ) : (
              <EmptyState compact title="No views data yet" description="Appears after the first daily sync of a connected platform." />
            )}
          </Card>
        </Section>
      </div>

      <Section title="Latest posts & videos">
        <Card className="px-5 py-2 sm:px-6">
          {posts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-fg-2 [&>th]:h-[52px] [&>th]:font-medium">
                    <th className="w-12">#</th>
                    <th>Post</th>
                    <th>Platform</th>
                    <th>Published</th>
                    <th className="text-right">Views</th>
                    <th className="text-right">Likes</th>
                    <th className="text-right">Comments</th>
                    <th className="text-right">Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post, index) => {
                    const account = accountById.get(post.social_account_id);
                    return (
                      <tr key={post.id} className="border-t border-line [&>td]:h-[56px]">
                        <td className="tabular text-muted">{String(index + 1).padStart(2, "0")}.</td>
                        <td className="max-w-[320px]">
                          {post.url ? <a href={post.url} target="_blank" rel="noopener noreferrer" className="block truncate font-semibold hover:text-accent-fg">{post.title ?? "Untitled"}</a> : <span className="block truncate font-semibold">{post.title ?? "Untitled"}</span>}
                        </td>
                        <td className="text-fg-2">{account ? PLATFORM_LABELS[account.platform] : "—"}</td>
                        <td className="whitespace-nowrap text-fg-2">{post.published_at ? formatDayMonth(todayPK(new Date(post.published_at))) : "—"}</td>
                        <td className="tabular text-right">{post.views === null ? "—" : formatNumber(post.views)}</td>
                        <td className="tabular text-right">{post.likes === null ? "—" : formatNumber(post.likes)}</td>
                        <td className="tabular text-right">{post.comments === null ? "—" : formatNumber(post.comments)}</td>
                        <td className="tabular text-right font-bold text-success">{post.engagement === null ? "—" : formatNumber(post.engagement)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState compact title="No posts synced yet" description="After connecting YouTube, Facebook, Instagram or Threads, recent posts with their metrics appear here." />
          )}
        </Card>
      </Section>
    </div>
  );
}
