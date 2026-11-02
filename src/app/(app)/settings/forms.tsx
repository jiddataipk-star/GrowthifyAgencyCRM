"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Database, Laptop, LogOut, Pencil, Plus, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { companySchema, inviteSchema, paymentDetailsSchema, planSchema, preferencesSchema, profileSchema, serviceSchema } from "@/lib/validation";
import { INTERVAL_LABELS, PAKISTAN_CITIES, ROLE_LABELS, SERVICE_TYPE_LABELS, currencyOptions, intervalOptions, roleOptions, serviceTypeOptions } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Field, FormGrid, Input, Select, Textarea, Checkbox } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Confirm } from "@/components/ui/confirm";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { LogoInput } from "@/components/app/upload";
import { applyFieldErrors } from "@/components/app/form-utils";
import { paymentDetailsText } from "@/components/app/domain";
import { savePlanAction, deletePlanAction } from "../subscriptions/actions";
import {
  clearDemoDataAction,
  deleteServiceAction,
  inviteMemberAction,
  loadDemoDataAction,
  removeMemberAction,
  revokeSessionAction,
  savePaymentDetailsAction,
  saveCompanyAction,
  savePreferencesAction,
  saveProfileAction,
  saveServiceAction,
  signOutEverywhereAction,
  updateMemberAction,
} from "./actions";
import type { Tables } from "@/types/db";

type Result = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

function useSaveToast() {
  return (result: Result, success = "Saved") => {
    if (result.ok) toast.success(success);
    else toast.error(result.error ?? "Couldn't save");
    return result.ok;
  };
}

function FormFooter({ pending, disabled, label = "Save" }: { pending: boolean; disabled?: boolean; label?: string }) {
  return (
    <div className="mt-7 flex justify-end">
      <Button type="submit" size="lg" className="min-w-[190px]" loading={pending} disabled={disabled}>
        {label}
      </Button>
    </div>
  );
}

/* ── Company profile ───────────────────────────────────────────────────── */
export function CompanyForm({ settings, canEdit }: { settings: Tables<"settings">; canEdit: boolean }) {
  const notify = useSaveToast();
  type Values = z.input<typeof companySchema>;
  const { register, handleSubmit, formState, control, setError } = useForm<Values>({
    resolver: zodResolver(companySchema) as never,
    defaultValues: {
      company_name: settings.company_name,
      tagline: settings.tagline ?? "",
      email: settings.email ?? "",
      phone: settings.phone ?? "",
      whatsapp_number: settings.whatsapp_number ?? "",
      website: settings.website ?? "",
      address: settings.address ?? "",
      city: settings.city ?? "",
      country: settings.country,
      logo_path: settings.logo_path ?? "",
    },
  });
  const errors = formState.errors;
  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (values) => {
        const result = await saveCompanyAction(values);
        applyFieldErrors(result.ok ? undefined : result.fieldErrors, setError);
        notify(result, "Company profile saved");
      })}
    >
      <fieldset disabled={!canEdit} className="grid grid-cols-1 gap-8 lg:grid-cols-[auto_1fr]">
        <Controller control={control} name="logo_path" render={({ field }) => <LogoInput value={field.value ?? ""} onChange={field.onChange} folder="company" name="Company logo (app use)" />} />
        <FormGrid>
          <Field label="Company name" htmlFor="co-name" error={errors.company_name?.message}>
            <Input {...register("company_name")} />
          </Field>
          <Field label="Tagline" htmlFor="co-tagline">
            <Input {...register("tagline")} />
          </Field>
          <Field label="Email" htmlFor="co-email" error={errors.email?.message}>
            <Input type="email" {...register("email")} />
          </Field>
          <Field label="Phone" htmlFor="co-phone" error={errors.phone?.message}>
            <Input inputMode="tel" {...register("phone")} />
          </Field>
          <Field label="Business WhatsApp (internal)" htmlFor="co-wa" error={errors.whatsapp_number?.message} hint="For your records; not sent to clients.">
            <Input inputMode="tel" {...register("whatsapp_number")} />
          </Field>
          <Field label="Website" htmlFor="co-web" error={errors.website?.message}>
            <Input type="url" placeholder="https://" {...register("website")} />
          </Field>
          <Field label="City" htmlFor="co-city">
            <Input list="co-cities" {...register("city")} />
          </Field>
          <Field label="Country" htmlFor="co-country">
            <Input {...register("country")} />
          </Field>
          <Field label="Address" htmlFor="co-address" className="sm:col-span-2">
            <Input {...register("address")} />
          </Field>
        </FormGrid>
        <datalist id="co-cities">{PAKISTAN_CITIES.map((c) => <option key={c} value={c} />)}</datalist>
      </fieldset>
      {canEdit ? <FormFooter pending={formState.isSubmitting} /> : null}
    </form>
  );
}

