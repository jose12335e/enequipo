create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  owner_user_id uuid references public.user_profiles (id) on delete set null,
  name text not null,
  type text not null check (type in ('efectivo','banco','tarjeta_credito','tarjeta_debito','ahorro','prestamo','otro')),
  initial_balance numeric not null default 0,
  current_balance numeric not null default 0,
  currency text not null default 'DOP',
  color text,
  icon text,
  is_shared boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  name text not null,
  kind text not null default 'expense' check (kind in ('expense','income','transfer','saving','debt')),
  color text,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, name)
);

create table if not exists public.finance_subcategories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  category_id uuid not null references public.finance_categories (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  created_by uuid references public.user_profiles (id) on delete set null,
  paid_by uuid references public.user_profiles (id) on delete set null,
  assigned_to uuid references public.user_profiles (id) on delete set null,
  type text not null check (type in ('expense','income','transfer','settlement','saving','refund','debt_payment','adjustment','recurring_expense')),
  amount numeric not null check (amount >= 0),
  currency text not null default 'DOP',
  category_id uuid references public.finance_categories (id) on delete set null,
  subcategory_id uuid references public.finance_subcategories (id) on delete set null,
  account_id uuid references public.finance_accounts (id) on delete set null,
  title text not null,
  description text,
  transaction_date date not null,
  status text not null default 'posted' check (status in ('pending','posted','cancelled','refunded','settled')),
  split_type text check (split_type in ('50_50','one_paid','custom')),
  split_data jsonb,
  is_shared boolean not null default true,
  is_settled boolean not null default false,
  source_expense_id uuid unique references public.expenses (id) on delete set null,
  source_settlement_id uuid unique references public.debt_settlements (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.expenses
  add column if not exists title text,
  add column if not exists currency text not null default 'DOP',
  add column if not exists category_id uuid references public.finance_categories (id) on delete set null,
  add column if not exists subcategory_id uuid references public.finance_subcategories (id) on delete set null,
  add column if not exists account_id uuid references public.finance_accounts (id) on delete set null,
  add column if not exists assigned_to uuid references public.user_profiles (id) on delete set null,
  add column if not exists status text not null default 'posted',
  add column if not exists is_shared boolean not null default true,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

do $$
begin
  alter table public.expenses
    add constraint expenses_status_check
    check (status in ('pending','posted','cancelled','refunded','settled'));
exception
  when duplicate_object then null;
end $$;

alter table public.debt_settlements
  add column if not exists payment_method text,
  add column if not exists settlement_date date not null default current_date,
  add column if not exists linked_expense_ids uuid[] not null default '{}',
  add column if not exists created_by uuid references public.user_profiles (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

create table if not exists public.settlement_expenses (
  settlement_id uuid not null references public.debt_settlements (id) on delete cascade,
  expense_id uuid not null references public.expenses (id) on delete cascade,
  amount_applied numeric not null default 0,
  created_at timestamptz not null default now(),
  primary key (settlement_id, expense_id)
);

create index if not exists finance_accounts_couple_idx on public.finance_accounts (couple_id, is_active);
create index if not exists finance_categories_couple_idx on public.finance_categories (couple_id, is_active, sort_order);
create index if not exists finance_subcategories_category_idx on public.finance_subcategories (category_id, is_active, sort_order);
create index if not exists finance_transactions_couple_date_idx on public.finance_transactions (couple_id, transaction_date desc);
create index if not exists finance_transactions_month_idx on public.finance_transactions (couple_id, type, transaction_date desc) where deleted_at is null;
create index if not exists expenses_couple_deleted_idx on public.expenses (couple_id, date desc) where deleted_at is null;
create index if not exists settlement_expenses_expense_idx on public.settlement_expenses (expense_id);

alter table public.finance_accounts enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_subcategories enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.settlement_expenses enable row level security;

drop policy if exists "finance_accounts_select_member" on public.finance_accounts;
create policy "finance_accounts_select_member" on public.finance_accounts for select using (public.is_couple_member(couple_id));
drop policy if exists "finance_accounts_insert_member" on public.finance_accounts;
create policy "finance_accounts_insert_member" on public.finance_accounts for insert with check (public.is_couple_member(couple_id));
drop policy if exists "finance_accounts_update_member" on public.finance_accounts;
create policy "finance_accounts_update_member" on public.finance_accounts for update using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));

drop policy if exists "finance_categories_select_member" on public.finance_categories;
create policy "finance_categories_select_member" on public.finance_categories for select using (public.is_couple_member(couple_id));
drop policy if exists "finance_categories_insert_member" on public.finance_categories;
create policy "finance_categories_insert_member" on public.finance_categories for insert with check (public.is_couple_member(couple_id));
drop policy if exists "finance_categories_update_member" on public.finance_categories;
create policy "finance_categories_update_member" on public.finance_categories for update using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));

