// js/pages/cashier/dashboard.js
import { supabase } from '../../supabase-client.js';
import { money, statCard } from '../../ui.js';

export async function renderCashierDashboard() {
  const main = document.getElementById('app-main');
  const { data: d, error } = await supabase.rpc('cashier_dashboard');
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">My Branch Dashboard</h1><div class="stat-grid">
    ${statCard("Today's Sales", money(d.todaysSales))}${statCard("Today's Service Income", money(d.todaysServiceIncome))}
    ${statCard('Transactions', d.transactionCount)}${statCard('Low Stock Alerts', d.lowStockItems, d.lowStockItems > 0)}
    ${statCard('Pending Requests', d.pendingRequests)}${statCard('Day Status', d.dayClosed ? 'Closed' : 'Open', d.dayClosed)}
  </div>`;
}
