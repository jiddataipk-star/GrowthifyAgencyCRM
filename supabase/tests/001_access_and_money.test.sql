-- pgTAP: roles, RLS and money operations.  Run with:  npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

-- ---------------------------------------------------------------------------
-- Fixtures: three Google users (owner, manager, staff) and one stranger.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.com',   '{"provider":"google"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'manager@example.com', '{"provider":"google"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'staff@example.com',   '{"provider":"google"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a4', 'stranger@example.com','{"provider":"google"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a5', 'sneaky@example.com',  '{"provider":"email"}',  'authenticated', 'authenticated');

insert into public.team_members (id, email, name, role) values
  ('10000000-0000-0000-0000-0000000000a1', 'owner@example.com',   'Owner',   'owner'),
  ('10000000-0000-0000-0000-0000000000a2', 'manager@example.com', 'Manager', 'manager'),
  ('10000000-0000-0000-0000-0000000000a3', 'staff@example.com',   'Staff',   'staff'),
  ('10000000-0000-0000-0000-0000000000a5', 'sneaky@example.com',  'Sneaky',  'manager');

create or replace function pg_temp.login(p_uid uuid, p_email text, p_provider text default 'google')
returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', p_uid, 'email', p_email, 'role', 'authenticated',
    'app_metadata', json_build_object('provider', p_provider)
  )::text, true);
end $$;

create or replace function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end $$;

-- ---------------------------------------------------------------------------
-- Allowlist / claim
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a4', 'stranger@example.com');
select is(public.claim_membership(), null, 'unlisted email gets no role');
select is((select count(*) from public.clients)::int, 0, 'unlisted user sees no clients');

select pg_temp.login('00000000-0000-0000-0000-0000000000a5', 'sneaky@example.com', 'email');
select is(public.claim_membership(), null, 'non-Google identity cannot claim an allowlisted email');
select is(public.my_role(), null, 'unclaimed member has no role');

select pg_temp.login('00000000-0000-0000-0000-0000000000a1', 'owner@example.com');
select is(public.claim_membership(), 'owner'::public.member_role, 'owner claims membership');
select pg_temp.login('00000000-0000-0000-0000-0000000000a2', 'manager@example.com');
select is(public.claim_membership(), 'manager'::public.member_role, 'manager claims membership');
select pg_temp.login('00000000-0000-0000-0000-0000000000a3', 'staff@example.com');
select is(public.claim_membership(), 'staff'::public.member_role, 'staff claims membership');

-- ---------------------------------------------------------------------------
-- Owner creates CRM data
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a1', 'owner@example.com');
insert into public.clients (id, business_name, phone) values
  ('20000000-0000-0000-0000-000000000001', 'Nova Clinic', '03001234567'),
  ('20000000-0000-0000-0000-000000000002', 'Skyline Travels', null);
insert into public.projects (id, client_id, title, service_type, value) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Clinic CRM', 'custom_software', 30000000),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Visa bot', 'ai_automation', 12000000);
insert into public.project_members (project_id, team_member_id) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a3');
insert into public.tasks (project_id, title) values ('30000000-0000-0000-0000-000000000001', 'Design schema');

-- Scoped to the test rows so the suite also passes on a database that has demo data.
select is((select count(*) from public.activity_log where entity = 'clients' and entity_id::text like '20000000-%')::int, 2, 'client creation is logged');
select is((select actor_id from public.activity_log where entity = 'clients' and entity_id = '20000000-0000-0000-0000-000000000001' limit 1),
          '00000000-0000-0000-0000-0000000000a1'::uuid, 'activity log records the actor');

-- Dues: a project payment schedule entry, paid in two parts
insert into public.dues (id, client_id, project_id, payer_name, title, amount, due_date) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', null, 'Advance 50%', 15000000, '2026-11-01'),
  ('40000000-0000-0000-0000-000000000002', null, null, 'Rehan', 'Logo design', 1000000, '2026-11-05');
select throws_ok($$ insert into public.dues (title, amount) values ('Nobody', 100) $$, '23514', null, 'a due needs a client or a payer name');

select public.record_due_payment('40000000-0000-0000-0000-000000000001', 10000000, '2026-11-02', 'jazzcash', 'TID123', null, null, '14:35', 'NOVA HEALTH');
select is((select status::text from public.dues where id = '40000000-0000-0000-0000-000000000001'), 'pending', 'part payment keeps the due open');
select is((select amount_paid from public.dues where id = '40000000-0000-0000-0000-000000000001'), 10000000::bigint, 'amount paid tracks transactions');
select is((select party_name || ' ' || time::text from public.transactions where due_id = '40000000-0000-0000-0000-000000000001'),
          'NOVA HEALTH 14:35:00', 'payment keeps payer name and time');
select is((select category::text from public.transactions where due_id = '40000000-0000-0000-0000-000000000001'), 'project', 'project dues book as project income');
select public.record_due_payment('40000000-0000-0000-0000-000000000001', 4500000, '2026-11-03', 'cash', null, null, null, null, null, true);
select is((select status::text from public.dues where id = '40000000-0000-0000-0000-000000000001'), 'paid', 'settling closes the due');
select is((select adjustment from public.dues where id = '40000000-0000-0000-0000-000000000001'), 500000::bigint, 'the discount is kept as an adjustment');
select throws_ok($$ select public.record_due_payment('40000000-0000-0000-0000-000000000001', 100) $$,
                 '23505', null, 'cannot pay a due twice');

update public.dues set status = 'cancelled', cancel_reason = 'Client backed out' where id = '40000000-0000-0000-0000-000000000002';
select isnt((select cancelled_at from public.dues where id = '40000000-0000-0000-0000-000000000002'), null, 'cancelling stamps the time');
select throws_ok($$ select public.record_due_payment('40000000-0000-0000-0000-000000000002', 100) $$,
                 '23514', null, 'cancelled requests cannot be paid');
