-- Keep saved expected cash consistent with the cashier and admin dashboards:
-- gross income less the branch expenses recorded for the business date.
create or replace function public.close_daily(p_business_date date default (now() at time zone 'Africa/Dar_es_Salaam')::date)
returns public.daily_closings language plpgsql security definer set search_path = public as $$
declare v_branch uuid; v_sales numeric; v_services numeric; v_expenses numeric; v_closing public.daily_closings;
begin
  if not public.is_cashier() then raise exception 'Only a cashier can close the business day.'; end if;
  v_branch := public.app_branch_id();
  if exists (select 1 from public.daily_closings where branch_id=v_branch and business_date=p_business_date) then
    raise exception 'This business day has already been closed.';
  end if;
  select coalesce(sum(total),0) into v_sales from public.sales
    where branch_id=v_branch and status='COMPLETED'
      and (created_at at time zone 'Africa/Dar_es_Salaam')::date=p_business_date;
  select coalesce(sum(amount),0) into v_services from public.service_transactions
    where branch_id=v_branch and (created_at at time zone 'Africa/Dar_es_Salaam')::date=p_business_date;
  select coalesce(sum(amount),0) into v_expenses from public.branch_expenses
    where branch_id=v_branch and business_date=p_business_date;
  insert into public.daily_closings(branch_id,business_date,product_sales,service_income,expected_cash,closed_by)
    values(v_branch,p_business_date,v_sales,v_services,v_sales+v_services-v_expenses,auth.uid()) returning * into v_closing;
  perform public.log_action('DAILY_CLOSING','dailyClosing',v_branch,jsonb_build_object('date',p_business_date,'expenses',v_expenses));
  return v_closing;
end;
$$;

-- Correct previously closed days so recorded expected cash also reflects
-- expenses that were entered before the closing function was updated.
update public.daily_closings d
set expected_cash = d.product_sales + d.service_income - coalesce((
  select sum(e.amount) from public.branch_expenses e
  where e.branch_id=d.branch_id and e.business_date=d.business_date
),0);

update public.cash_collections c
set expected_cash=d.expected_cash,
    difference=c.collected_amount-d.expected_cash
from public.daily_closings d
where d.branch_id=c.branch_id and d.business_date=c.business_date;
