// js/pages/cashier/requests.js
import { supabase } from '../../supabase-client.js';
import { renderTable, badge, money, toast, friendlyError, val } from '../../ui.js';

export async function renderCashierRequests() {
  const main = document.getElementById('app-main');
  const { data: rows, error } = await supabase.from('product_requests_view').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Register Delivered Product</h1><p class="page-sub">Use this when a manager brings stock to the branch. Select whether it was bought packed or individually; an admin confirms its buying price before it enters sellable stock.</p>
    <div class="panel"><form onsubmit="return submitProductRequest(event)">
      <div class="form-row"><label>Product Name<input id="req-name" required /></label><label>Buying format<select id="req-type" onchange="onRequestBuyModeChange(this.value)"><option value="PACK">Packed together (carton / box)</option><option value="INDIVIDUAL">Individual items</option></select></label>
      <label>Selling price per item<input id="req-price" type="number" min="0.01" step="0.01" required /></label>
      <label>Sellable unit<input id="req-unit" value="piece" required /></label><label id="req-pack-wrap">Items in one pack<input id="req-pack" type="number" min="1" step="1" value="1" required /></label>
      <label>Quantity received (individual items)<input id="req-qty" type="number" min="1" step="1" required /></label></div>
      <p class="muted small">Buying price is left for the admin to confirm. Individual purchases use 1 item per pack.</p>
      <button class="btn btn-primary" type="submit">Register Delivered Stock</button></form></div>
    <div class="panel">${renderTable([
      { key: 'product_name', label: 'Product' }, { key: 'intake_type', label: 'Purchase type' }, { key: 'quantity', label: 'Received' },
      { key: 'selling_price', label: 'Sell price / item', render: (r) => money(r.selling_price) },
      { key: 'status', label: 'Status', render: (r) => badge(r.status, r.status === 'PENDING' ? 'yellow' : r.status === 'APPROVED' ? 'green' : 'red') }
    ], rows, 'No requests submitted yet.')}</div>`;
}

export async function submitProductRequest(e) {
  e.preventDefault();
  const type = val('req-type');
  const { error } = await supabase.rpc('create_product_request', { p_product_name: val('req-name'), p_selling_price: val('req-price'), p_unit: val('req-unit'), p_quantity: val('req-qty'), p_purchase_total: null, p_items_per_pack: type === 'PACK' ? val('req-pack') : 1, p_intake_type: type });
  if (error) { toast(friendlyError(error), 'error'); return false; }
  toast('Delivered stock registered and sent to admin for cost confirmation.', 'success'); renderCashierRequests();
  return false;
}

window.submitProductRequest = submitProductRequest;
window.onRequestBuyModeChange = function(mode) {
  const packed = mode === 'PACK';
  const wrap = document.getElementById('req-pack-wrap');
  const input = document.getElementById('req-pack');
  if (wrap) wrap.style.display = packed ? '' : 'none';
  if (input) { input.required = packed; if (!packed) input.value = '1'; }
};
