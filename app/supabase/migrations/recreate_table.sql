-- NUCLEAR OPTION: Recreate the table
-- This fixes any hidden corruption or stale cache issues by creating a fresh table.

-- 1. Rename the broken table
ALTER TABLE public.project_line_items RENAME TO project_line_items_broken;

-- 2. Create a fresh, clean table
create table public.project_line_items (
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

-- 3. Re-add Indexes
create index project_line_items_project_idx on public.project_line_items (project_id);
create index project_line_items_search_idx on public.project_line_items (search_name);

-- 4. Re-add Trigger for timestamp
create trigger project_line_items_set_updated_at
  before update on public.project_line_items
  for each row execute procedure public.set_updated_at();

-- 5. Force Schema Reload
NOTIFY pgrst, 'reload schema';

