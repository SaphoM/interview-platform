-- Records each admin login with device + location info.
create table if not exists public.admin_logins (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  browser text,
  os text,
  device_type text,
  user_agent text,
  ip text,
  city text,
  region text,
  country text,
  created_at timestamptz not null default now()
);

alter table public.admin_logins enable row level security;

create policy admin_logins_insert on public.admin_logins
  for insert to anon with check (true);

create policy admin_logins_select on public.admin_logins
  for select to anon using (true);
