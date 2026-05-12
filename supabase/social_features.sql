alter table public.couples
  add column if not exists avatar_url text;

alter table public.user_profiles
  add column if not exists default_event_color text default '#ef9fb5';

alter table public.events
  add column if not exists actor_type text default 'user';

alter table public.events
  add column if not exists status text default 'pending',
  add column if not exists status_note text;

do $$
begin
  alter table public.events
    add constraint events_actor_type_check
    check (actor_type in ('user','couple'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.events
    add constraint events_status_check
    check (status in ('pending','done','not_done','postponed'));
exception
  when duplicate_object then null;
end $$;

alter table public.tasks
  add column if not exists status_note text;

alter table public.tasks
  drop constraint if exists tasks_status_check;

alter table public.tasks
  add constraint tasks_status_check
  check (status in ('pending','in_progress','done','not_done','postponed'));

drop policy if exists "couples_update_member" on public.couples;
create policy "couples_update_member"
on public.couples for update
using (public.is_couple_member(id))
with check (public.is_couple_member(id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_read_authenticated" on storage.objects;
create policy "avatars_read_authenticated"
on storage.objects for select
to authenticated
using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own_user_photo" on storage.objects;
create policy "avatars_insert_own_user_photo"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and name = 'users/' || auth.uid()::text || '/profile.webp'
);

drop policy if exists "avatars_update_own_user_photo" on storage.objects;
create policy "avatars_update_own_user_photo"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and name = 'users/' || auth.uid()::text || '/profile.webp'
)
with check (
  bucket_id = 'avatars'
  and name = 'users/' || auth.uid()::text || '/profile.webp'
);

drop policy if exists "avatars_insert_couple_photo" on storage.objects;
create policy "avatars_insert_couple_photo"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = 'couples'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name, '/', 3) = 'couple.webp'
  and public.is_couple_member(split_part(name, '/', 2)::uuid)
);

drop policy if exists "avatars_update_couple_photo" on storage.objects;
create policy "avatars_update_couple_photo"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = 'couples'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name, '/', 3) = 'couple.webp'
  and public.is_couple_member(split_part(name, '/', 2)::uuid)
)
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = 'couples'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name, '/', 3) = 'couple.webp'
  and public.is_couple_member(split_part(name, '/', 2)::uuid)
);

notify pgrst, 'reload schema';
