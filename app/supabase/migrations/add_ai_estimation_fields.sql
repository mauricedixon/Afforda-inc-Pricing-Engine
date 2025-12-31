-- Add AI estimation fields to project_line_items

alter table public.project_line_items
add column if not exists confidence_score integer check (confidence_score >= 0 and confidence_score <= 100),
add column if not exists pricing_source text check (pricing_source in ('database', 'manual', 'ai')) default 'manual',
add column if not exists ai_reasoning text;

-- Update existing rows to have a source
-- If matched=true, it likely came from the database (or was manually matched)
-- For now, let's default everything to 'manual' unless we know better, 
-- but we can infer 'database' if material_price_id is set.
update public.project_line_items
set pricing_source = 'database'
where material_price_id is not null or labor_rate_id is not null;






