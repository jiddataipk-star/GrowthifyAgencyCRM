import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarClock, Filter, Target, Trophy } from "lucide-react";
import { requireFinance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, oneOf, type SearchParams } from "@/lib/data/query";
import { serviceTypeOptions, sourceOptions } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { monthStart, todayPK } from "@/lib/dates";
import { param } from "@/lib/utils";
import { KpiCard, Section } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/feedback";
import { ListToolbar } from "@/components/app/toolbar";
import { LeadsBoard } from "./board";

export const metadata: Metadata = { title: "Leads" };

export default function LeadsPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Leads searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Leads({ searchParams }: { searchParams: SearchParams }) {
  await requireFinance();
  const params = await searchParams;
  const supabase = await createClient();
  const today = todayPK();
  const source = oneOf(params.source, ["meta_ad", "organic", "referral", "linkedin", "other"] as const);
  const service = oneOf(params.service, ["custom_software", "ai_automation", "web_app", "whatsapp_api", "ads_management", "other"] as const);
  const term = ilikeTerm(param(params.q));

  let query = supabase.from("leads").select("*").order("position", { ascending: false });
  if (source) query = query.eq("source", source);
  if (service) query = query.eq("service_interest", service);
  if (term) query = query.or(`name.ilike.${term},business.ilike.${term},phone.ilike.${term},city.ilike.${term}`);
  const { data, error } = await query;
  if (error) throw error;
  const leads = data ?? [];

  const open = leads.filter((l) => !["won", "lost"].includes(l.stage));
  const pipeline = open.filter((l) => l.currency === "PKR").reduce((sum, l) => sum + l.est_value, 0);
  const due = open.filter((l) => l.next_follow_up && l.next_follow_up <= today).length;
  const monthFrom = monthStart(today);
  const closedThisMonth = leads.filter((l) => ["won", "lost"].includes(l.stage) && l.stage_changed_at.slice(0, 10) >= monthFrom);
  const wonThisMonth = closedThisMonth.filter((l) => l.stage === "won").length;

  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-2 gap-3 sm:gap-5 wide:grid-cols-4">
        <KpiCard icon={<Filter />} tone="info" label="Open leads" value={open.length} />
        <KpiCard icon={<Target />} tone="accent" label="Pipeline value" value={formatMoney(pipeline, "PKR")} sub="Open leads, estimated" subTone="muted" />
        <KpiCard icon={<CalendarClock />} tone="warning" label="Follow-ups due" value={due} sub={due ? "Today or overdue" : "You're up to date"} subTone={due ? "warning" : "success"} />
        <KpiCard
          icon={<Trophy />}
          tone="success"
          label="Won this month"
          value={wonThisMonth}
          sub={closedThisMonth.length ? `${Math.round((wonThisMonth / closedThisMonth.length) * 100)}% win rate` : "No closed leads yet"}
          subTone="muted"
        />
      </div>
      <Section title="Pipeline">
        <ListToolbar
          className="mb-1"
          searchPlaceholder="Search name, business, phone…"
          filters={[
            { param: "source", placeholder: "All sources", options: sourceOptions },
            { param: "service", placeholder: "All services", options: serviceTypeOptions },
          ]}
        />
        <LeadsBoard leads={leads} today={today} />
      </Section>
    </div>
  );
}
