create table if not exists public.store_orders (
  id uuid primary key,
  order_number text not null unique,
  create_hash text not null,
  buyer_address text not null check (buyer_address ~ '^0x[0-9a-f]{40}$'),
  seller_id text not null,
  seller_name text not null,
  seller_contact text not null default '',
  payment_address text not null check (payment_address ~ '^0x[0-9a-f]{40}$'),
  token text not null check (token in ('USDT', 'FTA')),
  total text not null,
  total_units text not null check (total_units ~ '^[0-9]+$'),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  private_ciphertext text not null check (char_length(private_ciphertext) <= 20000),
  tx_hash text unique check (tx_hash is null or tx_hash ~ '^0x[0-9a-f]{64}$'),
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'payment_pending', 'paid', 'preparing', 'shipped', 'delivered')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  paid_at timestamptz,
  expires_at timestamptz not null
);

create index if not exists store_orders_buyer_created_idx
  on public.store_orders (buyer_address, created_at desc);
create index if not exists store_orders_status_created_idx
  on public.store_orders (status, created_at desc);
create index if not exists store_orders_expiry_idx
  on public.store_orders (status, expires_at);

alter table public.store_orders enable row level security;
revoke all on public.store_orders from anon, authenticated;
grant select, insert, update, delete on public.store_orders to service_role;

comment on table public.store_orders is 'Private FITIA STORE orders. Server-only access; no public RLS policies.';
comment on column public.store_orders.private_ciphertext is 'AES-256-GCM delivery and tracking data. Plaintext customer details are never stored.';
