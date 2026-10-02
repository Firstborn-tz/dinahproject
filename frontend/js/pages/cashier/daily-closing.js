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
  const net = Math.max(0, Number(d.todaysSales) + Number(d.todaysServiceIncome) - spent);
  main.innerHTML = `<h1 class="page-title">Daily Closing</h1><div class="panel">
    <p>Today's Product Sales: <strong>${money(d.todaysSales)}</strong></p>
    <p>Today's Service Income: <strong>${money(d.todaysServiceIncome)}</strong></p>
    <p>Expenses: <strong>${money(spent)}</strong></p><p>Cash to collect: <strong>${money(net)}</strong></p>
    ${d.dayClosed ? `<p>${badge('Day already closed', 'green')}</p>` : `<button class="btn btn-outline" onclick="addBranchExpense()">Record Expense</button> <button class="btn btn-primary" onclick="closeDay()">Close Business Day</button>`}
  </div><div class="panel"><div class="panel-header"><h3>Today's expenses</h3></div>${renderTable([
    {key:'category',label:'Category'}, {key:'description',label:'Need'}, {key:'amount',label:'Amount',render:r=>money(r.amount)}, {key:'created_at',label:'Time',render:r=>new Date(r.created_at).toLocaleTimeString()}
  ],expenses,'No expenses recorded today.')}</div>`;
}

export async function addBranchExpense() {
  const result = await promptDialog({title:'Record branch expense',icon:'dollar',confirmLabel:'Save expense',fields:[
    {id:'category',label:'Category',type:'select',value:'Food',options:['Food','Transport','Electricity','Other'].map(v=>({value:v,label:v}))},
    {id:'description',label:'What was needed?'}, {id:'amount',label:'Amount',type:'number',min:0.01}
  ]});
  if (!result) return;
  const {error}=await supabase.rpc('record_branch_expense',{p_description:result.description,p_category:result.category,p_amount:result.amount});
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
