import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Folder, Mail, MapPin, Pencil, Phone, Plus, Repeat, Wallet, FileText } from "lucide-react";
import { requireFinance, isOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { dueLabel, formatDate, formatDayMonth, todayPK } from "@/lib/dates";
import { isUuid, param } from "@/lib/utils";
import {
  CATEGORY_LABELS,
  CLIENT_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  METHOD_LABELS,
  NICHE_LABELS,
  PROJECT_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
  SOURCE_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  INTERVAL_LABELS,
} from "@/lib/constants";
import { Card, Detail, KpiCard } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { LinkTabs, Progress } from "@/components/ui/misc";
import { Pill, StatusPill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { Amount, RowList, TxIcon, WhatsAppLink } from "@/components/app/domain";
import { FilesPanel } from "@/components/app/files-panel";
import { ActivityFeed } from "@/components/app/activity";
import { loadActors } from "@/lib/data/lookups";
import { invoiceDisplayStatus } from "@/lib/invoices";
import { ClientFormDialog } from "../client-form";
import { ClientDangerZone } from "./client-actions";
import { ProjectFormDialog } from "../../projects/project-form";
import { SubscriptionFormDialog } from "../../subscriptions/subscription-form";
import { loadFormOptions } from "@/lib/data/lookups";

export const metadata: Metadata = { title: "Client" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "projects", label: "Projects" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "money", label: "Invoices & Payments" },
  { value: "files", label: "Files" },
  { value: "activity", label: "Activity" },
];

export default function ClientPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton kpis={4} />}>
      <ClientDetail {...props} />
    </Suspense>
  );
}