drop policy if exists "finance_subcategories_select_member" on public.finance_subcategories;
create policy "finance_subcategories_select_member" on public.finance_subcategories for select using (public.is_couple_member(couple_id));
drop policy if exists "finance_subcategories_insert_member" on public.finance_subcategories;
create policy "finance_subcategories_insert_member" on public.finance_subcategories for insert with check (public.is_couple_member(couple_id));
drop policy if exists "finance_subcategories_update_member" on public.finance_subcategories;
create policy "finance_subcategories_update_member" on public.finance_subcategories for update using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));

drop policy if exists "finance_transactions_select_member" on public.finance_transactions;
create policy "finance_transactions_select_member" on public.finance_transactions for select using (public.is_couple_member(couple_id));
drop policy if exists "finance_transactions_insert_member" on public.finance_transactions;
create policy "finance_transactions_insert_member" on public.finance_transactions for insert with check (public.is_couple_member(couple_id));
drop policy if exists "finance_transactions_update_member" on public.finance_transactions;
create policy "finance_transactions_update_member" on public.finance_transactions for update using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));

drop policy if exists "settlement_expenses_select_member" on public.settlement_expenses;
create policy "settlement_expenses_select_member" on public.settlement_expenses for select using (
  exists (
    select 1 from public.debt_settlements s
    where s.id = settlement_expenses.settlement_id
      and public.is_couple_member(s.couple_id)
  )
);
drop policy if exists "settlement_expenses_insert_member" on public.settlement_expenses;
create policy "settlement_expenses_insert_member" on public.settlement_expenses for insert with check (
  exists (
    select 1 from public.debt_settlements s
    join public.expenses e on e.id = settlement_expenses.expense_id
    where s.id = settlement_expenses.settlement_id
      and e.couple_id = s.couple_id
      and public.is_couple_member(s.couple_id)
  )
);
drop policy if exists "settlement_expenses_update_member" on public.settlement_expenses;
create policy "settlement_expenses_update_member" on public.settlement_expenses for update using (
  exists (
    select 1 from public.debt_settlements s
    where s.id = settlement_expenses.settlement_id
      and public.is_couple_member(s.couple_id)
  )
);
drop policy if exists "settlement_expenses_delete_member" on public.settlement_expenses;
create policy "settlement_expenses_delete_member" on public.settlement_expenses for delete using (
  exists (
    select 1 from public.debt_settlements s
    where s.id = settlement_expenses.settlement_id
      and public.is_couple_member(s.couple_id)
  )
);

insert into public.finance_categories (couple_id, name, kind, color, icon, sort_order)
select c.id, seed.name, 'expense', seed.color, seed.icon, seed.sort_order
from public.couples c
cross join (
  values
    ('Comida', '#fb7185', 'utensils', 10),
    ('Transporte', '#60a5fa', 'car', 20),
    ('Casa', '#f59e0b', 'home', 30),
    ('Salud', '#34d399', 'heart-pulse', 40),
    ('Ocio', '#a78bfa', 'sparkles', 50),
    ('Educacion', '#38bdf8', 'graduation-cap', 60),
    ('Servicios', '#f97316', 'plug', 70),
    ('Regalos', '#f472b6', 'gift', 80),
    ('Viajes', '#2dd4bf', 'plane', 90),
    ('Deudas', '#ef4444', 'receipt', 100),
    ('Ahorro', '#22c55e', 'piggy-bank', 110),
    ('Otros', '#94a3b8', 'circle-dollar-sign', 120)
) as seed(name, color, icon, sort_order)
on conflict (couple_id, name) do nothing;

insert into public.finance_subcategories (couple_id, category_id, name, sort_order)
select fc.couple_id, fc.id, seed.subcategory_name, seed.sort_order
from public.finance_categories fc
join (
  values
    ('Comida', 'Restaurante', 10),
    ('Comida', 'Delivery', 20),
    ('Comida', 'Supermercado', 30),
    ('Transporte', 'Uber', 10),
    ('Transporte', 'Gasolina', 20),
    ('Transporte', 'Peaje', 30),
    ('Transporte', 'Parqueo', 40),
    ('Casa', 'Renta', 10),
    ('Casa', 'Mantenimiento', 20),
    ('Casa', 'Compra del hogar', 30)
) as seed(category_name, subcategory_name, sort_order)
on fc.name = seed.category_name
on conflict (category_id, name) do nothing;

