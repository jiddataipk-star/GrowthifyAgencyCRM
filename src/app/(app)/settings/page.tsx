import type { Metadata } from "next";
import { Suspense } from "react";
import { requireMember, canSeeFinance, isOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { loadActors } from "@/lib/data/lookups";
import { param } from "@/lib/utils";
import { expiresWithin } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { LinkTabs } from "@/components/ui/misc";
import { ActivityFeed } from "@/components/app/activity";
import { BillingForm, CatalogManager, CompanyForm, DemoDataCard, PreferencesForm, ProfileForm, SessionsList, TeamManager } from "./forms";
import { IntegrationsPanel } from "./integrations";
import { SettingsNotice } from "./notice";

export const metadata: Metadata = { title: "Settings" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function SettingsPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton kpis={0} />}>
      <Settings {...props} />
    </Suspense>
  );
}

async function Settings({ searchParams }: Props) {
  const member = await requireMember();
  const params = await searchParams;
  const finance = canSeeFinance(member.role);
  const owner = isOwner(member.role);
  const supabase = await createClient();

  const tabs = [
    ...(finance ? [{ value: "company", label: "Company profile" }] : [{ value: "profile", label: "My profile" }]),
    ...(finance ? [{ value: "profile", label: "My profile" }] : []),
    { value: "preferences", label: "Preferences" },
    { value: "security", label: "Security" },
    ...(finance
      ? [
          { value: "team", label: "Team & roles" },
          { value: "integrations", label: "Integrations" },
          { value: "catalog", label: "Services & plans" },
          { value: "activity", label: "Activity log" },
        ]
      : []),
  ];
  const tab = tabs.some((t) => t.value === param(params.tab)) ? param(params.tab)! : tabs[0].value;

  const { data: settings } = await supabase.from("settings").select("*").maybeSingle();
  if (!settings) return <ErrorState title="Settings not found" description="Run the database migrations (see docs/SETUP.md)." />;

  let body: React.ReactNode = null;
  if (tab === "company") {
    body = (
      <div className="space-y-10">
        <section>
          <h3 className="mb-5 text-card font-bold">Company profile</h3>
          <CompanyForm settings={settings} canEdit={finance} />
        </section>
        <section className="border-t border-line pt-8">
          <h3 className="mb-1 text-card font-bold">Billing & invoice details</h3>
          <p className="mb-5 text-sm text-muted">Printed on invoices: bank, IBAN, wallets, NTN/STRN.</p>
          <BillingForm settings={settings} canEdit={owner} />
        </section>
      </div>
    );
  } else if (tab === "profile") {
    body = <ProfileForm name={member.name} email={member.email} avatarUrl={member.avatarUrl} role={member.role} />;
  } else if (tab === "preferences") {
    body = <PreferencesForm settings={settings} canEdit={finance} />;
  } else if (tab === "security") {
    const { data: sessions } = await supabase.rpc("my_sessions");
    body = <SessionsList sessions={sessions ?? []} />;
  } else if (tab === "team") {
    const { data: members } = await supabase.from("team_members").select("id, email, name, role, active, user_id, avatar_url, last_seen_at").order("role").order("name");
    const { count: demoCount } = owner ? await supabase.from("demo_records").select("id", { count: "exact", head: true }) : { count: 0 };
    body = (
      <div className="space-y-8">
        <TeamManager members={members ?? []} meId={member.id} canManage={owner} />
        {owner && (serverEnv.demoDataAllowed() || (demoCount ?? 0) > 0) ? <DemoDataCard loaded={demoCount ?? 0} /> : null}
      </div>
    );
  } else if (tab === "integrations") {
    const { data: accounts } = await supabase
      .from("social_accounts")
      .select("id, platform, connection, name, handle, status, token_expires_at, last_synced_at, last_error, scopes")
      .order("platform");
    const google = serverEnv.google();
    const meta = serverEnv.meta();
    const threads = serverEnv.threads();
    body = (
      <IntegrationsPanel
        accounts={(accounts ?? []).map((a) => ({
          ...a,
          expires_soon: expiresWithin(a.token_expires_at, 7),
        }))}
        configured={{
          google: Boolean(google.clientId && google.clientSecret),
          meta: Boolean(meta.appId && meta.appSecret),
          threads: Boolean(threads.appId && threads.appSecret),
          encryption: Boolean(process.env.TOKEN_ENCRYPTION_KEY),
        }}
      />
    );
  } else if (tab === "catalog") {
    const [services, plans] = await Promise.all([
      supabase.from("services").select("*").order("name"),
      supabase.from("plans").select("*").order("name"),
    ]);
    body = <CatalogManager services={services.data ?? []} plans={plans.data ?? []} canDelete={owner} />;
  } else if (tab === "activity") {
    const [{ data: rows }, actors] = await Promise.all([
      supabase.from("activity_log").select("id, entity, action, label, diff, created_at, actor_id").order("created_at", { ascending: false }).limit(150),
      loadActors(supabase),
    ]);
    body = <ActivityFeed rows={rows ?? []} actors={actors} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <SettingsNotice />
      <Card className="px-5 pt-3 sm:px-8">
        <LinkTabs tabs={tabs} className="mb-7" />
        <div className="pb-6">{body}</div>
      </Card>
    </div>
  );
}
