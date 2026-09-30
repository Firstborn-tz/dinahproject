// js/pages/manager/dashboard.js
import { supabase } from '../../supabase-client.js';
import { money, renderTable, statCard, escapeHtml } from '../../ui.js';

export async function renderManagerDashboard() {
  const main = document.getElementById('app-main');
  const { data, error } = await supabase.rpc('manager_dashboard');
  if (error) throw error;
  const maxVal = Math.max(1, ...data.salesByBranch.map((b) => b.sales));
  main.innerHTML = `
    <h1 class="page-title">Manager Dashboard</h1><p class="page-sub">Business overview across all branches.</p>
    <div class="stat-grid">
      ${statCard('Total Sales', money(data.totalSales))}${statCard('Service Income', money(data.serviceIncome))}
      ${statCard('Product Profit', money(data.productProfit))}${statCard('Service Profit', money(data.serviceProfit))}
      ${statCard('Low Stock Items', data.lowStockItems, data.lowStockItems > 0)}${statCard('Pending Requests', data.pendingRequests, data.pendingRequests > 0)}
      ${statCard('Active Branches', data.activeBranches)}
    </div>
    <div class="panel"><div class="panel-header"><h3>Sales by Branch</h3></div>
      <div class="bars-scroll"><div class="bars">${data.salesByBranch.map((b) => `<div class="bar-col"><div class="bar" style="height:${Math.max(4, (b.sales / maxVal) * 120)}px" title="${money(b.sales)}"></div><div class="bar-label">${escapeHtml(b.branch)}</div></div>`).join('')}</div></div>
      ${renderTable([{ key: 'branch', label: 'Branch' }, { key: 'sales', label: 'Product Sales', render: (r) => money(r.sales) }, { key: 'services', label: 'Service Income', render: (r) => money(r.services) }], data.salesByBranch)}
    </div>`;
}
