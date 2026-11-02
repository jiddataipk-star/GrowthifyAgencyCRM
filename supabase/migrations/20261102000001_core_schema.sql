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
create type public.due_status          as enum ('pending', 'paid', 'cancelled');
create type public.tx_type             as enum ('income', 'expense');
create type public.tx_category         as enum (
  -- income
  'project', 'subscription',
  -- expense (what a Pakistani agency actually spends on)
  'salary', 'freelancer', 'rent', 'utilities', 'software', 'ads_spend', 'travel', 'office', 'tax',
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
  whatsapp_number    text,           -- business WhatsApp shown in payment reminders
  website            text,
  address            text,
  city               text,
  country            text not null default 'Pakistan',
  -- payment details sent to clients in WhatsApp reminders (owner only)
  bank_name          text,
  account_title      text,
  account_number     text,
  iban               text,
  jazzcash_number    text,
  easypaisa_number   text,
  raast_id           text,
  payment_notes      text,
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
  service_ref     text,             -- e.g. the WhatsApp API number or Meta ad account
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

-- Dues: "who owes us what, for what, by when" — the simple receivables list
-- Pakistani clients actually work with (no formal invoice needed). Project
-- payment schedules (advance / final) are dues linked to the project.
create table public.dues (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clients (id) on delete restrict,
  payer_name    text,             -- when the payer isn't a saved client
  payer_phone   text,
  title         text not null check (length(trim(title)) > 0),   -- for what
  amount        bigint not null check (amount > 0),
  currency      public.currency_code not null default 'PKR',
  due_date      date not null default public.today_pk(),
  project_id    uuid references public.projects (id) on delete set null,
  status        public.due_status not null default 'pending',
  amount_paid   bigint not null default 0 check (amount_paid >= 0),  -- kept in sync from transactions
  adjustment    bigint not null default 0 check (adjustment >= 0),   -- discount / written off when settled
  paid_at       timestamptz,
  cancelled_at  timestamptz,
  cancel_reason text,
  notes         text,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  check (client_id is not null or length(trim(coalesce(payer_name, ''))) > 0)
);
create index dues_open_idx on public.dues (due_date) where status = 'pending';
create index dues_client_idx on public.dues (client_id);
create index dues_project_idx on public.dues (project_id, position);

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
  currency        public.currency_code not null default 'PKR',
  date            date not null default public.today_pk(),
  time            time,             -- when the money arrived (from the bank / wallet SMS)
  party_name      text,             -- name it came from (account title) or was paid to
  category        public.tx_category not null,
  method          public.payment_method not null default 'bank_transfer',
  reference       text,
  description     text,
  client_id       uuid references public.clients (id) on delete set null,
  project_id      uuid references public.projects (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  due_id          uuid references public.dues (id) on delete set null,
  employee_id     uuid references public.employees (id) on delete set null,
  salary_month    date check (salary_month is null or extract(day from salary_month) = 1),
  receipt_url     text,             -- screenshot / receipt in the private receipts bucket
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  check (
    (type = 'income'  and category in ('project', 'subscription', 'other'))
    or
    (type = 'expense' and category in ('salary', 'freelancer', 'rent', 'utilities', 'software', 'ads_spend', 'travel', 'office', 'tax', 'other'))
  )
);
create index transactions_date_idx on public.transactions (date desc);
create index transactions_type_date_idx on public.transactions (type, date desc);
create index transactions_client_idx on public.transactions (client_id);
create index transactions_project_idx on public.transactions (project_id);
create index transactions_due_idx on public.transactions (due_id);
create index transactions_subscription_idx on public.transactions (subscription_id);
create index transactions_employee_idx on public.transactions (employee_id);
-- One salary payment per employee per month.
create unique index transactions_salary_once_idx
  on public.transactions (employee_id, salary_month)
  where category = 'salary' and employee_id is not null and salary_month is not null;

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
  entity     text not null check (entity in ('client', 'project', 'transaction', 'employee')),
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
    'tasks', 'plans', 'subscriptions', 'dues', 'employees', 'transactions',
    'social_accounts', 'social_metrics_daily', 'social_posts', 'files',
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
  v_diff := v_diff - 'token_encrypted' - 'refresh_token_encrypted';

  v_label := coalesce(
    v_row ->> 'business_name', v_row ->> 'title',
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
    'subscriptions', 'dues', 'employees', 'transactions', 'social_accounts'
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

-- Payment details (bank, IBAN, wallets) are owner-only: they are sent to clients.
create or replace function public.guard_settings_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_owner() then
    return new;
  end if;
  if (new.bank_name, new.account_title, new.account_number, new.iban, new.jazzcash_number,
      new.easypaisa_number, new.raast_id, new.payment_notes)
     is distinct from
     (old.bank_name, old.account_title, old.account_number, old.iban, old.jazzcash_number,
      old.easypaisa_number, old.raast_id, old.payment_notes) then
    raise exception 'Only the owner can change payment details'
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
-- Dues: paid / pending status is derived from linked income transactions, so it
-- can never disagree with the money actually recorded.
-- -----------------------------------------------------------------------------
create or replace function public.compute_due_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    return new;
  end if;
  new.cancelled_at := null;
  new.cancel_reason := null;
  if new.amount_paid + new.adjustment >= new.amount then
    new.status := 'paid';
    new.paid_at := coalesce(new.paid_at, now());
  else
    new.status := 'pending';
    new.paid_at := null;
    new.adjustment := 0;
  end if;
  return new;
end;
$$;
create trigger compute_due_status before insert or update on public.dues
  for each row execute function public.compute_due_status();

create or replace function public.refresh_due_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := array_remove(array[
    case when tg_op <> 'DELETE' then new.due_id end,
    case when tg_op <> 'INSERT' then old.due_id end
  ], null);
begin
  update public.dues d
     set amount_paid = coalesce((
           select sum(t.amount) from public.transactions t
           where t.due_id = d.id and t.type = 'income'
         ), 0)
   where d.id = any (v_ids);
  return null;
end;
$$;
create trigger refresh_due_paid after insert or update or delete on public.transactions
  for each row execute function public.refresh_due_paid();

-- Keep linked transactions consistent with their due.
create or replace function public.check_transaction_links()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_currency public.currency_code;
  v_status   public.due_status;
begin
  if new.due_id is not null then
    select currency, status into v_currency, v_status from public.dues where id = new.due_id;
    if v_currency is distinct from new.currency then
      raise exception 'Payment currency must match the amount due (%)', v_currency using errcode = '23514';
    end if;
    if v_status = 'cancelled' and (tg_op = 'INSERT' or old.due_id is distinct from new.due_id) then
      raise exception 'This payment request was cancelled. Reopen it first.' using errcode = '23514';
    end if;
    if new.type <> 'income' then
      raise exception 'Only income can be linked to a payment request' using errcode = '23514';
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

-- =============================================================================
-- Row Level Security
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'team_members', 'settings', 'clients', 'leads', 'services', 'projects', 'project_members',
    'tasks', 'plans', 'subscriptions', 'dues', 'employees', 'transactions',
    'social_accounts', 'social_metrics_daily', 'social_posts', 'files',
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

-- money tables: owner + manager read/write, only owner deletes -------------------
do $$
declare
  t text;
begin
  foreach t in array array['plans', 'subscriptions', 'transactions', 'employees']
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

-- dues: managers can delete a request nobody has paid against yet
create policy "finance reads dues" on public.dues
  for select to authenticated using ((select public.is_finance()));
create policy "finance adds dues" on public.dues
  for insert to authenticated with check ((select public.is_finance()));
create policy "finance edits dues" on public.dues
  for update to authenticated using ((select public.is_finance())) with check ((select public.is_finance()));
create policy "delete unpaid dues" on public.dues
  for delete to authenticated using ((select public.is_owner()) or ((select public.is_finance()) and amount_paid = 0));

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
revoke execute on function public.log_activity() from public, anon, authenticated;
revoke execute on function public.refresh_due_paid() from public, anon, authenticated;
