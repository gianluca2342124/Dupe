-- Gemelu — initial schema
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)
--
-- Security model: every table has RLS enabled and NO policies, so the anon /
-- authenticated roles can read and write nothing. The Worker uses the
-- service-role key (server-side only), which bypasses RLS. RPC functions are
-- revoked from public roles and granted to service_role only.
--
-- Privacy: no table stores IP addresses, user agents, cookies or any user
-- identifier. Events are coarse (device class, country, referrer domain).

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists vector with schema extensions;

-- Immutable unaccent wrapper so it can be used in indexes and generated data.
create or replace function public.immutable_unaccent(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(input, '')) $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Source products (the product the user wants an alternative for)
-- ─────────────────────────────────────────────────────────────────────────
create table public.source_products (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  canonical_url text not null,
  domain text not null,
  store_id text not null,
  title text,
  description text,
  image_url text,
  images jsonb not null default '[]',
  price numeric(12, 2),
  price_high numeric(12, 2),
  currency char(3),
  availability text not null default 'unknown'
    check (availability in ('in_stock', 'out_of_stock', 'preorder', 'limited', 'unknown')),
  brand text,
  category text,
  breadcrumbs text[] not null default '{}',
  color text,
  material text,
  dimensions jsonb,
  variant text,
  gtin text,
  mpn text,
  sku text,
  rating numeric(3, 1),
  rating_count integer,
  read_mode text not null check (read_mode in ('page', 'url-only', 'example', 'text')),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  field_sources jsonb not null default '{}',
  analysis jsonb,
  checked_at timestamptz not null,
  -- Source data expiry (default policy: 24 h).
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index source_products_domain_idx on public.source_products (domain);
create index source_products_expires_idx on public.source_products (expires_at);
create trigger source_products_updated before update on public.source_products
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Catalogue products (AliExpress via API cache or Awin feed import)
-- ─────────────────────────────────────────────────────────────────────────
create table public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('aliexpress', 'awin', 'demo')),
  provider_product_id text not null,
  title text not null,
  description text,
  image_url text,
  images jsonb not null default '[]',
  price numeric(12, 2),
  price_high numeric(12, 2),
  list_price numeric(12, 2),
  currency char(3),
  shipping_cost numeric(12, 2),
  delivery_days_min integer,
  delivery_days_max integer,
  ships_to_es boolean,
  availability text not null default 'unknown'
    check (availability in ('in_stock', 'out_of_stock', 'preorder', 'limited', 'unknown')),
  rating numeric(3, 1),
  rating_count integer,
  orders_count integer,
  category_path text[] not null default '{}',
  attributes jsonb not null default '{}',
  product_url text,
  affiliate_url text,
  affiliate_source text check (affiliate_source in ('feed', 'api', 'deeplink')),
  gtin text,
  mpn text,
  seller_name text,
  -- Full-text document (maintained by trigger) and optional image/text embedding.
  search_text tsvector,
  embedding extensions.vector(512),
  -- Separate freshness per data type.
  price_checked_at timestamptz,
  availability_checked_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_product_id)
);
create index catalog_products_search_idx on public.catalog_products using gin (search_text);
create index catalog_products_title_trgm_idx on public.catalog_products using gin (title extensions.gin_trgm_ops);
create index catalog_products_provider_price_idx on public.catalog_products (provider, price);
create index catalog_products_gtin_idx on public.catalog_products (gtin) where gtin is not null;
create index catalog_products_last_seen_idx on public.catalog_products (provider, last_seen_at);
-- When embeddings are populated, add an ANN index, e.g.:
--   create index catalog_products_embedding_idx on public.catalog_products
--     using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.catalog_products_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_text :=
    setweight(to_tsvector('simple', public.immutable_unaccent(lower(new.title))), 'A') ||
    setweight(to_tsvector('simple', public.immutable_unaccent(lower(array_to_string(new.category_path, ' ')))), 'B') ||
    setweight(to_tsvector('simple', public.immutable_unaccent(lower(coalesce(new.attributes::text, '')))), 'C');
  return new;
end $$;
create trigger catalog_products_tsv before insert or update of title, category_path, attributes
  on public.catalog_products for each row execute function public.catalog_products_search_text();
