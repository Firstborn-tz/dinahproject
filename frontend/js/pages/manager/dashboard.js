// js/pages/manager/dashboard.js
import { supabase } from '../../supabase-client.js';
import { state } from '../../state.js';
import { money, renderTable, statCard, escapeHtml, toast } from '../../ui.js';

const dayKey = (value) => new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Dar_es_Salaam'}).format(new Date(value));
const todayKey = () => dayKey(new Date());
let expenseSort = { key: 'date', direction: 'desc' };
let dashboardDrawVersion = 0;

async function fetchAll(query) {
  const rows=[];
  for(let offset=0;;offset+=1000){
    const {data,error}=await query.range(offset,offset+999);
    if(error)return {data:null,error};
    rows.push(...(data||[]));
    if(!data||data.length<1000)break;
  }
  return {data:rows,error:null};
}

export async function renderManagerDashboard() {
  const main = document.getElementById('app-main');
  const today = todayKey();
  main.innerHTML = `<h1 class="page-title">Admin Dashboard</h1><p class="page-sub">Track branch income, expenses and cash due across any reporting period.</p>
    <div class="panel dashboard-filters"><div class="dashboard-periods" role="group" aria-label="Reporting period">
      ${[['day','Daily'],['week','Weekly'],['month','Monthly'],['year','Yearly'],['custom','Custom']].map(([id,label])=>`<button class="btn btn-outline period-btn" data-period="${id}" onclick="setDashboardPeriod('${id}')">${label}</button>`).join('')}
    </div><div class="dashboard-filter-fields"><label>Branch<select id="dash-branch" onchange="drawDashboard()"><option value="all">All branches</option>${state.branches.map(b=>`<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}</select></label>
      <label>From<input id="dash-from" type="date" value="${today}" /></label><label>To<input id="dash-to" type="date" value="${today}" /></label>
      <button class="btn btn-primary" onclick="applyDashboardDates()">Apply dates</button></div></div>
    <div id="dashboard-content"><div class="loader-wrap"><div class="loader"></div></div></div>`;
  const [salesRes,serviceRes,expensesRes,branchesRes,dashboardRes]=await Promise.all([
    fetchAll(supabase.from('sales_view').select('branch_id,total,status,created_at')),
    fetchAll(supabase.from('service_transactions_view').select('branch_id,amount,created_at')),
    fetchAll(supabase.from('branch_expenses_view').select('branch_id,amount,business_date,category,description')),
    supabase.from('branches_view').select('id,name,active').order('name'),
    supabase.rpc('manager_dashboard')
  ]);
  const expenseViewMissing=expensesRes.error && (expensesRes.error.code==='PGRST205'||/branch_expenses_view.*schema cache|schema cache.*branch_expenses_view/i.test(expensesRes.error.message||''));
  if(salesRes.error||serviceRes.error||(expensesRes.error&&!expenseViewMissing)||branchesRes.error||dashboardRes.error) throw salesRes.error||serviceRes.error||expensesRes.error||branchesRes.error||dashboardRes.error;
  state.managerDashboardData={sales:salesRes.data||[],services:serviceRes.data||[],expenses:expensesRes.data||[],expensesUnavailable:!!expenseViewMissing,branches:branchesRes.data||[],meta:dashboardRes.data};
  window.setDashboardPeriod('day',false);
}

export function setDashboardPeriod(period, redraw=true) {
  const now=new Date(); const end=todayKey(); let start=end;
  if(period==='week'){const d=new Date(now);d.setDate(d.getDate()-((d.getDay()+6)%7));start=dayKey(d);}
  if(period==='month') start=`${end.slice(0,7)}-01`;
  if(period==='year') start=`${end.slice(0,4)}-01-01`;
  document.querySelectorAll('.period-btn').forEach(b=>b.classList.toggle('btn-primary',b.dataset.period===period));
  document.querySelectorAll('.period-btn').forEach(b=>b.classList.toggle('btn-outline',b.dataset.period!==period));
  if(period!=='custom'){document.getElementById('dash-from').value=start;document.getElementById('dash-to').value=end;}
  if(redraw) drawDashboard(); else drawDashboard();
}
export function applyDashboardDates(){
  const from=document.getElementById('dash-from').value,to=document.getElementById('dash-to').value;
  if(!from||!to||from>to){toast('Choose a valid date range.','error');return;}
  document.querySelectorAll('.period-btn').forEach(b=>{b.classList.toggle('btn-primary',b.dataset.period==='custom');b.classList.toggle('btn-outline',b.dataset.period!=='custom');}); drawDashboard();
}
async function drawDashboard(){
  const data=state.managerDashboardData;if(!data)return;
  const from=document.getElementById('dash-from').value,to=document.getElementById('dash-to').value,selected=document.getElementById('dash-branch').value;
  const drawVersion=++dashboardDrawVersion;
  const {data:financials,error:financialError}=await supabase.rpc('manager_financial_summary',{p_from:from,p_to:to,p_branch_id:selected==='all'?null:selected});
  if(drawVersion!==dashboardDrawVersion)return;
  if(financialError){toast(`Could not load profit and cash summary: ${financialError.message}`,'error');return;}
  const branchOk=id=>selected==='all'||id===selected, dateOk=d=>d>=from&&d<=to;
  const sales=data.sales.filter(x=>x.status==='COMPLETED'&&branchOk(x.branch_id)&&dateOk(dayKey(x.created_at)));
  const services=data.services.filter(x=>branchOk(x.branch_id)&&dateOk(dayKey(x.created_at)));
  const expenses=data.expenses.filter(x=>branchOk(x.branch_id)&&dateOk(x.business_date));
  const spent=expenses.reduce((n,x)=>n+Number(x.amount),0);
  const byBranch=data.branches.filter(b=>selected==='all'||b.id===selected).map(b=>{
    const ps=sales.filter(x=>x.branch_id===b.id).reduce((n,x)=>n+Number(x.total),0),si=services.filter(x=>x.branch_id===b.id).reduce((n,x)=>n+Number(x.amount),0),ex=expenses.filter(x=>x.branch_id===b.id).reduce((n,x)=>n+Number(x.amount),0);
    return {id:b.id,branch:b.name,sales:ps,services:si,expenses:ex,net:ps+si-ex};
  });
  const branchNames=new Map(data.branches.map(b=>[b.id,b.name]));
  const expenseRows=expenses.map(e=>({...e,branch:branchNames.get(e.branch_id)||'Unknown branch',date:e.business_date,reason:e.description||''}));
  const sortValue={branch:r=>r.branch.toLocaleLowerCase(),date:r=>r.date,reason:r=>r.reason.toLocaleLowerCase(),amount:r=>Number(r.amount)};
  expenseRows.sort((a,b)=>{const av=sortValue[expenseSort.key](a),bv=sortValue[expenseSort.key](b);return (av<bv?-1:av>bv?1:0)*(expenseSort.direction==='asc'?1:-1);});
  const maxVal=Math.max(1,...byBranch.map(b=>Math.abs(b.net))); const meta=data.meta;
  document.getElementById('dashboard-content').innerHTML=`${data.expensesUnavailable?`<div class="panel dashboard-migration-notice"><strong>Expense reporting is not connected yet.</strong><span>Apply the expense and net cash migrations from the Supabase migrations folder, then refresh the page. Sales and service totals are shown; expense and net cash figures will update after the migrations.</span></div>`:''}<div class="stat-grid">
    ${statCard('Product Sales',money(financials.productSales))}${statCard('Product Profit',money(financials.productProfit),financials.productProfit<0)}${statCard('Service Income',money(financials.serviceIncome))}${statCard('Service Profit',money(financials.serviceProfit),financials.serviceProfit<0)}
    ${statCard('Branch Expenses',money(financials.branchExpenses),financials.branchExpenses>0)}${statCard('Cash to Collect',money(financials.cashToCollect),financials.cashToCollect<0)}${statCard('Net Profit / Loss',money(financials.netProfit),financials.netProfit<0)}
    ${statCard('Low Stock Items',meta.lowStockItems,meta.lowStockItems>0)}${statCard('Pending Requests',meta.pendingRequests,meta.pendingRequests>0)}${statCard('Active Branches',meta.activeBranches)}
  </div><p class="dashboard-financial-note">Cash to collect = product sales + service income less branch expenses. Product profit deducts product cost. Service profit deducts resource costs and branch expenses. Negative profit indicates a loss.</p>
  <div class="panel"><div class="panel-header"><div><h3>Branch performance</h3><p class="muted small">${escapeHtml(from)} to ${escapeHtml(to)} · sales and service income less recorded expenses</p></div></div>
    <div class="bars-scroll"><div class="bars">${byBranch.map(b=>`<div class="bar-col"><div class="bar ${b.net<0?'bar-negative':''}" style="height:${Math.max(4,(Math.abs(b.net)/maxVal)*120)}px" title="${money(b.net)}"></div><div class="bar-label">${escapeHtml(b.branch)}</div></div>`).join('')}</div></div>
    ${renderTable([{key:'branch',label:'Branch'},{key:'sales',label:'Product Sales',render:r=>money(r.sales)},{key:'services',label:'Service Income',render:r=>money(r.services)},{key:'expenses',label:'Expenses',render:r=>money(r.expenses)},{key:'net',label:'Net Cash Due',render:r=>`<strong>${money(r.net)}</strong>`}],byBranch,'No branch activity in this period.')}
  </div><div class="panel"><div class="panel-header"><div><h3>Branch expenses</h3><p class="muted small">All expense entries for ${escapeHtml(from)} to ${escapeHtml(to)}. Select a branch above to narrow this list.</p></div><strong class="expense-total">Total: ${money(spent)}</strong></div>
    ${renderTable([
      {key:'branch',label:`<button class="table-sort" onclick="sortDashboardExpenses('branch')">Branch${expenseSort.key==='branch'?(expenseSort.direction==='asc'?' ↑':' ↓'):''}</button>`},
      {key:'date',label:`<button class="table-sort" onclick="sortDashboardExpenses('date')">Date${expenseSort.key==='date'?(expenseSort.direction==='asc'?' ↑':' ↓'):''}</button>`},
      {key:'reason',label:`<button class="table-sort" onclick="sortDashboardExpenses('reason')">Reason${expenseSort.key==='reason'?(expenseSort.direction==='asc'?' ↑':' ↓'):''}</button>`},
      {key:'amount',label:`<button class="table-sort" onclick="sortDashboardExpenses('amount')">Amount${expenseSort.key==='amount'?(expenseSort.direction==='asc'?' ↑':' ↓'):''}</button>`,render:r=>`<strong>${money(r.amount)}</strong>`}
    ],expenseRows,'No branch expenses in this period.')}
  </div>`;
}
export function sortDashboardExpenses(key){if(expenseSort.key===key)expenseSort.direction=expenseSort.direction==='asc'?'desc':'asc';else expenseSort={key,direction:key==='date'?'desc':'asc'};drawDashboard();}
window.renderManagerDashboard=renderManagerDashboard;window.setDashboardPeriod=setDashboardPeriod;window.applyDashboardDates=applyDashboardDates;window.drawDashboard=drawDashboard;window.sortDashboardExpenses=sortDashboardExpenses;
