create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  default_event_color text default '#ef9fb5',
  couple_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique,
  avatar_url text,
  created_by uuid references public.user_profiles (id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.couples
  add column if not exists avatar_url text;

alter table public.user_profiles
  add column if not exists default_event_color text default '#ef9fb5';

alter table public.user_profiles
  drop constraint if exists user_profiles_couple_id_fkey,
  add constraint user_profiles_couple_id_fkey
  foreign key (couple_id) references public.couples (id) on delete set null;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples (id) on delete cascade,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  color text,
  is_shared boolean default true,
  actor_type text check (actor_type in ('user','couple')) default 'user',
  status text check (status in ('pending','done','not_done','postponed')) default 'pending',
  status_note text,
  created_by uuid references public.user_profiles (id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples (id) on delete cascade,
  title text not null,
  content text not null,
  category text,
  is_shared boolean default false,
  created_by uuid references public.user_profiles (id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples (id) on delete cascade,
  title text not null,
  description text,
  priority text check (priority in ('low','medium','high')),
  status text check (status in ('pending','in_progress','done','not_done','postponed')) default 'pending',
  status_note text,
  due_date date,
  assigned_to uuid references public.user_profiles (id) on delete set null,
  created_by uuid references public.user_profiles (id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tasks
  add column if not exists status_note text;

alter table public.tasks
  drop constraint if exists tasks_status_check;

alter table public.tasks
  add constraint tasks_status_check
  check (status in ('pending','in_progress','done','not_done','postponed'));

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples (id) on delete cascade,
  amount numeric not null,
  category text not null,
  description text,
  date date not null,
  paid_by uuid references public.user_profiles (id) on delete cascade,
  split_type text check (split_type in ('50_50','one_paid','custom')),
  split_details jsonb,
  settled boolean default false,
  created_by uuid references public.user_profiles (id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples (id) on delete cascade,
  title text not null,
  target_amount numeric not null,
  current_amount numeric default 0,
  deadline date,
  created_by uuid references public.user_profiles (id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.debt_settlements (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples (id) on delete cascade,
  amount numeric not null,
  from_user uuid references public.user_profiles (id) on delete cascade,
  to_user uuid references public.user_profiles (id) on delete cascade,
  settled_at timestamptz,
  note text,
  created_at timestamptz default now()
);

create or replace view public.couple_members
with (security_invoker = true) as
select couple_id, id as user_id
from public.user_profiles
where couple_id is not null;

create or replace function public.is_couple_member(target_couple_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.couple_members
    where couple_id = target_couple_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.same_couple(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_profiles me
    join public.user_profiles other on other.couple_id = me.couple_id
    where me.id = auth.uid()
      and other.id = target_user_id
      and me.couple_id is not null
  );
$$;

create or replace function public.unlink_couple(target_couple_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_couple_member(target_couple_id) then
    raise exception 'Not allowed';
  end if;

  update public.user_profiles
  set couple_id = null,
      updated_at = now()
  where couple_id = target_couple_id;
end;
$$;

create or replace function public.create_couple_for_current_user(new_invite_code text)
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.user_profiles;
  created_couple public.couples;
begin
  select *
  into current_profile
  from public.user_profiles
  where id = auth.uid();

  if current_profile.id is null then
    raise exception 'Perfil de usuario no encontrado';
  end if;

  if current_profile.couple_id is not null then
    raise exception 'Ya tienes una pareja vinculada';
  end if;

  insert into public.couples (invite_code, created_by)
  values (upper(new_invite_code), auth.uid())
  returning * into created_couple;

  update public.user_profiles
  set couple_id = created_couple.id,
      updated_at = now()
  where id = auth.uid();

  return created_couple;
end;
$$;

create or replace function public.join_couple_by_code(raw_invite_code text)
returns public.user_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.user_profiles;
  target_couple public.couples;
  member_count integer;
  partner_profile public.user_profiles;
begin
  select *
  into current_profile
  from public.user_profiles
  where id = auth.uid();

  if current_profile.id is null then
    raise exception 'Perfil de usuario no encontrado';
  end if;

  if current_profile.couple_id is not null then
    raise exception 'Ya tienes una pareja vinculada';
  end if;

  select *
  into target_couple
  from public.couples
  where invite_code = upper(trim(raw_invite_code))
  limit 1;

  if target_couple.id is null then
    raise exception 'Código de invitación inválido.';
  end if;

  if target_couple.created_at < now() - interval '48 hours' then
    raise exception 'Código de invitación expirado.';
  end if;

  select count(*)
  into member_count
  from public.user_profiles
  where couple_id = target_couple.id;

  if member_count >= 2 then
    raise exception 'Este código ya fue usado';
  end if;

  update public.user_profiles
  set couple_id = target_couple.id,
      updated_at = now()
  where id in (auth.uid(), target_couple.created_by);

  select *
  into partner_profile
  from public.user_profiles
  where id = target_couple.created_by;

  return partner_profile;
end;
$$;

revoke all on function public.create_couple_for_current_user(text) from public;
grant execute on function public.create_couple_for_current_user(text) to authenticated;

revoke all on function public.join_couple_by_code(text) from public;
grant execute on function public.join_couple_by_code(text) to authenticated;

revoke all on function public.unlink_couple(uuid) from public;
grant execute on function public.unlink_couple(uuid) to authenticated;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, full_name, avatar_url, couple_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    null,
    null
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.user_profiles (id, full_name, avatar_url, couple_id)
select id, coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), null, null
from auth.users
on conflict (id) do nothing;

alter table public.user_profiles enable row level security;
alter table public.couples enable row level security;
alter table public.events enable row level security;
alter table public.notes enable row level security;
alter table public.tasks enable row level security;
alter table public.expenses enable row level security;
alter table public.savings_goals enable row level security;
alter table public.debt_settlements enable row level security;

drop policy if exists "profiles_select_own_or_same_couple" on public.user_profiles;
create policy "profiles_select_own_or_same_couple"
on public.user_profiles for select
using (auth.uid() = id or public.same_couple(id));

drop policy if exists "profiles_update_own" on public.user_profiles;
create policy "profiles_update_own"
on public.user_profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.user_profiles;
create policy "profiles_insert_own"
on public.user_profiles for insert
with check (auth.uid() = id);

drop policy if exists "couples_select_created_or_member" on public.couples;
create policy "couples_select_created_or_member"
on public.couples for select
using (auth.uid() = created_by or public.is_couple_member(id));

drop policy if exists "couples_insert_created_by" on public.couples;
create policy "couples_insert_created_by"
on public.couples for insert
with check (auth.uid() = created_by);

drop policy if exists "couples_update_member" on public.couples;
create policy "couples_update_member"
on public.couples for update
using (public.is_couple_member(id))
with check (public.is_couple_member(id));

drop policy if exists "events_select_member" on public.events;
create policy "events_select_member" on public.events for select using (public.is_couple_member(couple_id));
drop policy if exists "events_insert_member" on public.events;
create policy "events_insert_member" on public.events for insert with check (public.is_couple_member(couple_id));
drop policy if exists "events_update_creator_or_member" on public.events;
create policy "events_update_creator_or_member" on public.events for update using (auth.uid() = created_by or public.is_couple_member(couple_id));
drop policy if exists "events_delete_creator" on public.events;
create policy "events_delete_creator" on public.events for delete using (auth.uid() = created_by);

drop policy if exists "notes_select_member" on public.notes;
create policy "notes_select_member" on public.notes for select using (public.is_couple_member(couple_id));
drop policy if exists "notes_insert_member" on public.notes;
create policy "notes_insert_member" on public.notes for insert with check (public.is_couple_member(couple_id));
drop policy if exists "notes_update_creator_or_member" on public.notes;
create policy "notes_update_creator_or_member" on public.notes for update using (auth.uid() = created_by or public.is_couple_member(couple_id));
drop policy if exists "notes_delete_creator" on public.notes;
create policy "notes_delete_creator" on public.notes for delete using (auth.uid() = created_by);

drop policy if exists "tasks_select_member" on public.tasks;
create policy "tasks_select_member" on public.tasks for select using (public.is_couple_member(couple_id));
drop policy if exists "tasks_insert_member" on public.tasks;
create policy "tasks_insert_member" on public.tasks for insert with check (public.is_couple_member(couple_id));
drop policy if exists "tasks_update_creator_or_member" on public.tasks;
create policy "tasks_update_creator_or_member" on public.tasks for update using (auth.uid() = created_by or public.is_couple_member(couple_id));
drop policy if exists "tasks_delete_creator" on public.tasks;
create policy "tasks_delete_creator" on public.tasks for delete using (auth.uid() = created_by);

drop policy if exists "expenses_select_member" on public.expenses;
create policy "expenses_select_member" on public.expenses for select using (public.is_couple_member(couple_id));
drop policy if exists "expenses_insert_member" on public.expenses;
create policy "expenses_insert_member" on public.expenses for insert with check (public.is_couple_member(couple_id));
drop policy if exists "expenses_update_creator_or_member" on public.expenses;
create policy "expenses_update_creator_or_member" on public.expenses for update using (auth.uid() = created_by or public.is_couple_member(couple_id));
drop policy if exists "expenses_delete_creator" on public.expenses;
create policy "expenses_delete_creator" on public.expenses for delete using (auth.uid() = created_by);

drop policy if exists "savings_select_member" on public.savings_goals;
create policy "savings_select_member" on public.savings_goals for select using (public.is_couple_member(couple_id));
drop policy if exists "savings_insert_member" on public.savings_goals;
create policy "savings_insert_member" on public.savings_goals for insert with check (public.is_couple_member(couple_id));
drop policy if exists "savings_update_creator_or_member" on public.savings_goals;
create policy "savings_update_creator_or_member" on public.savings_goals for update using (auth.uid() = created_by or public.is_couple_member(couple_id));
drop policy if exists "savings_delete_creator" on public.savings_goals;
create policy "savings_delete_creator" on public.savings_goals for delete using (auth.uid() = created_by);

drop policy if exists "settlements_select_member" on public.debt_settlements;
create policy "settlements_select_member" on public.debt_settlements for select using (public.is_couple_member(couple_id));
drop policy if exists "settlements_insert_member" on public.debt_settlements;
create policy "settlements_insert_member" on public.debt_settlements for insert with check (public.is_couple_member(couple_id));
drop policy if exists "settlements_update_member" on public.debt_settlements;
create policy "settlements_update_member" on public.debt_settlements for update using (public.is_couple_member(couple_id));
drop policy if exists "settlements_delete_from_user" on public.debt_settlements;
create policy "settlements_delete_from_user" on public.debt_settlements for delete using (auth.uid() = from_user);

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

do $$
begin
  execute 'alter publication supabase_realtime add table public.events';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.tasks';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.expenses';
exception
  when duplicate_object then null;
end $$;

create table if not exists public.release_notes (
  id text primary key,
  title text not null,
  summary text not null,
  highlights jsonb not null default '[]'::jsonb,
  published_at timestamptz default now(),
  is_active boolean default true
);

create table if not exists public.release_note_reads (
  release_id text references public.release_notes (id) on delete cascade,
  user_id uuid references public.user_profiles (id) on delete cascade,
  read_at timestamptz default now(),
  primary key (release_id, user_id)
);

create table if not exists public.activity_notifications (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples (id) on delete cascade,
  actor_id uuid references public.user_profiles (id) on delete cascade,
  target_user_id uuid references public.user_profiles (id) on delete cascade,
  module text check (module in ('calendar','tasks','notes','finances','couple','profile')),
  action text check (action in ('created','updated','deleted','status_changed','settled','uploaded')),
  entity_type text not null,
  entity_id uuid,
  title text not null,
  body text,
  created_at timestamptz default now(),
  read_at timestamptz,
  dismissed_at timestamptz
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples (id) on delete cascade,
  actor_id uuid references public.user_profiles (id) on delete set null,
  module text not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);

create index if not exists activity_notifications_target_created_idx
on public.activity_notifications (target_user_id, created_at desc)
where read_at is null;

create index if not exists audit_logs_couple_created_idx
on public.audit_logs (couple_id, created_at desc);

alter table public.release_notes enable row level security;
alter table public.release_note_reads enable row level security;
alter table public.activity_notifications enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "release_notes_select_authenticated" on public.release_notes;
create policy "release_notes_select_authenticated"
on public.release_notes for select
to authenticated
using (is_active = true);

drop policy if exists "release_reads_select_own" on public.release_note_reads;
create policy "release_reads_select_own"
on public.release_note_reads for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "release_reads_insert_own" on public.release_note_reads;
create policy "release_reads_insert_own"
on public.release_note_reads for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "release_reads_update_own" on public.release_note_reads;
create policy "release_reads_update_own"
on public.release_note_reads for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "activity_notifications_select_target" on public.activity_notifications;
create policy "activity_notifications_select_target"
on public.activity_notifications for select
to authenticated
using (auth.uid() = target_user_id);

drop policy if exists "activity_notifications_insert_member" on public.activity_notifications;
create policy "activity_notifications_insert_member"
on public.activity_notifications for insert
to authenticated
with check (
  actor_id = auth.uid()
  and target_user_id <> auth.uid()
  and public.is_couple_member(couple_id)
  and exists (
    select 1
    from public.user_profiles target_profile
    where target_profile.id = target_user_id
      and target_profile.couple_id = activity_notifications.couple_id
  )
);

drop policy if exists "activity_notifications_update_target" on public.activity_notifications;
create policy "activity_notifications_update_target"
on public.activity_notifications for update
to authenticated
using (auth.uid() = target_user_id)
with check (auth.uid() = target_user_id);

drop policy if exists "audit_logs_select_member" on public.audit_logs;
create policy "audit_logs_select_member"
on public.audit_logs for select
to authenticated
using (public.is_couple_member(couple_id));

drop policy if exists "audit_logs_insert_member" on public.audit_logs;
create policy "audit_logs_insert_member"
on public.audit_logs for insert
to authenticated
with check (
  actor_id = auth.uid()
  and public.is_couple_member(couple_id)
);

insert into public.release_notes (id, title, summary, highlights, published_at, is_active)
values
  (
    '2026-05-12-agenda-alerts',
    'Novedades en agenda y seguimiento',
    'DuoLife ahora avisa mejor cuando hay cambios importantes para la pareja.',
    '["Inicio muestra avisos cuando tu pareja agrega algo nuevo.","Los eventos vencidos pendientes piden confirmar si se realizaron.","Puedes definir un color predeterminado para eventos desde Perfil."]'::jsonb,
    '2026-05-12T00:00:00Z',
    true
  ),
  (
    '2026-05-12-release-inbox',
    'Centro de novedades no leidas',
    'Las actualizaciones ahora se guardan por usuario hasta que cada persona las marque como leidas.',
    '["Si se publican varias mejoras en un dia, se muestran todas las no vistas.","Cada usuario confirma sus novedades de forma independiente.","Las tareas pueden quedar asignadas a ambos cuando son responsabilidad compartida."]'::jsonb,
    '2026-05-12T00:01:00Z',
    true
  ),
  (
    '2026-05-12-flexible-expense-splits',
    'Division flexible de gastos',
    'Finanzas ahora permite dividir gastos con proporciones reales de pareja, no solo 50/50.',
    '["Agregamos presets rapidos: 50/50, 60/40, 70/30, 80/20 y 100/0.","Ahora puedes usar porcentajes personalizados o montos exactos.","Antes de guardar veras quien pago, cuanto corresponde a cada uno y quien queda debiendo."]'::jsonb,
    '2026-05-12T00:02:00Z',
    true
  ),
  (
    '2026-05-12-supabase-reliability',
    'Novedades y actividad con datos reales',
    'Las alertas importantes ahora viven en Supabase y se leen por usuario.',
    '["Las novedades ya no dependen del navegador donde iniciaste sesion.","La actividad de pareja queda preparada para mostrarse a quien corresponde.","Se agrego auditoria basica para cambios importantes."]'::jsonb,
    '2026-05-12T00:03:00Z',
    true
  ),
  (
    '2026-05-12-finance-dashboard-dop',
    'Finanzas en DOP y resumen mensual',
    'Finanzas ahora trabaja en peso dominicano y muestra un resumen mensual mas claro.',
    '["La moneda global cambio a peso dominicano DOP.","Finanzas ahora tiene selector de mes, balance, gastos del mes y monto abierto por liquidar.","La grafica por categoria ahora se ordena de mayor a menor y muestra un estado vacio con accion rapida."]'::jsonb,
    '2026-05-12T00:04:00Z',
    true
  )
on conflict (id) do update
set title = excluded.title,
    summary = excluded.summary,
    highlights = excluded.highlights,
    published_at = excluded.published_at,
    is_active = excluded.is_active;
