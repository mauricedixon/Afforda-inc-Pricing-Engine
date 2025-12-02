-- Add bond_rate column to projects table
-- Run this migration if the projects table already exists

alter table public.projects
add column if not exists bond_rate numeric(5,4) not null default 0.03;