export function PaymentDetailsForm({ settings, canEdit }: { settings: Tables<"settings">; canEdit: boolean }) {
  const notify = useSaveToast();
  type Values = z.input<typeof paymentDetailsSchema>;
  const { register, handleSubmit, formState, setError, watch } = useForm<Values>({
    resolver: zodResolver(paymentDetailsSchema) as never,
    defaultValues: {
      bank_name: settings.bank_name ?? "",
      account_title: settings.account_title ?? "",
      account_number: settings.account_number ?? "",
      iban: settings.iban ?? "",
      jazzcash_number: settings.jazzcash_number ?? "",
      easypaisa_number: settings.easypaisa_number ?? "",
      raast_id: settings.raast_id ?? "",
      payment_notes: settings.payment_notes ?? "",
    },
  });
  const errors = formState.errors;
  const preview = paymentDetailsText({ ...watch(), company_name: settings.company_name });
  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (values) => {
        const result = await savePaymentDetailsAction(values);
        applyFieldErrors(result.ok ? undefined : result.fieldErrors, setError);
        notify(result, "Payment details saved");
      })}
      className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_320px]"
    >
      <div>
        {!canEdit ? <p className="mb-5 rounded-xl bg-surface-2 px-4 py-3 text-sm text-fg-2">Only the owner can change payment details.</p> : null}
        <fieldset disabled={!canEdit}>
          <FormGrid>
            <Field label="Bank name" htmlFor="b-bank"><Input placeholder="e.g. Meezan Bank" {...register("bank_name")} /></Field>
            <Field label="Account title" htmlFor="b-title"><Input placeholder="GROWTHIFY AGENCY" {...register("account_title")} /></Field>
            <Field label="Account number" htmlFor="b-acc"><Input {...register("account_number")} /></Field>
            <Field label="IBAN" htmlFor="b-iban" error={errors.iban?.message}><Input placeholder="PK36SCBL0000001123456702" {...register("iban")} /></Field>
            <Field label="JazzCash number" htmlFor="b-jazz" error={errors.jazzcash_number?.message}><Input inputMode="tel" placeholder="03XX-XXXXXXX" {...register("jazzcash_number")} /></Field>
            <Field label="Easypaisa number" htmlFor="b-easy" error={errors.easypaisa_number?.message}><Input inputMode="tel" placeholder="03XX-XXXXXXX" {...register("easypaisa_number")} /></Field>
            <Field label="Raast ID" htmlFor="b-raast"><Input placeholder="Mobile number or Raast ID" {...register("raast_id")} /></Field>
            <Field label="Extra line" htmlFor="b-notes" hint="e.g. “Payments in the name of Ahmad” or bank branch"><Input {...register("payment_notes")} /></Field>
          </FormGrid>
        </fieldset>
        {canEdit ? <FormFooter pending={formState.isSubmitting} /> : null}
      </div>
      <aside className="rounded-card border border-line bg-canvas p-4">
        <p className="text-[12.5px] font-semibold text-muted">Preview — added to every WhatsApp payment reminder</p>
        <pre className="mt-3 rounded-xl bg-white p-3.5 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-fg shadow-card">
          {`Assalam o Alaikum, a gentle reminder for Website advance: PKR 50,000 (due 5 Nov).${preview}\n\nPlease share the screenshot after payment. JazakAllah! — ${settings.company_name}`}
        </pre>
      </aside>
    </form>
  );
}

