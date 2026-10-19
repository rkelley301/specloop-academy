-- SpecLoop Academy: private file storage.
--
-- Two private buckets. Objects live under "{user_id}/{file_id}" and are
-- reachable only by that signed-in user. There are no policies for the anon
-- role and the buckets are not public, so public URLs don't resolve.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('audio', 'audio', false, 52428800,
   array['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave']),
  ('sources', 'sources', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "specloop audio: owner select" on storage.objects for select to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "specloop audio: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "specloop audio: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "specloop audio: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "specloop sources: owner select" on storage.objects for select to authenticated
  using (bucket_id = 'sources' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "specloop sources: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'sources' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "specloop sources: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'sources' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'sources' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "specloop sources: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'sources' and (storage.foldername(name))[1] = (select auth.uid())::text);
