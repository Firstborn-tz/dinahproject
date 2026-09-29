// js/pages/cashier/resources.js
import { supabase } from '../../supabase-client.js';
import { state } from '../../state.js';
import { escapeHtml, renderTable, toast, friendlyError, val } from '../../ui.js';

export async function renderCashierResources() {
  const main = document.getElementById('app-main');
  const branchId = state.currentUser.branchId;
  const [{ data: inventory }, { data: rows }] = await Promise.all([
    supabase.from('branch_inventory_view').select('*').eq('branch_id', branchId).eq('type', 'RESOURCE'),
    supabase.from('resource_usage_view').select('*').eq('branch_id', branchId).order('created_at', { ascending: false })
  ]);
  main.innerHTML = `<h1 class="page-title">Record Resources Used</h1><p class="page-sub">Enter the quantity consumed while providing services today.</p>
    <div class="panel"><form onsubmit="return submitResourceUsage(event)">
      <div class="form-row"><label>Resource<select id="res-select">${(inventory || []).map((i) => `<option value="${i.product_id}">${escapeHtml(i.name)} (${i.quantity} ${i.unit} left)</option>`).join('')}</select></label>
      <label>Quantity Used<input id="res-qty" type="number" min="1" required /></label></div>
      <button class="btn btn-primary" type="submit">Record Usage</button></form></div>
    <div class="panel">${renderTable([
      { key: 'product_name', label: 'Resource' }, { key: 'quantity', label: 'Qty' },
      { key: 'created_at', label: 'Time', render: (r) => new Date(r.created_at).toLocaleString() }
    ], rows, 'No resource usage recorded yet.')}</div>`;
}

export async function submitResourceUsage(e) {
  e.preventDefault();
  const { error } = await supabase.rpc('record_resource_usage', { p_product_id: val('res-select'), p_quantity: val('res-qty') });
  if (error) { toast(friendlyError(error), 'error'); return false; }
  toast('Resource usage recorded.', 'success'); renderCashierResources();
  return false;
}

window.submitResourceUsage = submitResourceUsage;
