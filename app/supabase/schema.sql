-- FastBid
-- Database schema for Supabase (PostgreSQL)
-- Run this file inside the Supabase SQL editor or via `psql`.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Master catalog of vendor material prices
create table if not exists public.material_prices (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  search_name text not null,
  full_description text,
  unit text not null,
  cost_per_unit numeric(12,4) not null,
  vendor text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists material_prices_search_name_idx
  on public.material_prices (search_name);

create trigger material_prices_set_updated_at
  before update on public.material_prices
  for each row execute procedure public.set_updated_at();

-- Master catalog of labor rates by trade / labor type
create table if not exists public.labor_rates (
  id uuid primary key default gen_random_uuid(),
  trade text not null,
  labor_type text not null,
  hourly_cost numeric(12,4) not null,
  crew_size integer default 1 check (crew_size > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists labor_rates_trade_type_idx
  on public.labor_rates (lower(trade), lower(labor_type));

create trigger labor_rates_set_updated_at
  before update on public.labor_rates
  for each row execute procedure public.set_updated_at();

-- Bid / project level metadata
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  profit_margin numeric(5,4) not null default 0.20,
  bond_rate numeric(5,4) not null default 0.03,
  status text not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

-- Line items for each uploaded BOQ
create table if not exists public.project_line_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  line_number integer,
  description text not null,
  item_name text,
  search_name text,
  unit text,
  quantity numeric(14,4) not null default 0,
  material_price_id uuid references public.material_prices(id),
  labor_rate_id uuid references public.labor_rates(id),
  material_cost numeric(14,4),
  labor_cost numeric(14,4),
  total_cost numeric(14,4),
  matched boolean not null default true,
  warnings text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_line_items_project_idx
  on public.project_line_items (project_id);

create index if not exists project_line_items_search_idx
  on public.project_line_items (search_name);

create trigger project_line_items_set_updated_at
  before update on public.project_line_items
  for each row execute procedure public.set_updated_at();