/* ── Preferences ───────────────────────────────────────────────────────── */
export function PreferencesForm({ settings, canEdit }: { settings: Tables<"settings">; canEdit: boolean }) {
  const notify = useSaveToast();
  type Values = z.input<typeof preferencesSchema>;
  const { register, handleSubmit, formState, control } = useForm<Values>({
    resolver: zodResolver(preferencesSchema) as never,
    defaultValues: {
      default_currency: settings.default_currency,
      timezone: settings.timezone,
      notify_renewals: settings.notify_renewals,
      notify_followups: settings.notify_followups,
      notify_overdue: settings.notify_overdue,
      notify_social: settings.notify_social,
    },
  });
  const toggles: { name: keyof Values; title: string; text: string }[] = [
    { name: "notify_renewals", title: "Renewals due", text: "Subscriptions due within 3 days, and overdue ones." },
    { name: "notify_followups", title: "Lead follow-ups", text: "Leads whose follow-up date is today or past." },
    { name: "notify_overdue", title: "Overdue payments", text: "Payments to collect that are past their date." },
    { name: "notify_social", title: "Social connection problems", text: "When a platform needs reconnecting." },
  ];
  return (
    <div className="space-y-8">
      <form
        noValidate
        onSubmit={handleSubmit(async (values) => {
          notify(await savePreferencesAction(values), "Preferences saved");
        })}
      >
        <fieldset disabled={!canEdit}>
          <h3 className="mb-4 font-display text-card font-bold">Regional</h3>
          <FormGrid>
            <Field label="Reporting currency" htmlFor="p-currency" hint="Dashboards report PKR; USD is always shown separately, never converted.">
              <Select options={currencyOptions} {...register("default_currency")} />
            </Field>
            <Field label="Time zone" htmlFor="p-tz" hint="Due dates and “today” follow Pakistan time.">
              <Select options={[{ value: "Asia/Karachi", label: "Asia/Karachi (PKT, UTC+5)" }]} {...register("timezone")} />
            </Field>
          </FormGrid>
          <h3 className="mt-8 mb-4 font-display text-card font-bold">Notifications</h3>
          <ul className="divide-y divide-line rounded-control border border-line">
            {toggles.map((toggle) => (
              <li key={toggle.name} className="flex items-center justify-between gap-4 px-4 py-4">
                <span>
                  <span className="block font-semibold">{toggle.title}</span>
                  <span className="text-sm text-muted">{toggle.text}</span>
                </span>
                <Controller
                  control={control}
                  name={toggle.name}
                  render={({ field }) => <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} aria-label={toggle.title} />}
                />
              </li>
            ))}
          </ul>
        </fieldset>
        {canEdit ? <FormFooter pending={formState.isSubmitting} /> : null}
      </form>
    </div>
  );
}

/* ── My profile ────────────────────────────────────────────────────────── */
export function ProfileForm({ name, email, avatarUrl, role }: { name: string; email: string; avatarUrl: string | null; role: Tables<"team_members">["role"] }) {
  const notify = useSaveToast();
  const { register, handleSubmit, formState, control, setError } = useForm<z.input<typeof profileSchema>>({
    resolver: zodResolver(profileSchema) as never,
    defaultValues: { name, avatar_url: avatarUrl ?? "" },
  });
  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (values) => {
        const result = await saveProfileAction(values);
        applyFieldErrors(result.ok ? undefined : result.fieldErrors, setError);
        notify(result, "Profile saved");
      })}
      className="grid grid-cols-1 gap-8 lg:grid-cols-[auto_1fr]"
    >
      <Controller control={control} name="avatar_url" render={({ field }) => <LogoInput value={field.value ?? ""} onChange={field.onChange} folder="avatars" name="Profile photo" />} />
      <div>
        <FormGrid>
          <Field label="Your name" htmlFor="pr-name" error={formState.errors.name?.message}>
            <Input {...register("name")} />
          </Field>
          <Field label="Google email" htmlFor="pr-email" hint="Sign-in email; the owner can change it.">
            <Input value={email} readOnly disabled />
          </Field>
          <Field label="Role" htmlFor="pr-role">
            <Input value={ROLE_LABELS[role]} readOnly disabled />
          </Field>
        </FormGrid>
        <FormFooter pending={formState.isSubmitting} />
      </div>
    </form>
  );
}

