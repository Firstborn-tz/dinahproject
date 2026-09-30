// js/pages/manager/inventory.js
import { supabase } from '../../supabase-client.js';
import { renderTable, money, badge, toast, friendlyError, escapeHtml, resolveBranchId, promptDialog } from '../../ui.js';
import { branchSelectorHtml } from '../../layout.js';

export async function renderInventory() {
  const main = document.getElementById('app-main');
  main.innerHTML = `<h1 class="page-title">Inventory ${branchSelectorHtml()}</h1><p class="page-sub">Branch-specific stock levels.</p><div id="inv-table" class="panel"></div>`;
  const branchId = resolveBranchId(main);
  if (!branchId) return;
  document.getElementById('inv-table').innerHTML = `<div class="loader-wrap"><div class="loader"></div></div>`;
  const { data: rows, error } = await supabase.from('branch_inventory_view').select('*').eq('branch_id', branchId);
  if (error) throw error;
  document.getElementById('inv-table').innerHTML = renderTable([
    { key: 'name', label: 'Product' }, { key: 'type', label: 'Type' }, { key: 'quantity', label: 'Qty', render: (r) => `${r.quantity} ${r.unit || ''}` },
    { key: 'buying_price', label: 'Buying Price', render: (r) => money(r.buying_price) },
    { key: 'inventory_value', label: 'Inventory Value', render: (r) => money(r.inventory_value) },
    { key: 'low_stock', label: 'Status', render: (r) => r.low_stock ? badge('LOW STOCK', 'red') : badge('OK', 'green') },
    { key: 'adjust', label: '', render: (r) => `<button class="btn btn-outline btn-sm" onclick="promptAdjust('${r.product_id}','${escapeHtml(r.name)}')">Adjust</button>` }
  ], rows);
}

export async function promptAdjust(productId, name) {
  const main = document.getElementById('app-main');
  const branchId = resolveBranchId(main);
  if (!branchId) return;
  const result = await promptDialog({
    title: 'Adjust Stock', message: `Product: ${name}`, icon: 'package', confirmLabel: 'Apply Adjustment',
    fields: [
      { id: 'direction', label: 'Direction', type: 'select', options: [{ value: 'INCREASE', label: 'Increase' }, { value: 'DECREASE', label: 'Decrease' }] },
      { id: 'quantity', label: 'Quantity', type: 'number', min: 1 },
      { id: 'reason', label: 'Reason', type: 'select', options: ['Damaged', 'Lost', 'Expired', 'Physical Count Correction', 'Wrong Entry', 'Returned', 'Other'].map((r) => ({ value: r, label: r })) }
    ]
  });
  if (!result || !result.quantity) return;
  const { error } = await supabase.rpc('adjust_stock', { p_branch_id: branchId, p_product_id: productId, p_direction: result.direction, p_quantity: result.quantity, p_reason: result.reason });
  if (error) return toast(friendlyError(error), 'error');
  toast('Stock adjusted.', 'success'); renderInventory();
}

window.promptAdjust = promptAdjust;