create trigger catalog_products_updated before update on public.catalog_products
  for each row execute function public.set_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  catalog_product_id uuid not null references public.catalog_products (id) on delete cascade,
  provider_variant_id text not null,
  label text,
  attributes jsonb not null default '{}',
  price numeric(12, 2),
  currency char(3),
  availability text not null default 'unknown',
  image_url text,
  price_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (catalog_product_id, provider_variant_id)
);
create trigger product_variants_updated before update on public.product_variants
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Matches (similarity is versioned by algorithm; expires independently)
-- ─────────────────────────────────────────────────────────────────────────
create table public.product_matches (
  id uuid primary key default gen_random_uuid(),
  source_product_id uuid not null references public.source_products (id) on delete cascade,
  catalog_product_id uuid not null references public.catalog_products (id) on delete cascade,
  algorithm_version text not null,
  similarity numeric(4, 3) not null,
  evidence numeric(4, 3),
  shopping numeric(4, 3),
  final_score numeric(4, 3),
  tier text not null check (tier in ('verified', 'very_similar', 'similar', 'low_confidence')),
  signals jsonb,
  savings_eur numeric(12, 2),
  savings_pct integer,
  savings_basis text check (savings_basis in ('total_with_shipping', 'item_price_only')),
  rank integer,
  computed_at timestamptz not null default now(),
  -- Similarity expiry (default policy: 30 days per algorithm version).
  expires_at timestamptz not null,
  unique (source_product_id, catalog_product_id, algorithm_version)
);
create index product_matches_source_idx on public.product_matches (source_product_id, algorithm_version);

-- ─────────────────────────────────────────────────────────────────────────
-- Searches, results cache, events, clicks
-- ─────────────────────────────────────────────────────────────────────────
create table public.search_jobs (
  id text primary key,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'done', 'failed')),
  entry_mode text not null,
  source_url text,
  canonical_url text,
  domain text,
  store_id text,
  provider text,
  read_mode text,
  source_title text,
  category_id text,
  result_count integer not null default 0,
  low_confidence_count integer not null default 0,
  best_savings_eur numeric(12, 2),
  error_code text,
  cache_hit boolean not null default false,
  duration_ms integer,
  timings jsonb not null default '{}',
  provider_calls integer not null default 0
);
create index search_jobs_created_idx on public.search_jobs (created_at desc);
create index search_jobs_domain_idx on public.search_jobs (domain, created_at desc);

-- Full result payloads keyed by algorithm:provider:canonical URL (price expiry: 24 h).
create table public.search_results (
  cache_key text primary key,
  payload jsonb not null,
  stored_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index search_results_expires_idx on public.search_results (expires_at);

create table public.search_events (
  id bigint generated always as identity primary key,
  type text not null,
  at timestamptz not null default now(),
  search_id text,
  path text,
  domain text,
  entry_mode text,
  referrer_domain text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  device_class text check (device_class in ('mobile', 'tablet', 'desktop', 'bot')),
  country char(2),
  value integer
);
create index search_events_at_idx on public.search_events (at);
create index search_events_type_at_idx on public.search_events (type, at);

create table public.outbound_clicks (
  click_id text primary key,
  at timestamptz not null default now(),
  search_id text,
  provider text not null,
  provider_product_id text not null,
  rank integer,
  tier text,
  is_affiliate boolean not null default false,
  is_demo boolean not null default false,
  device_class text,
  country char(2)
);
create index outbound_clicks_at_idx on public.outbound_clicks (at);
create index outbound_clicks_product_idx on public.outbound_clicks (provider, provider_product_id);

-- Official affiliate links (from feeds or the provider's link API). Link expiry: 30 days.
create table public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_product_id text not null,
  destination_url text,
  affiliate_url text not null,
  source text not null check (source in ('feed', 'api', 'deeplink')),
  tracking_id text,
  status text not null default 'active' check (status in ('active', 'expired', 'invalid')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_validated_at timestamptz,
  unique (provider, provider_product_id)
);

create table public.provider_sync_runs (
  id text primary key,
  provider text not null,
  kind text not null check (kind in ('feed_import', 'price_refresh', 'commission_import', 'maintenance')),
  status text not null check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null,
  finished_at timestamptz,
  rows_read integer not null default 0,
  rows_upserted integer not null default 0,
  rows_rejected integer not null default 0,
  error text
);
create index provider_sync_runs_started_idx on public.provider_sync_runs (started_at desc);

create table public.product_corrections (
  id text primary key,
  at timestamptz not null default now(),
  search_id text,
  source_url text,
  provider_product_id text,
  kind text not null check (kind in ('not_similar', 'wrong_price', 'unavailable', 'counterfeit', 'other')),
  note text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'applied', 'dismissed'))
);
create index product_corrections_status_idx on public.product_corrections (status, at desc);

-- Commissions imported from the networks: verified conversions, kept apart from local clicks.
create table public.commission_reports (
  provider text not null,
  transaction_id text not null,
  click_ref text,
  status text not null,
  sale_amount numeric(12, 2),
  commission_amount numeric(12, 2),
  currency char(3),
  transaction_date timestamptz not null,
  imported_at timestamptz not null default now(),
  primary key (provider, transaction_id)
);
create index commission_reports_date_idx on public.commission_reports (transaction_date);