update public.dues set status = 'pending' where id = '40000000-0000-0000-0000-000000000002';
select is((select cancel_reason from public.dues where id = '40000000-0000-0000-0000-000000000002'), null, 'reopening clears the cancellation');

-- Undoing a payment reopens the due
delete from public.transactions where due_id = '40000000-0000-0000-0000-000000000001' and method = 'cash';
select is((select status::text from public.dues where id = '40000000-0000-0000-0000-000000000001'), 'pending', 'deleting a payment reopens the due');

-- Prepaid subscription: mark paid moves the renewal date by one cycle and clamps month ends
insert into public.subscriptions (id, client_id, name, amount, billing_day, start_date, next_due_date, service_type)
values ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
        'Growthify WhatsApp API — 1 Month', 1500000, 31, '2026-01-31', '2026-01-31', 'whatsapp_api');
select public.mark_subscription_paid('50000000-0000-0000-0000-000000000001', '2026-02-02', 'bank_transfer');
select is((select next_due_date from public.subscriptions where id = '50000000-0000-0000-0000-000000000001'),
          '2026-02-28'::date, 'billing day 31 clamps to 28 Feb');
select public.mark_subscription_paid('50000000-0000-0000-0000-000000000001');
select is((select next_due_date from public.subscriptions where id = '50000000-0000-0000-0000-000000000001'),
          '2026-03-31'::date, 'billing day returns to 31 in March');

-- Start a 3-month WhatsApp API client in one step (new client + first payment)
select ok(public.start_subscription(jsonb_build_object(
  'new_client', jsonb_build_object('business_name', 'Test WA Store', 'phone', '0300-0009911'),
  'name', 'Growthify WhatsApp API — 3 Months', 'service_type', 'whatsapp_api', 'amount', 4200000,
  'interval_months', 3, 'start_date', '2026-11-01', 'service_ref', '+92 300 0009911', 'paid_now', true,
  'payment', jsonb_build_object('method', 'easypaisa', 'reference', 'TID9', 'time', '11:20')
)) is not null, 'start_subscription creates client + subscription');
select is((select next_due_date from public.subscriptions where service_ref = '+92 300 0009911'), '2027-02-01'::date,
          'paid-now 3-month plan renews after 3 months');
select is((select count(*) from public.transactions t join public.subscriptions s on s.id = t.subscription_id
           where s.service_ref = '+92 300 0009911')::int, 1, 'the first payment is recorded');

-- Salary: once per month
insert into public.employees (id, name, salary) values ('60000000-0000-0000-0000-000000000001', 'Ali', 8000000);
select public.pay_salary('60000000-0000-0000-0000-000000000001', '2026-10-15');
select throws_ok($$ select public.pay_salary('60000000-0000-0000-0000-000000000001', '2026-10-01') $$,
                 '23505', null, 'salary cannot be paid twice for the same month');

-- Lead conversion
insert into public.leads (id, name, business, phone, est_value, service_interest)
values ('70000000-0000-0000-0000-000000000001', 'Usman', 'Alpha Real Estate', '03211234567', 20000000, 'whatsapp_api');
select ok(public.convert_lead('70000000-0000-0000-0000-000000000001', '{"title":"WhatsApp API setup"}') is not null, 'lead converts');
select is((select stage::text from public.leads where id = '70000000-0000-0000-0000-000000000001'), 'won', 'converted lead is won');

-- Reports
select is((public.report_kpis() ->> 'mrr_pkr')::bigint,
          (select sum(amount / interval_months) from public.subscriptions where status = 'active' and currency = 'PKR')::bigint,
          'MRR normalises 3-month plans to monthly');
select ok((select amount / interval_months from public.subscriptions where service_ref = '+92 300 0009911') = 1400000,
          'a PKR 42,000 3-month plan counts as PKR 14,000 a month');
select ok((public.report_kpis() ->> 'to_collect_pkr')::bigint >= 1000000, 'open dues count towards to-collect');
select is((select count(*) from public.report_top_clients('2026-01-01', '2027-12-31'))::int > 0, true, 'top clients report works');

-- ---------------------------------------------------------------------------
-- Manager: everything except deleting financial records, billing, users
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a2', 'manager@example.com');
select is((select count(*) from public.transactions)::int > 0, true, 'manager reads transactions');
delete from public.transactions;
select is((select count(*) from public.transactions)::int > 0, true, 'manager cannot delete transactions');
select throws_ok($$ update public.settings set iban = 'PK00TEST' $$, '42501', null, 'manager cannot edit billing settings');
select lives_ok($$ update public.settings set notify_renewals = false $$, 'manager can edit preferences');
select throws_ok($$ update public.team_members set role = 'owner' where email = 'manager@example.com' $$,
                 '42501', null, 'manager cannot promote themselves');
insert into public.team_members (email, role) select 'new@example.com', 'staff' where false; -- no-op guard
select throws_ok($$ insert into public.team_members (email, role) values ('x@example.com', 'staff') $$,
                 '42501', null, 'manager cannot invite users');

-- ---------------------------------------------------------------------------
-- Staff: only assigned projects and tasks, no finance
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a3', 'staff@example.com');
select is((select count(*) from public.projects)::int, 1, 'staff sees only assigned projects');
select is((select count(*) from public.transactions)::int, 0, 'staff sees no transactions');
select is((select count(*) from public.dues)::int, 0, 'staff sees no payment requests');
select throws_ok($$ select public.report_kpis() $$, '42501', null, 'staff cannot run finance reports');

select pg_temp.logout();
select * from finish();
rollback;
