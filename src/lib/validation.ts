import { z } from "zod";

/**
 * Form schemas shared by the browser (React Hook Form) and the server (Server Actions).
 * Money fields are major units (rupees / dollars) in forms; actions convert to minor units.
 */
const text = (max = 200) => z.string().trim().max(max, `Keep it under ${max} characters`);
const optionalText = (max = 500) => text(max).optional().or(z.literal(""));
const requiredText = (label: string, max = 200) => text(max).min(1, `${label} is required`);
const id = z.guid("Choose an option");
const optionalId = z.guid().optional().or(z.literal(""));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const optionalDate = isoDate.optional().or(z.literal(""));
const money = z.coerce.number({ error: "Enter an amount" }).min(0, "Can't be negative").max(1_000_000_000, "That's too large");
const positiveMoney = z.coerce.number({ error: "Enter an amount" }).positive("Enter an amount above 0").max(1_000_000_000, "That's too large");
const currency = z.enum(["PKR", "USD"]);
const email = z.email("Enter a valid email").optional().or(z.literal(""));
const phone = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+\d\s\-()]*$/, "Use digits, spaces, + or -")
  .optional()
  .or(z.literal(""));
const url = z.url("Enter a full link, e.g. https://…").optional().or(z.literal(""));

export const serviceType = z.enum(["custom_software", "ai_automation", "web_app", "whatsapp_api", "ads_management", "other"]);
export const paymentMethod = z.enum(["bank_transfer", "raast", "jazzcash", "easypaisa", "cash", "cheque", "card", "payoneer", "wise", "other"]);

/* ── Clients ───────────────────────────────────────────────────────────── */
export const clientSchema = z.object({
  business_name: requiredText("Business name"),
  contact_name: optionalText(120),
  phone,
  whatsapp: phone,
  email,
  city: optionalText(80),
  country: text(80).default("Pakistan"),
  address: optionalText(300),
  ntn: optionalText(30),
  niche: z.enum(["real_estate", "travel_visa", "clinic", "academy", "ecommerce", "other"]),
  source: z.enum(["meta_ad", "organic", "referral", "linkedin", "other"]),
  status: z.enum(["active", "paused", "former"]),
  tags: optionalText(300),
  notes: optionalText(4000),
  logo_url: optionalText(500),
});
export type ClientInput = z.input<typeof clientSchema>;

/* ── Leads ─────────────────────────────────────────────────────────────── */
export const leadStage = z.enum(["new", "contacted", "proposal_sent", "negotiation", "won", "lost"]);
export const leadSchema = z.object({
  name: requiredText("Name", 120),
  business: optionalText(160),
  phone,
  email,
  city: optionalText(80),
  source: z.enum(["meta_ad", "organic", "referral", "linkedin", "other"]),
  service_interest: serviceType.optional().or(z.literal("")),
  est_value: money,
  currency,
  stage: leadStage,
  next_follow_up: optionalDate,
  notes: optionalText(4000),
  lost_reason: optionalText(300),
});
export type LeadInput = z.input<typeof leadSchema>;

export const convertLeadSchema = z.object({
  lead_id: id,
  create_project: z.boolean(),
  title: optionalText(160),
  service_type: serviceType.optional().or(z.literal("")),
  value: money.optional(),
  currency: currency.optional(),
  deadline: optionalDate,
});

/* ── Projects ──────────────────────────────────────────────────────────── */
export const projectSchema = z
  .object({
    client_id: id,
    title: requiredText("Title", 160),
    service_type: serviceType,
    value: money,
    currency,
    start_date: optionalDate,
    deadline: optionalDate,
    status: z.enum(["planning", "in_progress", "review", "delivered", "on_hold"]),
    progress: z.coerce.number().int().min(0).max(100),
    repo: url,
    staging: url,
    live: url,
    notes: optionalText(4000),
    member_ids: z.array(z.guid()).default([]),
  })
  .refine((v) => !v.start_date || !v.deadline || v.deadline >= v.start_date, {
    path: ["deadline"],
    message: "Deadline can't be before the start date",
  });
export type ProjectInput = z.input<typeof projectSchema>;

export const taskSchema = z.object({
  project_id: id,
  title: requiredText("Task", 200),
  assignee_id: optionalId,
  due_date: optionalDate,
});

/* ── Money ─────────────────────────────────────────────────────────────── */
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Pick a time").optional().or(z.literal(""));

/** What every received or paid amount records (Pakistani reality: TID + screenshot). */
export const paymentFields = {
  paid_on: isoDate,
  time,
  method: paymentMethod,
  party_name: optionalText(120),
  reference: optionalText(120),
  receipt_url: optionalText(500),
  notes: optionalText(1000),
};

export const markPaidSchema = z.object({ id, amount: positiveMoney.optional(), ...paymentFields });

export const planSchema = z.object({
  name: requiredText("Plan name", 120),
  service_type: serviceType,
  amount: money,
  currency,
  interval_months: z.coerce.number().int().refine((v) => [1, 3, 6, 12].includes(v), "Pick a billing cycle"),
  active: z.boolean().default(true),
});

export const subscriptionSchema = z.object({
  client_id: id,
  plan_id: optionalId,
  name: requiredText("Name", 160),
  service_ref: optionalText(120),
  service_type: serviceType,
  amount: money,
  currency,
  interval_months: z.coerce.number().int().refine((v) => [1, 3, 6, 12].includes(v), "Pick a billing cycle"),
  billing_day: z.coerce.number().int().min(1, "1–31").max(31, "1–31"),
  start_date: isoDate,
  next_due_date: isoDate,
  status: z.enum(["active", "paused", "cancelled"]),
  notes: optionalText(2000),
});
export type SubscriptionInput = z.input<typeof subscriptionSchema>;