-- Daily counters for cost control (uncached searches, vision calls, API calls…).
create table public.usage_counters (
  day date not null,
  key text not null,
  value integer not null default 0,
  primary key (day, key)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Functions
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.increment_usage(p_day date, p_key text, p_by integer default 1)
returns integer
language sql
set search_path = ''
as $$
  insert into public.usage_counters (day, key, value) values (p_day, p_key, p_by)
  on conflict (day, key) do update set value = public.usage_counters.value + excluded.value
  returning value
$$;

-- Catalogue search for the Awin provider: OR-semantics full text + trigram fallback.
create or replace function public.search_catalog(
  p_query text,
  p_provider text,
  p_max_price numeric default null,
  p_limit integer default 30
)
returns setof public.catalog_products
language plpgsql
stable
set search_path = ''
as $$
declare
  q tsquery;
  terms text;
begin
  select string_agg(t, ' | ')
    into terms
  from unnest(regexp_split_to_array(public.immutable_unaccent(lower(p_query)), '[^a-z0-9]+')) as t
  where length(t) > 1;
  if terms is null then
    return;
  end if;
  q := to_tsquery('simple', terms);
  return query
    select c.*
    from public.catalog_products c
    where c.provider = p_provider
      and c.availability <> 'out_of_stock'
      and (p_max_price is null or c.price is null or c.price <= p_max_price)
      and (c.search_text @@ q or extensions.similarity(c.title, p_query) > 0.25)
    order by ts_rank_cd(c.search_text, q) desc, extensions.similarity(c.title, p_query) desc
    limit least(greatest(p_limit, 1), 50);
end $$;

-- Retention: expired caches and 13-month analytics window.
create or replace function public.purge_expired_data()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  n integer := 0;
  c integer;
begin
  delete from public.search_results where expires_at < now();
  get diagnostics c = row_count; n := n + c;
  delete from public.product_matches where expires_at < now();
  get diagnostics c = row_count; n := n + c;
  delete from public.source_products where expires_at < now() - interval '30 days';
  get diagnostics c = row_count; n := n + c;
  delete from public.search_events where at < now() - interval '13 months';
  get diagnostics c = row_count; n := n + c;
  delete from public.outbound_clicks where at < now() - interval '13 months';
  get diagnostics c = row_count; n := n + c;
  delete from public.search_jobs where created_at < now() - interval '13 months';
  get diagnostics c = row_count; n := n + c;
  delete from public.product_corrections where at < now() - interval '24 months';
  get diagnostics c = row_count; n := n + c;
  delete from public.usage_counters where day < current_date - 90;
  get diagnostics c = row_count; n := n + c;
  update public.affiliate_links set status = 'expired' where status = 'active' and expires_at < now();
  return n;
end $$;

-- Daily metrics view for SQL dashboards (security_invoker: obeys RLS of the caller).
create or replace view public.daily_search_metrics
with (security_invoker = true) as
select
  date_trunc('day', created_at) as day,
  count(*) filter (where status <> 'running') as searches,
  count(*) filter (where result_count > 0) as with_results,
  count(*) filter (where read_mode = 'url-only') as url_only,
  count(*) filter (where error_code is not null) as failed,
  count(*) filter (where cache_hit) as cache_hits,
  round(avg(result_count)::numeric, 2) as avg_results,
  percentile_cont(0.95) within group (order by duration_ms) as p95_ms
from public.search_jobs
group by 1;

-- ─────────────────────────────────────────────────────────────────────────
-- Row level security: deny by default
-- ─────────────────────────────────────────────────────────────────────────
alter table public.source_products enable row level security;
alter table public.catalog_products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_matches enable row level security;
alter table public.search_jobs enable row level security;
alter table public.search_results enable row level security;
alter table public.search_events enable row level security;
alter table public.outbound_clicks enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.provider_sync_runs enable row level security;
alter table public.product_corrections enable row level security;
alter table public.commission_reports enable row level security;
alter table public.usage_counters enable row level security;

revoke all on function public.increment_usage(date, text, integer) from public, anon, authenticated;
revoke all on function public.search_catalog(text, text, numeric, integer) from public, anon, authenticated;
revoke all on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.increment_usage(date, text, integer) to service_role;
grant execute on function public.search_catalog(text, text, numeric, integer) to service_role;
grant execute on function public.purge_expired_data() to service_role;
revoke all on public.daily_search_metrics from anon, authenticated;
