-- Item 7/8 — Tables du durcissement serveur (SIWE single-use nonces,
-- jetons de notification push, ingest d'erreurs applicatives).
-- À exécuter manuellement dans le SQL Editor Supabase (ou via `supabase db push`).
-- Accès réservé à la clé service_role : RLS activée, aucune policy publique.

create table if not exists public.siwe_nonces (
  nonce text primary key,
  expires_at timestamptz not null,
  used_at timestamptz not null default now()
);

alter table public.siwe_nonces enable row level security;
-- Aucune policy : les clients anon/authenticated ne peuvent rien faire.

create index if not exists siwe_nonces_expires_at_idx on public.siwe_nonces (expires_at);

create table if not exists public.push_tokens (
  token text primary key,
  platform text not null default 'android' check (platform in ('android', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  message text not null,
  stack text,
  url text,
  release text,
  platform text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.app_errors enable row level security;

create index if not exists app_errors_created_at_idx on public.app_errors (created_at desc);
