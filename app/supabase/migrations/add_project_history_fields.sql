-- Add total_value and submitted_at to projects table
alter table public.projects 
add column if not exists total_value numeric(14,4) default 0,
add column if not exists submitted_at timestamptz;

comment on column public.projects.total_value is 'Cached grand total of the project including markups';
comment on column public.projects.submitted_at is 'Timestamp when the project was marked as Approved/Sent';