const txCategory = z.enum(["project", "subscription", "salary", "freelancer", "rent", "utilities", "software", "ads_spend", "travel", "office", "tax", "other"]);

export const transactionSchema = z
  .object({
    type: z.enum(["income", "expense"]),
    amount: positiveMoney,
    currency,
    date: isoDate,
    time,
    party_name: optionalText(120),
    category: txCategory,
    method: paymentMethod,
    reference: optionalText(120),
    description: optionalText(200),
    client_id: optionalId,
    project_id: optionalId,
    subscription_id: optionalId,
    employee_id: optionalId,
    receipt_url: optionalText(500),
    notes: optionalText(2000),
  })
  .refine(
    (v) =>
      v.type === "income"
        ? ["project", "subscription", "other"].includes(v.category)
        : ["salary", "freelancer", "rent", "utilities", "software", "ads_spend", "travel", "office", "tax", "other"].includes(v.category),
    { path: ["category"], message: "This category doesn't match the type" },
  );
export type TransactionInput = z.input<typeof transactionSchema>;

/** A payment to collect: a saved client or just a name + number. */
export const dueSchema = z
  .object({
    client_id: optionalId,
    payer_name: optionalText(120),
    payer_phone: phone,
    title: requiredText("What is it for", 200),
    amount: positiveMoney,
    currency,
    due_date: isoDate,
    project_id: optionalId,
    notes: optionalText(1000),
  })
  .refine((v) => Boolean(v.client_id) || Boolean(v.payer_name?.trim()), { path: ["payer_name"], message: "Choose a client or enter a name" });
export type DueInput = z.input<typeof dueSchema>;

export const duePaymentSchema = z.object({
  id,
  amount: positiveMoney,
  settle: z.boolean().default(false),
  ...paymentFields,
});

/** New subscription in one step (e.g. a WhatsApp API client), optionally paid now. */
export const startSubscriptionSchema = z
  .object({
    client_id: optionalId,
    new_business_name: optionalText(160),
    new_contact_name: optionalText(120),
    new_phone: phone,
    new_city: optionalText(80),
    plan_id: optionalId,
    name: requiredText("Plan name", 160),
    service_type: serviceType,
    amount: money,
    currency,
    interval_months: z.coerce.number().int().refine((v) => [1, 3, 6, 12].includes(v), "Pick a duration"),
    start_date: isoDate,
    service_ref: optionalText(120),
    notes: optionalText(1000),
    paid_now: z.boolean(),
    method: paymentMethod,
    party_name: optionalText(120),
    reference: optionalText(120),
    paid_on: optionalDate,
    time,
    receipt_url: optionalText(500),
  })
  .refine((v) => Boolean(v.client_id) || Boolean(v.new_business_name?.trim()), { path: ["new_business_name"], message: "Choose a client or enter a business name" });
export type StartSubscriptionInput = z.input<typeof startSubscriptionSchema>;

/* ── Team ──────────────────────────────────────────────────────────────── */
export const employeeSchema = z.object({
  name: requiredText("Name", 120),
  role: optionalText(120),
  email,
  phone,
  joined_on: optionalDate,
  salary: money,
  currency,
  status: z.enum(["active", "on_leave", "left"]),
  team_member_id: optionalId,
  notes: optionalText(2000),
});
export type EmployeeInput = z.input<typeof employeeSchema>;

export const salarySchema = z.object({
  employee_id: id,
  month: z.string().regex(/^\d{4}-\d{2}$/, "Pick a month"),
  amount: positiveMoney,
  ...paymentFields,
});

export const inviteSchema = z.object({
  email: z.email("Enter a Google email").transform((v) => v.trim().toLowerCase()),
  name: optionalText(120),
  role: z.enum(["owner", "manager", "staff"]),
});

/* ── Settings ──────────────────────────────────────────────────────────── */
export const companySchema = z.object({
  company_name: requiredText("Company name", 120),
  tagline: optionalText(200),
  email,
  phone,
  whatsapp_number: phone,
  website: url,
  address: optionalText(300),
  city: optionalText(80),
  country: text(80),
  logo_path: optionalText(500),
});

/** Bank / wallet details sent to clients in WhatsApp payment reminders (owner only). */
export const paymentDetailsSchema = z.object({
  bank_name: optionalText(120),
  account_title: optionalText(120),
  account_number: optionalText(60),
  iban: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{2}\d{2}[A-Z0-9]{10,30})?$/, "IBAN looks wrong (e.g. PK36SCBL0000001123456702)")
    .optional()
    .or(z.literal("")),
  jazzcash_number: phone,
  easypaisa_number: phone,
  raast_id: optionalText(60),
  payment_notes: optionalText(300),
});

export const preferencesSchema = z.object({
  default_currency: currency,
  timezone: z.string().min(1),
  notify_renewals: z.boolean(),
  notify_followups: z.boolean(),
  notify_overdue: z.boolean(),
  notify_social: z.boolean(),
});

export const profileSchema = z.object({
  name: requiredText("Name", 120),
  avatar_url: optionalText(500),
});

export const serviceSchema = z.object({
  name: requiredText("Service name", 120),
  type: serviceType,
  description: optionalText(300),
  default_price: money.optional(),
  currency,
  is_recurring: z.boolean(),
  active: z.boolean(),
});

/* ── Social ────────────────────────────────────────────────────────────── */
export const manualMetricSchema = z.object({
  social_account_id: id,
  date: isoDate,
  followers: z.coerce.number().int().min(0, "Can't be negative"),
  views: z.coerce.number().int().min(0).optional(),
});

export const metaTokenSchema = z.object({
  token: z.string().trim().min(20, "Paste the full system user token").max(2000),
});
