-- =============================================================================
-- Growthify OS — core schema
-- Conventions
--   * Every table: id uuid PK, created_at, updated_at, created_by.
--   * Money is stored as integer minor units (paisa / cents) + currency code.
--   * Business dates are `date` values in Asia/Karachi; timestamps are timestamptz.
--   * Row Level Security is enabled on every table. Roles: owner / manager / staff.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.member_role         as enum ('owner', 'manager', 'staff');
create type public.currency_code       as enum ('PKR', 'USD');
create type public.client_status       as enum ('active', 'paused', 'former');
create type public.client_niche        as enum ('real_estate', 'travel_visa', 'clinic', 'academy', 'ecommerce', 'other');
create type public.acquisition_source  as enum ('meta_ad', 'organic', 'referral', 'linkedin', 'other');
create type public.lead_stage          as enum ('new', 'contacted', 'proposal_sent', 'negotiation', 'won', 'lost');
create type public.service_type        as enum ('custom_software', 'ai_automation', 'web_app', 'whatsapp_api', 'ads_management', 'other');
create type public.project_status      as enum ('planning', 'in_progress', 'review', 'delivered', 'on_hold');
create type public.subscription_status as enum ('active', 'paused', 'cancelled');
create type public.invoice_status      as enum ('draft', 'sent', 'partial', 'paid', 'void');
create type public.tx_type             as enum ('income', 'expense');
create type public.tx_category         as enum (
  -- income
  'project', 'subscription',
  -- expense
  'salary', 'contractor', 'hosting', 'software', 'ads_spend', 'office', 'tax',
  -- both
  'other'
);
create type public.payment_method      as enum ('bank_transfer', 'raast', 'jazzcash', 'easypaisa', 'cash', 'cheque', 'card', 'payoneer', 'wise', 'other');
create type public.employee_status     as enum ('active', 'on_leave', 'left');
create type public.social_platform     as enum ('facebook', 'instagram', 'youtube', 'threads', 'linkedin', 'tiktok');
create type public.social_status       as enum ('not_connected', 'connected', 'needs_reconnect');
create type public.social_connection   as enum ('oauth', 'system_user', 'manual');

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------

-- Today's business date in Pakistan (servers run in UTC).
create or replace function public.today_pk()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Karachi')::date
$$;

-- Add N months to a date, pinning the day to `anchor_day` but clamping to month end
-- (billing day 31 → 28/29 Feb, 30 Apr, …).
create or replace function public.add_billing_months(p_date date, p_months integer, p_anchor_day integer)
returns date
language sql
immutable
set search_path = ''
as $$
  with target as (
    select (date_trunc('month', p_date) + make_interval(months => p_months))::date as month_start
  )
  select month_start + (least(
           p_anchor_day,
           extract(day from (month_start + interval '1 month - 1 day'))::integer
         ) - 1)
  from target
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Team members (the login allowlist)
-- -----------------------------------------------------------------------------
create table public.team_members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users (id) on delete set null,
  email       text not null unique check (email = lower(email) and position('@' in email) > 1),
  name        text,
  role        public.member_role not null default 'staff',
  avatar_url  text,
  active      boolean not null default true,
  last_seen_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null
);

-- Role helpers. SECURITY DEFINER so they can read team_members regardless of RLS;
-- they only ever reveal facts about the calling user.
create or replace function public.my_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select tm.id from public.team_members tm
  where tm.user_id = auth.uid() and tm.active
$$;

create or replace function public.my_role()
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select tm.role from public.team_members tm
  where tm.user_id = auth.uid() and tm.active
$$;

create or replace function public.is_member()
returns boolean
language sql
stable
set search_path = ''
as $$ select public.my_role() is not null $$;

create or replace function public.is_owner()
returns boolean
language sql
stable
set search_path = ''
as $$ select coalesce(public.my_role() = 'owner', false) $$;

-- Owner or manager: may see money, clients, leads, settings.
create or replace function public.is_finance()
returns boolean
language sql
stable
set search_path = ''
as $$ select coalesce(public.my_role() in ('owner', 'manager'), false) $$;

