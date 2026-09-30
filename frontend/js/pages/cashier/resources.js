// js/pages/cashier/resources.js
import { supabase } from '../../supabase-client.js';
import { escapeHtml, renderTable, badge, toast, friendlyError, val, resolveBranchId } from '../../ui.js';

export async function renderCashierResources() {
  const main = document.getElementById('app-main');
  const branchId = resolveBranchId(main);
  if (!branchId) return;

  const [inventoryResult, usageResult] = await Promise.all([
    supabase.from('branch_inventory_view').select('*').eq('branch_id', branchId).eq('type', 'RESOURCE').order('name'),
    supabase.from('resource_usage_view').select('*').eq('branch_id', branchId).order('created_at', { ascending: false })
  ]);
  if (inventoryResult.error) throw inventoryResult.error;
  if (usageResult.error) throw usageResult.error;

  const inventory = inventoryResult.data || [];
  const available = inventory.filter((item) => Number(item.quantity) > 0);
  const rows = usageResult.data || [];
  main.innerHTML = `<h1 class="page-title">Branch Resources</h1><p class="page-sub">View supplies assigned to this branch and record the amount used while providing services.</p>
    <div class="panel"><div class="panel-header"><h3>Resource Stock</h3></div>${renderTable([
      { key: 'name', label: 'Resource' },
      { key: 'quantity', label: 'Available', render: (r) => `${Number(r.quantity).toLocaleString()} ${escapeHtml(r.unit || 'items')}` },
      { key: 'low_stock', label: 'Stock level', render: (r) => r.low_stock ? badge('Low stock', 'yellow') : badge('In stock', 'green') }
    ], inventory, 'No resources have been added to this branch yet.')}</div>
    <div class="panel"><div class="panel-header"><div><h3>Record Resource Use</h3><p class="muted small">Only resources with stock available can be selected.</p></div></div>
      <form onsubmit="return submitResourceUsage(event)">
        <div class="form-row"><label>Resource<select id="res-select" ${available.length ? '' : 'disabled'} required>${available.map((i) => `<option value="${i.product_id}">${escapeHtml(i.name)} (${Number(i.quantity).toLocaleString()} ${escapeHtml(i.unit || 'items')} left)</option>`).join('')}</select></label>
        <label>Quantity used<input id="res-qty" type="number" min="1" step="1" required inputmode="numeric" ${available.length ? '' : 'disabled'} /></label></div>
        ${available.length ? '<button class="btn btn-primary" type="submit">Record Usage</button>' : '<p class="muted small">There is no available resource stock to record. Contact the manager if this does not look right.</p>'}
      </form></div>
    <div class="panel"><div class="panel-header"><h3>Recent Resource Use</h3></div>${renderTable([
      { key: 'product_name', label: 'Resource' }, { key: 'quantity', label: 'Quantity used' },
      { key: 'created_at', label: 'Time', render: (r) => new Date(r.created_at).toLocaleString() }
    ], rows, 'No resource usage recorded yet.')}</div>`;
}

export async function submitResourceUsage(e) {
  e.preventDefault();
  const productId = val('res-select');
  const quantity = Number(val('res-qty'));
  if (!productId || !Number.isInteger(quantity) || quantity < 1) {
    toast('Select a resource and enter a valid whole-item quantity.', 'error');
    return false;
  }
  const { error } = await supabase.rpc('record_resource_usage', { p_product_id: productId, p_quantity: quantity });
  if (error) { toast(friendlyError(error), 'error'); return false; }
  toast('Resource usage recorded.', 'success');
  renderCashierResources();
  return false;
}

window.submitResourceUsage = submitResourceUsage;
