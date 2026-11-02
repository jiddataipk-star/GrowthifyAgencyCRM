import type { Enums } from "@/types/db";

/** Human labels for every enum, in display order. */
function options<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

export const ROLE_LABELS: Record<Enums<"member_role">, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
};

export const NICHE_LABELS: Record<Enums<"client_niche">, string> = {
  real_estate: "Real estate",
  travel_visa: "Travel & visa",
  clinic: "Clinic",
  academy: "Academy",
  ecommerce: "E-commerce",
  other: "Other",
};

export const SOURCE_LABELS: Record<Enums<"acquisition_source">, string> = {
  meta_ad: "Meta ad",
  organic: "Organic",
  referral: "Referral",
  linkedin: "LinkedIn",
  other: "Other",
};

export const CLIENT_STATUS_LABELS: Record<Enums<"client_status">, string> = {
  active: "Active",
  paused: "Paused",
  former: "Former",
};

export const LEAD_STAGE_LABELS: Record<Enums<"lead_stage">, string> = {
  new: "New",
  contacted: "Contacted",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export const SERVICE_TYPE_LABELS: Record<Enums<"service_type">, string> = {
  custom_software: "Custom Software",
  ai_automation: "AI & Automation",
  web_app: "Web & App",
  whatsapp_api: "Growthify WhatsApp API",
  ads_management: "Ads Management",
  other: "Other",
};

/** Shorter labels for charts and pills. */
export const SERVICE_TYPE_SHORT: Record<Enums<"service_type">, string> = {
  custom_software: "Custom Software",
  ai_automation: "AI & Automation",
  web_app: "Web & App",
  whatsapp_api: "WhatsApp API",
  ads_management: "Ads Management",
  other: "Other",
};

export const PROJECT_STATUS_LABELS: Record<Enums<"project_status">, string> = {
  planning: "Planning",
  in_progress: "In progress",
  review: "Review",
  delivered: "Delivered",
  on_hold: "On hold",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<Enums<"subscription_status">, string> = {
  active: "Active",
  paused: "Paused",
  cancelled: "Cancelled",
};

export const INVOICE_STATUS_LABELS: Record<Enums<"invoice_status"> | "overdue", string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Partly paid",
  paid: "Paid",
  void: "Void",
  overdue: "Overdue",
};

export const TX_TYPE_LABELS: Record<Enums<"tx_type">, string> = {
  income: "Income",
  expense: "Expense",
};

export const INCOME_CATEGORIES = ["project", "subscription", "other"] as const satisfies readonly Enums<"tx_category">[];
export const EXPENSE_CATEGORIES = [
  "salary",
  "contractor",
  "hosting",
  "software",
  "ads_spend",
  "office",
  "tax",
  "other",
] as const satisfies readonly Enums<"tx_category">[];

export const CATEGORY_LABELS: Record<Enums<"tx_category">, string> = {
  project: "Project",
  subscription: "Subscription",
  salary: "Salary",
  contractor: "Freelancer / contractor",
  hosting: "Hosting & servers",
  software: "Software & API",
  ads_spend: "Ads spend",
  office: "Office",
  tax: "Tax (FBR / PRA)",
  other: "Other",
};

export const METHOD_LABELS: Record<Enums<"payment_method">, string> = {
  bank_transfer: "Bank transfer",
  raast: "Raast",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  cash: "Cash",
  cheque: "Cheque",
  card: "Card",
  payoneer: "Payoneer",
  wise: "Wise",
  other: "Other",
};

export const EMPLOYEE_STATUS_LABELS: Record<Enums<"employee_status">, string> = {
  active: "Active",
  on_leave: "On leave",
  left: "Left",
};

export const PLATFORM_LABELS: Record<Enums<"social_platform">, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  threads: "Threads",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

/** Brand tints for platform monograms (text on dark surfaces). */
export const PLATFORM_COLORS: Record<Enums<"social_platform">, string> = {
  facebook: "#7FA7FF",
  instagram: "#FF8FB1",
  youtube: "#FF6B6B",
  threads: "#E6ECE9",
  linkedin: "#6FB6FF",
  tiktok: "#5EEAD4",
};

export const SOCIAL_STATUS_LABELS: Record<Enums<"social_status">, string> = {
  not_connected: "Not connected",
  connected: "Connected",
  needs_reconnect: "Needs reconnect",
};

export const INTERVAL_LABELS: Record<number, string> = {
  1: "Monthly",
  3: "Quarterly",
  6: "Every 6 months",
  12: "Yearly",
};

export const PAKISTAN_CITIES = [
  "Faisalabad",
  "Lahore",
  "Karachi",
  "Islamabad",
  "Rawalpindi",
  "Multan",
  "Peshawar",
  "Quetta",
  "Sialkot",
  "Gujranwala",
  "Hyderabad",
  "Bahawalpur",
  "Sargodha",
  "Sahiwal",
  "Abbottabad",
  "Gujrat",
  "Sheikhupura",
  "Jhang",
  "Rahim Yar Khan",
  "Mardan",
];

export const nicheOptions = options(NICHE_LABELS);
export const sourceOptions = options(SOURCE_LABELS);
export const clientStatusOptions = options(CLIENT_STATUS_LABELS);
export const leadStageOptions = options(LEAD_STAGE_LABELS);
export const serviceTypeOptions = options(SERVICE_TYPE_LABELS);
export const projectStatusOptions = options(PROJECT_STATUS_LABELS);
export const subscriptionStatusOptions = options(SUBSCRIPTION_STATUS_LABELS);
export const methodOptions = options(METHOD_LABELS);
export const employeeStatusOptions = options(EMPLOYEE_STATUS_LABELS);
export const roleOptions = options(ROLE_LABELS);
export const currencyOptions = [
  { value: "PKR", label: "PKR — Pakistani Rupee" },
  { value: "USD", label: "USD — US Dollar" },
];
export const intervalOptions = [1, 3, 6, 12].map((months) => ({
  value: String(months),
  label: INTERVAL_LABELS[months],
}));
