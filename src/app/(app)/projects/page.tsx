import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AlarmClock, Folder, PackageCheck, Plus, Rocket } from "lucide-react";
import { SERVICE_ICON } from "@/components/app/service-icon";
import { requireMember, canSeeFinance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, oneOf, pageCount, pageFrom, type SearchParams } from "@/lib/data/query";
import { loadFormOptions } from "@/lib/data/lookups";
import { PROJECT_STATUS_LABELS, SERVICE_TYPE_LABELS, projectStatusOptions, serviceTypeOptions } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { dueLabel, monthStart, todayPK } from "@/lib/dates";
import { param } from "@/lib/utils";
import { Card, IconCircle, KpiCard, Section } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Pagination, Progress } from "@/components/ui/misc";
import { StatusPill } from "@/components/ui/pill";
import { ListToolbar } from "@/components/app/toolbar";
import { ProjectFormDialog } from "./project-form";

export const metadata: Metadata = { title: "Projects" };


export default function ProjectsPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Projects searchParams={props.searchParams} />
    </Suspense>
  );
}

const OPEN = ["planning", "in_progress", "review"] as const;

async function Projects({ searchParams }: { searchParams: SearchParams }) {
  const member = await requireMember();
  const finance = canSeeFinance(member.role);
  const params = await searchParams;
  const supabase = await createClient();
  const today = todayPK();
  const { page, from, to } = pageFrom(params);
  const status = oneOf(params.status, ["planning", "in_progress", "review", "delivered", "on_hold"] as const);
  const service = oneOf(params.service, ["custom_software", "ai_automation", "web_app", "whatsapp_api", "ads_management", "other"] as const);
  const view = param(params.view);
  const term = ilikeTerm(param(params.q));

  let query = supabase
    .from("projects")
    .select("id, title, service_type, status, progress, value, currency, deadline, clients(business_name), tasks(done)", { count: "exact" })
    .order("status")
    .order("deadline", { ascending: true, nullsFirst: false })
    .range(from, to);
  if (status) query = query.eq("status", status);
  else if (view !== "all") query = query.in("status", [...OPEN, "on_hold"]);
  if (service) query = query.eq("service_type", service);
  if (term) query = query.ilike("title", term);

  const [list, open, review, deliveredMonth, late, options] = await Promise.all([
    query,
    supabase.from("projects").select("id", { count: "exact", head: true }).in("status", [...OPEN]),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "review"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "delivered").gte("delivered_at", monthStart(today)),
    supabase.from("projects").select("id", { count: "exact", head: true }).in("status", [...OPEN]).lt("deadline", today),
    finance ? loadFormOptions(supabase) : Promise.resolve(null),
  ]);
  if (list.error) throw list.error;
  const projects = list.data ?? [];

  const newProject = options ? (
    <ProjectFormDialog clients={options.clients} members={options.members} trigger={<Button><Plus /> New project</Button>} />
  ) : null;

  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-2 gap-3 sm:gap-5 wide:grid-cols-4">
        <KpiCard icon={<Rocket />} tone="accent" label={finance ? "Active projects" : "My active projects"} value={open.count ?? 0} />
        <KpiCard icon={<Folder />} tone="warning" label="In review" value={review.count ?? 0} />
        <KpiCard icon={<PackageCheck />} tone="success" label="Delivered this month" value={deliveredMonth.count ?? 0} />
        <KpiCard icon={<AlarmClock />} tone="danger" label="Past deadline" value={late.count ?? 0} sub={late.count ? "Needs attention" : "All on schedule"} subTone={late.count ? "danger" : "success"} />
      </div>

      <Section title={status ? PROJECT_STATUS_LABELS[status] : view === "all" ? "All projects" : "Current projects"}>
        <ListToolbar
          className="mb-5"
          searchPlaceholder="Search projects…"
          filters={[
            { param: "status", placeholder: "Open (not delivered)", options: projectStatusOptions },
            { param: "service", placeholder: "All services", options: serviceTypeOptions },
          ]}
          actions={
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href={view === "all" ? "/projects" : "/projects?view=all"}>{view === "all" ? "Hide delivered" : "Include delivered"}</Link>
              </Button>
              {newProject}
            </>
          }
        />
        {projects.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Folder />}
              title={finance ? "No projects here" : "No projects assigned to you yet"}
              description={finance ? "Create a project for a client, or convert a won lead." : "When the owner assigns you to a project it appears here."}
              action={newProject}
            />
          </Card>
        ) : (
          <ul className="space-y-4">
            {projects.map((project) => {
              const meta = SERVICE_ICON[project.service_type];
              const done = project.tasks.filter((t) => t.done).length;
              const overdue = project.deadline && project.deadline < today && OPEN.includes(project.status as (typeof OPEN)[number]);
              return (
                <li key={project.id}>
                  <Card className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-3 px-4 py-4 hover:border-line-strong sm:px-5 lg:grid-cols-[auto_1.5fr_1.1fr_1fr_1fr_auto]">
                    <IconCircle tone={meta.tone} size="md" className="rounded-[16px]">{meta.icon}</IconCircle>
                    <div className="min-w-0">
                      <Link href={`/projects/${project.id}`} className="block truncate text-[15px] font-bold hover:text-primary">{project.title}</Link>
                      <p className="truncate text-sm text-muted">{project.clients?.business_name}</p>
                    </div>
                    <div className="justify-self-end lg:order-last">
                      <Button asChild variant="outline" size="pill">
                        <Link href={`/projects/${project.id}`}>View details</Link>
                      </Button>
                    </div>
                    <div className="col-span-3 min-w-0 lg:col-span-1">
                      <div className="mb-1.5 flex justify-between text-xs font-semibold">
                        <span className="text-muted">{project.tasks.length ? `${done}/${project.tasks.length} tasks` : "Progress"}</span>
                        <span className="tabular">{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} label={`${project.title} progress`} />
                    </div>
                    <div className="col-span-3 min-w-0 lg:col-span-1">
                      <p className="truncate text-sm font-semibold">{finance ? formatMoney(project.value, project.currency) : SERVICE_TYPE_LABELS[project.service_type]}</p>
                      <p className={`truncate text-[13px] ${overdue ? "font-semibold text-danger" : "text-muted"}`}>
                        {project.deadline ? dueLabel(project.deadline, today).replace("Due", "Deadline") : "No deadline"}
                      </p>
                    </div>
                    <div className="col-span-3 lg:col-span-1">
                      <StatusPill status={project.status} label={PROJECT_STATUS_LABELS[project.status]} />
                    </div>
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