insert into public.finance_accounts (couple_id, owner_user_id, name, type, initial_balance, current_balance, currency, color, icon, is_shared)
select c.id, c.created_by, 'Efectivo compartido', 'efectivo', 0, 0, 'DOP', '#ef9fb5', 'wallet', true
from public.couples c
where not exists (
  select 1 from public.finance_accounts fa
  where fa.couple_id = c.id
)
on conflict do nothing;

update public.expenses e
set title = coalesce(e.title, nullif(e.description, ''), e.category),
    currency = coalesce(e.currency, 'DOP'),
    category_id = coalesce(e.category_id, fc.id),
    account_id = coalesce(e.account_id, fa.id),
    updated_at = coalesce(e.updated_at, e.created_at, now())
from public.finance_categories fc
left join public.finance_accounts fa on fa.couple_id = fc.couple_id and fa.is_active = true
where fc.couple_id = e.couple_id
  and lower(fc.name) = lower(e.category)
  and e.deleted_at is null;

insert into public.finance_transactions (
  couple_id,
  created_by,
  paid_by,
  assigned_to,
  type,
  amount,
  currency,
  category_id,
  subcategory_id,
  account_id,
  title,
  description,
  transaction_date,
  status,
  split_type,
  split_data,
  is_shared,
  is_settled,
  source_expense_id,
  created_at,
  updated_at
)
select
  e.couple_id,
  e.created_by,
  e.paid_by,
  e.assigned_to,
  'expense',
  e.amount,
  coalesce(e.currency, 'DOP'),
  e.category_id,
  e.subcategory_id,
  e.account_id,
  coalesce(e.title, e.category),
  e.description,
  e.date,
  coalesce(e.status, 'posted'),
  e.split_type,
  e.split_details,
  coalesce(e.is_shared, true),
  coalesce(e.settled, false),
  e.id,
  e.created_at,
  e.updated_at
from public.expenses e
where e.deleted_at is null
on conflict (source_expense_id) do update
set amount = excluded.amount,
    currency = excluded.currency,
    category_id = excluded.category_id,
    subcategory_id = excluded.subcategory_id,
    account_id = excluded.account_id,
    title = excluded.title,
    description = excluded.description,
    transaction_date = excluded.transaction_date,
    status = excluded.status,
    split_type = excluded.split_type,
    split_data = excluded.split_data,
    is_settled = excluded.is_settled,
    updated_at = now();

insert into public.finance_transactions (
  couple_id,
  created_by,
  paid_by,
  assigned_to,
  type,
  amount,
  currency,
  title,
  description,
  transaction_date,
  status,
  is_shared,
  is_settled,
  source_settlement_id,
  created_at,
  updated_at
)
select
  s.couple_id,
  s.created_by,
  s.from_user,
  s.to_user,
  'settlement',
  s.amount,
  'DOP',
  'Liquidacion de deuda',
  s.note,
  coalesce(s.settlement_date, s.settled_at::date, s.created_at::date),
  'settled',
  true,
  true,
  s.id,
  s.created_at,
  coalesce(s.updated_at, s.created_at)
from public.debt_settlements s
where s.deleted_at is null
on conflict (source_settlement_id) do update
set amount = excluded.amount,
    description = excluded.description,
    transaction_date = excluded.transaction_date,
    updated_at = now();

insert into public.release_notes (id, title, summary, highlights, published_at, is_active)
values (
  '2026-05-12-finance-phase-1-foundation',
  'Base financiera profesional',
  'Finanzas ahora queda preparada con cuentas, categorias normalizadas, transacciones y liquidaciones por gastos seleccionados.',
  '["Se agrego una base de transacciones financieras para gastos, liquidaciones y futuros ingresos.","Ahora los gastos pueden asignarse a una cuenta y categoria normalizada.","Las liquidaciones dejan de saldar todo automaticamente y pasan a trabajar con gastos seleccionados."]'::jsonb,
  '2026-05-12T00:05:00Z',
  true
)
on conflict (id) do update
set title = excluded.title,
    summary = excluded.summary,
    highlights = excluded.highlights,
    published_at = excluded.published_at,
    is_active = excluded.is_active;