-- -----------------------------------------------------------------------------
-- Company settings (single row)
-- -----------------------------------------------------------------------------
create table public.settings (
  id                 uuid primary key default gen_random_uuid(),
  singleton          boolean not null default true unique check (singleton),
  -- company profile
  company_name       text not null default 'Growthify Agency',
  tagline            text,
  logo_path          text,
  email              text,
  phone              text,
  whatsapp_number    text,           -- internal; never printed unless show_whatsapp_on_invoice
  website            text,
  address            text,
  city               text,
  country            text not null default 'Pakistan',
  -- billing (owner only)
  ntn                text,           -- FBR National Tax Number
  strn               text,           -- Sales Tax Registration Number
  bank_name          text,
  account_title      text,
  account_number     text,
  iban               text,
  wallet_details     text,           -- JazzCash / Easypaisa / Raast IDs
  payment_notes      text,
  invoice_prefix     text not null default 'GA' check (invoice_prefix ~ '^[A-Z0-9]{1,6}$'),
  default_tax_rate   numeric(5, 2) not null default 0 check (default_tax_rate between 0 and 100),
  default_due_days   integer not null default 7 check (default_due_days between 0 and 120),
  invoice_footer     text,
  show_whatsapp_on_invoice boolean not null default false,
  -- preferences
  default_currency   public.currency_code not null default 'PKR',
  timezone           text not null default 'Asia/Karachi',
  notify_renewals    boolean not null default true,
  notify_followups   boolean not null default true,
  notify_overdue     boolean not null default true,
  notify_social      boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid default auth.uid() references auth.users (id) on delete set null
);

-- -----------------------------------------------------------------------------
-- CRM
-- -----------------------------------------------------------------------------
create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  business_name text not null check (length(trim(business_name)) > 0),
  contact_name  text,
  phone         text,
  whatsapp      text,
  email         text,
  city          text,
  country       text not null default 'Pakistan',
  address       text,
  ntn           text,
  niche         public.client_niche not null default 'other',
  source        public.acquisition_source not null default 'other',
  status        public.client_status not null default 'active',
  tags          text[] not null default '{}',
  notes         text,
  logo_url      text,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null
);
create index clients_status_idx on public.clients (status) where archived_at is null;
create index clients_name_idx on public.clients (lower(business_name));

create table public.leads (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(trim(name)) > 0),
  business            text,
  phone               text,
  email               text,
  city                text,
  source              public.acquisition_source not null default 'other',
  service_interest    public.service_type,
  est_value           bigint not null default 0 check (est_value >= 0),
  currency            public.currency_code not null default 'PKR',
  stage               public.lead_stage not null default 'new',
  position            double precision not null default 0,
  next_follow_up      date,
  notes               text,
  lost_reason         text,
  converted_client_id uuid references public.clients (id) on delete set null,
  stage_changed_at    timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid default auth.uid() references auth.users (id) on delete set null
);
create index leads_stage_idx on public.leads (stage, position);
create index leads_follow_up_idx on public.leads (next_follow_up) where stage not in ('won', 'lost');

create table public.services (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  type          public.service_type not null default 'other',
  description   text,
  default_price bigint check (default_price >= 0),
  currency      public.currency_code not null default 'PKR',
  is_recurring  boolean not null default false,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null
);

create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete restrict,
  title        text not null check (length(trim(title)) > 0),
  service_type public.service_type not null default 'other',
  value        bigint not null default 0 check (value >= 0),
  currency     public.currency_code not null default 'PKR',
  start_date   date,
  deadline     date,
  status       public.project_status not null default 'planning',
  progress     integer not null default 0 check (progress between 0 and 100),
  links        jsonb not null default '{}'::jsonb check (jsonb_typeof(links) = 'object'),
  notes        text,
  delivered_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  check (deadline is null or start_date is null or deadline >= start_date)
);
create index projects_client_idx on public.projects (client_id);
create index projects_status_idx on public.projects (status);

create table public.project_members (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects (id) on delete cascade,
  team_member_id uuid not null references public.team_members (id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  unique (project_id, team_member_id)
);
create index project_members_member_idx on public.project_members (team_member_id);

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id
      and pm.team_member_id = public.my_member_id()
  )
$$;

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  title       text not null check (length(trim(title)) > 0),
  assignee_id uuid references public.team_members (id) on delete set null,
  due_date    date,
  done        boolean not null default false,
  done_at     timestamptz,
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null
);
create index tasks_project_idx on public.tasks (project_id, position);
create index tasks_assignee_idx on public.tasks (assignee_id) where not done;

-- -----------------------------------------------------------------------------
-- Money
-- -----------------------------------------------------------------------------
create table public.plans (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  service_type    public.service_type not null default 'other',
  amount          bigint not null default 0 check (amount >= 0),
  currency        public.currency_code not null default 'PKR',
  interval        text not null default 'month' check (interval = 'month'),
  interval_months integer not null default 1 check (interval_months in (1, 3, 6, 12)),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid() references auth.users (id) on delete set null
);

