// js/pages/manager/reports.js
import { supabase } from '../../supabase-client.js';
import { renderTable, money } from '../../ui.js';

export async function renderReports() {
  const main = document.getElementById('app-main');
  main.innerHTML = `<h1 class="page-title">Product Report</h1><p class="page-sub">Revenue, cost and profit per product across all branches.</p><div id="report-table" class="panel"><div class="loader-wrap"><div class="loader"></div></div></div>`;
  const { data: rows, error } = await supabase.from('product_report_view').select('*').order('revenue', { ascending: false });
  if (error) throw error;
  document.getElementById('report-table').innerHTML = renderTable([
    { key: 'product', label: 'Product' }, { key: 'qty_sold', label: 'Qty Sold' },
    { key: 'revenue', label: 'Revenue', render: (r) => money(r.revenue) }, { key: 'cost', label: 'Cost', render: (r) => money(r.cost) },
    { key: 'profit', label: 'Profit', render: (r) => `<span style="color:${r.profit >= 0 ? 'var(--success-ink)' : 'var(--danger-ink)'}">${money(r.profit)}</span>` }
  ], rows, 'No sales recorded yet.');
}
