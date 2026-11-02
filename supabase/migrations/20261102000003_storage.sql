-- =============================================================================
-- Growthify OS — file storage
--   receipts : private. Payment receipts (owner + manager).
--   files    : private. Project / client documents. Project files are also
--              visible to staff assigned to that project.
--              Path convention: <entity>/<entity_id>/<uuid>-<filename>
--   logos    : public. Company and client logos (images only).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('receipts', 'receipts', false, 10485760,
     array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
  ('files', 'files', false, 26214400, null),
  ('logos', 'logos', true, 2097152,
     array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Is the object in a project folder the caller is assigned to?
create or replace function public.storage_project_access(p_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select split_part(p_name, '/', 1) = 'project'
     and split_part(p_name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and public.is_project_member(split_part(p_name, '/', 2)::uuid)
$$;
grant execute on function public.storage_project_access(text) to authenticated;

-- receipts -------------------------------------------------------------------
create policy "finance reads receipts" on storage.objects
  for select to authenticated using (bucket_id = 'receipts' and (select public.is_finance()));
create policy "finance uploads receipts" on storage.objects
  for insert to authenticated with check (bucket_id = 'receipts' and (select public.is_finance()));
create policy "finance replaces receipts" on storage.objects
  for update to authenticated using (bucket_id = 'receipts' and (select public.is_finance()));
create policy "owner deletes receipts" on storage.objects
  for delete to authenticated using (bucket_id = 'receipts' and (select public.is_owner()));

-- files ----------------------------------------------------------------------
create policy "read files bucket" on storage.objects
  for select to authenticated using (
    bucket_id = 'files' and ((select public.is_finance()) or public.storage_project_access(name))
  );
create policy "upload files bucket" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'files' and ((select public.is_finance()) or public.storage_project_access(name))
  );
create policy "delete files bucket" on storage.objects
  for delete to authenticated using (
    bucket_id = 'files' and ((select public.is_finance()) or owner_id = (select auth.uid())::text)
  );

-- logos (public read through the CDN URL) -------------------------------------
create policy "finance uploads logos" on storage.objects
  for insert to authenticated with check (bucket_id = 'logos' and (select public.is_finance()));
create policy "finance replaces logos" on storage.objects
  for update to authenticated using (bucket_id = 'logos' and (select public.is_finance()));
create policy "finance deletes logos" on storage.objects
  for delete to authenticated using (bucket_id = 'logos' and (select public.is_finance()));
