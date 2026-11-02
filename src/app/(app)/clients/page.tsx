import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Archive, Plus, UserCheck, UserPlus, Users, UserX } from "lucide-react";
import { requireFinance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, oneOf, pageCount, pageFrom, type SearchParams } from "@/lib/data/query";
import { CLIENT_STATUS_LABELS, NICHE_LABELS, clientStatusOptions, nicheOptions, sourceOptions } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { monthStart, todayPK } from "@/lib/dates";
import { param } from "@/lib/utils";
import { Card, KpiCard, Section } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/misc";
import { StatusPill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { ListToolbar } from "@/components/app/toolbar";
import { WhatsAppLink } from "@/components/app/domain";
import { ClientFormDialog } from "./client-form";

export const metadata: Metadata = { title: "Clients" };

export default function ClientsPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Clients searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Clients({ searchParams }: { searchParams: SearchParams }) {
  await requireFinance();
  const params = await searchParams;
  const supabase = await createClient();
  const { page, from, to } = pageFrom(params);
  const status = oneOf(params.status, ["active", "paused", "former"] as const);
  const niche = oneOf(params.niche, ["real_estate", "travel_visa", "clinic", "academy", "ecommerce", "other"] as const);
  const source = oneOf(params.source, ["meta_ad", "organic", "referral", "linkedin", "other"] as const);
  const archived = param(params.archived) === "1";
  const term = ilikeTerm(param(params.q));

  let query = supabase
    .from("clients")
    .select("id, business_name, contact_name, phone, whatsapp, city, niche, status, logo_url, tags, archived_at, projects(status), subscriptions(amount, currency, interval_months, status)", { count: "exact" })
    .order("business_name")
    .range(from, to);
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (status) query = query.eq("status", status);
  if (niche) query = query.eq("niche", niche);
  if (source) query = query.eq("source", source);
  if (term) query = query.or(`business_name.ilike.${term},contact_name.ilike.${term},phone.ilike.${term},city.ilike.${term},email.ilike.${term}`);

  const countBy = (s: "active" | "paused" | "former") =>
    supabase.from("clients").select("id", { count: "exact", head: true }).is("archived_at", null).eq("status", s);
  const [list, active, paused, former, fresh] = await Promise.all([
    query,
    countBy("active"),
    countBy("paused"),
    countBy("former"),
    supabase.from("clients").select("id", { count: "exact", head: true }).is("archived_at", null).gte("created_at", monthStart(todayPK())),
  ]);
  if (list.error) throw list.error;
  const clients = list.data ?? [];

  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 wide:grid-cols-4">
        <KpiCard icon={<UserCheck />} tone="success" label="Active clients" value={active.count ?? 0} />
        <KpiCard icon={<UserPlus />} tone="accent" label="New this month" value={fresh.count ?? 0} />
        <KpiCard icon={<Users />} tone="warning" label="Paused" value={paused.count ?? 0} />
        <KpiCard icon={<UserX />} tone="neutral" label="Former" value={former.count ?? 0} />
      </div>

      <Section title={archived ? "Archived clients" : "Client list"}>
        <ListToolbar
          className="mb-5"
          searchPlaceholder="Search name, contact, phone, city…"
          filters={[
            { param: "status", placeholder: "All statuses", options: clientStatusOptions },
            { param: "niche", placeholder: "All niches", options: nicheOptions },
            { param: "source", placeholder: "All sources", options: sourceOptions },
          ]}
          actions={
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href={archived ? "/clients" : "/clients?archived=1"}>
                  <Archive /> {archived ? "Back to clients" : "Archived"}
                </Link>
              </Button>
              <ClientFormDialog
                trigger={
                  <Button>
                    <Plus /> Add client
                  </Button>
                }
              />
            </>
          }
        />

        {clients.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users />}
              title={term || status || niche || source ? "No clients match these filters" : archived ? "No archived clients" : "No clients yet"}
              description={term || status || niche || source ? "Try a different search or clear the filters." : "Add your first client, or convert a won lead from the pipeline."}
              action={
                !term && !archived ? (
                  <ClientFormDialog trigger={<Button><Plus /> Add client</Button>} />
                ) : undefined
              }
            />
          </Card>
        ) : (
          <ul className="space-y-4">
            {clients.map((client) => {
              const activeProjects = client.projects.filter((p) => ["planning", "in_progress", "review"].includes(p.status)).length;
              const mrr = client.subscriptions
                .filter((s) => s.status === "active" && s.currency === "PKR")
                .reduce((sum, s) => sum + Math.round(s.amount / s.interval_months), 0);
              return (
                <li key={client.id}>
                  <Card className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-3 px-4 py-4 transition-colors hover:border-line-strong sm:px-5 lg:grid-cols-[auto_1.4fr_1fr_1fr_1fr_auto]">
                    <Avatar src={client.logo_url} name={client.business_name} size={56} square />
                    <div className="min-w-0">
                      <Link href={`/clients/${client.id}`} className="block truncate text-[15px] font-bold hover:text-accent-fg">
                        {client.business_name}
                      </Link>
                      <p className="truncate text-sm text-muted">{client.contact_name ?? "No contact person"}</p>
                    </div>
                    <div className="flex items-center gap-1 justify-self-end lg:order-last">
                      <WhatsAppLink variant="icon" phone={client.whatsapp ?? client.phone} label="Open WhatsApp chat" />
                      <Button asChild variant="outline" size="pill" className="hidden sm:inline-flex">
                        <Link href={`/clients/${client.id}`}>View details</Link>
                      </Button>
                    </div>
                    <Cell label={client.city ?? "—"} sub={NICHE_LABELS[client.niche]} />
                    <Cell label={formatPhone(client.whatsapp ?? client.phone)} sub="WhatsApp / phone" />
                    <Cell
                      label={mrr ? `${formatMoney(mrr, "PKR")}/mo` : `${activeProjects} active project${activeProjects === 1 ? "" : "s"}`}
                      sub={<StatusPill status={client.archived_at ? "former" : client.status} label={client.archived_at ? "Archived" : CLIENT_STATUS_LABELS[client.status]} />}
                    />
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination page={page} pageCount={pageCount(list.count)} />
      </Section>
    </div>
  );
}

function Cell({ label, sub }: { label: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div className="col-span-3 min-w-0 pl-[72px] lg:col-span-1 lg:pl-0 max-lg:[&:nth-of-type(n)]:-mt-1">
      <p className="truncate text-sm font-semibold">{label}</p>
      <div className="mt-0.5 truncate text-[13px] text-muted">{sub}</div>
    </div>
  );
}
