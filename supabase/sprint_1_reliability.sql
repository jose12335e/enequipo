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
  )
on conflict (id) do update
set title = excluded.title,
    summary = excluded.summary,
    highlights = excluded.highlights,
    published_at = excluded.published_at,
    is_active = excluded.is_active;
