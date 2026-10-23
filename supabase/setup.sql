-- RepFuel cloud backup. Paste into Supabase › SQL Editor and press Run (safe to run again).
-- A private bucket "backups" with one folder per account; each signed-in person can only see and change their own.

insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

drop policy if exists "RepFuel backups: read own" on storage.objects;
drop policy if exists "RepFuel backups: add own" on storage.objects;
drop policy if exists "RepFuel backups: replace own" on storage.objects;
drop policy if exists "RepFuel backups: delete own" on storage.objects;

create policy "RepFuel backups: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "RepFuel backups: add own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "RepFuel backups: replace own" on storage.objects
  for update to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "RepFuel backups: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid()::text));
