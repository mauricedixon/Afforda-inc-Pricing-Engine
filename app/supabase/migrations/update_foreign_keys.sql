-- Update foreign keys to allow safe deletion of master catalog items
-- By setting the reference to NULL, we preserve the historical line item data
-- (since material_cost and labor_cost are stored values) while allowing the master record to be deleted.

alter table public.project_line_items
  drop constraint if exists project_line_items_material_price_id_fkey,
  drop constraint if exists project_line_items_labor_rate_id_fkey;

alter table public.project_line_items
  add constraint project_line_items_material_price_id_fkey
  foreign key (material_price_id)
  references public.material_prices(id)
  on delete set null;

alter table public.project_line_items
  add constraint project_line_items_labor_rate_id_fkey
  foreign key (labor_rate_id)
  references public.labor_rates(id)
  on delete set null;



