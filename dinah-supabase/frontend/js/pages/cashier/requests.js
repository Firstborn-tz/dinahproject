// js/pages/cashier/requests.js
import { supabase } from '../../supabase-client.js';
import { renderTable, badge, money, toast, friendlyError, val } from '../../ui.js';

export async function renderCashierRequests() {
  const main = document.getElementById('app-main');
  const { data: rows, error } = await supabase.from('product_requests_view').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Request a Product</h1><p class="page-sub">You set the selling price and quantity — the manager sets the buying price before approving.</p>
    <div class="panel"><form onsubmit="return submitProductRequest(event)">
      <div class="form-row"><label>Product Name<input id="req-name" required /></label><label>Suggested Selling Price<input id="req-price" type="number" min="0" required /></label>
      <label>Unit<input id="req-unit" value="piece" /></label><label>Quantity Needed<input id="req-qty" type="number" min="1" required /></label></div>
      <button class="btn btn-primary" type="submit">Submit Request</button></form></div>
    <div class="panel">${renderTable([
      { key: 'product_name', label: 'Product' }, { key: 'selling_price', label: 'Price', render: (r) => money(r.selling_price) },
      { key: 'status', label: 'Status', render: (r) => badge(r.status, r.status === 'PENDING' ? 'yellow' : r.status === 'APPROVED' ? 'green' : 'red') }
    ], rows, 'No requests submitted yet.')}</div>`;
}

export async function submitProductRequest(e) {
  e.preventDefault();
  const { error } = await supabase.rpc('create_product_request', { p_product_name: val('req-name'), p_selling_price: val('req-price'), p_unit: val('req-unit'), p_quantity: val('req-qty') });
  if (error) { toast(friendlyError(error), 'error'); return false; }
  toast('Request submitted.', 'success'); renderCashierRequests();
  return false;
}

window.submitProductRequest = submitProductRequest;
