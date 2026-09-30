-- Product intake supports pack purchases, direct manager stock assignment,
-- and cashier reported deliveries awaiting manager cost confirmation.
alter table public.product_requests
  add column if not exists purchase_total numeric(12,2),
  add column if not exists items_per_pack numeric(12,2) not null default 1,
  add column if not exists intake_type text not null default 'INDIVIDUAL';

create or replace view public.product_requests_view as
  select * from public.product_requests
  where public.is_manager() or branch_id = public.app_branch_id();

create or replace function public.create_product_request(
  p_product_name text, p_selling_price numeric, p_unit text, p_quantity numeric,
  p_purchase_total numeric, p_items_per_pack numeric, p_intake_type text
) returns public.product_requests language plpgsql security definer set search_path = public as $$
declare v_req public.product_requests;
begin
  if not public.is_cashier() then raise exception 'Only a cashier can register a delivered product.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be positive.'; end if;
  if p_items_per_pack is null or p_items_per_pack <= 0 then raise exception 'Items per pack must be positive.'; end if;
  if p_intake_type not in ('INDIVIDUAL','PACK') then raise exception 'Choose individual items or a pack.'; end if;
  if p_selling_price is null or p_selling_price <= 0 then raise exception 'Selling price must be positive.'; end if;
  if p_purchase_total is not null and p_purchase_total < 0 then raise exception 'Purchase total cannot be negative.'; end if;
  insert into public.product_requests
    (branch_id, product_name, selling_price, unit, quantity, requested_by, purchase_total, items_per_pack, intake_type)
  values (public.app_branch_id(), trim(p_product_name), p_selling_price, coalesce(nullif(trim(p_unit),''),'piece'),
    p_quantity, auth.uid(), p_purchase_total, p_items_per_pack, p_intake_type)
  returning * into v_req;
  perform public.log_action('PRODUCT_DELIVERY_REGISTER', 'productRequest', v_req.branch_id, jsonb_build_object('requestId', v_req.id));
  return v_req;
end;
$$;

create or replace function public.add_product_to_branch(
  p_branch_id uuid, p_name text, p_type text, p_category text, p_unit text,
  p_purchase_total numeric, p_items_per_pack numeric, p_selling_price numeric,
  p_quantity numeric, p_low_stock_level numeric default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_product public.products;
begin
  if not public.is_manager() then raise exception 'Only an admin can add branch stock.'; end if;
  if p_type not in ('FOR_SALE','RESOURCE') then raise exception 'Invalid product type.'; end if;
  if p_purchase_total is null or p_purchase_total < 0 or p_items_per_pack is null or p_items_per_pack <= 0 then
    raise exception 'Purchase total and items per pack must be valid.';
  end if;
  if p_quantity is null or p_quantity < 0 then raise exception 'Quantity cannot be negative.'; end if;
  insert into public.products(name,type,category,unit,buying_price,selling_price)
  values (trim(p_name), p_type, coalesce(nullif(trim(p_category),''),'General'), coalesce(nullif(trim(p_unit),''),'piece'),
    p_purchase_total / p_items_per_pack, case when p_type='FOR_SALE' then coalesce(p_selling_price,0) else 0 end)
  returning * into v_product;
  insert into public.branch_products(branch_id,product_id,quantity,low_stock_level)
  values(p_branch_id,v_product.id,p_quantity,p_low_stock_level);
  perform public.log_action('PRODUCT_CREATE_AND_ASSIGN','branchProduct',p_branch_id,
    jsonb_build_object('productId',v_product.id,'quantity',p_quantity,'unitBuyingPrice',v_product.buying_price));
  return v_product.id;
end;
$$;

create or replace function public.approve_product_request(p_request_id uuid, p_buying_price numeric, p_category text default 'General')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_req public.product_requests; v_product public.products; v_unit_cost numeric;
begin
  if not public.is_manager() then raise exception 'Only an admin can confirm deliveries.'; end if;
  select * into v_req from public.product_requests where id=p_request_id for update;
  if not found or v_req.status <> 'PENDING' then raise exception 'Delivery not found or already reviewed.'; end if;
  if p_buying_price is null or p_buying_price < 0 then raise exception 'Enter the total purchase cost.'; end if;
  v_unit_cost := p_buying_price / greatest(coalesce(v_req.items_per_pack,1),1);
  insert into public.products(name,type,category,unit,buying_price,selling_price)
    values(v_req.product_name,'FOR_SALE',coalesce(p_category,'General'),v_req.unit,v_unit_cost,v_req.selling_price)
    returning * into v_product;
  insert into public.branch_products(branch_id,product_id,quantity) values(v_req.branch_id,v_product.id,v_req.quantity);
  update public.product_requests set status='APPROVED', buying_price=v_unit_cost, purchase_total=p_buying_price,
    product_id=v_product.id, reviewed_by=auth.uid(), reviewed_at=now() where id=p_request_id;
  perform public.log_action('PRODUCT_DELIVERY_CONFIRM','productRequest',v_req.branch_id,jsonb_build_object('requestId',p_request_id,'productId',v_product.id,'unitBuyingPrice',v_unit_cost));
  return jsonb_build_object('requestId',p_request_id,'productId',v_product.id,'unitBuyingPrice',v_unit_cost);
end;
$$;

grant execute on function public.add_product_to_branch(uuid,text,text,text,text,numeric,numeric,numeric,numeric,numeric) to authenticated;
grant execute on function public.create_product_request(text,numeric,text,numeric,numeric,numeric,text) to authenticated;
