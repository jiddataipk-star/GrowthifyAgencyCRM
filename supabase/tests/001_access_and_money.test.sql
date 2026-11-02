-- pgTAP: roles, RLS and money operations.  Run with:  npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

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
insert into public.milestones (id, project_id, name, amount) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Advance 50%', 15000000);
insert into public.tasks (project_id, title) values ('30000000-0000-0000-0000-000000000001', 'Design schema');

select is((select count(*) from public.activity_log where entity = 'clients')::int, 2, 'client creation is logged');
select is((select actor_id from public.activity_log where entity = 'clients' limit 1),
          '00000000-0000-0000-0000-0000000000a1'::uuid, 'activity log records the actor');

-- Milestone paid → income transaction
select isnt(public.mark_milestone_paid('40000000-0000-0000-0000-000000000001', '2026-11-01', 'jazzcash', 'TID123'), null,
            'mark milestone paid returns a transaction');
select is((select paid from public.milestones where id = '40000000-0000-0000-0000-000000000001'), true, 'milestone flagged paid');
select is((select amount from public.transactions where project_id = '30000000-0000-0000-0000-000000000001')::bigint,
          15000000::bigint, 'income transaction equals milestone amount');
select throws_ok($$ select public.mark_milestone_paid('40000000-0000-0000-0000-000000000001') $$,
                 '23505', null, 'cannot pay a milestone twice');

-- Subscription mark paid moves the due date by one cycle and clamps month ends
insert into public.subscriptions (id, client_id, name, amount, billing_day, start_date, next_due_date, service_type)
values ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
        'Growthify WhatsApp API — Monthly', 1500000, 31, '2026-01-31', '2026-01-31', 'whatsapp_api');
select public.mark_subscription_paid('50000000-0000-0000-0000-000000000001', '2026-02-02', 'bank_transfer');
select is((select next_due_date from public.subscriptions where id = '50000000-0000-0000-0000-000000000001'),
          '2026-02-28'::date, 'billing day 31 clamps to 28 Feb');
select public.mark_subscription_paid('50000000-0000-0000-0000-000000000001');
select is((select next_due_date from public.subscriptions where id = '50000000-0000-0000-0000-000000000001'),
          '2026-03-31'::date, 'billing day returns to 31 in March');
select is((select count(*) from public.transactions where subscription_id = '50000000-0000-0000-0000-000000000001')::int,
          2, 'each mark-paid records one income');

-- Invoice: numbering, totals, partial + withholding tax settlement
select ok(public.save_invoice(null,
  '{"client_id":"20000000-0000-0000-0000-000000000002","issue_date":"2026-11-01","due_date":"2026-11-08","currency":"PKR","discount":"100000","tax_rate":"16","status":"sent"}',
  '[{"description":"AI assistant setup","qty":"1","unit_price":"5000000"},{"description":"Training","qty":"2","unit_price":"250000"}]'
) is not null, 'save_invoice creates an invoice');
select is((select number from public.invoices limit 1), 'GA-2026-0001', 'invoice numbered GA-YYYY-0001');
select is((select subtotal from public.invoices limit 1), 5500000::bigint, 'subtotal = sum of lines');
select is((select total from public.invoices limit 1), 6264000::bigint, 'total = (subtotal - discount) + 16% tax');
select is((select status::text from public.invoices limit 1), 'sent', 'status is sent');
select public.record_invoice_payment((select id from public.invoices limit 1), 3000000, 0, '2026-11-03', 'raast');
select is((select status::text from public.invoices limit 1), 'partial', 'partial payment → partial');
select throws_ok($$ select public.save_invoice((select id from public.invoices limit 1),
  '{"client_id":"20000000-0000-0000-0000-000000000002","due_date":"2026-11-08"}', '[{"description":"x","qty":"1","unit_price":"1"}]') $$,
  '23514', null, 'partly paid invoices are locked');
select public.record_invoice_payment((select id from public.invoices limit 1), 3013440, 250560, '2026-11-05', 'bank_transfer');
select is((select status::text from public.invoices limit 1), 'paid', 'cash + withheld tax settles the invoice');
select ok(public.save_invoice(null,
  '{"client_id":"20000000-0000-0000-0000-000000000001","due_date":"2027-01-10","issue_date":"2027-01-03"}',
  '[{"description":"Retainer","qty":"1","unit_price":"100"}]') is not null, 'second invoice saved');
select is((select number from public.invoices where issue_date = '2027-01-03'), 'GA-2027-0001', 'numbering restarts each year');

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
select is((select count(*) from public.projects p join public.clients c on c.id = p.client_id
           where c.business_name = 'Alpha Real Estate')::int, 1, 'conversion created the project');

-- Reports
select ok((public.report_kpis() ->> 'mrr_pkr')::bigint = 1500000, 'MRR = active monthly subscriptions');

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
select is((select count(*) from public.milestones)::int, 0, 'staff sees no milestones');
select throws_ok($$ select public.report_kpis() $$, '42501', null, 'staff cannot run finance reports');

select pg_temp.logout();
select * from finish();
rollback;
