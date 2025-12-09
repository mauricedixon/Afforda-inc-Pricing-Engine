-- Create table for line item components (breakdown of a BOQ item)
create table if not exists public.line_item_components (
  id uuid primary key default gen_random_uuid(),
  project_line_item_id uuid references public.project_line_items(id) on delete cascade,
  description text not null,
  component_type text check (component_type in ('material', 'labor', 'equipment', 'other')),
  unit text,
  quantity numeric(14,4) not null default 0,
  unit_cost numeric(14,4) not null default 0,
  total_cost numeric(14,4) generated always as (quantity * unit_cost) stored,
  created_at timestamptz not null default now()
);

-- Add index
create index if not exists line_item_components_item_idx 
  on public.line_item_components (project_line_item_id);

-- Add is_composite flag to project_line_items
alter table public.project_line_items 
add column if not exists is_composite boolean default false;
