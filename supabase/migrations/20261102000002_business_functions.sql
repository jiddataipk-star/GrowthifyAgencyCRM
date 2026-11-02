-- =============================================================================
-- Growthify OS — business operations and reporting
-- All operations are SECURITY INVOKER unless stated, so Row Level Security
-- still decides who may do what. Multi-step money operations run in a single
-- transaction so the books can never be half-written.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Login: link the Google identity to an allowlisted team member.
-- Returns the member's role, or NULL when the email is not on the allowlist.
-- -----------------------------------------------------------------------------
create or replace function public.claim_membership()
returns public.member_role
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_email    text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_provider text := coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '');
  v_meta     jsonb := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb);
  v_role     public.member_role;
begin
  if v_uid is null or v_email = '' then
    return null;
  end if;
  -- Only Google sign-ins may claim an allowlisted email.
  if v_provider <> 'google' then
    return null;
  end if;

  update public.team_members tm
     set user_id      = v_uid,
         name         = coalesce(tm.name, nullif(v_meta ->> 'full_name', ''), nullif(v_meta ->> 'name', '')),
         avatar_url   = coalesce(tm.avatar_url, nullif(v_meta ->> 'avatar_url', '')),
         last_seen_at = now()
   where tm.email = v_email
     and tm.active
     and (tm.user_id is null or tm.user_id = v_uid)
  returning tm.role into v_role;

  return v_role;
end;
$$;
revoke execute on function public.claim_membership() from public, anon;
grant execute on function public.claim_membership() to authenticated;

