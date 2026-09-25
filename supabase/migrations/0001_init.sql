-- =============================================================================
-- Dinah Stationaries — Supabase schema, security, and business logic
-- =============================================================================
-- HOW THIS IS ORGANIZED (read this before running it):
--
-- 1. TABLES store data. Row Level Security is enabled on every one of them
--    with NO policies attached — meaning the raw tables are completely
--    unreachable from the browser (anon/authenticated), on purpose.
-- 2. VIEWS are the only way the frontend reads data. Views in Supabase are
--    owned by the "postgres" role, which bypasses RLS — so each view below
--    manually re-implements the row/column filtering it needs (e.g. "only
--    rows from my branch", "buying_price only if I'm a manager") using the
--    helper functions in section 2. This is Supabase's documented pattern
--    for hiding specific *columns* from specific roles, which plain RLS
--    (row-level only) cannot do on its own.
-- 3. FUNCTIONS (RPCs) are the only way the frontend writes data. Every one
--    is SECURITY DEFINER (bypasses RLS internally) and starts by checking
--    who is calling (via auth.uid()) and rejecting anything they're not
--    allowed to do. This is where all business rules live — stock checks,
--    branch isolation, atomic multi-table updates, audit logging.
--
-- Run this whole file once in Supabase Dashboard -> SQL Editor -> New query.
-- It's written to be safe to re-run (DROP ... IF EXISTS / CREATE OR REPLACE)
-- if you need to re-apply it after making manual edits.
-- =============================================================================

create extension if not exists pgcrypto;

-- =============================================================================
-- 1. TABLES
-- =============================================================================

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null check (role in ('MANAGER','CASHIER')),
  branch_id uuid references public.branches(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Only one *active* cashier per branch, enforced at the database level.
drop index if exists one_active_cashier_per_branch;
create unique index one_active_cashier_per_branch
  on public.profiles (branch_id)
  where role = 'CASHIER' and active = true;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('FOR_SALE','RESOURCE')),
  category text not null default 'General',
  unit text not null default 'piece',
  buying_price numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.branch_products (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  product_id uuid not null references public.products(id),
  quantity numeric(12,2) not null default 0 check (quantity >= 0),
  low_stock_level numeric(12,2),
  created_at timestamptz not null default now(),
  unique (branch_id, product_id)
);

create table if not exists public.txn_counters (
  branch_id uuid primary key references public.branches(id),
  next_number int not null default 1
);

create table if not exists public.product_requests (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  product_name text not null,
  selling_price numeric(12,2) not null,
  unit text not null default 'piece',
  quantity numeric(12,2) not null default 0,
  requested_by uuid not null references public.profiles(id),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  buying_price numeric(12,2),
  product_id uuid references public.products(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  name text not null,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  txn_number text not null unique,
  branch_id uuid not null references public.branches(id),
  cashier_id uuid not null references public.profiles(id),
  total numeric(12,2) not null default 0,
  status text not null default 'COMPLETED' check (status in ('COMPLETED','VOID')),
  void_reason text,
  voided_by uuid references public.profiles(id),
  voided_at timestamptz,
  client_txn_id text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  name text not null,
  unit text,
  quantity numeric(12,2) not null,
  price numeric(12,2) not null,
  line_total numeric(12,2) not null
);

create table if not exists public.service_transactions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  service_id uuid not null references public.services(id),
  service_name text not null,
  amount numeric(12,2) not null check (amount > 0),
  cashier_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.resource_usage (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  product_id uuid not null references public.products(id),
  product_name text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  cost numeric(12,2) not null default 0,
  cashier_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  product_id uuid not null references public.products(id),
  direction text not null check (direction in ('INCREASE','DECREASE')),
  quantity numeric(12,2) not null check (quantity > 0),
  reason text not null,
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  sale_id uuid not null references public.sales(id),
  product_id uuid not null references public.products(id),
  quantity numeric(12,2) not null check (quantity > 0),
  reason text not null default '',
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  requested_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_closings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  business_date date not null,
  product_sales numeric(12,2) not null default 0,
  service_income numeric(12,2) not null default 0,
  expected_cash numeric(12,2) not null default 0,
  closed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (branch_id, business_date)
);

create table if not exists public.cash_collections (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  business_date date not null,
  expected_cash numeric(12,2) not null,
  collected_amount numeric(12,2) not null,
  difference numeric(12,2) not null,
  collected_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (branch_id, business_date)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  username text,
  role text,
  branch_id uuid,
  action text not null,
  entity text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'Dinah Stationaries',
  currency text not null default 'TZS',
  timezone text not null default 'Africa/Dar_es_Salaam',
  tagline text not null default 'Your Trusted Stationery & Document Service Partner',
  description text not null default 'Quality stationery products, professional printing, photocopying, binding, lamination and document services — all in one convenient place.',
  phone text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  office_address text not null default '',
  google_maps_url text not null default '',
  google_maps_embed_url text not null default '',
  opening_hours text not null default 'Mon - Sat: 8:00 AM - 7:00 PM',
  low_stock_default numeric(12,2) not null default 10
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- Lock every base table down completely. No policies = no direct access for
-- anon/authenticated. All access happens through the views/functions below.
do $$
declare t text;
begin
  for t in select unnest(array[
    'branches','profiles','products','branch_products','txn_counters',
    'product_requests','services','sales','sale_items','service_transactions',
    'resource_usage','stock_adjustments','returns','daily_closings',
    'cash_collections','audit_logs','settings'
  ]) loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('revoke all on public.%I from anon, authenticated;', t);
  end loop;
end $$;

-- =============================================================================
-- 2. HELPER FUNCTIONS (used throughout views and RPCs)
-- =============================================================================

create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.app_branch_id() returns uuid
language sql stable security definer set search_path = public as $$
  select branch_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'MANAGER' and active from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_cashier() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'CASHIER' and active from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.log_action(p_action text, p_entity text, p_branch_id uuid, p_details jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (user_id, username, role, branch_id, action, entity, details)
  values (auth.uid(), (select full_name from public.profiles where id = auth.uid()), public.app_role(), p_branch_id, p_action, p_entity, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- =============================================================================
-- 3. VIEWS — the only read path. Each one filters manually since views
--    bypass the base table's RLS (they run as their postgres owner).
-- =============================================================================

-- Public landing page (no login required)
create or replace view public.public_settings as
  select business_name, currency, timezone, tagline, description, phone, whatsapp,
         email, office_address, google_maps_url, google_maps_embed_url, opening_hours
  from public.settings;

create or replace view public.public_products as
  select id, name, category, unit, selling_price, active
  from public.products where active = true and type = 'FOR_SALE';

create or replace view public.public_services as
  select id, name, description, active from public.services where active = true;

-- Authenticated views
create or replace view public.branches_view as
  select * from public.branches where public.is_manager() or id = public.app_branch_id();

create or replace view public.users_view as
  select p.id, p.full_name, p.role, p.branch_id, p.active, p.created_at, u.email
  from public.profiles p join auth.users u on u.id = p.id
  where public.is_manager();

-- Every logged-in user (any role) can read their own profile — needed for
-- role-based routing and the "My Profile" page. Distinct from users_view,
-- which is manager-only and lists everyone.
create or replace view public.my_profile_view as
  select p.id, p.full_name, p.role, p.branch_id, p.active, u.email
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = auth.uid();

create or replace view public.products_view as
  select id, name, type, category, unit, selling_price, active, created_at,
         case when public.is_manager() then buying_price else null end as buying_price
  from public.products;

create or replace view public.branch_inventory_view as
  select
    bp.id, bp.branch_id, bp.product_id, p.name, p.type, p.unit, bp.quantity, p.selling_price,
    case when public.is_manager() then p.buying_price else null end as buying_price,
    case when public.is_manager() then round(bp.quantity * p.buying_price, 2) else null end as inventory_value,
    (bp.quantity <= coalesce(bp.low_stock_level, (select low_stock_default from public.settings))) as low_stock
  from public.branch_products bp
  join public.products p on p.id = bp.product_id
  where public.is_manager() or bp.branch_id = public.app_branch_id();

create or replace view public.services_view as
  select * from public.services where public.is_manager() or branch_id = public.app_branch_id();

create or replace view public.sales_view as
  select s.*,
    (select coalesce(json_agg(json_build_object(
        'productId', si.product_id, 'name', si.name, 'unit', si.unit,
        'quantity', si.quantity, 'price', si.price, 'lineTotal', si.line_total
     )), '[]'::json) from public.sale_items si where si.sale_id = s.id) as items
  from public.sales s
  where public.is_manager() or s.branch_id = public.app_branch_id();

create or replace view public.service_transactions_view as
  select * from public.service_transactions
  where public.is_manager() or branch_id = public.app_branch_id();

create or replace view public.resource_usage_view as
  select id, branch_id, product_id, product_name, quantity, cashier_id, created_at,
    case when public.is_manager() then cost else null end as cost
  from public.resource_usage
  where public.is_manager() or branch_id = public.app_branch_id();

create or replace view public.product_requests_view as
  select * from public.product_requests
  where public.is_manager() or branch_id = public.app_branch_id();

create or replace view public.returns_view as
  select * from public.returns
  where public.is_manager() or branch_id = public.app_branch_id();

create or replace view public.daily_closings_view as
  select * from public.daily_closings
  where public.is_manager() or branch_id = public.app_branch_id();

create or replace view public.cash_collections_view as
  select * from public.cash_collections where public.is_manager();

create or replace view public.audit_logs_view as
  select * from public.audit_logs where public.is_manager() order by created_at desc limit 500;

create or replace view public.product_report_view as
  select
    p.id as product_id, p.name as product,
    coalesce(sum(si.quantity), 0) as qty_sold,
    coalesce(sum(si.line_total), 0) as revenue,
    coalesce(sum(si.quantity * p.buying_price), 0) as cost,
    coalesce(sum(si.line_total - si.quantity * p.buying_price), 0) as profit
  from public.products p
  left join public.sale_items si on si.product_id = p.id
  left join public.sales s on s.id = si.sale_id and s.status = 'COMPLETED'
  where p.type = 'FOR_SALE' and public.is_manager()
  group by p.id, p.name;

grant select on public.public_settings, public.public_products, public.public_services to anon, authenticated;
grant select on
  public.branches_view, public.users_view, public.my_profile_view, public.products_view, public.branch_inventory_view,
  public.services_view, public.sales_view, public.service_transactions_view, public.resource_usage_view,
  public.product_requests_view, public.returns_view, public.daily_closings_view, public.cash_collections_view,
  public.audit_logs_view, public.product_report_view
to authenticated;

-- =============================================================================
-- 4. RPC FUNCTIONS — the only write path (and a couple of read aggregates).
-- =============================================================================

-- ---------- Profile / self-service ----------
create or replace function public.update_my_profile(p_full_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;
  update public.profiles set full_name = coalesce(nullif(trim(p_full_name), ''), full_name) where id = auth.uid();
end;
$$;

create or replace function public.set_user_active(p_user_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_role text; v_other_managers int;
begin
  if not public.is_manager() then raise exception 'Only a manager can do this.'; end if;
  select role into v_role from public.profiles where id = p_user_id;
  if v_role = 'MANAGER' and p_active = false then
    select count(*) into v_other_managers from public.profiles where role = 'MANAGER' and active and id <> p_user_id;
    if v_other_managers = 0 then raise exception 'You cannot deactivate the last active manager account.'; end if;
  end if;
  update public.profiles set active = p_active where id = p_user_id;
  perform public.log_action('USER_UPDATE', 'user', null, jsonb_build_object('userId', p_user_id, 'active', p_active));
end;
$$;

-- ---------- Branches ----------
create or replace function public.create_branch(p_name text, p_address text default '')
returns public.branches language plpgsql security definer set search_path = public as $$
declare v_branch public.branches;
begin
  if not public.is_manager() then raise exception 'Only a manager can create a branch.'; end if;
  insert into public.branches (name, address) values (p_name, coalesce(p_address, '')) returning * into v_branch;
  perform public.log_action('BRANCH_CREATE', 'branch', v_branch.id, jsonb_build_object('name', p_name));
  return v_branch;
end;
$$;

create or replace function public.update_branch(p_branch_id uuid, p_name text, p_address text, p_active boolean)
returns public.branches language plpgsql security definer set search_path = public as $$
declare v_branch public.branches;
begin
  if not public.is_manager() then raise exception 'Only a manager can update a branch.'; end if;
  update public.branches set
    name = coalesce(p_name, name), address = coalesce(p_address, address), active = coalesce(p_active, active)
    where id = p_branch_id returning * into v_branch;
  perform public.log_action('BRANCH_UPDATE', 'branch', v_branch.id, '{}'::jsonb);
  return v_branch;
end;
$$;

-- ---------- Products ----------
create or replace function public.create_product(
  p_name text, p_type text, p_category text, p_unit text, p_buying_price numeric, p_selling_price numeric
) returns public.products language plpgsql security definer set search_path = public as $$
declare v_product public.products;
begin
  if not public.is_manager() then raise exception 'Only a manager can create products.'; end if;
  if p_type not in ('FOR_SALE','RESOURCE') then raise exception 'type must be FOR_SALE or RESOURCE.'; end if;
  insert into public.products (name, type, category, unit, buying_price, selling_price)
    values (p_name, p_type, coalesce(p_category,'General'), coalesce(p_unit,'piece'), coalesce(p_buying_price,0),
            case when p_type = 'FOR_SALE' then coalesce(p_selling_price,0) else 0 end)
    returning * into v_product;
  perform public.log_action('PRODUCT_CREATE', 'product', null, jsonb_build_object('productId', v_product.id, 'name', p_name));
  return v_product;
end;
$$;

create or replace function public.assign_product_to_branch(
  p_branch_id uuid, p_product_id uuid, p_quantity numeric default 0, p_low_stock_level numeric default null
) returns public.branch_products language plpgsql security definer set search_path = public as $$
declare v_bp public.branch_products;
begin
  if not public.is_manager() then raise exception 'Only a manager can assign products to a branch.'; end if;
  if exists (select 1 from public.branch_products where branch_id = p_branch_id and product_id = p_product_id) then
    raise exception 'This product is already assigned to that branch. Use stock adjustment to change quantity.';
  end if;
  insert into public.branch_products (branch_id, product_id, quantity, low_stock_level)
    values (p_branch_id, p_product_id, coalesce(p_quantity,0), p_low_stock_level)
    returning * into v_bp;
  perform public.log_action('BRANCH_PRODUCT_ASSIGN', 'branchProduct', p_branch_id, jsonb_build_object('productId', p_product_id, 'quantity', p_quantity));
  return v_bp;
end;
$$;

create or replace function public.adjust_stock(
  p_branch_id uuid, p_product_id uuid, p_direction text, p_quantity numeric, p_reason text
) returns numeric language plpgsql security definer set search_path = public as $$
declare v_qty numeric;
begin
  if not public.is_manager() then raise exception 'Only a manager can adjust stock.'; end if;
  if p_direction not in ('INCREASE','DECREASE') then raise exception 'direction must be INCREASE or DECREASE.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be a positive number.'; end if;

  select quantity into v_qty from public.branch_products where branch_id = p_branch_id and product_id = p_product_id for update;
  if not found then raise exception 'That product is not stocked at this branch.'; end if;
  if p_direction = 'DECREASE' and v_qty < p_quantity then raise exception 'Cannot decrease below zero stock.'; end if;

  update public.branch_products set quantity = quantity + case when p_direction = 'INCREASE' then p_quantity else -p_quantity end
    where branch_id = p_branch_id and product_id = p_product_id
    returning quantity into v_qty;

  insert into public.stock_adjustments (branch_id, product_id, direction, quantity, reason, user_id)
    values (p_branch_id, p_product_id, p_direction, p_quantity, coalesce(p_reason,'Other'), auth.uid());
  perform public.log_action('STOCK_ADJUSTMENT', 'branchProduct', p_branch_id, jsonb_build_object('productId', p_product_id, 'direction', p_direction, 'quantity', p_quantity));
  return v_qty;
end;
$$;

-- ---------- Product requests ----------
create or replace function public.create_product_request(p_product_name text, p_selling_price numeric, p_unit text, p_quantity numeric)
returns public.product_requests language plpgsql security definer set search_path = public as $$
declare v_req public.product_requests;
begin
  if not public.is_cashier() then raise exception 'Only a cashier can request a product.'; end if;
  insert into public.product_requests (branch_id, product_name, selling_price, unit, quantity, requested_by)
    values (public.app_branch_id(), p_product_name, p_selling_price, coalesce(p_unit,'piece'), coalesce(p_quantity,0), auth.uid())
    returning * into v_req;
  perform public.log_action('PRODUCT_REQUEST_CREATE', 'productRequest', v_req.branch_id, jsonb_build_object('requestId', v_req.id));
  return v_req;
end;
$$;

create or replace function public.approve_product_request(p_request_id uuid, p_buying_price numeric, p_category text default 'General')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_req public.product_requests; v_product public.products;
begin
  if not public.is_manager() then raise exception 'Only a manager can approve requests.'; end if;
  select * into v_req from public.product_requests where id = p_request_id for update;
  if not found or v_req.status <> 'PENDING' then raise exception 'Request not found or already reviewed.'; end if;
  if p_buying_price is null then raise exception 'buying_price is required to approve a request.'; end if;

  insert into public.products (name, type, category, unit, buying_price, selling_price)
    values (v_req.product_name, 'FOR_SALE', coalesce(p_category,'General'), v_req.unit, p_buying_price, v_req.selling_price)
    returning * into v_product;
  insert into public.branch_products (branch_id, product_id, quantity) values (v_req.branch_id, v_product.id, v_req.quantity);

  update public.product_requests set status = 'APPROVED', buying_price = p_buying_price, product_id = v_product.id,
    reviewed_by = auth.uid(), reviewed_at = now() where id = p_request_id;

  perform public.log_action('PRODUCT_REQUEST_APPROVE', 'productRequest', v_req.branch_id, jsonb_build_object('requestId', p_request_id, 'productId', v_product.id));
  return jsonb_build_object('requestId', p_request_id, 'productId', v_product.id);
end;
$$;

create or replace function public.reject_product_request(p_request_id uuid, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
declare v_branch uuid;
begin
  if not public.is_manager() then raise exception 'Only a manager can reject requests.'; end if;
  select branch_id into v_branch from public.product_requests where id = p_request_id and status = 'PENDING';
  if not found then raise exception 'Request not found or already reviewed.'; end if;
  update public.product_requests set status = 'REJECTED', rejection_reason = p_reason, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request_id;
  perform public.log_action('PRODUCT_REQUEST_REJECT', 'productRequest', v_branch, jsonb_build_object('requestId', p_request_id));
end;
$$;

-- ---------- Services ----------
create or replace function public.create_service(p_branch_id uuid, p_name text, p_description text default '')
returns public.services language plpgsql security definer set search_path = public as $$
declare v_service public.services;
begin
  if not public.is_manager() then raise exception 'Only a manager can create services.'; end if;
  insert into public.services (branch_id, name, description) values (p_branch_id, p_name, coalesce(p_description,''))
    returning * into v_service;
  perform public.log_action('SERVICE_CREATE', 'service', p_branch_id, jsonb_build_object('serviceId', v_service.id, 'name', p_name));
  return v_service;
end;
$$;

create or replace function public.update_service(p_service_id uuid, p_name text, p_description text, p_active boolean)
returns public.services language plpgsql security definer set search_path = public as $$
declare v_service public.services;
begin
  if not public.is_manager() then raise exception 'Only a manager can update services.'; end if;
  update public.services set
    name = coalesce(p_name, name), description = coalesce(p_description, description), active = coalesce(p_active, active)
    where id = p_service_id returning * into v_service;
  perform public.log_action('SERVICE_UPDATE', 'service', v_service.branch_id, jsonb_build_object('serviceId', p_service_id));
  return v_service;
end;
$$;

-- ---------- POS ----------
create or replace function public.create_sale(p_items jsonb, p_client_txn_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_branch_id uuid; v_item jsonb; v_product public.products%rowtype; v_stock numeric; v_qty numeric;
  v_total numeric := 0; v_sale_id uuid; v_existing_id uuid; v_next_num int; v_txn_number text; v_items_out jsonb := '[]'::jsonb;
begin
  if not public.is_cashier() then raise exception 'Only an active cashier can record a sale.'; end if;
  v_branch_id := public.app_branch_id();

  if p_client_txn_id is not null then
    select id into v_existing_id from public.sales where client_txn_id = p_client_txn_id;
    if found then
      return (select jsonb_build_object('id', s.id, 'txnNumber', s.txn_number, 'total', s.total, 'status', s.status, 'createdAt', s.created_at)
              from public.sales s where s.id = v_existing_id);
    end if;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'At least one item is required.'; end if;

  -- Validate every line first (all-or-nothing), locking each stock row.
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id = (v_item->>'productId')::uuid and type = 'FOR_SALE' and active = true;
    if not found then raise exception 'A product in your cart is no longer available.'; end if;
    v_qty := (v_item->>'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Invalid quantity for "%".', v_product.name; end if;
    select quantity into v_stock from public.branch_products where branch_id = v_branch_id and product_id = v_product.id for update;
    if v_stock is null or v_stock < v_qty then raise exception 'Not enough stock for "%". Available: %.', v_product.name, coalesce(v_stock,0); end if;
  end loop;

  insert into public.txn_counters (branch_id, next_number) values (v_branch_id, 1) on conflict (branch_id) do nothing;
  update public.txn_counters set next_number = next_number + 1 where branch_id = v_branch_id returning next_number - 1 into v_next_num;
  v_txn_number := 'DS-' || upper(substr(replace(v_branch_id::text, '-', ''), 1, 6)) || '-' || lpad(v_next_num::text, 6, '0');

  insert into public.sales (txn_number, branch_id, cashier_id, total, status, client_txn_id)
    values (v_txn_number, v_branch_id, auth.uid(), 0, 'COMPLETED', p_client_txn_id) returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id = (v_item->>'productId')::uuid;
    v_qty := (v_item->>'quantity')::numeric;
    insert into public.sale_items (sale_id, product_id, name, unit, quantity, price, line_total)
      values (v_sale_id, v_product.id, v_product.name, v_product.unit, v_qty, v_product.selling_price, v_product.selling_price * v_qty);
    update public.branch_products set quantity = quantity - v_qty where branch_id = v_branch_id and product_id = v_product.id;
    v_total := v_total + (v_product.selling_price * v_qty);
    v_items_out := v_items_out || jsonb_build_object('name', v_product.name, 'quantity', v_qty, 'price', v_product.selling_price);
  end loop;

  update public.sales set total = v_total where id = v_sale_id;
  perform public.log_action('SALE_CREATE', 'sale', v_branch_id, jsonb_build_object('saleId', v_sale_id, 'total', v_total));

  return jsonb_build_object('id', v_sale_id, 'txnNumber', v_txn_number, 'total', v_total, 'items', v_items_out);
end;
$$;

create or replace function public.void_sale(p_sale_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_sale public.sales%rowtype; v_item record;
begin
  select * into v_sale from public.sales where id = p_sale_id;
  if not found then raise exception 'Sale not found.'; end if;
  if not (public.is_manager() or (public.is_cashier() and v_sale.branch_id = public.app_branch_id())) then
    raise exception 'You can only void sales from your own branch.';
  end if;
  if v_sale.status = 'VOID' then raise exception 'This sale is already void.'; end if;
  if p_reason is null or trim(p_reason) = '' then raise exception 'A reason is required to void a sale.'; end if;

  for v_item in select product_id, quantity from public.sale_items where sale_id = p_sale_id loop
    update public.branch_products set quantity = quantity + v_item.quantity
      where branch_id = v_sale.branch_id and product_id = v_item.product_id;
  end loop;

  update public.sales set status = 'VOID', void_reason = p_reason, voided_by = auth.uid(), voided_at = now() where id = p_sale_id;
  perform public.log_action('SALE_VOID', 'sale', v_sale.branch_id, jsonb_build_object('saleId', p_sale_id, 'reason', p_reason));
end;
$$;

-- ---------- Services transactions ----------
create or replace function public.record_service_transaction(p_service_id uuid, p_amount numeric)
returns public.service_transactions language plpgsql security definer set search_path = public as $$
declare v_service public.services%rowtype; v_txn public.service_transactions;
begin
  if not public.is_cashier() then raise exception 'Only a cashier can record a service.'; end if;
  select * into v_service from public.services where id = p_service_id and branch_id = public.app_branch_id();
  if not found then raise exception 'Service not found for your branch.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be a positive number.'; end if;

  insert into public.service_transactions (branch_id, service_id, service_name, amount, cashier_id)
    values (public.app_branch_id(), p_service_id, v_service.name, p_amount, auth.uid()) returning * into v_txn;
  perform public.log_action('SERVICE_TRANSACTION', 'serviceTransaction', v_txn.branch_id, jsonb_build_object('txnId', v_txn.id, 'amount', p_amount));
  return v_txn;
end;
$$;

-- ---------- Resource usage ----------
create or replace function public.record_resource_usage(p_product_id uuid, p_quantity numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_product public.products%rowtype; v_stock numeric; v_cost numeric; v_usage_id uuid; v_branch uuid;
begin
  if not public.is_cashier() then raise exception 'Only a cashier can record resource usage.'; end if;
  v_branch := public.app_branch_id();
  select * into v_product from public.products where id = p_product_id and type = 'RESOURCE';
  if not found then raise exception 'Resource product not found.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'quantity must be a positive number.'; end if;

  select quantity into v_stock from public.branch_products where branch_id = v_branch and product_id = p_product_id for update;
  if v_stock is null or v_stock < p_quantity then raise exception 'Not enough "%" in stock.', v_product.name; end if;

  update public.branch_products set quantity = quantity - p_quantity where branch_id = v_branch and product_id = p_product_id;
  v_cost := v_product.buying_price * p_quantity;

  insert into public.resource_usage (branch_id, product_id, product_name, quantity, cost, cashier_id)
    values (v_branch, p_product_id, v_product.name, p_quantity, v_cost, auth.uid()) returning id into v_usage_id;
  perform public.log_action('RESOURCE_USAGE', 'resourceUsage', v_branch, jsonb_build_object('usageId', v_usage_id, 'productId', p_product_id, 'quantity', p_quantity));

  return jsonb_build_object('id', v_usage_id, 'productName', v_product.name, 'quantity', p_quantity);
end;
$$;

-- ---------- Returns ----------
create or replace function public.create_return(p_sale_id uuid, p_product_id uuid, p_quantity numeric, p_reason text default '')
returns public.returns language plpgsql security definer set search_path = public as $$
declare v_sale public.sales%rowtype; v_line record; v_ret public.returns;
begin
  if not public.is_cashier() then raise exception 'Only a cashier can request a return.'; end if;
  select * into v_sale from public.sales where id = p_sale_id and branch_id = public.app_branch_id();
  if not found then raise exception 'Original sale not found for your branch.'; end if;
  select * into v_line from public.sale_items where sale_id = p_sale_id and product_id = p_product_id;
  if not found then raise exception 'That product was not part of this sale.'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > v_line.quantity then raise exception 'Invalid return quantity.'; end if;

  insert into public.returns (branch_id, sale_id, product_id, quantity, reason, requested_by)
    values (public.app_branch_id(), p_sale_id, p_product_id, p_quantity, coalesce(p_reason,''), auth.uid())
    returning * into v_ret;
  perform public.log_action('RETURN_REQUEST', 'return', v_ret.branch_id, jsonb_build_object('returnId', v_ret.id));
  return v_ret;
end;
$$;

create or replace function public.approve_return(p_return_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_ret public.returns%rowtype;
begin
  if not public.is_manager() then raise exception 'Only a manager can approve returns.'; end if;
  select * into v_ret from public.returns where id = p_return_id and status = 'PENDING' for update;
  if not found then raise exception 'Return not found or already reviewed.'; end if;
  update public.branch_products set quantity = quantity + v_ret.quantity where branch_id = v_ret.branch_id and product_id = v_ret.product_id;
  update public.returns set status = 'APPROVED', approved_by = auth.uid(), approved_at = now() where id = p_return_id;
  perform public.log_action('RETURN_APPROVE', 'return', v_ret.branch_id, jsonb_build_object('returnId', p_return_id));
end;
$$;

create or replace function public.reject_return(p_return_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_branch uuid;
begin
  if not public.is_manager() then raise exception 'Only a manager can reject returns.'; end if;
  select branch_id into v_branch from public.returns where id = p_return_id and status = 'PENDING';
  if not found then raise exception 'Return not found or already reviewed.'; end if;
  update public.returns set status = 'REJECTED', approved_by = auth.uid(), approved_at = now() where id = p_return_id;
  perform public.log_action('RETURN_REJECT', 'return', v_branch, jsonb_build_object('returnId', p_return_id));
end;
$$;

-- ---------- Daily closing / cash collection ----------
create or replace function public.close_daily(p_business_date date default (now() at time zone 'Africa/Dar_es_Salaam')::date)
returns public.daily_closings language plpgsql security definer set search_path = public as $$
declare v_branch uuid; v_sales numeric; v_services numeric; v_closing public.daily_closings;
begin
  if not public.is_cashier() then raise exception 'Only a cashier can close the business day.'; end if;
  v_branch := public.app_branch_id();
  if exists (select 1 from public.daily_closings where branch_id = v_branch and business_date = p_business_date) then
    raise exception 'This business day has already been closed.';
  end if;

  select coalesce(sum(total), 0) into v_sales from public.sales
    where branch_id = v_branch and status = 'COMPLETED' and created_at::date = p_business_date;
  select coalesce(sum(amount), 0) into v_services from public.service_transactions
    where branch_id = v_branch and created_at::date = p_business_date;

  insert into public.daily_closings (branch_id, business_date, product_sales, service_income, expected_cash, closed_by)
    values (v_branch, p_business_date, v_sales, v_services, v_sales + v_services, auth.uid())
    returning * into v_closing;
  perform public.log_action('DAILY_CLOSING', 'dailyClosing', v_branch, jsonb_build_object('date', p_business_date));
  return v_closing;
end;
$$;

create or replace function public.record_cash_collection(p_branch_id uuid, p_business_date date, p_collected_amount numeric)
returns public.cash_collections language plpgsql security definer set search_path = public as $$
declare v_closing public.daily_closings%rowtype; v_record public.cash_collections;
begin
  if not public.is_manager() then raise exception 'Only a manager can record cash collection.'; end if;
  select * into v_closing from public.daily_closings where branch_id = p_branch_id and business_date = p_business_date;
  if not found then raise exception 'No daily closing found for that branch/date.'; end if;

  insert into public.cash_collections (branch_id, business_date, expected_cash, collected_amount, difference, collected_by)
    values (p_branch_id, p_business_date, v_closing.expected_cash, p_collected_amount, p_collected_amount - v_closing.expected_cash, auth.uid())
    returning * into v_record;
  perform public.log_action('CASH_COLLECTION', 'cashCollection', p_branch_id, jsonb_build_object('date', p_business_date, 'collectedAmount', p_collected_amount));
  return v_record;
end;
$$;

-- ---------- Dashboards ----------
create or replace function public.manager_dashboard()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_total_sales numeric; v_service_income numeric; v_resource_cost numeric; v_product_profit numeric;
  v_low_stock int; v_pending_requests int; v_active_branches int; v_by_branch jsonb;
begin
  if not public.is_manager() then raise exception 'Manager access only.'; end if;

  select coalesce(sum(total),0) into v_total_sales from public.sales where status = 'COMPLETED';
  select coalesce(sum(amount),0) into v_service_income from public.service_transactions;
  select coalesce(sum(cost),0) into v_resource_cost from public.resource_usage;
  select coalesce(sum(si.line_total - si.quantity * p.buying_price), 0) into v_product_profit
    from public.sale_items si join public.sales s on s.id = si.sale_id and s.status = 'COMPLETED'
    join public.products p on p.id = si.product_id;
  select count(*) into v_low_stock from public.branch_products bp
    where bp.quantity <= coalesce(bp.low_stock_level, (select low_stock_default from public.settings));
  select count(*) into v_pending_requests from public.product_requests where status = 'PENDING';
  select count(*) into v_active_branches from public.branches where active = true;

  select coalesce(jsonb_agg(jsonb_build_object('branch', b.name,
      'sales', (select coalesce(sum(total),0) from public.sales where branch_id = b.id and status='COMPLETED'),
      'services', (select coalesce(sum(amount),0) from public.service_transactions where branch_id = b.id)
    )), '[]'::jsonb) into v_by_branch
  from public.branches b;

  return jsonb_build_object(
    'totalSales', v_total_sales, 'serviceIncome', v_service_income,
    'productProfit', v_product_profit, 'serviceProfit', v_service_income - v_resource_cost,
    'lowStockItems', v_low_stock, 'pendingRequests', v_pending_requests, 'activeBranches', v_active_branches,
    'salesByBranch', v_by_branch
  );
end;
$$;

create or replace function public.cashier_dashboard()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_branch uuid; v_today date; v_sales numeric; v_services numeric; v_txn_count int;
  v_low_stock int; v_pending int; v_closed boolean;
begin
  if not public.is_cashier() then raise exception 'Cashier access only.'; end if;
  v_branch := public.app_branch_id();
  v_today := (now() at time zone 'Africa/Dar_es_Salaam')::date;

  select coalesce(sum(total),0), count(*) into v_sales, v_txn_count from public.sales
    where branch_id = v_branch and status = 'COMPLETED' and created_at::date = v_today;
  select coalesce(sum(amount),0) into v_services from public.service_transactions
    where branch_id = v_branch and created_at::date = v_today;
  select count(*) into v_low_stock from public.branch_products
    where branch_id = v_branch and quantity <= coalesce(low_stock_level, (select low_stock_default from public.settings));
  select count(*) into v_pending from public.product_requests where branch_id = v_branch and status = 'PENDING';
  select exists(select 1 from public.daily_closings where branch_id = v_branch and business_date = v_today) into v_closed;

  return jsonb_build_object(
    'todaysSales', v_sales, 'todaysServiceIncome', v_services, 'transactionCount', v_txn_count,
    'lowStockItems', v_low_stock, 'pendingRequests', v_pending, 'dayClosed', v_closed
  );
end;
$$;

-- ---------- Settings ----------
create or replace function public.update_settings(p_settings jsonb)
returns public.settings language plpgsql security definer set search_path = public as $$
declare v_settings public.settings;
begin
  if not public.is_manager() then raise exception 'Only a manager can change settings.'; end if;
  update public.settings set
    business_name = coalesce(p_settings->>'businessName', business_name),
    currency = coalesce(p_settings->>'currency', currency),
    phone = coalesce(p_settings->>'phone', phone),
    whatsapp = coalesce(p_settings->>'whatsapp', whatsapp),
    email = coalesce(p_settings->>'email', email),
    office_address = coalesce(p_settings->>'officeAddress', office_address),
    opening_hours = coalesce(p_settings->>'openingHours', opening_hours),
    google_maps_url = coalesce(p_settings->>'googleMapsUrl', google_maps_url),
    google_maps_embed_url = coalesce(p_settings->>'googleMapsEmbedUrl', google_maps_embed_url),
    low_stock_default = coalesce((p_settings->>'lowStockDefault')::numeric, low_stock_default)
  where id = 1
  returning * into v_settings;
  perform public.log_action('SETTINGS_UPDATE', 'settings', null, '{}'::jsonb);
  return v_settings;
end;
$$;

grant execute on all functions in schema public to authenticated;
revoke execute on function public.app_role(), public.app_branch_id(), public.is_manager(), public.is_cashier(), public.log_action(text,text,uuid,jsonb) from anon;

-- =============================================================================
-- Done. Next: deploy the "create-user" Edge Function (see
-- supabase/functions/create-user) and create your first Admin using it, or
-- follow the README's "bootstrapping your first Admin" instructions.
-- =============================================================================
