// js/pages/manager/resources.js
import { supabase } from '../../supabase-client.js';
import { state } from '../../state.js';
import { renderTable, money, resolveBranchId } from '../../ui.js';
import { branchSelectorHtml } from '../../layout.js';

export async function renderResources() {
  const main = document.getElementById('app-main');
  main.innerHTML = `<h1 class="page-title">Resource Usage ${branchSelectorHtml()}</h1><p class="page-sub">Resources consumed while providing services.</p><div id="res-table" class="panel"></div>`;
  const branchId = resolveBranchId(main);
  if (!branchId) return;
  document.getElementById('res-table').innerHTML = `<div class="loader-wrap"><div class="loader"></div></div>`;
  const { data: rows, error } = await supabase.from('resource_usage_view').select('*').eq('branch_id', branchId).order('created_at', { ascending: false });
  if (error) throw error;
  const cols = [{ key: 'product_name', label: 'Resource' }, { key: 'quantity', label: 'Quantity' }];
  if (state.currentUser.role === 'MANAGER') cols.push({ key: 'cost', label: 'Cost', render: (r) => money(r.cost) });
  cols.push({ key: 'created_at', label: 'Time', render: (r) => new Date(r.created_at).toLocaleString() });
  document.getElementById('res-table').innerHTML = renderTable(cols, rows, 'No resource usage recorded yet.');
}
