-- Prospects intake table (mirrors remote migration create_prospects)
create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  project text not null,
  timeline text not null,
  budget text not null,
  email text not null,
  message text,
  created_at timestamptz not null default now()
);

alter table public.prospects enable row level security;

revoke all on table public.prospects from anon, authenticated;
grant select, insert on table public.prospects to service_role;

create index if not exists prospects_created_at_idx on public.prospects (created_at desc);
