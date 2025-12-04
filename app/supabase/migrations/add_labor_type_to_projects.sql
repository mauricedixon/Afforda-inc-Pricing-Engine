-- Add labor_type to projects table
alter table public.projects
add column if not exists labor_type text default 'Prevailing Wage';

comment on column public.projects.labor_type is 'Default labor rate type for the project (e.g. Prevailing Wage, Union, Private)';
