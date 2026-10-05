-- Period and branch aware income, cost, operating expense, profit and cash
-- figures for the manager dashboard.
create or replace function public.manager_financial_summary(
  p_from date,
  p_to date,
  p_branch_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_product_sales numeric := 0;
  v_product_cost numeric := 0;
  v_service_income numeric := 0;
  v_service_cost numeric := 0;
  v_branch_expenses numeric := 0;
  v_product_profit numeric := 0;
  v_service_profit numeric := 0;
begin
  if not public.is_manager() then raise exception 'Manager access only.'; end if;
  if p_from is null or p_to is null or p_from > p_to then raise exception 'Choose a valid date range.'; end if;

  select coalesce(sum(si.line_total),0), coalesce(sum(si.quantity * p.buying_price),0)
    into v_product_sales,v_product_cost
  from public.sales s
  join public.sale_items si on si.sale_id=s.id
  join public.products p on p.id=si.product_id
  where s.status='COMPLETED'
    and (s.created_at at time zone 'Africa/Dar_es_Salaam')::date between p_from and p_to
    and (p_branch_id is null or s.branch_id=p_branch_id);

  select coalesce(sum(amount),0) into v_service_income
  from public.service_transactions
  where (created_at at time zone 'Africa/Dar_es_Salaam')::date between p_from and p_to
    and (p_branch_id is null or branch_id=p_branch_id);

  select coalesce(sum(cost),0) into v_service_cost
  from public.resource_usage
  where (created_at at time zone 'Africa/Dar_es_Salaam')::date between p_from and p_to
    and (p_branch_id is null or branch_id=p_branch_id);

  select coalesce(sum(amount),0) into v_branch_expenses
  from public.branch_expenses
  where business_date between p_from and p_to
    and (p_branch_id is null or branch_id=p_branch_id);

  v_product_profit := v_product_sales-v_product_cost;
  v_service_profit := v_service_income-v_service_cost-v_branch_expenses;
  return jsonb_build_object(
    'productSales',v_product_sales,
    'productCost',v_product_cost,
    'productProfit',v_product_profit,
    'serviceIncome',v_service_income,
    'serviceCost',v_service_cost,
    'serviceProfit',v_service_profit,
    'branchExpenses',v_branch_expenses,
    'cashToCollect',v_product_sales+v_service_income-v_branch_expenses,
    'netProfit',v_product_profit+v_service_profit
  );
end;
$$;

revoke all on function public.manager_financial_summary(date,date,uuid) from public, anon;
grant execute on function public.manager_financial_summary(date,date,uuid) to authenticated;
