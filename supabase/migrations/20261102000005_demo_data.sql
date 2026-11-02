-- =============================================================================
-- Growthify OS — optional demo data (Settings → Team & roles → "Load demo data").
-- The app only offers this when ALLOW_DEMO_DATA=true (keep it false in production).
-- Every row created is recorded in demo_records so clear_demo_data() removes
-- exactly those rows and nothing else. All names and numbers are fictional.
-- =============================================================================

create or replace function public.demo_track(p_entity text, p_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.demo_records (entity, entity_id)
  select p_entity, unnest(p_ids)
  on conflict do nothing
$$;

create or replace function public.load_demo_data()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today    date := public.today_pk();
  v_month    date := date_trunc('month', public.today_pk())::date;
  v_clients  uuid[];
  v_projects uuid[];
  v_emps     uuid[];
  v_subs     uuid[];
  v_members  uuid[];
  v_ids      uuid[];
  v_id       uuid;
  v_due      uuid;
  m          integer;
  i          integer;
  v_names    text[] := array['Usman Tariq', 'Dr. Ayesha Malik', 'Bilal Ahmed', 'Kamran Shah', 'Hamza Qureshi', 'Faisal Iqbal', 'Rabia Noor', 'Dr. Saad Hassan',
                             'Adnan Bhatti', 'Sara Khan', 'Imtiaz Ali', 'Naveed Akhtar', 'Zubair Anwar'];
  v_methods  public.payment_method[] := array['bank_transfer', 'jazzcash', 'easypaisa', 'raast', 'bank_transfer', 'cash']::public.payment_method[];
  v_count    integer;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can load demo data' using errcode = '42501';
  end if;
  if exists (select 1 from public.demo_records) then
    raise exception 'Demo data is already loaded' using errcode = '23505';
  end if;
  select array_agg(id) into v_members from public.team_members where active;

  -- Clients ------------------------------------------------------------------
  with ins as (
    insert into public.clients (business_name, contact_name, phone, whatsapp, email, city, niche, source, status, tags, notes, created_at)
    values
      ('Alpha Real Estate',        'Usman Tariq',      '0321-4567890', '0321-4567890', 'usman@alpha-realestate.pk', 'Lahore',     'real_estate', 'meta_ad',  'active', '{demo,priority}', 'DHA & Bahria listings. Prefers voice notes.', now() - interval '11 months'),
      ('Nova Clinic',              'Dr. Ayesha Malik', '0300-1234567', '0300-1234567', 'admin@novaclinic.pk',       'Faisalabad', 'clinic',      'referral', 'active', '{demo}',          'Two branches. Booking bot + CRM.', now() - interval '9 months'),
      ('Skyline Travels',          'Bilal Ahmed',      '0333-9876543', '0333-9876543', 'bilal@skylinetravels.pk',   'Islamabad',  'travel_visa', 'organic',  'active', '{demo}',          'Umrah & visa packages.', now() - interval '7 months'),
      ('Bright Future Academy',    'Kamran Shah',      '0345-1112233', '0345-1112233', 'info@brightfuture.edu.pk',  'Faisalabad', 'academy',     'meta_ad',  'active', '{demo}',          'Admissions campaigns twice a year.', now() - interval '5 months'),
      ('Zaitoon Mart',             'Hamza Qureshi',    '0312-5556677', '0312-5556677', 'hamza@zaitoonmart.pk',      'Karachi',    'ecommerce',   'linkedin', 'active', '{demo}',          'Shopify store, COD heavy.', now() - interval '3 months'),
      ('Crescent Builders',        'Faisal Iqbal',     '0301-7788990', '0301-7788990', null,                        'Multan',     'real_estate', 'referral', 'active', '{demo}',          null, date_trunc('month', now()) + interval '1 day'),
      ('Al-Noor Visa Consultants', 'Rabia Noor',       '0322-3344556', '0322-3344556', 'rabia@alnoorvisa.pk',       'Rawalpindi', 'travel_visa', 'meta_ad',  'paused', '{demo}',          'Paused campaigns.', now() - interval '8 months'),
      ('Gulberg Dental Studio',    'Dr. Saad Hassan',  '0302-4455667', '0302-4455667', null,                        'Lahore',     'clinic',      'organic',  'former', '{demo}',          'Website delivered last year.', now() - interval '13 months'),
      ('Bhatti Electronics',       'Adnan Bhatti',     '0300-6611223', '0300-6611223', null,                        'Faisalabad', 'ecommerce',   'meta_ad',  'active', '{demo,whatsapp}', 'WhatsApp API for order updates.', now() - interval '6 months'),
      ('Sara Boutique',            'Sara Khan',        '0321-7722334', '0321-7722334', null,                        'Lahore',     'ecommerce',   'organic',  'active', '{demo,whatsapp}', null, now() - interval '4 months'),
      ('Ali Motors',               'Imtiaz Ali',       '0333-8833445', '0333-8833445', null,                        'Gujranwala', 'other',       'referral', 'active', '{demo,whatsapp}', null, now() - interval '2 months'),
      ('Akhtar Pharmacy',          'Naveed Akhtar',    '0345-9944556', '0345-9944556', null,                        'Sialkot',    'clinic',      'meta_ad',  'active', '{demo,whatsapp}', null, now() - interval '12 months'),
      ('Anwar Cargo Services',     'Zubair Anwar',     '0301-1055667', '0301-1055667', null,                        'Karachi',    'other',       'linkedin', 'active', '{demo,whatsapp}', null, now() - interval '1 month')
    returning id
  )
  select array_agg(id) into v_ids from ins;
  perform public.demo_track('clients', v_ids);
  select array_agg(c.id order by array_position(v_names, c.contact_name)) into v_clients
    from public.clients c where c.id = any (v_ids);

  -- Team ---------------------------------------------------------------------
  with ins as (
    insert into public.employees (name, role, email, phone, joined_on, salary, status)
    values
      ('Ali Raza',     'Full-stack Developer', 'ali@growthify.example',   '0300-1010101', v_today - 420, 9500000, 'active'),
      ('Hina Tariq',   'UI/UX Designer',       'hina@growthify.example',  '0300-2020202', v_today - 300, 7000000, 'active'),
      ('Usman Khalid', 'Meta Ads Specialist',  'usman@growthify.example', '0300-3030303', v_today - 250, 6000000, 'active'),
      ('Sana Iqbal',   'AI Engineer',          'sana@growthify.example',  '0300-4040404', v_today - 120, 9000000, 'on_leave')
    returning id
  )
  select array_agg(id) into v_ids from ins;
  perform public.demo_track('employees', v_ids);
  select array_agg(id order by joined_on) into v_emps from public.employees where id = any (v_ids);

  -- Projects + tasks ------------------------------------------------------------
  with ins as (
    insert into public.projects (client_id, title, service_type, value, currency, start_date, deadline, status, progress, links, notes)
    values
      (v_clients[2], 'Clinic CRM & booking bot', 'custom_software', 45000000, 'PKR', v_today - 70,  v_today + 20,  'in_progress', 65, '{"staging":"https://staging.novaclinic.example"}', 'Phase 2: reports and SMS reminders.'),
      (v_clients[3], 'AI visa assistant',        'ai_automation',   18000000, 'PKR', v_today - 40,  v_today + 10,  'review',      85, '{"live":"https://skylinetravels.example"}', null),
      (v_clients[1], 'Property portal',          'web_app',         60000000, 'PKR', v_today - 25,  v_today + 60,  'in_progress', 30, '{}', 'Listings import from portal export.'),
      (v_clients[4], 'Admissions landing pages', 'web_app',          9000000, 'PKR', v_today - 15,  v_today + 5,   'planning',    10, '{}', null),
      (v_clients[5], 'Store automation',         'ai_automation',     250000, 'USD', v_today - 60,  v_today - 5,   'delivered',  100, '{}', 'Order sync + abandoned-cart flows.'),
      (v_clients[6], 'Company website',          'web_app',          3500000, 'PKR', v_today - 5,   v_today + 9,   'in_progress', 40, '{}', null),
      (v_clients[8], 'Dental website',           'web_app',          8000000, 'PKR', v_today - 400, v_today - 330, 'delivered',  100, '{}', null)
    returning id
  )
  select array_agg(id) into v_ids from ins;
  perform public.demo_track('projects', v_ids);
  select array_agg(p.id order by array_position(array['Clinic CRM & booking bot','AI visa assistant','Property portal',
    'Admissions landing pages','Store automation','Company website','Dental website'], p.title))
    into v_projects from public.projects p where p.id = any (v_ids);

  if v_members is not null then
    insert into public.project_members (project_id, team_member_id)
    select p, v_members[1] from unnest(v_projects[1:4]) p on conflict do nothing;
  end if;

  insert into public.tasks (project_id, title, due_date, done, position, assignee_id) values
    (v_projects[1], 'Patient table + import',     v_today - 30, true,  0, v_members[1]),
    (v_projects[1], 'Booking flow on WhatsApp',   v_today - 8,  true,  1, v_members[1]),
    (v_projects[1], 'Monthly revenue report',     v_today + 6,  false, 2, v_members[1]),
    (v_projects[1], 'SMS reminders',              v_today + 14, false, 3, null),
    (v_projects[2], 'Train on visa FAQs',         v_today - 12, true,  0, null),
    (v_projects[2], 'Client testing',             v_today + 2,  false, 1, v_members[1]),
    (v_projects[3], 'Wireframes',                 v_today - 5,  true,  0, null),
    (v_projects[3], 'Listing import script',      v_today + 12, false, 1, null),
    (v_projects[4], 'Copy in Urdu + English',     v_today + 1,  false, 0, null),
    (v_projects[6], 'Domain + hosting setup',     v_today + 3,  false, 0, v_members[1]);

  -- Payment requests (dues): project schedules + standalone ---------------------
  with ins as (
    insert into public.dues (client_id, project_id, title, amount, currency, due_date, position) values
      (v_clients[2], v_projects[1], 'Advance 40%',      18000000, 'PKR', v_today - 70, 0),
      (v_clients[2], v_projects[1], 'Beta handover',    13500000, 'PKR', v_today - 10, 1),
      (v_clients[2], v_projects[1], 'Final delivery',   13500000, 'PKR', v_today + 20, 2),
      (v_clients[3], v_projects[2], 'Advance 50%',       9000000, 'PKR', v_today - 40, 0),
      (v_clients[3], v_projects[2], 'Go-live',           9000000, 'PKR', v_today + 10, 1),
      (v_clients[1], v_projects[3], 'Advance 30%',      18000000, 'PKR', v_today - 25, 0),
      (v_clients[1], v_projects[3], 'Design sign-off',  12000000, 'PKR', v_today + 15, 1),
      (v_clients[1], v_projects[3], 'Launch',           30000000, 'PKR', v_today + 60, 2),
      (v_clients[4], v_projects[4], 'Full payment',      9000000, 'PKR', v_today + 5,  0),
      (v_clients[5], v_projects[5], 'Fixed price',         250000, 'USD', v_today - 20, 0),
      (v_clients[6], v_projects[6], 'Advance 50%',       1750000, 'PKR', v_today - 2,  0),
      (v_clients[6], v_projects[6], 'On delivery',       1750000, 'PKR', v_today + 9,  1),
      (v_clients[8], v_projects[7], 'Full payment',      8000000, 'PKR', v_today - 340, 0),
      (v_clients[4], null,          'Admission campaign creatives (10)', 3500000, 'PKR', v_today - 28, 0),
      (v_clients[7], null,          'Meta ads setup fee',                2500000, 'PKR', v_today - 18, 0),
      (v_clients[1], null,          'Extra landing page',                4000000, 'PKR', v_today + 4,  0)
    returning id
  )
  select array_agg(id) into v_ids from ins;
  perform public.demo_track('dues', v_ids);
  insert into public.dues (payer_name, payer_phone, title, amount, currency, due_date)
  values ('Rehan (referral)', '0300-5550001', 'Logo + business card design', 1500000, 'PKR', v_today + 2)
  returning id into v_id;
  perform public.demo_track('dues', array[v_id]);

  -- What has already been paid in this story.
  for v_due in
    select d.id from public.dues d
    where d.id = any (v_ids) and d.due_date < v_today - 15 and d.title <> 'Meta ads setup fee'
  loop
    perform public.record_due_payment(
      v_due,
      (select amount from public.dues where id = v_due),
      (select due_date + 2 from public.dues where id = v_due),
      v_methods[1 + floor(random() * 4)::int],
      'TID' || (10000000 + floor(random() * 89999999)::int),
      null, null,
      ('10:00'::time + make_interval(mins => floor(random() * 480)::int))::time
    );
  end loop;
  -- A part payment, and one settled with a small discount.
  select id into v_due from public.dues where id = any (v_ids) and title = 'Beta handover';
  perform public.record_due_payment(v_due, 8000000, v_today - 4, 'bank_transfer', 'IBFT-88213', null, 'Rest promised next week.', '14:35', 'NOVA HEALTH CARE PVT');
  select id into v_due from public.dues where id = any (v_ids) and project_id = v_projects[6] and position = 0;
  perform public.record_due_payment(v_due, 1500000, v_today - 1, 'jazzcash', 'TID 2618374512', null, 'Client asked for 2,500 off.', '21:10', 'FAISAL IQBAL', true);

  -- Subscriptions (prepaid) ------------------------------------------------------
  with ins as (
    insert into public.subscriptions (client_id, plan_id, name, service_type, amount, interval_months, billing_day, start_date, next_due_date, service_ref, status)
    select x.client_id, (select id from public.plans where name = x.plan_name), x.plan_name, x.service, x.amount, x.months,
           extract(day from x.start)::int, x.start, x.start, x.ref, 'active'::public.subscription_status
    from (values
      (v_clients[1],  'Growthify WhatsApp API — 1 Month',  'whatsapp_api'::public.service_type,   1500000, 1,  (v_month - interval '10 months')::date,     '+92 321 4567890', 'active'),
      (v_clients[2],  'Growthify WhatsApp API — 3 Months', 'whatsapp_api'::public.service_type,   4200000, 3,  (v_month - interval '9 months')::date + 4,  '+92 300 1234567', 'active'),
      (v_clients[9],  'Growthify WhatsApp API — 1 Year',   'whatsapp_api'::public.service_type,  15000000, 12, (v_month - interval '6 months')::date + 9,  '+92 300 6611223', 'active'),
      (v_clients[10], 'Growthify WhatsApp API — 1 Month',  'whatsapp_api'::public.service_type,   1500000, 1,  (v_month - interval '4 months')::date + 14, '+92 321 7722334', 'active'),
      (v_clients[11], 'Growthify WhatsApp API — 3 Months', 'whatsapp_api'::public.service_type,   4200000, 3,  (v_month - interval '2 months')::date + 1,  '+92 333 8833445', 'active'),
      (v_clients[12], 'Growthify WhatsApp API — 1 Month',  'whatsapp_api'::public.service_type,   1500000, 1,  (v_month - interval '5 months')::date + 19, '+92 345 9944556', 'active'),
      (v_clients[13], 'Growthify WhatsApp API — 1 Month',  'whatsapp_api'::public.service_type,   1500000, 1,  (v_month - interval '1 month')::date + 2,   '+92 301 1055667', 'active'),
      (v_clients[3],  'Growthify WhatsApp API — 1 Month',  'whatsapp_api'::public.service_type,   1500000, 1,  (v_month - interval '5 months')::date + 19, '+92 333 9876543', 'cancelled'),
      (v_clients[1],  'Meta Ads Management — Monthly',     'ads_management'::public.service_type, 3500000, 1,  (v_month - interval '6 months')::date + 9,  'act_1093844', 'active'),
      (v_clients[4],  'Meta Ads Management — Monthly',     'ads_management'::public.service_type, 2500000, 1,  (v_month - interval '4 months')::date + 14, 'act_2209371', 'active'),
      (v_clients[7],  'Meta Ads Management — Monthly',     'ads_management'::public.service_type, 2000000, 1,  (v_month - interval '7 months')::date + 24, 'act_3318820', 'paused')
    ) as x(client_id, plan_name, service, amount, months, start, ref, status)
    returning id
  )
  select array_agg(id) into v_subs from ins;
  perform public.demo_track('subscriptions', v_subs);

  -- Renew past cycles: most are up to date, one lapsed recently, others due soon.
  for v_id in select unnest(v_subs)
  loop
    for i in 1..14 loop
      exit when (select next_due_date from public.subscriptions where id = v_id) > v_today + 3;
      -- the paused / cancelled ones stopped paying a while ago
      exit when (select service_ref from public.subscriptions where id = v_id) in ('act_3318820', '+92 333 9876543')
            and (select next_due_date from public.subscriptions where id = v_id) >= v_today - 75;
      exit when (select client_id from public.subscriptions where id = v_id) = v_clients[12]
            and (select next_due_date from public.subscriptions where id = v_id) >= v_today - 20;
      perform public.mark_subscription_paid(
        v_id,
        (select least(next_due_date + floor(random() * 3)::int, v_today) from public.subscriptions where id = v_id),
        v_methods[1 + floor(random() * 6)::int],
        'TID' || (10000000 + floor(random() * 89999999)::int),
        null, null, null,
        ('09:00'::time + make_interval(mins => floor(random() * 660)::int))::time,
        null
      );
    end loop;
  end loop;
  update public.subscriptions set status = 'paused' where id = any (v_subs) and service_ref = 'act_3318820';
  update public.subscriptions set status = 'cancelled' where id = any (v_subs) and service_ref = '+92 333 9876543';

  -- Older project income (keeps 12 months of history realistic) ------------------
  with ins as (
    insert into public.transactions (type, amount, currency, date, time, category, method, description, party_name, client_id, project_id, reference)
    select 'income', ((220000 + (11 - g.n) * 30000 + (g.n % 3) * 45000) * 100)::bigint, 'PKR',
           (v_month - make_interval(months => g.n))::date + 7 + (g.n % 2) * 9,
           ('11:00'::time + make_interval(mins => g.n * 23))::time,
           'project', v_methods[1 + g.n % 4], 'Project payment', upper(c.business_name),
           p.client_id, p.id, 'IBFT-' || (40000 + g.n * 137)
    from generate_series(1, 11) as g(n)
    join public.projects p on p.id = v_projects[case when g.n > 8 then 7 else 1 + (g.n % 3) end]
    join public.clients c on c.id = p.client_id
    returning id
  )
  select array_agg(id) into v_ids from ins;
  perform public.demo_track('transactions', v_ids);

  -- Monthly expenses ----------------------------------------------------------------
  for m in 0..11 loop
    with ins as (
      insert into public.transactions (type, amount, currency, date, category, method, description, party_name)
      select 'expense', x.amount, 'PKR', (v_month - make_interval(months => m))::date + x.day_offset, x.category, x.method, x.description, x.party
      from (values
        (6000000,             1,  'rent'::public.tx_category,       'bank_transfer'::public.payment_method, 'Office rent',                       'Landlord — Peoples Colony'),
        (1450000 + m * 20000, 9,  'utilities'::public.tx_category,  'jazzcash'::public.payment_method,      'Electricity (FESCO) + internet',    'FESCO / Nayatel'),
        (1840000 + m * 15000, 3,  'software'::public.tx_category,   'card'::public.payment_method,          'Hosting, AI & software (USD card)', 'Vercel · Supabase · OpenAI'),
        (420000,              14, 'travel'::public.tx_category,     'cash'::public.payment_method,          'Petrol & client visits',            null),
        (300000,              18, 'office'::public.tx_category,     'cash'::public.payment_method,          'Tea, snacks & supplies',            null),
        (case when m % 3 = 0 then 2500000 + m * 100000 else 0 end,
                              12, 'ads_spend'::public.tx_category,  'card'::public.payment_method,          'Growthify brand ads (Meta)',        'Meta Platforms'),
        (case when m % 4 = 1 then 3500000 else 0 end,
                              20, 'freelancer'::public.tx_category, 'easypaisa'::public.payment_method,     'Video editing (freelancer)',        'Waqas — editor')
      ) as x(amount, day_offset, category, method, description, party)
      where x.amount > 0 and (v_month - make_interval(months => m))::date + x.day_offset <= v_today
      returning id
    )
    select array_agg(id) into v_ids from ins;
    perform public.demo_track('transactions', coalesce(v_ids, '{}'));
  end loop;

  -- Opening balance (cash in bank when the books start).
  insert into public.transactions (type, amount, currency, date, category, method, description, party_name, notes)
  values ('income', 150000000, 'PKR', (v_month - interval '12 months')::date + 2, 'other', 'bank_transfer', 'Opening balance', 'Growthify Agency', 'Demo opening balance.')
  returning id into v_id;
  perform public.demo_track('transactions', array[v_id]);

  -- Salaries for fully past months.
  for m in 1..11 loop
    for i in 1..array_length(v_emps, 1) loop
      if (select joined_on from public.employees where id = v_emps[i]) <= (v_month - make_interval(months => m))::date then
        perform public.pay_salary(v_emps[i], (v_month - make_interval(months => m))::date, null,
                                  least((v_month - make_interval(months => m - 1))::date + 1, v_today), 'bank_transfer');
      end if;
    end loop;
  end loop;

  -- Track every transaction created through the money functions above.
  perform public.demo_track('transactions', array(
    select t.id from public.transactions t
    where t.client_id = any (v_clients) or t.employee_id = any (v_emps)
       or t.due_id in (select entity_id from public.demo_records where entity = 'dues')
  ));

  -- Leads --------------------------------------------------------------------------
  with ins as (
    insert into public.leads (name, business, phone, source, service_interest, est_value, stage, next_follow_up, notes, lost_reason, position)
    values
      ('Imran Shah',     'Shah Estate Advisors', '0321-1231231', 'meta_ad',  'whatsapp_api',    1500000, 'new',           v_today,     'Asked for the WhatsApp API 3-month price.', null, 1),
      ('Mehwish Ali',    'Glow Skin Clinic',     '0300-9090909', 'referral', 'custom_software', 25000000, 'contacted',    v_today - 1, 'Wants an appointment CRM.', null, 1),
      ('Tahir Mehmood',  'Mehmood Travels',      '0345-8080808', 'meta_ad',  'ai_automation',   15000000, 'proposal_sent', v_today + 2, 'Proposal v2 sent on WhatsApp.', null, 1),
      ('Ahsan Javed',    'Javed Foods',          '0333-7070707', 'organic',  'ads_management',   3000000, 'negotiation',   v_today + 1, 'Negotiating monthly retainer.', null, 1),
      ('Kiran Naz',      'Little Stars School',  '0312-6060606', 'linkedin', 'web_app',          8000000, 'new',           v_today + 3, null, null, 2),
      ('Zeeshan Haider', 'ZH Motors',            '0301-5050505', 'meta_ad',  'whatsapp_api',     4200000, 'contacted',     v_today + 4, 'Interested in the 3-month plan.', null, 2),
      ('Nadia Hussain',  'Hussain Textiles',     '0322-4040404', 'referral', 'custom_software', 40000000, 'lost',          null,        null, 'Went with an in-house team.', 1)
    returning id
  )
  select array_agg(id) into v_ids from ins;
  perform public.demo_track('leads', v_ids);

  -- Social: 60 days of history for not-yet-connected accounts (flagged as demo).
  with ins as (
    insert into public.social_metrics_daily (social_account_id, date, followers, reach, views, engagement, extra)
    select a.id, d::date,
           case a.platform when 'facebook' then 480 when 'instagram' then 40 when 'linkedin' then 120 else 0 end
             + (60 - (v_today - d::date)) * case a.platform when 'facebook' then 1.5 when 'instagram' then 0.6 when 'linkedin' then 0.4 else 0.05 end,
           (200 + random() * 400)::int, (300 + random() * 900)::int, (10 + random() * 60)::int,
           '{"demo": true}'::jsonb
    from public.social_accounts a
    cross join generate_series(v_today - 60, v_today - 1, interval '1 day') d
    where a.status = 'not_connected'
    on conflict (social_account_id, date) do nothing
    returning id
  )
  select array_agg(id) into v_ids from ins;
  perform public.demo_track('social_metrics_daily', coalesce(v_ids, '{}'));

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
  delete from public.dues          where id in (select entity_id from public.demo_records where entity = 'dues');
  delete from public.subscriptions where id in (select entity_id from public.demo_records where entity = 'subscriptions');
  delete from public.projects      where id in (select entity_id from public.demo_records where entity = 'projects');
  delete from public.leads         where id in (select entity_id from public.demo_records where entity = 'leads');
  -- Clients may have picked up real records meanwhile; keep those clients.
  delete from public.clients c
   where c.id in (select entity_id from public.demo_records where entity = 'clients')
     and not exists (select 1 from public.projects p where p.client_id = c.id)
     and not exists (select 1 from public.subscriptions s where s.client_id = c.id)
     and not exists (select 1 from public.dues d where d.client_id = c.id);
  delete from public.employees     where id in (select entity_id from public.demo_records where entity = 'employees');
  delete from public.demo_records;
  return v_count;
end;
$$;

revoke execute on function public.demo_track(text, uuid[]) from public, anon, authenticated;
revoke execute on function public.load_demo_data() from public, anon;
revoke execute on function public.clear_demo_data() from public, anon;
grant execute on function public.load_demo_data() to authenticated;
grant execute on function public.clear_demo_data() to authenticated;
