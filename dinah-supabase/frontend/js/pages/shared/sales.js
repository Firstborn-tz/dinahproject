// js/pages/shared/sales.js
import { supabase } from '../../supabase-client.js';
import { renderTable, money, badge, toast, friendlyError, resolveBranchId, promptDialog } from '../../ui.js';
import { branchSelectorHtml } from '../../layout.js';

export async function renderSales() {
  const main = document.getElementById('app-main');
  main.innerHTML = `<h1 class="page-title">Sales ${branchSelectorHtml()}</h1><div id="sales-table" class="panel"></div>`;
  const branchId = resolveBranchId(main);
  if (!branchId) return;
  document.getElementById('sales-table').innerHTML = `<div class="loader-wrap"><div class="loader"></div></div>`;
  const { data: sales, error } = await supabase.from('sales_view').select('*').eq('branch_id', branchId).order('created_at', { ascending: false });
  if (error) throw error;
  document.getElementById('sales-table').innerHTML = renderTable([
    { key: 'txn_number', label: 'Txn #' }, { key: 'total', label: 'Total', render: (r) => money(r.total) },
    { key: 'items', label: 'Items', render: (r) => (r.items || []).map((i) => `${i.name} x${i.quantity}`).join(', ') },
    { key: 'status', label: 'Status', render: (r) => badge(r.status, r.status === 'COMPLETED' ? 'green' : 'red') },
    { key: 'created_at', label: 'Time', render: (r) => new Date(r.created_at).toLocaleString() },
    { key: 'void', label: '', render: (r) => r.status === 'COMPLETED' ? `<button class="btn btn-danger btn-sm" onclick="voidSale('${r.id}')">Void</button>` : '—' }
  ], sales, 'No sales recorded yet.');
}

export async function voidSale(id) {
  const result = await promptDialog({
    title: 'Void This Sale?', message: 'Stock will be restored automatically. This cannot be undone.', icon: 'alert-triangle', confirmLabel: 'Void Sale', danger: true,
    fields: [{ id: 'reason', label: 'Reason', type: 'textarea', placeholder: 'e.g. Customer changed their mind' }]
  });
  if (!result || !result.reason) return;
  const { error } = await supabase.rpc('void_sale', { p_sale_id: id, p_reason: result.reason });
  if (error) return toast(friendlyError(error), 'error');
  toast('Sale voided, stock restored.', 'success'); renderSales();
}

window.voidSale = voidSale;