async function ClientDetail({ params, searchParams }: Props) {
  const member = await requireFinance();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const tab = TABS.some((t) => t.value === param(query.tab)) ? param(query.tab)! : "overview";
  const supabase = await createClient();
  const today = todayPK();

  const [clientRes, projectsRes, subsRes, invoicesRes, txRes, filesRes, options] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("projects").select("id, title, service_type, status, progress, value, currency, deadline").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("subscriptions").select("*").eq("client_id", id).order("next_due_date"),
    supabase.from("invoices").select("id, number, status, total, amount_paid, currency, issue_date, due_date").eq("client_id", id).order("issue_date", { ascending: false }),
    supabase.from("transactions").select("id, type, amount, tax_withheld, currency, date, category, method, reference, description").eq("client_id", id).order("date", { ascending: false }).limit(50),
    supabase.from("files").select("id, name, size, created_at").eq("entity", "client").eq("entity_id", id).order("created_at", { ascending: false }),
    loadFormOptions(supabase),
  ]);
  const client = clientRes.data;
  if (!client) notFound();

  const projects = projectsRes.data ?? [];
  const subs = subsRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const txs = txRes.data ?? [];
  const billedPkr = txs.filter((t) => t.type === "income" && t.currency === "PKR").reduce((s, t) => s + t.amount, 0);
  const billedUsd = txs.filter((t) => t.type === "income" && t.currency === "USD").reduce((s, t) => s + t.amount, 0);
  const openInvoices = invoices.filter((i) => i.status === "sent" || i.status === "partial");
  const outstanding = openInvoices.filter((i) => i.currency === "PKR").reduce((s, i) => s + i.total - i.amount_paid, 0);
  const mrr = subs.filter((s) => s.status === "active" && s.currency === "PKR").reduce((sum, s) => sum + Math.round(s.amount / s.interval_months), 0);
  const activeProjects = projects.filter((p) => ["planning", "in_progress", "review"].includes(p.status));
  const phone = client.whatsapp ?? client.phone;

  let activity = null;
  if (tab === "activity") {
    const ids = [id, ...projects.map((p) => p.id), ...subs.map((s) => s.id), ...invoices.map((i) => i.id)];
    const { data } = await supabase.from("activity_log").select("id, entity, action, label, diff, created_at, actor_id").in("entity_id", ids).order("created_at", { ascending: false }).limit(100);
    activity = data ?? [];
  }
  const actors = tab === "activity" ? await loadActors(supabase) : {};

  return (
    <div className="flex flex-col gap-7">
      <Link href="/clients" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> All clients
      </Link>

      <Card className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 gap-5">
          <Avatar src={client.logo_url} name={client.business_name} size={84} square />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-bold tracking-[-0.01em]">{client.business_name}</h2>
              <StatusPill status={client.archived_at ? "former" : client.status} label={client.archived_at ? "Archived" : CLIENT_STATUS_LABELS[client.status]} />
            </div>
            <p className="mt-1 text-fg-2">
              {client.contact_name ?? "No contact person"} · {NICHE_LABELS[client.niche]} · via {SOURCE_LABELS[client.source]}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg-2">
              {phone ? (
                <span className="inline-flex items-center gap-1.5"><Phone className="size-4 text-muted" /> {formatPhone(phone)}</span>
              ) : null}
              {client.email ? (
                <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 hover:text-fg"><Mail className="size-4 text-muted" /> {client.email}</a>
              ) : null}
              {client.city ? (
                <span className="inline-flex items-center gap-1.5"><MapPin className="size-4 text-muted" /> {[client.city, client.country].filter(Boolean).join(", ")}</span>
              ) : null}
            </div>
            {client.tags.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {client.tags.map((tag) => (
                  <Pill key={tag} tone="accent">#{tag}</Pill>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <WhatsAppLink phone={phone} label="Open WhatsApp chat" />
          <ClientFormDialog client={client} trigger={<Button variant="secondary" size="sm"><Pencil /> Edit</Button>} />
          <ClientDangerZone id={client.id} name={client.business_name} archived={Boolean(client.archived_at)} canDelete={isOwner(member.role)} />
        </div>
      </Card>

      <LinkTabs tabs={TABS} />

      {tab === "overview" ? (
        <div className="flex flex-col gap-7">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 wide:grid-cols-4">
            <KpiCard icon={<Wallet />} tone="success" label="Total received" value={formatMoney(billedPkr, "PKR")} sub={billedUsd ? `+ ${formatMoney(billedUsd, "USD")}` : "Lifetime, PKR"} subTone="muted" />
            <KpiCard icon={<FileText />} tone="danger" label="Outstanding" value={formatMoney(outstanding, "PKR")} sub={`${openInvoices.length} open invoice${openInvoices.length === 1 ? "" : "s"}`} subTone={outstanding ? "danger" : "muted"} />
            <KpiCard icon={<Repeat />} tone="accent" label="Monthly recurring" value={formatMoney(mrr, "PKR")} sub={`${subs.filter((s) => s.status === "active").length} active subscriptions`} subTone="muted" />
            <KpiCard icon={<Folder />} tone="info" label="Active projects" value={activeProjects.length} sub={`${projects.length} in total`} subTone="muted" />
          </div>
          <div className="grid grid-cols-1 gap-7 xl:grid-cols-2">
            <Card>
              <p className="mb-4 text-card font-bold">Details</p>
              <dl className="grid grid-cols-2 gap-5">
                <Detail label="Contact">{client.contact_name ?? "—"}</Detail>
                <Detail label="Phone">{formatPhone(client.phone)}</Detail>
                <Detail label="WhatsApp">{formatPhone(client.whatsapp)}</Detail>
                <Detail label="Email">{client.email ?? "—"}</Detail>
                <Detail label="NTN">{client.ntn ?? "—"}</Detail>
                <Detail label="Client since">{formatDate(client.created_at.slice(0, 10))}</Detail>
                <Detail label="Address" className="col-span-2">{client.address ?? "—"}</Detail>
              </dl>
              {client.notes ? <p className="mt-5 rounded-2xl bg-surface-2 p-4 text-sm whitespace-pre-line text-fg-2">{client.notes}</p> : null}
            </Card>
            <Card className="py-3">
              <p className="pt-2 pb-2 text-card font-bold">Recent payments</p>
              {txs.length ? (
                <RowList>
                  {txs.slice(0, 6).map((tx) => (
                    <li key={tx.id} className="flex items-center gap-3 py-3">
                      <TxIcon type={tx.type} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{tx.description ?? CATEGORY_LABELS[tx.category]}</p>
                        <p className="text-xs text-muted">{formatDayMonth(tx.date)} · {METHOD_LABELS[tx.method]}</p>
                      </div>
                      <Amount minor={tx.amount} currency={tx.currency} type={tx.type} className="text-sm" />
                    </li>
                  ))}
                </RowList>
              ) : (
                <EmptyState compact icon={<Wallet />} title="No payments yet" />
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "projects" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <ProjectFormDialog clients={options.clients} members={options.members} defaultClientId={client.id} trigger={<Button><Plus /> New project</Button>} />
          </div>
          {projects.length ? (
            projects.map((project) => (
              <Card key={project.id} className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[1.5fr_1fr_1fr_auto]">
                <div className="min-w-0">
                  <Link href={`/projects/${project.id}`} className="block truncate font-bold hover:text-accent-fg">{project.title}</Link>
                  <p className="text-sm text-muted">{SERVICE_TYPE_LABELS[project.service_type]}</p>
                </div>
                <div>
                  <div className="mb-1.5 flex justify-between text-xs font-semibold"><span className="text-muted">Progress</span><span className="tabular">{project.progress}%</span></div>
                  <Progress value={project.progress} />
                </div>
                <div className="text-sm">
                  <p className="tabular font-semibold">{formatMoney(project.value, project.currency)}</p>
                  <p className="text-muted">{project.deadline ? dueLabel(project.deadline, today).replace("Due", "Deadline") : "No deadline"}</p>
                </div>
                <StatusPill status={project.status} label={PROJECT_STATUS_LABELS[project.status]} />
              </Card>
            ))
          ) : (
            <Card><EmptyState compact icon={<Folder />} title="No projects for this client yet" /></Card>
          )}
        </div>
      ) : null}

      {tab === "subscriptions" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <SubscriptionFormDialog clients={options.clients} plans={options.plans} defaultClientId={client.id} trigger={<Button><Plus /> Add subscription</Button>} />
          </div>
          {subs.length ? (
            subs.map((sub) => {
              const overdue = sub.status === "active" && sub.next_due_date < today;
              return (
                <Card key={sub.id} className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[1.5fr_1fr_1fr_auto]">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{sub.name}</p>
                    <p className="text-sm text-muted">{INTERVAL_LABELS[sub.interval_months]} · billing day {sub.billing_day}</p>
                  </div>
                  <p className="tabular font-semibold">{formatMoney(sub.amount, sub.currency)}</p>
                  <p className={overdue ? "text-sm font-semibold text-danger" : "text-sm text-fg-2"}>
                    {sub.status === "active" ? dueLabel(sub.next_due_date, today) : `Next due ${formatDate(sub.next_due_date)}`}
                  </p>
                  <StatusPill status={sub.status} label={SUBSCRIPTION_STATUS_LABELS[sub.status]} />
                </Card>
              );
            })
          ) : (
            <Card><EmptyState compact icon={<Repeat />} title="No subscriptions" description="Monthly services like Growthify WhatsApp API and Meta Ads management." /></Card>
          )}
        </div>
      ) : null}

      {tab === "money" ? (
        <div className="grid grid-cols-1 gap-7 xl:grid-cols-2">
          <Card className="py-3">
            <div className="flex items-center justify-between pt-2 pb-2">
              <p className="text-card font-bold">Invoices</p>
              <Button asChild size="sm" variant="secondary"><Link href={`/invoices/new?client=${client.id}`}><Plus /> New invoice</Link></Button>
            </div>
            {invoices.length ? (
              <RowList>
                {invoices.map((inv) => {
                  const display = invoiceDisplayStatus(inv, today);
                  return (
                    <li key={inv.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/invoices/${inv.id}`} className="font-semibold hover:text-accent-fg">{inv.number}</Link>
                        <p className="text-xs text-muted">Issued {formatDayMonth(inv.issue_date)} · due {formatDayMonth(inv.due_date)}</p>
                      </div>
                      <span className="tabular text-sm font-bold">{formatMoney(inv.total, inv.currency)}</span>
                      <StatusPill status={display} label={INVOICE_STATUS_LABELS[display]} />
                    </li>
                  );
                })}
              </RowList>
            ) : (
              <EmptyState compact icon={<FileText />} title="No invoices yet" />
            )}
          </Card>
          <Card className="py-3">
            <p className="pt-2 pb-2 text-card font-bold">Transactions</p>
            {txs.length ? (
              <RowList>
                {txs.map((tx) => (
                  <li key={tx.id} className="flex items-center gap-3 py-3">
                    <TxIcon type={tx.type} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{tx.description ?? CATEGORY_LABELS[tx.category]}</p>
                      <p className="text-xs text-muted">
                        {formatDayMonth(tx.date)} · {METHOD_LABELS[tx.method]}
                        {tx.reference ? ` · ${tx.reference}` : ""}
                        {tx.tax_withheld ? ` · WHT ${formatMoney(tx.tax_withheld, tx.currency)}` : ""}
                      </p>
                    </div>
                    <Amount minor={tx.amount} currency={tx.currency} type={tx.type} className="text-sm" />
                  </li>
                ))}
              </RowList>
            ) : (
              <EmptyState compact icon={<Wallet />} title="No transactions yet" />
            )}
          </Card>
        </div>
      ) : null}

      {tab === "files" ? <FilesPanel entity="client" entityId={client.id} files={filesRes.data ?? []} /> : null}
      {tab === "activity" && activity ? <ActivityFeed rows={activity} actors={actors} /> : null}
    </div>
  );
}
