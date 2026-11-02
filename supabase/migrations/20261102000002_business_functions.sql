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
-- Subscriptions: one-click "Mark paid".
-- Records the income and moves the next due date forward by one billing cycle.
-- -----------------------------------------------------------------------------
create or replace function public.mark_subscription_paid(
  p_subscription_id uuid,
  p_paid_on         date default null,
  p_method          public.payment_method default 'bank_transfer',
  p_reference       text default null,
  p_receipt_url     text default null,
  p_amount          bigint default null,
  p_notes           text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_tx  uuid;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception 'Subscription not found' using errcode = 'P0002';
  end if;
  if v_sub.status = 'cancelled' then
    raise exception 'This subscription is cancelled' using errcode = '23514';
  end if;

  insert into public.transactions (
    type, amount, currency, date, category, method, reference, description,
    client_id, subscription_id, receipt_url, notes
  ) values (
    'income', coalesce(p_amount, v_sub.amount), v_sub.currency, coalesce(p_paid_on, public.today_pk()),
    'subscription', p_method, nullif(trim(p_reference), ''),
    v_sub.name || ' · ' || to_char(v_sub.next_due_date, 'Mon YYYY'),
    v_sub.client_id, v_sub.id, p_receipt_url, nullif(trim(p_notes), '')
  )
  returning id into v_tx;

  update public.subscriptions
     set next_due_date = public.add_billing_months(v_sub.next_due_date, v_sub.interval_months, v_sub.billing_day)
   where id = v_sub.id;

  return v_tx;
end;
$$;

-- -----------------------------------------------------------------------------
-- Projects: mark a milestone paid → creates the income transaction.
-- -----------------------------------------------------------------------------
create or replace function public.mark_milestone_paid(
  p_milestone_id uuid,
  p_paid_on      date default null,
  p_method       public.payment_method default 'bank_transfer',
  p_reference    text default null,
  p_receipt_url  text default null,
  p_notes        text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_ms      public.milestones;
  v_project public.projects;
  v_tx      uuid;
begin
  select * into v_ms from public.milestones where id = p_milestone_id for update;
  if not found then
    raise exception 'Milestone not found' using errcode = 'P0002';
  end if;
  if v_ms.paid then
    raise exception 'This milestone is already paid' using errcode = '23505';
  end if;
  if v_ms.amount <= 0 then
    raise exception 'Set the milestone amount before marking it paid' using errcode = '23514';
  end if;
  select * into v_project from public.projects where id = v_ms.project_id;

  insert into public.transactions (
    type, amount, currency, date, category, method, reference, description,
    client_id, project_id, receipt_url, notes
  ) values (
    'income', v_ms.amount, v_project.currency, coalesce(p_paid_on, public.today_pk()), 'project',
    p_method, nullif(trim(p_reference), ''), v_project.title || ' · ' || v_ms.name,
    v_project.client_id, v_project.id, p_receipt_url, nullif(trim(p_notes), '')
  )
  returning id into v_tx;

  update public.milestones set paid = true, paid_tx_id = v_tx where id = v_ms.id;
  return v_tx;
end;
$$;

-- -----------------------------------------------------------------------------
-- Invoices: record a (full or partial) payment. Pakistani clients often deduct
-- income tax at source; `p_tax_withheld` settles that part of the invoice
-- without pretending the cash arrived.
-- -----------------------------------------------------------------------------
create or replace function public.record_invoice_payment(
  p_invoice_id   uuid,
  p_amount       bigint,
  p_tax_withheld bigint default 0,
  p_paid_on      date default null,
  p_method       public.payment_method default 'bank_transfer',
  p_reference    text default null,
  p_receipt_url  text default null,
  p_notes        text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_inv public.invoices;
  v_tx  uuid;
  v_category public.tx_category := 'other';
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_inv.status = 'void' then
    raise exception 'This invoice is void' using errcode = '23514';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '23514';
  end if;
  if v_inv.project_id is not null then
    v_category := 'project';
  end if;

  insert into public.transactions (
    type, amount, tax_withheld, currency, date, category, method, reference, description,
    client_id, project_id, invoice_id, receipt_url, notes
  ) values (
    'income', p_amount, greatest(coalesce(p_tax_withheld, 0), 0), v_inv.currency,
    coalesce(p_paid_on, public.today_pk()), v_category, p_method, nullif(trim(p_reference), ''),
    'Invoice ' || v_inv.number, v_inv.client_id, v_inv.project_id, v_inv.id,
    p_receipt_url, nullif(trim(p_notes), '')
  )
  returning id into v_tx;

  return v_tx;
end;
$$;

-- -----------------------------------------------------------------------------
-- Invoices: create or update an invoice together with its line items.
-- p_data keys: client_id, project_id, issue_date, due_date, currency, discount,
--              tax_rate, notes, status ('draft' | 'sent')
-- p_items: [{description, qty, unit_price}]
-- -----------------------------------------------------------------------------
create or replace function public.save_invoice(p_invoice_id uuid, p_data jsonb, p_items jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id     uuid := p_invoice_id;
  v_status public.invoice_status := coalesce(nullif(p_data ->> 'status', ''), 'draft')::public.invoice_status;
  v_item   jsonb;
  v_pos    integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one line item' using errcode = '23514';
  end if;
  if v_status not in ('draft', 'sent') then
    raise exception 'Invalid status' using errcode = '23514';
  end if;

  if v_id is null then
    insert into public.invoices (
      client_id, project_id, issue_date, due_date, currency, discount, tax_rate, notes, status
    ) values (
      (p_data ->> 'client_id')::uuid,
      nullif(p_data ->> 'project_id', '')::uuid,
      coalesce((p_data ->> 'issue_date')::date, public.today_pk()),
      (p_data ->> 'due_date')::date,
      coalesce(nullif(p_data ->> 'currency', ''), 'PKR')::public.currency_code,
      0,
      coalesce((p_data ->> 'tax_rate')::numeric, 0),
      nullif(trim(p_data ->> 'notes'), ''),
      'draft'
    )
    returning id into v_id;
  else
    if not public.invoice_is_editable(v_id) then
      raise exception 'Paid, partly paid or void invoices cannot be edited' using errcode = '23514';
    end if;
    update public.invoices set
      client_id  = (p_data ->> 'client_id')::uuid,
      project_id = nullif(p_data ->> 'project_id', '')::uuid,
      issue_date = coalesce((p_data ->> 'issue_date')::date, issue_date),
      due_date   = (p_data ->> 'due_date')::date,
      currency   = coalesce(nullif(p_data ->> 'currency', ''), 'PKR')::public.currency_code,
      discount   = 0,
      tax_rate   = coalesce((p_data ->> 'tax_rate')::numeric, 0),
      notes      = nullif(trim(p_data ->> 'notes'), '')
    where id = v_id;
    delete from public.invoice_items where invoice_id = v_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.invoice_items (invoice_id, description, qty, unit_price, position)
    values (
      v_id,
      trim(v_item ->> 'description'),
      coalesce((v_item ->> 'qty')::numeric, 1),
      coalesce((v_item ->> 'unit_price')::bigint, 0),
      v_pos
    );
    v_pos := v_pos + 1;
  end loop;

  -- Discount is applied after the subtotal exists (it may not exceed it).
  update public.invoices
     set discount = least(coalesce((p_data ->> 'discount')::bigint, 0), subtotal),
         status   = case when status = 'draft' then v_status else status end
   where id = v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Team: pay a monthly salary → expense transaction (once per employee per month).
-- -----------------------------------------------------------------------------
create or replace function public.pay_salary(
  p_employee_id uuid,
  p_month       date,
  p_amount      bigint default null,
  p_paid_on     date default null,
  p_method      public.payment_method default 'bank_transfer',
  p_reference   text default null,
  p_notes       text default null
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
    type, amount, currency, date, category, method, reference, description,
    employee_id, salary_month, notes
  ) values (
    'expense', coalesce(p_amount, v_emp.salary), v_emp.currency, coalesce(p_paid_on, public.today_pk()),
    'salary', p_method, nullif(trim(p_reference), ''),
    'Salary · ' || v_emp.name || ' · ' || to_char(v_month, 'Mon YYYY'),
    v_emp.id, v_month, nullif(trim(p_notes), '')
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

-- Number of unpaid billing cycles for a subscription as of a date.
create or replace function public.cycles_due(p_next_due date, p_interval integer, p_as_of date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_next_due > p_as_of then 0
    else ((extract(year from age(p_as_of, p_next_due)) * 12
           + extract(month from age(p_as_of, p_next_due)))::integer / greatest(p_interval, 1)) + 1
  end
$$;

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
  v_prev_same   date := least(
                    (v_prev_start + (v_today - v_month_start))::date,
                    (v_month_start - 1)
                  );
  v_result      jsonb;
begin
  if not public.is_finance() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  with
  subs as (
    select * from public.subscriptions
  ),
  mrr as (
    select
      coalesce(sum(amount / interval_months) filter (where currency = 'PKR' and status = 'active'), 0) as mrr_pkr,
      coalesce(sum(amount / interval_months) filter (where currency = 'USD' and status = 'active'), 0) as mrr_usd,
      count(*) filter (where status = 'active') as active_subs,
      coalesce(sum(amount / interval_months) filter (
        where currency = 'PKR'
          and start_date < v_month_start
          and status <> 'paused'
          and (status <> 'cancelled' or cancelled_at >= v_month_start::timestamptz)
      ), 0) as mrr_prev_pkr
    from subs
  ),
  revenue as (
    select
      coalesce(sum(amount) filter (where type = 'income' and currency = 'PKR' and date >= v_month_start and date <= v_today), 0) as rev_pkr,
      coalesce(sum(amount) filter (where type = 'income' and currency = 'USD' and date >= v_month_start and date <= v_today), 0) as rev_usd,
      coalesce(sum(amount) filter (where type = 'income' and currency = 'PKR' and date >= v_prev_start and date <= v_prev_same), 0) as rev_prev_pkr,
      coalesce(sum(amount) filter (where type = 'income' and currency = 'PKR' and date >= v_prev_start and date < v_month_start), 0) as rev_prev_full_pkr,
      coalesce(sum(amount) filter (where type = 'expense' and currency = 'PKR' and date >= v_month_start and date <= v_today), 0) as exp_pkr,
      coalesce(sum(amount) filter (where type = 'expense' and currency = 'PKR' and date >= v_prev_start and date <= v_prev_same), 0) as exp_prev_pkr
    from public.transactions
  ),
  open_invoices as (
    select
      coalesce(sum(total - amount_paid) filter (where currency = 'PKR'), 0) as inv_pkr,
      coalesce(sum(total - amount_paid) filter (where currency = 'USD'), 0) as inv_usd,
      count(*) as inv_count,
      count(*) filter (where due_date < v_today) as inv_overdue
    from public.invoices
    where status in ('sent', 'partial')
  ),
  overdue_subs as (
    select
      coalesce(sum(amount * public.cycles_due(next_due_date, interval_months, v_today)) filter (where currency = 'PKR'), 0) as subs_pkr,
      coalesce(sum(amount * public.cycles_due(next_due_date, interval_months, v_today)) filter (where currency = 'USD'), 0) as subs_usd,
      count(*) as subs_count
    from subs
    where status = 'active' and next_due_date < v_today
  ),
  client_counts as (
    select
      count(*) filter (where status = 'active' and archived_at is null) as active_clients,
      count(*) filter (where created_at >= v_month_start::timestamptz and archived_at is null) as new_clients
    from public.clients
  )
  select jsonb_build_object(
    'mrr_pkr', mrr.mrr_pkr,
    'mrr_usd', mrr.mrr_usd,
    'mrr_prev_pkr', mrr.mrr_prev_pkr,
    'active_subscriptions', mrr.active_subs,
    'revenue_pkr', revenue.rev_pkr,
    'revenue_usd', revenue.rev_usd,
    'revenue_prev_pkr', revenue.rev_prev_pkr,
    'revenue_prev_full_pkr', revenue.rev_prev_full_pkr,
    'expenses_pkr', revenue.exp_pkr,
    'expenses_prev_pkr', revenue.exp_prev_pkr,
    'outstanding_pkr', open_invoices.inv_pkr + overdue_subs.subs_pkr,
    'outstanding_usd', open_invoices.inv_usd + overdue_subs.subs_usd,
    'outstanding_count', open_invoices.inv_count + overdue_subs.subs_count,
    'overdue_count', open_invoices.inv_overdue + overdue_subs.subs_count,
    'active_clients', client_counts.active_clients,
    'new_clients', client_counts.new_clients,
    'as_of', v_today
  )
  into v_result
  from mrr, revenue, open_invoices, overdue_subs, client_counts;

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
create or replace function public.report_revenue_by_service(p_from date, p_to date)
returns table (service_type public.service_type, amount bigint)
language sql
stable
set search_path = ''
as $$
  select coalesce(p.service_type, s.service_type, ip.service_type, 'other'::public.service_type) as service_type,
         sum(t.amount)::bigint as amount
  from public.transactions t
  left join public.projects p       on p.id = t.project_id
  left join public.subscriptions s  on s.id = t.subscription_id
  left join public.invoices i       on i.id = t.invoice_id
  left join public.projects ip      on ip.id = i.project_id
  where public.is_finance()
    and t.type = 'income'
    and t.currency = 'PKR'
    and t.date between p_from and p_to
  group by 1
  order by 2 desc
$$;

-- Global search across clients, projects, invoices and leads (RLS-aware).
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
  (select 'invoice'::text, i.id, i.number, c.business_name
     from public.invoices i
     left join public.clients c on c.id = i.client_id
    where i.number ilike v_q or c.business_name ilike v_q
    order by i.issue_date desc
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
