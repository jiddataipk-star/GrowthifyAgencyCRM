-- =============================================================================
-- Growthify OS — optional demo data (Settings → "Load demo data").
-- The app only offers this when ALLOW_DEMO_DATA=true (keep it false in production).
-- Every row created is recorded in demo_records so clear_demo_data() removes
-- exactly those rows and nothing else. All names are fictional.
-- =============================================================================

create or replace function public.load_demo_data()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today   date := public.today_pk();
  v_month   date := date_trunc('month', public.today_pk())::date;
  v_clients uuid[];
  v_projects uuid[];
  v_members uuid[];
  v_emps    uuid[];
  v_subs    uuid[];
  v_inv     uuid;
  v_id      uuid;
  v_plan_wa uuid;
  v_plan_ads uuid;
  m         integer;
  i         integer;
  v_count   integer;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can load demo data' using errcode = '42501';
  end if;
  if exists (select 1 from public.demo_records) then
    raise exception 'Demo data is already loaded' using errcode = '23505';
  end if;

  select id into v_plan_wa from public.plans where service_type = 'whatsapp_api' order by created_at limit 1;
  select id into v_plan_ads from public.plans where service_type = 'ads_management' order by created_at limit 1;

  -- Clients ------------------------------------------------------------------
  with ins as (
    insert into public.clients (business_name, contact_name, phone, whatsapp, email, city, niche, source, status, tags, notes, created_at)
    values
      ('Alpha Real Estate',       'Usman Tariq',   '0321-4567890', '0321-4567890', 'usman@alpha-realestate.pk', 'Lahore',     'real_estate', 'meta_ad',  'active', '{demo,priority}', 'Runs DHA & Bahria listings. Prefers WhatsApp voice notes.', now() - interval '11 months'),
      ('Nova Clinic',             'Dr. Ayesha Malik','0300-1234567','0300-1234567','admin@novaclinic.pk',       'Faisalabad', 'clinic',      'referral', 'active', '{demo}',          'Two branches. Patient booking bot + CRM.', now() - interval '9 months'),
      ('Skyline Travels',         'Bilal Ahmed',   '0333-9876543', '0333-9876543', 'bilal@skylinetravels.pk',   'Islamabad',  'travel_visa', 'organic',  'active', '{demo}',          'Umrah & visa packages. Busy season Dec–Feb.', now() - interval '7 months'),
      ('Bright Future Academy',   'Sir Kamran',    '0345-1112233', '0345-1112233', 'info@brightfuture.edu.pk',  'Faisalabad', 'academy',     'meta_ad',  'active', '{demo}',          'Admissions campaigns twice a year.', now() - interval '5 months'),
      ('Zaitoon Mart',            'Hamza Qureshi', '0312-5556677', '0312-5556677', 'hamza@zaitoonmart.pk',      'Karachi',    'ecommerce',   'linkedin', 'active', '{demo}',          'Shopify store, COD heavy.', now() - interval '3 months'),
      ('Crescent Builders',       'Faisal Iqbal',  '0301-7788990', '0301-7788990', null,                        'Multan',     'real_estate', 'referral', 'active', '{demo}',          null, date_trunc('month', now()) + interval '2 days'),
      ('Al-Noor Visa Consultants','Rabia Noor',    '0322-3344556', '0322-3344556', 'rabia@alnoorvisa.pk',       'Rawalpindi', 'travel_visa', 'meta_ad',  'paused', '{demo}',          'Paused campaigns until new visa policy.', now() - interval '8 months'),
      ('Gulberg Dental Studio',   'Dr. Saad',      '0302-4455667', '0302-4455667', null,                        'Lahore',     'clinic',      'organic',  'former', '{demo}',          'Project delivered in 2025.', now() - interval '13 months')
    returning id
  )
  select array_agg(id) into v_clients from ins;
  insert into public.demo_records (entity, entity_id) select 'clients', unnest(v_clients);
  -- array_agg order follows insert order
  select array_agg(c.id order by array_position(array[
    'Alpha Real Estate','Nova Clinic','Skyline Travels','Bright Future Academy','Zaitoon Mart',
    'Crescent Builders','Al-Noor Visa Consultants','Gulberg Dental Studio'], c.business_name))
    into v_clients from public.clients c where c.id = any (v_clients);

  -- Team (employees) -----------------------------------------------------------
  with ins as (
    insert into public.employees (name, role, email, phone, joined_on, salary, status)
    values
      ('Ali Raza',     'Full-stack Developer', 'ali@growthify.example',   '0300-1010101', v_today - 420, 9500000, 'active'),
      ('Hina Tariq',   'UI/UX Designer',       'hina@growthify.example',  '0300-2020202', v_today - 300,  7000000, 'active'),
      ('Usman Khalid', 'Meta Ads Specialist',  'usman@growthify.example', '0300-3030303', v_today - 250,  6000000, 'active'),
      ('Sana Iqbal',   'AI Engineer',          'sana@growthify.example',  '0300-4040404', v_today - 120,  9000000, 'on_leave')
    returning id
  )
  select array_agg(id) into v_emps from ins;
  insert into public.demo_records (entity, entity_id) select 'employees', unnest(v_emps);
  select array_agg(id order by joined_on) into v_emps from public.employees where id = any (v_emps);

  select array_agg(id) into v_members from public.team_members where active;

  -- Projects, milestones, tasks ------------------------------------------------
  with ins as (
    insert into public.projects (client_id, title, service_type, value, currency, start_date, deadline, status, progress, links, notes)
    values
      (v_clients[2], 'Clinic CRM & booking bot', 'custom_software', 45000000, 'PKR', v_today - 70, v_today + 20, 'in_progress', 65, '{"staging":"https://staging.novaclinic.example","repo":"https://github.com/example/nova-crm"}', 'Phase 2: reports and SMS reminders.'),
      (v_clients[3], 'AI visa assistant',        'ai_automation',   18000000, 'PKR', v_today - 40, v_today + 10, 'review',      85, '{"live":"https://skylinetravels.example"}', null),
      (v_clients[1], 'Property portal',          'web_app',         60000000, 'PKR', v_today - 25, v_today + 60, 'in_progress', 30, '{}', 'Listings import from Zameen export.'),
      (v_clients[4], 'Admissions landing pages', 'web_app',          9000000, 'PKR', v_today - 15, v_today + 5,  'planning',    10, '{}', null),
      (v_clients[5], 'Store automation (USD)',   'ai_automation',     250000, 'USD', v_today - 60, v_today - 5,  'delivered',  100, '{"live":"https://zaitoonmart.example"}', 'Order sync + abandoned cart WhatsApp flows.'),
      (v_clients[6], 'WhatsApp API setup',       'whatsapp_api',     3500000, 'PKR', v_today - 5,  v_today + 9,  'in_progress', 40, '{}', null),
      (v_clients[8], 'Dental website',           'web_app',          8000000, 'PKR', v_today - 400, v_today - 330, 'delivered', 100, '{}', null)
    returning id
  )
  select array_agg(id) into v_projects from ins;
  insert into public.demo_records (entity, entity_id) select 'projects', unnest(v_projects);
  -- Re-read in a stable order by title to map below.
  select array_agg(p.id order by array_position(array[
    'Clinic CRM & booking bot','AI visa assistant','Property portal','Admissions landing pages',
    'Store automation (USD)','WhatsApp API setup','Dental website'], p.title))
    into v_projects from public.projects p where p.id = any (v_projects);

  if v_members is not null then
    insert into public.project_members (project_id, team_member_id)
    select p, v_members[1] from unnest(v_projects[1:4]) p
    on conflict do nothing;
  end if;

  insert into public.milestones (project_id, name, amount, due_date, position) values
    (v_projects[1], 'Advance 40%',      18000000, v_today - 70, 0),
    (v_projects[1], 'Beta handover',    13500000, v_today - 10, 1),
    (v_projects[1], 'Final delivery',   13500000, v_today + 20, 2),
    (v_projects[2], 'Advance 50%',       9000000, v_today - 40, 0),
    (v_projects[2], 'Go-live',           9000000, v_today + 10, 1),
    (v_projects[3], 'Advance 30%',      18000000, v_today - 25, 0),
    (v_projects[3], 'Design sign-off',  12000000, v_today + 15, 1),
    (v_projects[3], 'Launch',           30000000, v_today + 60, 2),
    (v_projects[4], 'Full payment',      9000000, v_today + 5,  0),
    (v_projects[5], 'Fixed price',        250000, v_today - 20, 0),
    (v_projects[6], 'Setup fee',         3500000, v_today,      0),
    (v_projects[7], 'Full payment',      8000000, v_today - 340, 0);
  insert into public.demo_records (entity, entity_id)
    select 'milestones', id from public.milestones where project_id = any (v_projects);

  insert into public.tasks (project_id, title, due_date, done, position, assignee_id) values
    (v_projects[1], 'Patient table + import',      v_today - 30, true,  0, v_members[1]),
    (v_projects[1], 'Booking flow on WhatsApp',    v_today - 8,  true,  1, v_members[1]),
    (v_projects[1], 'Monthly revenue report',      v_today + 6,  false, 2, v_members[1]),
    (v_projects[1], 'SMS reminders via Jazz API',  v_today + 14, false, 3, null),
    (v_projects[2], 'Train on visa FAQs',          v_today - 12, true,  0, null),
    (v_projects[2], 'Client UAT',                  v_today + 2,  false, 1, v_members[1]),
    (v_projects[3], 'Wireframes',                  v_today - 5,  true,  0, null),
    (v_projects[3], 'Listing import script',       v_today + 12, false, 1, null),
    (v_projects[4], 'Copy in Urdu + English',      v_today + 1,  false, 0, null),
    (v_projects[6], 'Meta Business verification',  v_today + 3,  false, 0, v_members[1]);

  -- Pay the milestones that are in the past (creates income transactions).
  for v_id in
    select ms.id from public.milestones ms
    where ms.project_id = any (v_projects) and ms.due_date < v_today - 1 and ms.name <> 'Beta handover'
  loop
    perform public.mark_milestone_paid(
      v_id,
      (select due_date + 2 from public.milestones where id = v_id),
      (array['bank_transfer','jazzcash','raast','cheque']::public.payment_method[])[1 + floor(random() * 4)::int],
      'TID-' || upper(substr(md5(v_id::text), 1, 8))
    );
  end loop;

  -- Subscriptions with history --------------------------------------------------
  with ins as (
    insert into public.subscriptions (client_id, plan_id, name, service_type, amount, billing_day, start_date, next_due_date, status, notes)
    values
      (v_clients[1], v_plan_wa,  'Growthify WhatsApp API — Monthly', 'whatsapp_api',   1500000, 1,  (v_month - interval '10 months')::date, (v_month - interval '10 months')::date, 'active', null),
      (v_clients[2], v_plan_wa,  'Growthify WhatsApp API — Monthly', 'whatsapp_api',   1500000, 5,  ((v_month - interval '8 months')::date + 4), ((v_month - interval '8 months')::date + 4), 'active', null),
      (v_clients[1], v_plan_ads, 'Meta Ads Management — Monthly',    'ads_management', 3500000, 10, ((v_month - interval '6 months')::date + 9), ((v_month - interval '6 months')::date + 9), 'active', 'Ad spend billed separately by client card.'),
      (v_clients[4], v_plan_ads, 'Meta Ads Management — Monthly',    'ads_management', 2500000, 15, ((v_month - interval '4 months')::date + 14), ((v_month - interval '4 months')::date + 14), 'active', null),
      (v_clients[3], v_plan_wa,  'Growthify WhatsApp API — Monthly', 'whatsapp_api',   1500000, 20, ((v_month - interval '5 months')::date + 19), ((v_month - interval '5 months')::date + 19), 'active', null),
      (v_clients[7], v_plan_ads, 'Meta Ads Management — Monthly',    'ads_management', 2000000, 25, ((v_month - interval '7 months')::date + 24), ((v_month - interval '7 months')::date + 24), 'paused', 'Paused by client.')
    returning id
  )
  select array_agg(id) into v_subs from ins;
  insert into public.demo_records (entity, entity_id) select 'subscriptions', unnest(v_subs);

  -- Mark past cycles paid (each call records income and advances the due date).
  -- Leave one subscription overdue and one due within days so the dashboard shows both.
  for v_id in select unnest(v_subs)
  loop
    loop
      exit when (select next_due_date from public.subscriptions where id = v_id) >= v_today - 3;
      exit when (select status from public.subscriptions where id = v_id) = 'paused'
            and (select next_due_date from public.subscriptions where id = v_id) >= v_today - 75;
      exit when v_id = v_subs[5] and (select next_due_date from public.subscriptions where id = v_id) >= v_today - 40;
      perform public.mark_subscription_paid(
        v_id,
        (select next_due_date + (random() * 3)::int from public.subscriptions where id = v_id),
        (array['bank_transfer','jazzcash','easypaisa','raast']::public.payment_method[])[1 + floor(random() * 4)::int],
        'TID-' || upper(substr(md5(random()::text), 1, 8))
      );
    end loop;
  end loop;

  -- Invoices -------------------------------------------------------------------
  v_inv := public.save_invoice(null, jsonb_build_object(
    'client_id', v_clients[3], 'project_id', v_projects[2], 'issue_date', v_today - 20, 'due_date', v_today - 13,
    'currency', 'PKR', 'tax_rate', 16, 'discount', 0, 'status', 'sent', 'notes', 'Final 50% on go-live.'),
    '[{"description":"AI visa assistant — go-live milestone","qty":1,"unit_price":9000000}]');
  insert into public.demo_records (entity, entity_id) values ('invoices', v_inv);

  v_inv := public.save_invoice(null, jsonb_build_object(
    'client_id', v_clients[2], 'project_id', v_projects[1], 'issue_date', v_today - 12, 'due_date', v_today + 3,
    'currency', 'PKR', 'tax_rate', 0, 'discount', 500000, 'status', 'sent'),
    '[{"description":"Clinic CRM — beta handover","qty":1,"unit_price":13500000},{"description":"Staff training session","qty":2,"unit_price":1500000}]');
  insert into public.demo_records (entity, entity_id) values ('invoices', v_inv);
  perform public.record_invoice_payment(v_inv, 8000000, 0, v_today - 4, 'bank_transfer', 'IBFT-88213');

  v_inv := public.save_invoice(null, jsonb_build_object(
    'client_id', v_clients[6], 'project_id', v_projects[6], 'issue_date', v_today - 2, 'due_date', v_today + 5,
    'currency', 'PKR', 'tax_rate', 0, 'status', 'draft'),
    '[{"description":"Growthify WhatsApp API — setup & verification","qty":1,"unit_price":3500000}]');
  insert into public.demo_records (entity, entity_id) values ('invoices', v_inv);

  v_inv := public.save_invoice(null, jsonb_build_object(
    'client_id', v_clients[4], 'issue_date', v_today - 35, 'due_date', v_today - 28,
    'currency', 'PKR', 'tax_rate', 0, 'status', 'sent'),
    '[{"description":"Admissions campaign creatives (10)","qty":10,"unit_price":350000}]');
  insert into public.demo_records (entity, entity_id) values ('invoices', v_inv);
  perform public.record_invoice_payment(v_inv, 3220000, 280000, v_today - 26, 'cheque', 'CHQ-004512', null, 'Client deducted 8% WHT.');

  -- Expenses for the last 12 months --------------------------------------------
  for m in 0..11 loop
    with ins as (
      insert into public.transactions (type, amount, currency, date, category, method, description)
      select 'expense', x.amount, 'PKR', least((v_month - make_interval(months => m))::date + x.day_offset, v_today), x.category, x.method, x.description
      from (values
        (1840000 + m * 15000, 3,  'hosting'::public.tx_category,   'card'::public.payment_method,          'Hosting & API (Vercel, Supabase, OpenAI)'),
        (950000,              6,  'software'::public.tx_category,  'card'::public.payment_method,          'Software subscriptions'),
        (1500000,             1,  'office'::public.tx_category,    'bank_transfer'::public.payment_method, 'Office rent — Faisalabad'),
        (case when m % 3 = 0 then 2500000 + m * 100000 else 0 end,
                              12, 'ads_spend'::public.tx_category, 'card'::public.payment_method,          'Growthify brand ads (Meta)')
      ) as x(amount, day_offset, category, method, description)
      where x.amount > 0
      returning id
    )
    insert into public.demo_records (entity, entity_id) select 'transactions', id from ins;
  end loop;

  -- Project income history + opening capital (keeps the demo books realistic) ----
  with ins as (
    insert into public.transactions (type, amount, currency, date, category, method, description, client_id, project_id, reference)
    select 'income', ((300000 + (11 - g.n) * 42000 + (g.n % 3) * 55000) * 100)::bigint, 'PKR',
           least((v_month - make_interval(months => g.n))::date + 7 + (g.n % 2) * 9, v_today),
           'project',
           (array['bank_transfer','raast','cheque','jazzcash']::public.payment_method[])[1 + g.n % 4],
           'Project payment',
           p.client_id, p.id, 'IBFT-' || (40000 + g.n * 137)
    from generate_series(0, 11) as g(n)
    join public.projects p on p.id = v_projects[1 + (g.n % 3) * 3 % 7]
    returning id
  )
  insert into public.demo_records (entity, entity_id) select 'transactions', id from ins;

  with ins as (
    insert into public.transactions (type, amount, currency, date, category, method, description, notes)
    values ('income', 150000000, 'PKR', (v_month - interval '12 months')::date + 2, 'other', 'bank_transfer',
            'Opening balance', 'Cash in bank when Growthify OS started (demo).')
    returning id
  )
  insert into public.demo_records (entity, entity_id) select 'transactions', id from ins;

  -- Salaries (months fully past) ------------------------------------------------
  for m in 1..11 loop
    for i in 1..array_length(v_emps, 1) loop
      if (select joined_on from public.employees where id = v_emps[i]) <= (v_month - make_interval(months => m))::date then
        perform public.pay_salary(v_emps[i], (v_month - make_interval(months => m))::date, null,
                                  least((v_month - make_interval(months => m - 1))::date + 1, v_today), 'bank_transfer');
      end if;
    end loop;
  end loop;

  -- Record every remaining demo transaction (milestones, subscriptions, invoices, salaries).
  insert into public.demo_records (entity, entity_id)
    select 'transactions', t.id from public.transactions t
    where (t.client_id = any (v_clients) or t.employee_id = any (v_emps))
      and not exists (select 1 from public.demo_records d where d.entity_id = t.id);

  -- Leads ------------------------------------------------------------------------
  with ins as (
    insert into public.leads (name, business, phone, source, service_interest, est_value, stage, next_follow_up, notes, position)
    values
      ('Imran Shah',    'Shah Estate Advisors', '0321-1231231', 'meta_ad',  'whatsapp_api',    1800000, 'new',           v_today,      'Asked for WhatsApp API pricing.', 1),
      ('Mehwish Ali',   'Glow Skin Clinic',     '0300-9090909', 'referral', 'custom_software', 25000000, 'contacted',    v_today - 1,  'Wants appointment CRM like Nova Clinic.', 1),
      ('Tahir Mehmood', 'Mehmood Travels',      '0345-8080808', 'meta_ad',  'ai_automation',   15000000, 'proposal_sent', v_today + 2,  'Proposal v2 sent on WhatsApp.', 1),
      ('Ahsan Javed',   'Javed Foods',          '0333-7070707', 'organic',  'ads_management',  3000000, 'negotiation',   v_today + 1,  'Negotiating monthly retainer.', 1),
      ('Kiran Naz',     'Little Stars School',  '0312-6060606', 'linkedin', 'web_app',          8000000, 'new',           v_today + 3,  null, 2),
      ('Zeeshan Haider','ZH Motors',            '0301-5050505', 'meta_ad',  'whatsapp_api',     1500000, 'contacted',     v_today + 4,  null, 2),
      ('Nadia Hussain', 'Hussain Textiles',     '0322-4040404', 'referral', 'custom_software', 40000000, 'lost',          null,         'Went with in-house team.', 1),
      ('Farhan Butt',   'Butt Sweets',          '0300-3030303', 'organic',  'ads_management',   2500000, 'won',           null,         'Converted manually.', 1)
    returning id
  )
  insert into public.demo_records (entity, entity_id) select 'leads', id from ins;

  -- Social: 60 days of history for not-yet-connected accounts (flagged as demo).
  with ins as (
    insert into public.social_metrics_daily (social_account_id, date, followers, reach, views, engagement, extra)
    select a.id, d::date,
           case a.platform when 'facebook' then 480 when 'instagram' then 40 when 'youtube' then 0 when 'threads' then 0 else 120 end
             + (60 - (v_today - d::date)) * case a.platform when 'facebook' then 1.5 when 'instagram' then 0.6 when 'linkedin' then 0.4 else 0.05 end,
           (200 + random() * 400)::int,
           (300 + random() * 900)::int,
           (10 + random() * 60)::int,
           '{"demo": true}'::jsonb
    from public.social_accounts a
    cross join generate_series(v_today - 60, v_today - 1, interval '1 day') d
    where a.status = 'not_connected'
    on conflict (social_account_id, date) do nothing
    returning id
  )
  insert into public.demo_records (entity, entity_id) select 'social_metrics_daily', id from ins;

  select count(*) into v_count from public.demo_records;
  return v_count;