/* ── Security ──────────────────────────────────────────────────────────── */
type SessionRow = { id: string; created_at: string; updated_at: string | null; user_agent: string | null; ip: string | null; current: boolean };

function describeAgent(agent: string | null) {
  if (!agent) return { label: "Unknown device", mobile: false };
  const mobile = /Mobile|Android|iPhone/i.test(agent);
  const browser = /Edg\//.test(agent) ? "Edge" : /Chrome\//.test(agent) ? "Chrome" : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : "Browser";
  const os = /Windows/.test(agent) ? "Windows" : /Mac OS X/.test(agent) && !mobile ? "macOS" : /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Linux/.test(agent) ? "Linux" : "";
  return { label: `${browser}${os ? ` on ${os}` : ""}`, mobile };
}

export function SessionsList({ sessions }: { sessions: SessionRow[] }) {
  const [confirm, setConfirm] = React.useState(false);
  return (
    <div>
      <h3 className="mb-1 font-display text-card font-bold">Active sessions</h3>
      <p className="mb-4 text-sm text-muted">Devices signed in to your account. Sign-in is Google-only; manage 2-step verification in your Google account.</p>
      <ul className="divide-y divide-line rounded-control border border-line">
        {sessions.length === 0 ? <li className="px-4 py-6 text-sm text-muted">No session details available.</li> : null}
        {sessions.map((session) => {
          const agent = describeAgent(session.user_agent);
          return (
            <li key={session.id} className="flex items-center gap-4 px-4 py-4">
              <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-primary">
                {agent.mobile ? <Smartphone className="size-5" /> : <Laptop className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {agent.label} {session.current ? <Pill tone="success" className="ml-1.5">This device</Pill> : null}
                </p>
                <p className="text-sm text-muted">
                  {session.ip ?? "IP hidden"} · last active {formatDateTime(session.updated_at ?? session.created_at)}
                </p>
              </div>
              {!session.current ? (
                <Button
                  variant="outline"
                  size="pill"
                  onClick={async () => {
                    const result = await revokeSessionAction({ id: session.id });
                    if (result.ok) toast.success("Session signed out");
                    else toast.error(result.error);
                  }}
                >
                  Sign out
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="mt-6 flex justify-end">
        <Button variant="danger-outline" onClick={() => setConfirm(true)}>
          <LogOut /> Sign out everywhere
        </Button>
      </div>
      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title="Sign out on all devices?"
        description="Every session ends, including this one. You'll sign in again with Google."
        confirmLabel="Sign out everywhere"
        danger
        onConfirm={() => signOutEverywhereAction()}
      />
    </div>
  );
}

/* ── Team & roles ──────────────────────────────────────────────────────── */
type MemberRow = { id: string; email: string; name: string | null; role: "owner" | "manager" | "staff"; active: boolean; user_id: string | null; avatar_url: string | null; last_seen_at: string | null };

export function TeamManager({ members, meId, canManage }: { members: MemberRow[]; meId: string; canManage: boolean }) {
  const [removing, setRemoving] = React.useState<MemberRow | null>(null);
  const { register, handleSubmit, formState, reset, setError } = useForm<z.input<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema) as never,
    defaultValues: { email: "", name: "", role: "staff" },
  });

  async function update(member: MemberRow, values: Partial<Pick<MemberRow, "role" | "active">>) {
    const result = await updateMemberAction({ id: member.id, role: values.role ?? member.role, active: values.active ?? member.active });
    if (result.ok) toast.success("Access updated");
    else toast.error(result.error);
  }

  return (
    <div className="space-y-8">
      {canManage ? (
        <form
          noValidate
          onSubmit={handleSubmit(async (values) => {
            const result = await inviteMemberAction(values);
            if (!result.ok) {
              applyFieldErrors(result.fieldErrors, setError);
              toast.error(result.error);
              return;
            }
            toast.success(`${values.email} can now sign in with Google`);
            reset();
          })}
          className="rounded-control border border-line p-5"
        >
          <h3 className="mb-1 font-display text-card font-bold">Invite by Google email</h3>
          <p className="mb-4 text-sm text-muted">They sign in at this app with “Continue with Google”. No email is sent — share the link yourself.</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_1fr_160px_auto] md:items-end">
            <Field label="Google email" htmlFor="inv-email" error={formState.errors.email?.message}>
              <Input type="email" placeholder="name@gmail.com" {...register("email")} />
            </Field>
            <Field label="Name" htmlFor="inv-name">
              <Input placeholder="Optional" {...register("name")} />
            </Field>
            <Field label="Role" htmlFor="inv-role">
              <Select options={roleOptions} {...register("role")} />
            </Field>
            <Button type="submit" size="lg" loading={formState.isSubmitting}>
              <Plus /> Invite
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">Owner: everything · Manager: everything except billing settings, deleting money records and users · Staff: only assigned projects and tasks.</p>
        </form>
      ) : null}

      <ul className="divide-y divide-line rounded-control border border-line">
        {members.map((member) => (
          <li key={member.id} className={cn("flex flex-wrap items-center gap-4 px-4 py-4", !member.active && "opacity-60")}>
            <Avatar src={member.avatar_url} name={member.name ?? member.email} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {member.name ?? member.email.split("@")[0]} {member.id === meId ? <span className="text-sm text-muted">(you)</span> : null}
              </p>
              <p className="truncate text-sm text-muted">
                {member.email} · {member.user_id ? (member.last_seen_at ? `last seen ${formatDateTime(member.last_seen_at)}` : "signed in") : "invited, hasn't signed in yet"}
              </p>
            </div>
            {canManage && member.id !== meId ? (
              <>
                <label className="sr-only" htmlFor={`role-${member.id}`}>Role for {member.email}</label>
                <select
                  id={`role-${member.id}`}
                  value={member.role}
                  onChange={(event) => update(member, { role: event.target.value as MemberRow["role"] })}
                  className="h-10 rounded-full border border-line bg-surface-2 px-4 text-sm font-semibold"
                >
                  {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <Switch checked={member.active} onCheckedChange={(active) => update(member, { active })} aria-label={`Access for ${member.email}`} />
                  {member.active ? "Access on" : "Access off"}
                </label>
                <button type="button" onClick={() => setRemoving(member)} className="rounded-full p-2 text-muted hover:text-danger" aria-label={`Remove ${member.email}`}>
                  <Trash2 className="size-4" />
                </button>
              </>
            ) : (
              <Pill tone={member.role === "owner" ? "accent" : member.role === "manager" ? "info" : "neutral"}>{ROLE_LABELS[member.role]}</Pill>
            )}
          </li>
        ))}
      </ul>
      <Confirm
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.email}?`}
        description="They lose access immediately. Their past activity stays in the log. To pause access instead, switch Access off."
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          if (!removing) return;
          const result = await removeMemberAction({ id: removing.id });
          if (result.ok) toast.success("Member removed");
          else toast.error(result.error);
        }}
      />
    </div>
  );
}

/* ── Services & plans catalog ──────────────────────────────────────────── */
export function CatalogManager({ services, plans, canDelete }: { services: Tables<"services">[]; plans: Tables<"plans">[]; canDelete: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-card font-bold">Services</h3>
            <p className="text-sm text-muted">What Growthify sells. Used in projects and leads.</p>
          </div>
          <ServiceDialog trigger={<Button size="sm" variant="secondary"><Plus /> Add</Button>} />
        </div>
        <ul className="divide-y divide-line rounded-control border border-line">
          {services.map((service) => (
            <li key={service.id} className={cn("flex items-center gap-3 px-4 py-3.5", !service.active && "opacity-50")}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{service.name}</p>
                <p className="text-xs text-muted">
                  {SERVICE_TYPE_LABELS[service.type]}
                  {service.is_recurring ? " · recurring" : ""}
                  {service.default_price ? ` · from ${formatMoney(service.default_price, service.currency)}` : ""}
                </p>
              </div>
              <ServiceDialog service={service} trigger={<button type="button" className="rounded-full p-2 text-muted hover:text-fg" aria-label={`Edit ${service.name}`}><Pencil className="size-4" /></button>} />
              {canDelete ? <DeleteButton label={service.name} onDelete={() => deleteServiceAction({ id: service.id })} /> : null}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-card font-bold">Subscription plans</h3>
            <p className="text-sm text-muted">Monthly packages. A subscription can override the amount.</p>
          </div>
          <PlanDialog trigger={<Button size="sm" variant="secondary"><Plus /> Add</Button>} />
        </div>
        <ul className="divide-y divide-line rounded-control border border-line">
          {plans.map((plan) => (
            <li key={plan.id} className={cn("flex items-center gap-3 px-4 py-3.5", !plan.active && "opacity-50")}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{plan.name}</p>
                <p className="text-xs text-muted">
                  {INTERVAL_LABELS[plan.interval_months]} · {plan.amount ? formatMoney(plan.amount, plan.currency) : <span className="font-semibold text-danger">Set a price</span>}
                </p>
              </div>
              <PlanDialog plan={plan} trigger={<button type="button" className="rounded-full p-2 text-muted hover:text-fg" aria-label={`Edit ${plan.name}`}><Pencil className="size-4" /></button>} />
              {canDelete ? <DeleteButton label={plan.name} onDelete={() => deletePlanAction({ id: plan.id })} /> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DeleteButton({ label, onDelete }: { label: string; onDelete: () => Promise<Result> }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-full p-2 text-muted hover:text-danger" aria-label={`Delete ${label}`}>
        <Trash2 className="size-4" />
      </button>
      <Confirm
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${label}?`}
        description="If it's in use, deactivate it instead (edit → uncheck Active)."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          const result = await onDelete();
          if (result.ok) toast.success("Deleted");
          else toast.error(result.error);
        }}
      />
    </>
  );
}