-- -----------------------------------------------------------------------------
-- Security tab: list and revoke the caller's own sessions.
-- -----------------------------------------------------------------------------
create or replace function public.my_sessions()
returns table (id uuid, created_at timestamptz, updated_at timestamptz, user_agent text, ip text, current boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.created_at, coalesce(s.refreshed_at::timestamptz, s.updated_at), s.user_agent, host(s.ip),
         s.id::text = (auth.jwt() ->> 'session_id')
  from auth.sessions s
  where s.user_id = auth.uid()
  order by coalesce(s.refreshed_at::timestamptz, s.updated_at) desc nulls last
$$;
revoke execute on function public.my_sessions() from public, anon;
grant execute on function public.my_sessions() to authenticated;

create or replace function public.revoke_my_session(p_session_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.sessions s where s.id = p_session_id and s.user_id = auth.uid()
$$;
revoke execute on function public.revoke_my_session(uuid) from public, anon;
grant execute on function public.revoke_my_session(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- Shared payment fields. Every money movement records: amount, date, time,
-- method (bank / Raast / JazzCash / Easypaisa / cash / cheque …), the name it
-- came from (account title in the SMS), reference / TID and an optional screenshot.
-- -----------------------------------------------------------------------------

-- Subscriptions are prepaid in Pakistan: "Mark paid" records the income and
-- moves the renewal date forward by one cycle (1, 3, 6 or 12 months).
create or replace function public.mark_subscription_paid(
  p_subscription_id uuid,
  p_paid_on         date default null,
  p_method          public.payment_method default 'bank_transfer',
  p_reference       text default null,
  p_receipt_url     text default null,
  p_amount          bigint default null,
  p_notes           text default null,
  p_time            time default null,
  p_party_name      text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_sub    public.subscriptions;
  v_client text;
  v_tx     uuid;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception 'Subscription not found' using errcode = 'P0002';
  end if;
  if v_sub.status = 'cancelled' then
    raise exception 'This subscription is cancelled' using errcode = '23514';
  end if;
  select business_name into v_client from public.clients where id = v_sub.client_id;

  insert into public.transactions (
    type, amount, currency, date, time, category, method, reference, party_name, description,
    client_id, subscription_id, receipt_url, notes
  ) values (
    'income', coalesce(p_amount, v_sub.amount), v_sub.currency, coalesce(p_paid_on, public.today_pk()), p_time,
    'subscription', p_method, nullif(trim(p_reference), ''), coalesce(nullif(trim(p_party_name), ''), v_client),
    v_sub.name || ' · ' || to_char(v_sub.next_due_date, 'DD Mon YYYY') || ' → '
      || to_char(public.add_billing_months(v_sub.next_due_date, v_sub.interval_months, v_sub.billing_day), 'DD Mon YYYY'),
    v_sub.client_id, v_sub.id, p_receipt_url, nullif(trim(p_notes), '')
  )
  returning id into v_tx;

  update public.subscriptions
     set next_due_date = public.add_billing_months(v_sub.next_due_date, v_sub.interval_months, v_sub.billing_day),
         status = 'active'
   where id = v_sub.id;

  return v_tx;
end;
$$;

-- Start a subscription (e.g. a WhatsApp API client) in one step: optionally
-- create the client, create the subscription and record the first payment.
-- p_data keys: client_id | new_client{business_name, contact_name, phone, city},
--   plan_id, name, service_type, amount (minor), currency, interval_months,
--   start_date, service_ref, notes, paid_now (bool), payment{method, reference,
--   party_name, paid_on, time, receipt_url}
create or replace function public.start_subscription(p_data jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_client  uuid := nullif(p_data ->> 'client_id', '')::uuid;
  v_new     jsonb := p_data -> 'new_client';
  v_start   date := coalesce(nullif(p_data ->> 'start_date', '')::date, public.today_pk());
  v_sub     uuid;
  v_payment jsonb := coalesce(p_data -> 'payment', '{}'::jsonb);
begin
  if v_client is null then
    if v_new is null or length(trim(coalesce(v_new ->> 'business_name', ''))) = 0 then
      raise exception 'Choose a client or enter a business name' using errcode = '23514';
    end if;
    insert into public.clients (business_name, contact_name, phone, whatsapp, city, source, status)
    values (
      trim(v_new ->> 'business_name'),
      nullif(trim(v_new ->> 'contact_name'), ''),
      nullif(trim(v_new ->> 'phone'), ''),
      nullif(trim(v_new ->> 'phone'), ''),
      nullif(trim(v_new ->> 'city'), ''),
      coalesce(nullif(v_new ->> 'source', ''), 'other')::public.acquisition_source,
      'active'
    )
    returning id into v_client;
  end if;

  insert into public.subscriptions (
    client_id, plan_id, name, service_type, amount, currency, interval_months, billing_day,
    start_date, next_due_date, service_ref, status, notes
  ) values (
    v_client,
    nullif(p_data ->> 'plan_id', '')::uuid,
    trim(p_data ->> 'name'),
    coalesce(nullif(p_data ->> 'service_type', ''), 'other')::public.service_type,
    (p_data ->> 'amount')::bigint,
    coalesce(nullif(p_data ->> 'currency', ''), 'PKR')::public.currency_code,
    coalesce((p_data ->> 'interval_months')::integer, 1),
    extract(day from v_start)::integer,
    v_start,
    v_start,
    nullif(trim(p_data ->> 'service_ref'), ''),
    'active',
    nullif(trim(p_data ->> 'notes'), '')
  )
  returning id into v_sub;

  if coalesce((p_data ->> 'paid_now')::boolean, false) then
    perform public.mark_subscription_paid(
      v_sub,
      coalesce(nullif(v_payment ->> 'paid_on', '')::date, v_start),
      coalesce(nullif(v_payment ->> 'method', ''), 'bank_transfer')::public.payment_method,
      v_payment ->> 'reference',
      nullif(v_payment ->> 'receipt_url', ''),
      null,
      null,
      nullif(v_payment ->> 'time', '')::time,
      v_payment ->> 'party_name'
    );
  end if;
  return v_sub;
end;
$$;

-- Record money received against a due (full or part). p_settle closes the due
-- even if less was paid (discount / "thora kam kar diya"); the difference is kept
-- as an adjustment so the books stay honest.
create or replace function public.record_due_payment(
  p_due_id      uuid,
  p_amount      bigint,
  p_paid_on     date default null,
  p_method      public.payment_method default 'bank_transfer',
  p_reference   text default null,
  p_receipt_url text default null,
  p_notes       text default null,
  p_time        time default null,
  p_party_name  text default null,
  p_settle      boolean default false
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_due    public.dues;
  v_client text;
  v_tx     uuid;
begin
  select * into v_due from public.dues where id = p_due_id for update;
  if not found then
    raise exception 'Payment request not found' using errcode = 'P0002';
  end if;
  if v_due.status = 'cancelled' then
    raise exception 'This payment request was cancelled. Reopen it first.' using errcode = '23514';
  end if;
  if v_due.status = 'paid' then
    raise exception 'This is already fully paid' using errcode = '23505';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '23514';
  end if;
  select business_name into v_client from public.clients where id = v_due.client_id;

  insert into public.transactions (
    type, amount, currency, date, time, category, method, reference, party_name, description,
    client_id, project_id, due_id, receipt_url, notes
  ) values (
    'income', p_amount, v_due.currency, coalesce(p_paid_on, public.today_pk()), p_time,
    case when v_due.project_id is not null then 'project' else 'other' end::public.tx_category,
    p_method, nullif(trim(p_reference), ''),
    coalesce(nullif(trim(p_party_name), ''), v_client, v_due.payer_name),
    v_due.title, v_due.client_id, v_due.project_id, v_due.id, p_receipt_url, nullif(trim(p_notes), '')
  )
  returning id into v_tx;

  if p_settle then
    update public.dues d
       set adjustment = greatest(d.amount - d.amount_paid, 0)
     where d.id = v_due.id;
  end if;
  return v_tx;
end;
$$;

-- Team: pay a monthly salary → expense transaction (once per employee per month).
create or replace function public.pay_salary(
  p_employee_id uuid,
  p_month       date,
  p_amount      bigint default null,
  p_paid_on     date default null,
  p_method      public.payment_method default 'bank_transfer',
  p_reference   text default null,
  p_notes       text default null,
  p_receipt_url text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_emp   public.employees;
  v_month date := date_trunc('month', p_month)::date;
  v_tx    uuid;
begin
  select * into v_emp from public.employees where id = p_employee_id;
  if not found then
    raise exception 'Employee not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.transactions
    where employee_id = v_emp.id and category = 'salary' and salary_month = v_month
  ) then
    raise exception 'Salary for % is already paid', to_char(v_month, 'Mon YYYY') using errcode = '23505';
  end if;

  insert into public.transactions (
    type, amount, currency, date, category, method, reference, party_name, description,
    employee_id, salary_month, receipt_url, notes
  ) values (
    'expense', coalesce(p_amount, v_emp.salary), v_emp.currency, coalesce(p_paid_on, public.today_pk()),
    'salary', p_method, nullif(trim(p_reference), ''), v_emp.name,
    'Salary · ' || to_char(v_month, 'Mon YYYY'),
    v_emp.id, v_month, p_receipt_url, nullif(trim(p_notes), '')
  )
  returning id into v_tx;

  return v_tx;
end;
$$;

-- -----------------------------------------------------------------------------
-- Leads: convert to a client (and optionally a project).
-- p_project: null or {title, service_type, value, currency, deadline}
-- -----------------------------------------------------------------------------
create or replace function public.convert_lead(p_lead_id uuid, p_project jsonb default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_lead   public.leads;
  v_client uuid;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;
  if v_lead.converted_client_id is not null then
    return v_lead.converted_client_id;
  end if;

  insert into public.clients (business_name, contact_name, phone, whatsapp, email, city, source, notes, status)
  values (
    coalesce(nullif(trim(v_lead.business), ''), v_lead.name),
    v_lead.name, v_lead.phone, v_lead.phone, v_lead.email, v_lead.city, v_lead.source,
    v_lead.notes, 'active'
  )
  returning id into v_client;

  if p_project is not null and nullif(trim(p_project ->> 'title'), '') is not null then
    insert into public.projects (client_id, title, service_type, value, currency, start_date, deadline, status)
    values (
      v_client,
      trim(p_project ->> 'title'),
      coalesce(nullif(p_project ->> 'service_type', ''), v_lead.service_interest::text, 'other')::public.service_type,
      coalesce((p_project ->> 'value')::bigint, v_lead.est_value, 0),
      coalesce(nullif(p_project ->> 'currency', ''), v_lead.currency::text)::public.currency_code,
      public.today_pk(),
      nullif(p_project ->> 'deadline', '')::date,
      'planning'
    );
  end if;

  update public.leads set stage = 'won', converted_client_id = v_client where id = v_lead.id;
  return v_client;
end;
$$;


-- =============================================================================
-- Reporting. Dashboards report PKR; USD is reported separately, never converted.
-- =============================================================================

-- "This month" money summary + what's still to collect. Comparisons use the
-- same number of days last month, so early-month numbers aren't misleading.
create or replace function public.report_kpis()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_today       date := public.today_pk();
  v_month_start date := date_trunc('month', v_today)::date;
  v_prev_start  date := (date_trunc('month', v_today) - interval '1 month')::date;
  v_prev_same   date := least((v_prev_start + (v_today - v_month_start))::date, v_month_start - 1);
  v_result      jsonb;
begin
  if not public.is_finance() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  with
  money as (
    select
      coalesce(sum(amount) filter (where type = 'income'  and currency = 'PKR' and date between v_month_start and v_today), 0) as collected,
      coalesce(sum(amount) filter (where type = 'expense' and currency = 'PKR' and date between v_month_start and v_today), 0) as spent,
      coalesce(sum(amount) filter (where type = 'income'  and currency = 'PKR' and date between v_prev_start and v_prev_same), 0) as collected_prev,
      coalesce(sum(amount) filter (where type = 'expense' and currency = 'PKR' and date between v_prev_start and v_prev_same), 0) as spent_prev,
      coalesce(sum(amount) filter (where type = 'income'  and currency = 'PKR' and date >= v_prev_start and date < v_month_start), 0) as collected_last,
      coalesce(sum(amount) filter (where type = 'expense' and currency = 'PKR' and date >= v_prev_start and date < v_month_start), 0) as spent_last,
      coalesce(sum(amount) filter (where type = 'income'  and currency = 'USD' and date between v_month_start and v_today), 0) as collected_usd,
      coalesce(sum(amount) filter (where type = 'expense' and currency = 'USD' and date between v_month_start and v_today), 0) as spent_usd,
      count(*) filter (where type = 'income' and date between v_month_start and v_today) as payments_count
    from public.transactions
  ),
  subs as (
    select
      coalesce(sum(amount / interval_months) filter (where status = 'active' and currency = 'PKR'), 0) as mrr,
      coalesce(sum(amount / interval_months) filter (where status = 'active' and currency = 'USD'), 0) as mrr_usd,
      count(*) filter (where status = 'active') as active_subs,
      count(*) filter (where status = 'active' and service_type = 'whatsapp_api') as wa_active,
      -- A lapsed prepaid subscription is one renewal to collect (not every missed month).
      coalesce(sum(amount) filter (where status = 'active' and next_due_date <= v_today and currency = 'PKR'), 0) as renewals_due,
      count(*) filter (where status = 'active' and next_due_date <= v_today) as renewals_due_count,
      count(*) filter (where status = 'active' and next_due_date < v_today) as renewals_overdue_count,
      count(*) filter (where status = 'active' and next_due_date > v_today and next_due_date <= v_today + 7) as renewals_soon
    from public.subscriptions
  ),
  dues as (
    select
      coalesce(sum(amount - amount_paid) filter (where currency = 'PKR'), 0) as open_pkr,
      coalesce(sum(amount - amount_paid) filter (where currency = 'USD'), 0) as open_usd,
      count(*) as open_count,
      count(*) filter (where due_date < v_today) as overdue_count,
      coalesce(sum(amount - amount_paid) filter (where currency = 'PKR' and due_date <= v_today), 0) as due_now_pkr
    from public.dues
    where status = 'pending'
  ),
  clients as (
    select
      count(*) filter (where status = 'active' and archived_at is null) as active_clients,
      count(*) filter (where created_at >= v_month_start::timestamptz and archived_at is null) as new_clients
    from public.clients
  )
  select jsonb_build_object(
    'collected_pkr', money.collected,
    'spent_pkr', money.spent,
    'profit_pkr', money.collected - money.spent,
    'collected_prev_pkr', money.collected_prev,
    'spent_prev_pkr', money.spent_prev,
    'profit_prev_pkr', money.collected_prev - money.spent_prev,
    'collected_last_pkr', money.collected_last,
    'spent_last_pkr', money.spent_last,
    'collected_usd', money.collected_usd,
    'spent_usd', money.spent_usd,
    'payments_count', money.payments_count,
    'to_collect_pkr', dues.open_pkr + subs.renewals_due,
    'to_collect_usd', dues.open_usd,
    'to_collect_count', dues.open_count + subs.renewals_due_count,
    'due_now_pkr', dues.due_now_pkr + subs.renewals_due,
    'overdue_count', dues.overdue_count + subs.renewals_overdue_count,
    'mrr_pkr', subs.mrr,
    'mrr_usd', subs.mrr_usd,
    'active_subscriptions', subs.active_subs,
    'whatsapp_active', subs.wa_active,
    'renewals_soon', subs.renewals_soon,
    'active_clients', clients.active_clients,
    'new_clients', clients.new_clients,
    'as_of', v_today
  )
  into v_result
  from money, subs, dues, clients;

  return v_result;
end;
$$;

-- Monthly income vs expense (PKR) for the last p_months months, oldest first,
-- with the running cash balance at each month end.
create or replace function public.report_cashflow(p_months integer default 12)
returns table (month date, income bigint, expense bigint, balance bigint)
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select (date_trunc('month', public.today_pk()) - make_interval(months => greatest(p_months, 1) - 1))::date as first_month
  ),
  months as (
    select generate_series(b.first_month, date_trunc('month', public.today_pk())::date, interval '1 month')::date as month
    from bounds b
  ),
  opening as (
    select coalesce(sum(case when t.type = 'income' then t.amount else -t.amount end), 0)::bigint as amount
    from public.transactions t, bounds b
    where t.currency = 'PKR' and t.date < b.first_month
  ),
  monthly as (
    select date_trunc('month', t.date)::date as month,
           sum(t.amount) filter (where t.type = 'income')  as income,
           sum(t.amount) filter (where t.type = 'expense') as expense
    from public.transactions t, bounds b
    where t.currency = 'PKR' and t.date >= b.first_month
    group by 1
  )
  select m.month,
         coalesce(x.income, 0)::bigint,
         coalesce(x.expense, 0)::bigint,
         ((select amount from opening)
           + sum(coalesce(x.income, 0) - coalesce(x.expense, 0)) over (order by m.month))::bigint
  from months m
  left join monthly x on x.month = m.month
  where public.is_finance()
  order by m.month
$$;

-- PKR income in a date range, grouped by service line.

-- PKR income in a date range, grouped by service line.
create or replace function public.report_revenue_by_service(p_from date, p_to date)
returns table (service_type public.service_type, amount bigint)
language sql
stable
set search_path = ''
as $$
  select coalesce(p.service_type, s.service_type, dp.service_type, 'other'::public.service_type) as service_type,
         sum(t.amount)::bigint as amount
  from public.transactions t
  left join public.projects p      on p.id = t.project_id
  left join public.subscriptions s on s.id = t.subscription_id
  left join public.dues d          on d.id = t.due_id
  left join public.projects dp     on dp.id = d.project_id
  where public.is_finance()
    and t.type = 'income'
    and t.currency = 'PKR'
    and t.date between p_from and p_to
  group by 1
  order by 2 desc
$$;

-- Highest-paying clients in a date range (PKR).
create or replace function public.report_top_clients(p_from date, p_to date, p_limit integer default 8)
returns table (client_id uuid, business_name text, logo_url text, total bigint, payments integer, last_paid date, mrr bigint)
language sql
stable
set search_path = ''
as $$
  select c.id, c.business_name, c.logo_url,
         sum(t.amount)::bigint,
         count(*)::integer,
         max(t.date),
         coalesce((select sum(s.amount / s.interval_months) from public.subscriptions s
                    where s.client_id = c.id and s.status = 'active' and s.currency = 'PKR'), 0)::bigint
  from public.transactions t
  join public.clients c on c.id = t.client_id
  where public.is_finance()
    and t.type = 'income'
    and t.currency = 'PKR'
    and t.date between p_from and p_to
  group by c.id, c.business_name, c.logo_url
  order by 4 desc
  limit greatest(p_limit, 1)
$$;

-- Where the money goes (PKR expenses by category).
create or replace function public.report_expenses_by_category(p_from date, p_to date)
returns table (category public.tx_category, amount bigint)
language sql
stable
set search_path = ''
as $$
  select t.category, sum(t.amount)::bigint
  from public.transactions t
  where public.is_finance()
    and t.type = 'expense'
    and t.currency = 'PKR'
    and t.date between p_from and p_to
  group by 1
  order by 2 desc
$$;

-- Global search across clients, projects, payment requests and leads (RLS-aware).
create or replace function public.search_all(p_query text, p_limit integer default 6)
returns table (kind text, id uuid, title text, subtitle text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_q text := '%' || replace(replace(replace(trim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if length(trim(coalesce(p_query, ''))) < 2 then
    return;
  end if;

  return query
  (select 'client'::text, c.id, c.business_name, concat_ws(' · ', c.contact_name, c.city)
     from public.clients c
    where c.business_name ilike v_q or c.contact_name ilike v_q or c.phone ilike v_q or c.email ilike v_q
    order by c.archived_at nulls first, c.business_name
    limit p_limit)
  union all
  (select 'project'::text, p.id, p.title, c.business_name
     from public.projects p
     left join public.clients c on c.id = p.client_id
    where p.title ilike v_q or c.business_name ilike v_q
    order by p.created_at desc
    limit p_limit)
  union all
  (select 'due'::text, d.id, d.title, coalesce(c.business_name, d.payer_name)
     from public.dues d
     left join public.clients c on c.id = d.client_id
    where d.title ilike v_q or c.business_name ilike v_q or d.payer_name ilike v_q
    order by d.due_date desc
    limit p_limit)
  union all
  (select 'lead'::text, l.id, l.name, l.business
     from public.leads l
    where l.name ilike v_q or l.business ilike v_q or l.phone ilike v_q
    order by l.created_at desc
    limit p_limit);
end;
$$;

-- Function access: signed-in users only (RLS and in-function checks do the rest).
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;
