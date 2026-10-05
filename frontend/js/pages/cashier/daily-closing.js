// js/pages/cashier/daily-closing.js
import { supabase } from '../../supabase-client.js';
import { money, badge, toast, friendlyError, confirmDialog, promptDialog, renderTable } from '../../ui.js';

export async function renderDailyClosing() {
  const main = document.getElementById('app-main');
  const { data: d, error } = await supabase.rpc('cashier_dashboard');
  if (error) throw error;
  const { data: expenses, error: expenseError } = await supabase.from('branch_expenses_view').select('*').eq('business_date', new Date().toLocaleDateString('en-CA',{ timeZone:'Africa/Dar_es_Salaam' })).order('created_at',{ascending:false});
  if (expenseError) throw expenseError;
  const spent = (expenses || []).reduce((sum, e) => sum + Number(e.amount), 0);
  const gross = Number(d.todaysSales || 0) + Number(d.todaysServiceIncome || 0);
  const net = gross - spent;
  main.innerHTML = `<h1 class="page-title">Daily Closing</h1><div class="panel">
    <p>Today's Product Sales: <strong>${money(d.todaysSales)}</strong></p>
    <p>Today's Service Income: <strong>${money(d.todaysServiceIncome)}</strong></p>
    <p>Gross income: <strong>${money(gross)}</strong></p>
    <p>Branch expenses: <strong>${money(spent)}</strong></p><p>Cash to collect after expenses: <strong>${money(net)}</strong></p>
    ${d.dayClosed ? `<p>${badge('Day already closed', 'green')}</p>` : `<button class="btn btn-outline" onclick="addBranchExpense()">Record Expense</button> <button class="btn btn-primary" onclick="closeDay()">Close Business Day</button>`}
  </div><div class="panel"><div class="panel-header"><h3>Today's expenses</h3></div>${renderTable([
    {key:'description',label:'Reason'}, {key:'amount',label:'Amount',render:r=>money(r.amount)}, {key:'created_at',label:'Time',render:r=>new Date(r.created_at).toLocaleTimeString()}
  ],expenses,'No expenses recorded today.')}</div>`;
}

export async function addBranchExpense() {
  const result = await promptDialog({title:'Record branch expense',icon:'dollar',confirmLabel:'Save expense',fields:[
    {id:'description',label:'Reason',placeholder:'What was the expense for?'},
    {id:'amount',label:'Amount',type:'number',min:0.01,placeholder:'0.00'}
  ]});
  if (!result) return;
  const reason=result.description.trim(), amount=Number(result.amount);
  if(!reason) return toast('Enter the expense reason.','error');
  if(!Number.isFinite(amount)||amount<=0) return toast('Enter an amount greater than zero.','error');
  const {error}=await supabase.rpc('record_branch_expense',{p_description:reason,p_category:'Other',p_amount:amount});
  if(error) return toast(friendlyError(error),'error');
  toast('Expense recorded.','success'); renderDailyClosing();
}

export async function closeDay() {
  const ok = await confirmDialog({ title: "Close Today's Business Day?", message: "This finalizes today's totals and cannot be undone.", icon: 'clock', confirmLabel: 'Close Day' });
  if (!ok) return;
  const { error } = await supabase.rpc('close_daily');
  if (error) return toast(friendlyError(error), 'error');
  toast('Day closed successfully.', 'success'); renderDailyClosing();
}

window.closeDay = closeDay;
window.addBranchExpense = addBranchExpense;
