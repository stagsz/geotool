create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  hostname       text not null unique,
  upstream_url   text not null,
  cf_client_id   text not null,
  trial_ends_at  timestamptz not null,
  onboarded_at   timestamptz,
  created_at     timestamptz default now() not null
);

alter table public.customers enable row level security;

create policy "Users manage their own customers"
  on public.customers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid references public.customers(id) on delete cascade not null,
  ls_subscription_id  text not null unique,
  tier                text not null check (tier in ('starter', 'growth', 'pro')),
  status              text not null check (status in ('active', 'paused', 'cancelled', 'expired')),
  current_period_end  timestamptz not null,
  updated_at          timestamptz default now() not null
);

alter table public.subscriptions enable row level security;

create policy "Users read their own subscriptions"
  on public.subscriptions for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_id and c.user_id = auth.uid()
    )
  );
