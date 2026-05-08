create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  couple_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique,
  created_by uuid references public.user_profiles (id) on delete cascade,
  created_at timestamptz default now()
);

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
  created_by uuid references public.user_profiles (id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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
  status text check (status in ('pending','in_progress','done')) default 'pending',
  due_date date,
  assigned_to uuid references public.user_profiles (id) on delete set null,
  created_by uuid references public.user_profiles (id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

  if target_couple.id is null or target_couple.created_at < now() - interval '48 hours' then
    raise exception 'Código de invitación inválido o expirado.';
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