create table public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients (id) on delete restrict,
  plan_id         uuid references public.plans (id) on delete restrict,
  name            text not null check (length(trim(name)) > 0),
  service_type    public.service_type not null default 'other',
  amount          bigint not null check (amount >= 0),
  currency        public.currency_code not null default 'PKR',
  interval_months integer not null default 1 check (interval_months in (1, 3, 6, 12)),
  billing_day     integer not null check (billing_day between 1 and 31),
  start_date      date not null,
  next_due_date   date not null,
  status          public.subscription_status not null default 'active',
  notes           text,
  cancelled_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid() references auth.users (id) on delete set null
);
create index subscriptions_client_idx on public.subscriptions (client_id);
create index subscriptions_due_idx on public.subscriptions (next_due_date) where status = 'active';

create table public.invoices (
  id           uuid primary key default gen_random_uuid(),
  number       text not null unique,
  client_id    uuid not null references public.clients (id) on delete restrict,
  project_id   uuid references public.projects (id) on delete set null,
  issue_date   date not null default public.today_pk(),
  due_date     date not null,
  status       public.invoice_status not null default 'draft',
  currency     public.currency_code not null default 'PKR',
  subtotal     bigint not null default 0 check (subtotal >= 0),
  discount     bigint not null default 0 check (discount >= 0),
  tax_rate     numeric(5, 2) not null default 0 check (tax_rate between 0 and 100),
  tax          bigint not null default 0 check (tax >= 0),
  total        bigint not null default 0 check (total >= 0),
  amount_paid  bigint not null default 0 check (amount_paid >= 0),
  notes        text,
  pdf_url      text,
  share_token  uuid not null default gen_random_uuid() unique,
  sent_at      timestamptz,
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  check (due_date >= issue_date),
  check (discount <= subtotal)
);
create index invoices_client_idx on public.invoices (client_id);
create index invoices_open_idx on public.invoices (due_date) where status in ('sent', 'partial');

create table public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices (id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  qty         numeric(12, 2) not null default 1 check (qty > 0),
  unit_price  bigint not null check (unit_price >= 0),
  amount      bigint not null default 0,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null
);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id, position);

create table public.employees (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) > 0),
  role           text,
  email          text,
  phone          text,
  joined_on      date,
  salary         bigint not null default 0 check (salary >= 0),
  currency       public.currency_code not null default 'PKR',
  status         public.employee_status not null default 'active',
  team_member_id uuid unique references public.team_members (id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid default auth.uid() references auth.users (id) on delete set null
);

