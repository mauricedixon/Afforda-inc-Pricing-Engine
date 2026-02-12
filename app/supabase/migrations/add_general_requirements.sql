-- Add general_requirements column to projects table
alter table public.projects 
add column if not exists general_requirements numeric(12,2) not null default 0;