end;
$$;

create or replace function public.clear_demo_data()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can clear demo data' using errcode = '42501';
  end if;
  select count(*) into v_count from public.demo_records;

  delete from public.social_metrics_daily
   where id in (select entity_id from public.demo_records where entity = 'social_metrics_daily')
     and extra ->> 'demo' = 'true';
  delete from public.transactions  where id in (select entity_id from public.demo_records where entity = 'transactions');
  delete from public.invoices      where id in (select entity_id from public.demo_records where entity = 'invoices');
  delete from public.subscriptions where id in (select entity_id from public.demo_records where entity = 'subscriptions');
  delete from public.projects      where id in (select entity_id from public.demo_records where entity = 'projects');
  delete from public.leads         where id in (select entity_id from public.demo_records where entity = 'leads');
  -- Clients may have picked up real records meanwhile; keep those clients.
  delete from public.clients c
   where c.id in (select entity_id from public.demo_records where entity = 'clients')
     and not exists (select 1 from public.projects p where p.client_id = c.id)
     and not exists (select 1 from public.subscriptions s where s.client_id = c.id)
     and not exists (select 1 from public.invoices i where i.client_id = c.id);
  delete from public.employees     where id in (select entity_id from public.demo_records where entity = 'employees');
  delete from public.demo_records;
  return v_count;
end;
$$;

revoke execute on function public.load_demo_data() from public, anon;
revoke execute on function public.clear_demo_data() from public, anon;
grant execute on function public.load_demo_data() to authenticated;
grant execute on function public.clear_demo_data() to authenticated;