create table public.transactions (
  id              uuid primary key default gen_random_uuid(),
  type            public.tx_type not null,
  amount          bigint not null check (amount > 0),
  tax_withheld    bigint not null default 0 check (tax_withheld >= 0),
  currency        public.currency_code not null default 'PKR',
  date            date not null default public.today_pk(),
  category        public.tx_category not null,
  method          public.payment_method not null default 'bank_transfer',
  reference       text,
  description     text,
  client_id       uuid references public.clients (id) on delete set null,
  project_id      uuid references public.projects (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  invoice_id      uuid references public.invoices (id) on delete set null,
  employee_id     uuid references public.employees (id) on delete set null,
  salary_month    date check (salary_month is null or extract(day from salary_month) = 1),
  receipt_url     text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  check (
    (type = 'income'  and category in ('project', 'subscription', 'other'))
    or
    (type = 'expense' and category in ('salary', 'contractor', 'hosting', 'software', 'ads_spend', 'office', 'tax', 'other'))
  ),
  check (type = 'income' or tax_withheld = 0)
);
create index transactions_date_idx on public.transactions (date desc);
create index transactions_type_date_idx on public.transactions (type, date desc);
create index transactions_client_idx on public.transactions (client_id);
create index transactions_project_idx on public.transactions (project_id);
create index transactions_invoice_idx on public.transactions (invoice_id);
create index transactions_subscription_idx on public.transactions (subscription_id);
create index transactions_employee_idx on public.transactions (employee_id);
-- One salary payment per employee per month.
create unique index transactions_salary_once_idx
  on public.transactions (employee_id, salary_month)
  where category = 'salary' and employee_id is not null and salary_month is not null;

create table public.milestones (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  amount      bigint not null default 0 check (amount >= 0),
  due_date    date,
  paid        boolean not null default false,
  paid_tx_id  uuid references public.transactions (id) on delete set null,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null
);
create index milestones_project_idx on public.milestones (project_id, position);

-- -----------------------------------------------------------------------------
-- Social
-- -----------------------------------------------------------------------------
create table public.social_accounts (
  id                      uuid primary key default gen_random_uuid(),
  platform                public.social_platform not null,
  connection              public.social_connection not null default 'oauth',
  external_id             text,
  name                    text,
  handle                  text,
  profile_url             text,
  avatar_url              text,
  token_encrypted         text,
  refresh_token_encrypted text,
  token_expires_at        timestamptz,
  scopes                  text[] not null default '{}',
  meta                    jsonb not null default '{}'::jsonb,
  status                  public.social_status not null default 'not_connected',
  last_synced_at          timestamptz,
  last_error              text,
  connected_by            uuid references auth.users (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid default auth.uid() references auth.users (id) on delete set null,
  unique (platform, handle)
);

create table public.social_metrics_daily (
  id                uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  date              date not null,
  followers         integer check (followers >= 0),
  reach             integer check (reach >= 0),
  views             integer check (views >= 0),
  engagement        integer check (engagement >= 0),
  extra             jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid default auth.uid() references auth.users (id) on delete set null,
  unique (social_account_id, date)
);

create table public.social_posts (
  id                uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  external_id       text not null,
  title             text,
  url               text,
  thumbnail_url     text,
  published_at      timestamptz,
  views             integer,
  likes             integer,
  comments          integer,
  shares            integer,
  engagement        integer,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid default auth.uid() references auth.users (id) on delete set null,
  unique (social_account_id, external_id)
);
create index social_posts_published_idx on public.social_posts (social_account_id, published_at desc);

-- -----------------------------------------------------------------------------
-- Files, activity log, demo bookkeeping
-- -----------------------------------------------------------------------------
create table public.files (
  id         uuid primary key default gen_random_uuid(),
  entity     text not null check (entity in ('client', 'project', 'invoice', 'transaction', 'employee')),
  entity_id  uuid not null,
  bucket     text not null default 'files',
  path       text not null unique,
  name       text not null,
  size       bigint not null default 0,
  mime_type  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index files_entity_idx on public.files (entity, entity_id);

create table public.activity_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references auth.users (id) on delete set null,
  entity     text not null,
  entity_id  uuid not null,
  action     text not null check (action in ('create', 'update', 'delete')),
  label      text,
  diff       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index activity_log_entity_idx on public.activity_log (entity, entity_id, created_at desc);
create index activity_log_created_idx on public.activity_log (created_at desc);

create table public.demo_records (
  id         uuid primary key default gen_random_uuid(),
  entity     text not null,
  entity_id  uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (entity, entity_id)
);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'team_members', 'settings', 'clients', 'leads', 'services', 'projects', 'project_members',
    'tasks', 'plans', 'subscriptions', 'invoices', 'invoice_items', 'employees', 'transactions',
    'milestones', 'social_accounts', 'social_metrics_daily', 'social_posts', 'files',
    'activity_log', 'demo_records'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Activity log trigger: who created / edited / deleted what, and when.
-- -----------------------------------------------------------------------------
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row   jsonb;
  v_diff  jsonb;
  v_label text;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
    v_diff := v_row;
  elsif tg_op = 'INSERT' then
    v_row := to_jsonb(new);
    v_diff := v_row;
  else
    v_row := to_jsonb(new);
    select jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value))
      into v_diff
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value
       and n.key not in ('updated_at', 'last_seen_at');
    if v_diff is null then
      return new;
    end if;
  end if;

  -- Never copy secrets into the log.
  v_diff := v_diff - 'token_encrypted' - 'refresh_token_encrypted' - 'share_token';

  v_label := coalesce(
    v_row ->> 'business_name', v_row ->> 'title', v_row ->> 'number',
    v_row ->> 'name', v_row ->> 'company_name', v_row ->> 'description',
    v_row ->> 'email', v_row ->> 'platform'
  );

  insert into public.activity_log (actor_id, entity, entity_id, action, label, diff, created_by)
  values (
    auth.uid(),
    tg_table_name,
    (v_row ->> 'id')::uuid,
    case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end,
    left(v_label, 200),
    coalesce(v_diff, '{}'::jsonb),
    auth.uid()
  );

  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'team_members', 'settings', 'clients', 'leads', 'services', 'projects', 'plans',
    'subscriptions', 'invoices', 'employees', 'transactions', 'milestones', 'social_accounts'
  ]
  loop
    execute format(
      'create trigger log_activity after insert or update or delete on public.%I
         for each row execute function public.log_activity()', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Column guards that RLS alone cannot express
-- -----------------------------------------------------------------------------

-- Only owners may change roles, activation, emails or user links.
create or replace function public.guard_team_member_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_owner() then
    return new;
  end if;
  -- First sign-in: claim_membership() links the caller's own auth user to the row.
  -- (RLS hides unclaimed rows from direct updates, so this path is only reachable there.)
  if old.user_id is null and new.user_id = auth.uid()
     and new.role = old.role and new.active = old.active and new.email = old.email then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.active is distinct from old.active
     or new.email is distinct from old.email
     or new.user_id is distinct from old.user_id then
    raise exception 'Only the owner can change roles, access or emails'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_team_member_update before update on public.team_members
  for each row execute function public.guard_team_member_update();

-- Prevent the last active owner from being demoted, deactivated or removed.
create or replace function public.guard_last_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'owner' and old.active
     and (tg_op = 'DELETE' or new.role <> 'owner' or not new.active)
     and not exists (
       select 1 from public.team_members
       where role = 'owner' and active and id <> old.id
     ) then
    raise exception 'There must always be at least one active owner'
      using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger guard_last_owner before update or delete on public.team_members
  for each row execute function public.guard_last_owner();

-- Billing settings (bank details, tax numbers, invoice config) are owner-only.
create or replace function public.guard_settings_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_owner() then
    return new;
  end if;
  if (new.ntn, new.strn, new.bank_name, new.account_title, new.account_number, new.iban,
      new.wallet_details, new.payment_notes, new.invoice_prefix, new.default_tax_rate,
      new.default_due_days, new.invoice_footer, new.show_whatsapp_on_invoice)
     is distinct from
     (old.ntn, old.strn, old.bank_name, old.account_title, old.account_number, old.iban,
      old.wallet_details, old.payment_notes, old.invoice_prefix, old.default_tax_rate,
      old.default_due_days, old.invoice_footer, old.show_whatsapp_on_invoice) then
    raise exception 'Only the owner can change billing settings'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_settings_update before update on public.settings
  for each row execute function public.guard_settings_update();

-- Staff may update delivery fields of their projects, never commercial fields.
create or replace function public.guard_project_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_finance() then
    return new;
  end if;
  if (new.client_id, new.title, new.service_type, new.value, new.currency, new.start_date, new.deadline)
     is distinct from
     (old.client_id, old.title, old.service_type, old.value, old.currency, old.start_date, old.deadline) then
    raise exception 'Staff can only update status, progress, links and notes'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_project_update before update on public.projects
  for each row execute function public.guard_project_update();

create or replace function public.stamp_project_delivery()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'delivered' and (tg_op = 'INSERT' or old.status is distinct from 'delivered') then
    new.delivered_at := now();
    new.progress := 100;
  elsif new.status <> 'delivered' then
    new.delivered_at := null;
  end if;
  return new;
end;
$$;
create trigger stamp_project_delivery before insert or update of status on public.projects
  for each row execute function public.stamp_project_delivery();

create or replace function public.stamp_task_done()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.done_at := now();
  elsif not new.done then
    new.done_at := null;
  end if;
  return new;
end;
$$;
create trigger stamp_task_done before insert or update of done on public.tasks
  for each row execute function public.stamp_task_done();

create or replace function public.stamp_lead_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  end if;
  return new;
end;
$$;
create trigger stamp_lead_stage before update of stage on public.leads
  for each row execute function public.stamp_lead_stage();

create or replace function public.stamp_subscription_cancel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := now();
  elsif new.status <> 'cancelled' then
    new.cancelled_at := null;
  end if;
  return new;
end;
$$;
create trigger stamp_subscription_cancel before update of status on public.subscriptions
  for each row execute function public.stamp_subscription_cancel();

-- -----------------------------------------------------------------------------
-- Invoices: numbering, totals and payment status are maintained by the database
-- so they can never drift from the line items and linked transactions.
-- -----------------------------------------------------------------------------
create table public.invoice_counters (
  year       integer primary key,
  last_value integer not null default 0
);
alter table public.invoice_counters enable row level security;
-- No policies: only reachable through next_invoice_number().

create or replace function public.next_invoice_number(p_date date default public.today_pk())
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year   integer := extract(year from p_date)::integer;
  v_value  integer;
  v_prefix text;
begin
  if not public.is_finance() and auth.uid() is not null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select coalesce(s.invoice_prefix, 'GA') into v_prefix from public.settings s limit 1;
  insert into public.invoice_counters as c (year, last_value)
  values (v_year, 1)
  on conflict (year) do update set last_value = c.last_value + 1
  returning c.last_value into v_value;
  return format('%s-%s-%s', coalesce(v_prefix, 'GA'), v_year, lpad(v_value::text, 4, '0'));
end;
$$;

create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.number is null or new.number = '' then
    new.number := public.next_invoice_number(new.issue_date);
  end if;
  return new;
end;
$$;
create trigger assign_invoice_number before insert on public.invoices
  for each row execute function public.assign_invoice_number();

create or replace function public.compute_invoice_totals()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.discount := least(new.discount, new.subtotal);
  new.tax := round((new.subtotal - new.discount) * new.tax_rate / 100.0)::bigint;
  new.total := new.subtotal - new.discount + new.tax;

  if new.status <> 'void' then
    if new.total > 0 and new.amount_paid >= new.total then
      new.status := 'paid';
      new.paid_at := coalesce(new.paid_at, now());
    elsif new.amount_paid > 0 then
      new.status := 'partial';
      new.paid_at := null;
    elsif new.status in ('paid', 'partial') then
      new.status := 'sent';
      new.paid_at := null;
    end if;
  end if;

  if new.status = 'sent' and new.sent_at is null then
    new.sent_at := now();
  end if;
  return new;
end;
$$;
create trigger compute_invoice_totals before insert or update on public.invoices
  for each row execute function public.compute_invoice_totals();

create or replace function public.compute_item_amount()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.amount := round(new.qty * new.unit_price)::bigint;
  return new;
end;
$$;
create trigger compute_item_amount before insert or update on public.invoice_items
  for each row execute function public.compute_item_amount();

create or replace function public.refresh_invoice_subtotal()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update public.invoices i
     set subtotal = coalesce((select sum(it.amount) from public.invoice_items it where it.invoice_id = v_invoice), 0)
   where i.id = v_invoice;
  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then
    update public.invoices i
       set subtotal = coalesce((select sum(it.amount) from public.invoice_items it where it.invoice_id = old.invoice_id), 0)
     where i.id = old.invoice_id;
  end if;
  return null;
end;
$$;
create trigger refresh_invoice_subtotal after insert or update or delete on public.invoice_items
  for each row execute function public.refresh_invoice_subtotal();

-- Payments recorded against an invoice (cash received + tax withheld at source).
create or replace function public.refresh_invoice_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := array_remove(array[
    case when tg_op <> 'DELETE' then new.invoice_id end,
    case when tg_op <> 'INSERT' then old.invoice_id end
  ], null);
begin
  update public.invoices i
     set amount_paid = coalesce((
           select sum(t.amount + t.tax_withheld)
           from public.transactions t
           where t.invoice_id = i.id and t.type = 'income'
         ), 0)
   where i.id = any (v_ids);
  return null;
end;
$$;
create trigger refresh_invoice_paid after insert or update or delete on public.transactions
  for each row execute function public.refresh_invoice_paid();

-- Keep linked transactions consistent with their invoice / subscription currency.
create or replace function public.check_transaction_links()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_currency public.currency_code;
  v_status   public.invoice_status;
begin
  if new.invoice_id is not null then
    select currency, status into v_currency, v_status from public.invoices where id = new.invoice_id;
    if v_currency is distinct from new.currency then
      raise exception 'Payment currency must match the invoice currency (%)', v_currency using errcode = '23514';
    end if;
    if v_status = 'void' then
      raise exception 'Cannot record a payment on a void invoice' using errcode = '23514';
    end if;
  end if;
  if new.salary_month is not null and new.category <> 'salary' then
    raise exception 'salary_month is only valid for salary payments' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger check_transaction_links before insert or update on public.transactions
  for each row execute function public.check_transaction_links();

-- If a milestone's transaction is deleted, the milestone becomes unpaid again.
create or replace function public.unpay_milestone_on_tx_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.milestones set paid = false, paid_tx_id = null where paid_tx_id = old.id;
  return old;
end;
$$;
create trigger unpay_milestone_on_tx_delete before delete on public.transactions
  for each row execute function public.unpay_milestone_on_tx_delete();

-- =============================================================================
-- Row Level Security
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'team_members', 'settings', 'clients', 'leads', 'services', 'projects', 'project_members',
    'tasks', 'plans', 'subscriptions', 'invoices', 'invoice_items', 'employees', 'transactions',
    'milestones', 'social_accounts', 'social_metrics_daily', 'social_posts', 'files',
    'activity_log', 'demo_records'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    -- The anonymous role never touches app data.
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

-- team_members ---------------------------------------------------------------
create policy "members read team" on public.team_members
  for select to authenticated using ((select public.is_member()));
create policy "owner adds members" on public.team_members
  for insert to authenticated with check ((select public.is_owner()));
create policy "owner or self updates member" on public.team_members
  for update to authenticated
  using ((select public.is_owner()) or user_id = (select auth.uid()))
  with check ((select public.is_owner()) or user_id = (select auth.uid()));
create policy "owner removes members" on public.team_members
  for delete to authenticated using ((select public.is_owner()));

-- settings ---------------------------------------------------------------------
create policy "members read settings" on public.settings
  for select to authenticated using ((select public.is_member()));
create policy "finance updates settings" on public.settings
  for update to authenticated using ((select public.is_finance())) with check ((select public.is_finance()));

-- clients ----------------------------------------------------------------------
create policy "read clients" on public.clients
  for select to authenticated using (
    (select public.is_finance())
    or exists (
      select 1 from public.projects p
      where p.client_id = clients.id and public.is_project_member(p.id)
    )
  );
create policy "finance adds clients" on public.clients
  for insert to authenticated with check ((select public.is_finance()));
create policy "finance edits clients" on public.clients
  for update to authenticated using ((select public.is_finance())) with check ((select public.is_finance()));
create policy "owner deletes clients" on public.clients
  for delete to authenticated using ((select public.is_owner()));

-- leads ------------------------------------------------------------------------
create policy "finance manages leads" on public.leads
  for all to authenticated using ((select public.is_finance())) with check ((select public.is_finance()));

-- services ---------------------------------------------------------------------
create policy "members read services" on public.services
  for select to authenticated using ((select public.is_member()));
create policy "finance adds services" on public.services
  for insert to authenticated with check ((select public.is_finance()));
create policy "finance edits services" on public.services
  for update to authenticated using ((select public.is_finance())) with check ((select public.is_finance()));
create policy "owner deletes services" on public.services
  for delete to authenticated using ((select public.is_owner()));

-- projects ---------------------------------------------------------------------
create policy "read projects" on public.projects
  for select to authenticated using ((select public.is_finance()) or public.is_project_member(id));
create policy "finance adds projects" on public.projects
  for insert to authenticated with check ((select public.is_finance()));
create policy "finance or members edit projects" on public.projects
  for update to authenticated
  using ((select public.is_finance()) or public.is_project_member(id))
  with check ((select public.is_finance()) or public.is_project_member(id));
create policy "owner deletes projects" on public.projects
  for delete to authenticated using ((select public.is_owner()));

-- project_members --------------------------------------------------------------
create policy "read project members" on public.project_members
  for select to authenticated using ((select public.is_finance()) or public.is_project_member(project_id));
create policy "finance assigns members" on public.project_members
  for insert to authenticated with check ((select public.is_finance()));
create policy "finance unassigns members" on public.project_members
  for delete to authenticated using ((select public.is_finance()));

-- tasks ------------------------------------------------------------------------
create policy "read tasks" on public.tasks
  for select to authenticated using ((select public.is_finance()) or public.is_project_member(project_id));
create policy "add tasks" on public.tasks
  for insert to authenticated with check ((select public.is_finance()) or public.is_project_member(project_id));
create policy "edit tasks" on public.tasks
  for update to authenticated
  using ((select public.is_finance()) or public.is_project_member(project_id))
  with check ((select public.is_finance()) or public.is_project_member(project_id));
create policy "delete tasks" on public.tasks
  for delete to authenticated using (
    (select public.is_finance())
    or (created_by = (select auth.uid()) and public.is_project_member(project_id))
  );

-- milestones -------------------------------------------------------------------
create policy "finance reads milestones" on public.milestones
  for select to authenticated using ((select public.is_finance()));
create policy "finance adds milestones" on public.milestones
  for insert to authenticated with check ((select public.is_finance()));
create policy "finance edits milestones" on public.milestones
  for update to authenticated using ((select public.is_finance())) with check ((select public.is_finance()));
create policy "delete milestones" on public.milestones
  for delete to authenticated using ((select public.is_owner()) or ((select public.is_finance()) and not paid));

-- money tables: owner + manager read/write, only owner deletes -------------------
do $$
declare
  t text;
begin
  foreach t in array array['plans', 'subscriptions', 'invoices', 'transactions', 'employees']
  loop
    execute format('create policy "finance reads %1$s" on public.%1$I
                      for select to authenticated using ((select public.is_finance()))', t);
    execute format('create policy "finance adds %1$s" on public.%1$I
                      for insert to authenticated with check ((select public.is_finance()))', t);
    execute format('create policy "finance edits %1$s" on public.%1$I
                      for update to authenticated using ((select public.is_finance()))
                      with check ((select public.is_finance()))', t);
    execute format('create policy "owner deletes %1$s" on public.%1$I
                      for delete to authenticated using ((select public.is_owner()))', t);
  end loop;
end;
$$;

-- Draft invoices can be discarded by managers too (nothing financial has happened yet).
create policy "finance deletes draft invoices" on public.invoices
  for delete to authenticated using ((select public.is_finance()) and status = 'draft' and amount_paid = 0);

-- Line items are editable only while nothing has been paid against the invoice.
create or replace function public.invoice_is_editable(p_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invoices i
    where i.id = p_invoice_id and i.status in ('draft', 'sent') and i.amount_paid = 0
  )
$$;

create policy "finance reads invoice items" on public.invoice_items
  for select to authenticated using ((select public.is_finance()));
create policy "finance adds invoice items" on public.invoice_items
  for insert to authenticated
  with check ((select public.is_finance()) and public.invoice_is_editable(invoice_id));
create policy "finance edits invoice items" on public.invoice_items
  for update to authenticated
  using ((select public.is_finance()) and public.invoice_is_editable(invoice_id))
  with check ((select public.is_finance()) and public.invoice_is_editable(invoice_id));
create policy "finance removes invoice items" on public.invoice_items
  for delete to authenticated
  using ((select public.is_finance()) and public.invoice_is_editable(invoice_id));

-- social -----------------------------------------------------------------------
create policy "finance reads social accounts" on public.social_accounts
  for select to authenticated using ((select public.is_finance()));
create policy "finance adds social accounts" on public.social_accounts
  for insert to authenticated with check ((select public.is_finance()));
create policy "finance edits social accounts" on public.social_accounts
  for update to authenticated using ((select public.is_finance())) with check ((select public.is_finance()));
create policy "owner deletes social accounts" on public.social_accounts
  for delete to authenticated using ((select public.is_owner()));

-- OAuth tokens never leave the server: hide the token columns from API roles.
revoke select, insert, update on public.social_accounts from authenticated;
grant select (id, platform, connection, external_id, name, handle, profile_url, avatar_url,
              token_expires_at, scopes, meta, status, last_synced_at, last_error, connected_by,
              created_at, updated_at, created_by)
  on public.social_accounts to authenticated;
grant insert (platform, connection, name, handle, profile_url, avatar_url, status)
  on public.social_accounts to authenticated;
grant update (name, handle, profile_url, avatar_url, status)
  on public.social_accounts to authenticated;

create policy "finance reads metrics" on public.social_metrics_daily
  for select to authenticated using ((select public.is_finance()));
create policy "finance adds metrics" on public.social_metrics_daily
  for insert to authenticated with check ((select public.is_finance()));
create policy "finance edits metrics" on public.social_metrics_daily
  for update to authenticated using ((select public.is_finance())) with check ((select public.is_finance()));
create policy "owner deletes metrics" on public.social_metrics_daily
  for delete to authenticated using ((select public.is_owner()));

create policy "finance reads posts" on public.social_posts
  for select to authenticated using ((select public.is_finance()));

-- files ------------------------------------------------------------------------
create policy "read files" on public.files
  for select to authenticated using (
    (select public.is_finance())
    or (entity = 'project' and public.is_project_member(entity_id))
  );
create policy "add files" on public.files
  for insert to authenticated with check (
    (select public.is_finance())
    or (entity = 'project' and public.is_project_member(entity_id))
  );
create policy "delete files" on public.files
  for delete to authenticated using (
    (select public.is_finance()) or created_by = (select auth.uid())
  );

-- activity log: readable by owner + manager, written only by triggers ----------
create policy "finance reads activity" on public.activity_log
  for select to authenticated using ((select public.is_finance()));
revoke insert, update, delete on public.activity_log from authenticated;

-- demo bookkeeping: owner only -------------------------------------------------
create policy "owner reads demo records" on public.demo_records
  for select to authenticated using ((select public.is_owner()));

-- Lock down helper functions that must not be callable anonymously.
revoke execute on function public.next_invoice_number(date) from public, anon;
revoke all on public.invoice_counters from anon, authenticated;
revoke execute on function public.log_activity() from public, anon, authenticated;
revoke execute on function public.refresh_invoice_paid() from public, anon, authenticated;
revoke execute on function public.unpay_milestone_on_tx_delete() from public, anon, authenticated;
