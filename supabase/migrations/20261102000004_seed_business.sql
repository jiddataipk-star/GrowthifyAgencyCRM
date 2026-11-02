-- =============================================================================
-- Growthify OS — business facts (safe to run in production).
-- No client or financial records here: real data is entered through the app.
-- Plan prices are left at 0 so the owner sets them in Settings → Services & plans.
-- WhatsApp API is sold prepaid for 1 month, 3 months or 1 year.
-- =============================================================================

insert into public.settings (company_name, tagline, email, whatsapp_number, city, country,
                             default_currency, timezone)
select 'Growthify Agency',
       'We build the systems your business runs on.',
       'bymegrowthify@gmail.com',
       '+923216312898',
       'Faisalabad',
       'Pakistan',
       'PKR',
       'Asia/Karachi'
where not exists (select 1 from public.settings);

insert into public.services (name, type, is_recurring) values
  ('Custom Software Development', 'custom_software', false),
  ('AI Solutions & Automation',   'ai_automation',   false),
  ('Web & App Development',       'web_app',         false),
  ('Growthify WhatsApp API',      'whatsapp_api',    true),
  ('Meta Ads Management',         'ads_management',  true),
  ('TikTok Ads',                  'ads_management',  true)
on conflict (name) do nothing;

insert into public.plans (name, service_type, amount, currency, interval_months) values
  ('Growthify WhatsApp API — 1 Month',  'whatsapp_api',   0, 'PKR', 1),
  ('Growthify WhatsApp API — 3 Months', 'whatsapp_api',   0, 'PKR', 3),
  ('Growthify WhatsApp API — 1 Year',   'whatsapp_api',   0, 'PKR', 12),
  ('Meta Ads Management — Monthly',     'ads_management', 0, 'PKR', 1),
  ('TikTok Ads — Monthly',              'ads_management', 0, 'PKR', 1)
on conflict (name) do nothing;

insert into public.social_accounts (platform, connection, name, handle, profile_url, status) values
  ('facebook',  'system_user', 'Growthify Agency', 'GrowthifyAgencypk',  'https://www.facebook.com/GrowthifyAgencypk',      'not_connected'),
  ('instagram', 'system_user', 'Growthify Agency', 'growthifyagencypk',  'https://www.instagram.com/growthifyagencypk',     'not_connected'),
  ('youtube',   'oauth',       'Growthify Agency', '@growthifyagencypk', 'https://www.youtube.com/@growthifyagencypk',      'not_connected'),
  ('threads',   'oauth',       'Growthify Agency', 'growthifyagencypk',  'https://www.threads.com/@growthifyagencypk',      'not_connected'),
  ('linkedin',  'manual',      'Growthify Agency', null,                 null,                                              'not_connected')
on conflict (platform, handle) do nothing;
