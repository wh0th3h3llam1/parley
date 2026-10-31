create extension if not exists pgcrypto;

create table if not exists halls (
  id uuid primary key default gen_random_uuid(),
  invite_token text not null unique,
  phase text not null default 'Preparing',
  active_run_id uuid,
  current_plan_id uuid,
  plan_version integer not null default 0,
  error text,
  integration_status jsonb not null default '{"storage":"connected","relay":"unconfigured","openai":"unconfigured"}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists travelers (
  id text not null,
  hall_id uuid not null references halls(id) on delete cascade,
  name text not null,
  hard_constraints jsonb not null,
  soft_preferences jsonb not null,
  agent_status text not null default 'Ready',
  primary key (hall_id, id)
);
create table if not exists events (
  event_id text primary key,
  hall_id uuid not null references halls(id) on delete cascade,
  run_id uuid not null,
  sequence integer not null,
  round integer not null,
  sender text not null,
  recipient text not null,
  action text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (hall_id, run_id, sequence)
);
create table if not exists plans (
  id uuid primary key,
  hall_id uuid not null references halls(id) on delete cascade,
  run_id uuid not null,
  version integer not null,
  day date not null,
  catalog_item_ids text[] not null,
  cost_per_person integer not null,
  total_group_cost integer not null,
  validation_results jsonb not null,
  votes jsonb not null default '{}'::jsonb,
  source text not null,
  created_at timestamptz not null default now(),
  unique (hall_id, version)
);
create table if not exists human_messages (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references halls(id) on delete cascade,
  display_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);

alter table halls enable row level security;
alter table travelers enable row level security;
alter table events enable row level security;
alter table plans enable row level security;
alter table human_messages enable row level security;
-- No direct anon/authenticated policies. Server service role is the only database caller.

create or replace function start_hall_run(p_hall_id uuid, p_run_id uuid)
returns boolean language plpgsql security definer as $$
declare updated_count integer;
begin
  update halls set active_run_id = p_run_id, phase = 'Proposing', error = null
    where id = p_hall_id and active_run_id is null;
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end $$;
revoke all on function start_hall_run(uuid, uuid) from public, anon, authenticated;
grant execute on function start_hall_run(uuid, uuid) to service_role;
