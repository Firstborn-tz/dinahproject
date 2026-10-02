-- Branch operating expenses and net daily cash.
create table if not exists public.branch_expenses (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  business_date date not null default (now() at time zone 'Africa/Dar_es_Salaam')::date,
  description text not null check (length(trim(description)) > 0),
  category text not null check (category in ('Food','Transport','Electricity','Other')),
  amount numeric(12,2) not null check (amount > 0),
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists branch_expenses_branch_date_idx on public.branch_expenses(branch_id, business_date desc);
alter table public.branch_expenses enable row level security;
revoke all on public.branch_expenses from anon, authenticated;

create or replace view public.branch_expenses_view as
  select * from public.branch_expenses where public.is_manager() or branch_id = public.app_branch_id();
grant select on public.branch_expenses_view to authenticated;

create or replace function public.record_branch_expense(p_description text, p_category text, p_amount numeric,
  p_business_date date default (now() at time zone 'Africa/Dar_es_Salaam')::date)
returns public.branch_expenses language plpgsql security definer set search_path = public as $$
declare v_branch uuid; v_expense public.branch_expenses;
begin
  if not public.is_cashier() then raise exception 'Only a cashier can record branch expenses.'; end if;
  if trim(coalesce(p_description,'')) = '' then raise exception 'Enter what the expense was for.'; end if;
  if p_category not in ('Food','Transport','Electricity','Other') then raise exception 'Choose a valid expense category.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Expense amount must be greater than zero.'; end if;
  v_branch := public.app_branch_id();
  if exists(select 1 from public.daily_closings where branch_id=v_branch and business_date=p_business_date) then
    raise exception 'This business day is already closed.';
  end if;
  insert into public.branch_expenses(branch_id,business_date,description,category,amount,recorded_by)
  values(v_branch,p_business_date,trim(p_description),p_category,p_amount,auth.uid()) returning * into v_expense;
  perform public.log_action('BRANCH_EXPENSE','branchExpense',v_branch,jsonb_build_object('date',p_business_date,'amount',p_amount,'category',p_category));
  return v_expense;
end;
$$;
revoke all on function public.record_branch_expense(text,text,numeric,date) from public, anon;
grant execute on function public.record_branch_expense(text,text,numeric,date) to authenticated;

create or replace function public.close_daily(p_business_date date default (now() at time zone 'Africa/Dar_es_Salaam')::date)
returns public.daily_closings language plpgsql security definer set search_path = public as $$
declare v_branch uuid; v_sales numeric; v_services numeric; v_expenses numeric; v_closing public.daily_closings;
begin
  if not public.is_cashier() then raise exception 'Only a cashier can close the business day.'; end if;
  v_branch := public.app_branch_id();
  if exists (select 1 from public.daily_closings where branch_id = v_branch and business_date = p_business_date) then
    raise exception 'This business day has already been closed.';
  end if;
  select coalesce(sum(total), 0) into v_sales from public.sales where branch_id=v_branch and status='COMPLETED' and created_at::date=p_business_date;
  select coalesce(sum(amount), 0) into v_services from public.service_transactions where branch_id=v_branch and created_at::date=p_business_date;
  select coalesce(sum(amount), 0) into v_expenses from public.branch_expenses where branch_id=v_branch and business_date=p_business_date;
  insert into public.daily_closings(branch_id,business_date,product_sales,service_income,expected_cash,closed_by)
    values(v_branch,p_business_date,v_sales,v_services,greatest(0,v_sales+v_services-v_expenses),auth.uid()) returning * into v_closing;
  perform public.log_action('DAILY_CLOSING','dailyClosing',v_branch,jsonb_build_object('date',p_business_date,'expenses',v_expenses));
  return v_closing;
end;
$$;
