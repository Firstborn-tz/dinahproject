// js/pages/manager/dashboard.js
import { supabase } from '../../supabase-client.js';
import { state } from '../../state.js';
import { money, renderTable, statCard, escapeHtml, toast } from '../../ui.js';

const dayKey = (value) => new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Dar_es_Salaam'}).format(new Date(value));
const todayKey = () => dayKey(new Date());

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
  const {data: [salesRes, serviceRes, expensesRes, branchesRes, dashboardRes]} = await supabase.from('sales_view').select('branch_id,total,status,created_at').then(async sales=>{
    const results=await Promise.all([supabase.from('service_transactions_view').select('branch_id,amount,created_at'),supabase.from('branch_expenses_view').select('branch_id,amount,business_date,category,description'),supabase.from('branches_view').select('id,name,active').order('name'),supabase.rpc('manager_dashboard')]);
    return {data:[sales,...results]};
  });
  if(salesRes.error||serviceRes.error||expensesRes.error||branchesRes.error||dashboardRes.error) throw salesRes.error||serviceRes.error||expensesRes.error||branchesRes.error||dashboardRes.error;
  state.managerDashboardData={sales:salesRes.data||[],services:serviceRes.data||[],expenses:expensesRes.data||[],branches:branchesRes.data||[],meta:dashboardRes.data};
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
function drawDashboard(){
  const data=state.managerDashboardData;if(!data)return;
  const from=document.getElementById('dash-from').value,to=document.getElementById('dash-to').value,selected=document.getElementById('dash-branch').value;
  const branchOk=id=>selected==='all'||id===selected, dateOk=d=>d>=from&&d<=to;
  const sales=data.sales.filter(x=>x.status==='COMPLETED'&&branchOk(x.branch_id)&&dateOk(dayKey(x.created_at)));
  const services=data.services.filter(x=>branchOk(x.branch_id)&&dateOk(dayKey(x.created_at)));
  const expenses=data.expenses.filter(x=>branchOk(x.branch_id)&&dateOk(x.business_date));
  const totalSales=sales.reduce((n,x)=>n+Number(x.total),0), serviceIncome=services.reduce((n,x)=>n+Number(x.amount),0), spent=expenses.reduce((n,x)=>n+Number(x.amount),0);
  const byBranch=data.branches.filter(b=>selected==='all'||b.id===selected).map(b=>{
    const ps=sales.filter(x=>x.branch_id===b.id).reduce((n,x)=>n+Number(x.total),0),si=services.filter(x=>x.branch_id===b.id).reduce((n,x)=>n+Number(x.amount),0),ex=expenses.filter(x=>x.branch_id===b.id).reduce((n,x)=>n+Number(x.amount),0);
    return {id:b.id,branch:b.name,sales:ps,services:si,expenses:ex,net:Math.max(0,ps+si-ex)};
  });
  const maxVal=Math.max(1,...byBranch.map(b=>b.net)); const meta=data.meta;
  document.getElementById('dashboard-content').innerHTML=`<div class="stat-grid">
    ${statCard('Product Sales',money(totalSales))}${statCard('Service Income',money(serviceIncome))}${statCard('Expenses',money(spent),spent>0)}${statCard('Net Cash Due',money(Math.max(0,totalSales+serviceIncome-spent)))}
    ${statCard('Low Stock Items',meta.lowStockItems,meta.lowStockItems>0)}${statCard('Pending Requests',meta.pendingRequests,meta.pendingRequests>0)}${statCard('Active Branches',meta.activeBranches)}
  </div><div class="panel"><div class="panel-header"><div><h3>Branch performance</h3><p class="muted small">${escapeHtml(from)} to ${escapeHtml(to)} · sales and service income less recorded expenses</p></div></div>
    <div class="bars-scroll"><div class="bars">${byBranch.map(b=>`<div class="bar-col"><div class="bar" style="height:${Math.max(4,(b.net/maxVal)*120)}px" title="${money(b.net)}"></div><div class="bar-label">${escapeHtml(b.branch)}</div></div>`).join('')}</div></div>
    ${renderTable([{key:'branch',label:'Branch'},{key:'sales',label:'Product Sales',render:r=>money(r.sales)},{key:'services',label:'Service Income',render:r=>money(r.services)},{key:'expenses',label:'Expenses',render:r=>money(r.expenses)},{key:'net',label:'Net Cash Due',render:r=>`<strong>${money(r.net)}</strong>`}],byBranch,'No branch activity in this period.')}
  </div>`;
}
window.renderManagerDashboard=renderManagerDashboard;window.setDashboardPeriod=setDashboardPeriod;window.applyDashboardDates=applyDashboardDates;window.drawDashboard=drawDashboard;
