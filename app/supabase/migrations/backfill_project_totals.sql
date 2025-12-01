-- Backfill total_value for existing projects
-- This calculates the raw cost from line items and applies the project's markup
-- Formula matches the frontend: Grand Total = Hard Costs / (1 - (Profit + Bond))

do $$
declare
  proj record;
  hard_costs numeric;
  markup numeric;
  grand_total numeric;
begin
  for proj in select * from public.projects loop
    -- 1. Sum up hard costs (total_cost) from line items
    select coalesce(sum(total_cost), 0)
    into hard_costs
    from public.project_line_items
    where project_id = proj.id;

    -- 2. Calculate markup
    markup := coalesce(proj.profit_margin, 0.20) + coalesce(proj.bond_rate, 0.03);

    -- 3. Calculate Grand Total
    if markup >= 1 then
       grand_total := hard_costs; -- Prevent division by zero or negative
    else
       grand_total := hard_costs / (1 - markup);
    end if;

    -- 4. Update project
    update public.projects
    set total_value = grand_total
    where id = proj.id;
    
  end loop;
end;
$$;