function ServiceDialog({ service, trigger }: { service?: Tables<"services">; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  type Values = z.input<typeof serviceSchema>;
  const defaults: Values = {
    name: service?.name ?? "",
    type: service?.type ?? "custom_software",
    description: service?.description ?? "",
    default_price: service?.default_price ? service.default_price / 100 : 0,
    currency: service?.currency ?? "PKR",
    is_recurring: service?.is_recurring ?? false,
    active: service?.active ?? true,
  };
  const { register, handleSubmit, formState, reset, setError } = useForm<Values>({ resolver: zodResolver(serviceSchema) as never, defaultValues: defaults });
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) reset(defaults); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={service ? "Edit service" : "Add service"}>
        <form
          noValidate
          onSubmit={handleSubmit(async (values) => {
            const result = await saveServiceAction({ ...values, id: service?.id });
            if (!result.ok) { applyFieldErrors(result.fieldErrors, setError); toast.error(result.error); return; }
            toast.success("Service saved");
            setOpen(false);
          })}
        >
          <FormGrid>
            <Field label="Name" htmlFor="sv-name" error={formState.errors.name?.message} className="sm:col-span-2"><Input {...register("name")} /></Field>
            <Field label="Type" htmlFor="sv-type"><Select options={serviceTypeOptions} {...register("type")} /></Field>
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <Field label="Starting price" htmlFor="sv-price"><Input type="number" min="0" step="0.01" {...register("default_price")} /></Field>
              <Field label="Currency" htmlFor="sv-cur"><Select options={currencyOptions.map((o) => ({ value: o.value, label: o.value }))} {...register("currency")} /></Field>
            </div>
            <Field label="Description" htmlFor="sv-desc" className="sm:col-span-2"><Input {...register("description")} /></Field>
            <label className="flex items-center gap-3 font-semibold"><Checkbox {...register("is_recurring")} /> Recurring (monthly)</label>
            <label className="flex items-center gap-3 font-semibold"><Checkbox {...register("active")} /> Active</label>
          </FormGrid>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="lg" loading={formState.isSubmitting}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlanDialog({ plan, trigger }: { plan?: Tables<"plans">; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  type Values = z.input<typeof planSchema>;
  const defaults: Values = {
    name: plan?.name ?? "",
    service_type: plan?.service_type ?? "whatsapp_api",
    amount: plan ? plan.amount / 100 : 0,
    currency: plan?.currency ?? "PKR",
    interval_months: plan?.interval_months ?? 1,
    active: plan?.active ?? true,
  };
  const { register, handleSubmit, formState, reset, setError } = useForm<Values>({ resolver: zodResolver(planSchema) as never, defaultValues: defaults });
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) reset(defaults); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={plan ? "Edit plan" : "Add plan"}>
        <form
          noValidate
          onSubmit={handleSubmit(async (values) => {
            const result = await savePlanAction({ ...values, id: plan?.id });
            if (!result.ok) { applyFieldErrors(result.fieldErrors, setError); toast.error(result.error); return; }
            toast.success("Plan saved");
            setOpen(false);
          })}
        >
          <FormGrid>
            <Field label="Plan name" htmlFor="pl-name" error={formState.errors.name?.message} className="sm:col-span-2"><Input placeholder="Growthify WhatsApp API — Monthly" {...register("name")} /></Field>
            <Field label="Service" htmlFor="pl-type"><Select options={serviceTypeOptions} {...register("service_type")} /></Field>
            <Field label="Billing cycle" htmlFor="pl-int"><Select options={intervalOptions} {...register("interval_months")} /></Field>
            <Field label="Amount per cycle" htmlFor="pl-amt" error={formState.errors.amount?.message}><Input type="number" min="0" step="0.01" {...register("amount")} /></Field>
            <Field label="Currency" htmlFor="pl-cur"><Select options={currencyOptions} {...register("currency")} /></Field>
            <label className="flex items-center gap-3 font-semibold"><Checkbox {...register("active")} /> Active</label>
          </FormGrid>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="lg" loading={formState.isSubmitting}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Demo data ─────────────────────────────────────────────────────────── */
export function DemoDataCard({ loaded }: { loaded: number }) {
  const [confirm, setConfirm] = React.useState<null | "load" | "clear">(null);
  return (
    <div className="rounded-control border border-dashed border-line-strong bg-canvas p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-11 items-center justify-center rounded-full bg-primary-tint text-primary"><Database className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Demo data</p>
          <p className="text-sm text-muted">
            {loaded ? `${loaded} demo records loaded. Remove them before entering real data.` : "Fictional clients, projects and money to explore the app. Only shown because ALLOW_DEMO_DATA=true."}
          </p>
        </div>
        {loaded ? (
          <Button variant="danger-outline" onClick={() => setConfirm("clear")}>Remove demo data</Button>
        ) : (
          <Button variant="secondary" onClick={() => setConfirm("load")}>Load demo data</Button>
        )}
      </div>
      <Confirm
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === "load" ? "Load demo data?" : "Remove all demo data?"}
        description={confirm === "load" ? "Adds fictional records (all tracked) so they can be removed in one click." : "Deletes only the records created by the demo loader."}
        confirmLabel={confirm === "load" ? "Load" : "Remove"}
        danger={confirm === "clear"}
        onConfirm={async () => {
          const result = confirm === "load" ? await loadDemoDataAction({}) : await clearDemoDataAction({});
          if (result.ok) toast.success(confirm === "load" ? "Demo data loaded" : "Demo data removed");
          else toast.error(result.error);
        }}
      />
    </div>
  );
}
