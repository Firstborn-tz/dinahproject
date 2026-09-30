// js/pages/cashier/requests.js
import { supabase } from '../../supabase-client.js';
import { renderTable, badge, money, toast, friendlyError, val } from '../../ui.js';

export async function renderCashierRequests() {
  const main = document.getElementById('app-main');
  const { data: rows, error } = await supabase.from('product_requests_view').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Register Delivered Stock</h1><p class="page-sub">Record products physically delivered to this branch. The manager confirms the buying cost before the stock becomes available for sale.</p>
    <div class="panel intake-panel"><div class="panel-header"><div><h3>Register a Delivery</h3><p class="muted small">Buying cost is entered by the manager after you submit.</p></div></div>
      <form class="intake-form" onsubmit="return submitProductRequest(event)">
        <div class="intake-mode-row">
          <label class="intake-mode-field">Purchase format<select id="req-type" onchange="onRequestBuyModeChange(this.value)"><option value="PACK">Packed together (box / carton)</option><option value="INDIVIDUAL">Individual items</option></select></label>
          <div class="intake-format-note" id="req-format-note">Enter how many items are in each box and how many boxes arrived.</div>
        </div>
        <div class="intake-fields">
          <label>Product name<input id="req-name" autocomplete="off" required /></label>
          <label>Item name<input id="req-unit" value="piece" placeholder="e.g. pen, sheet" required /></label>
          <label id="req-pack-wrap">Items in one box<input id="req-pack" type="number" min="1" step="1" value="1" required inputmode="numeric" /></label>
          <label id="req-pack-count-wrap">Number of boxes received<input id="req-pack-count" type="number" min="1" step="1" value="1" required inputmode="numeric" /></label>
          <label id="req-individual-qty-wrap" class="hidden">Number of items received<input id="req-individual-qty" type="number" min="1" step="1" value="1" inputmode="numeric" /></label>
          <label>Selling price per item<input id="req-price" type="number" min="0.01" step="0.01" required inputmode="decimal" /></label>
        </div>
        <div class="intake-summary" aria-live="polite"><div><span>Stock to register</span><strong id="req-stock-total">1 piece</strong></div></div>
        <div class="intake-actions"><button class="btn btn-primary" type="submit">Send to Manager for Cost Confirmation</button></div>
      </form>
    </div>
    <div class="panel"><div class="panel-header"><h3>Delivery History</h3></div>${renderTable([
      { key: 'product_name', label: 'Product' }, { key: 'intake_type', label: 'Purchase type', render: (r) => r.intake_type === 'PACK' ? 'Box / carton' : 'Individual' },
      { key: 'quantity', label: 'Received items', render: (r) => Number(r.quantity).toLocaleString() },
      { key: 'selling_price', label: 'Sell price / item', render: (r) => money(r.selling_price) },
      { key: 'status', label: 'Status', render: (r) => badge(r.status, r.status === 'PENDING' ? 'yellow' : r.status === 'APPROVED' ? 'green' : 'red') }
    ], rows, 'No deliveries registered yet.')}</div>`;
  ['req-pack', 'req-pack-count', 'req-individual-qty', 'req-unit'].forEach((id) => document.getElementById(id).addEventListener('input', updateRequestPreview));
  updateRequestPreview();
}

function updateRequestPreview() {
  const packed = val('req-type') === 'PACK';
  const perPack = packed ? Math.max(1, Number(val('req-pack')) || 1) : 1;
  const packCount = packed ? Math.max(0, Number(val('req-pack-count')) || 0) : 0;
  const individualCount = packed ? 0 : Math.max(0, Number(val('req-individual-qty')) || 0);
  const quantity = perPack * packCount + individualCount;
  const out = document.getElementById('req-stock-total');
  if (out) out.textContent = `${quantity.toLocaleString()} ${val('req-unit') || 'item'}${quantity === 1 ? '' : 's'}`;
}

export async function submitProductRequest(e) {
  e.preventDefault();
  const packed = val('req-type') === 'PACK';
  const itemsPerPack = packed ? Number(val('req-pack')) : 1;
  const quantity = packed ? itemsPerPack * Number(val('req-pack-count')) : Number(val('req-individual-qty'));
  if (!Number.isInteger(quantity) || quantity < 1) { toast('Enter a valid number of items or boxes received.', 'error'); return false; }
  const { error } = await supabase.rpc('create_product_request', {
    p_product_name: val('req-name'), p_selling_price: val('req-price'), p_unit: val('req-unit'), p_quantity: quantity,
    p_purchase_total: null, p_items_per_pack: itemsPerPack, p_intake_type: packed ? 'PACK' : 'INDIVIDUAL'
  });
  if (error) { toast(friendlyError(error), 'error'); return false; }
  toast('Delivery registered. The manager will confirm the buying cost.', 'success');
  renderCashierRequests();
  return false;
}

export function onRequestBuyModeChange(mode) {
  const packed = mode === 'PACK';
  document.getElementById('req-pack-wrap')?.classList.toggle('hidden', !packed);
  document.getElementById('req-pack-count-wrap')?.classList.toggle('hidden', !packed);
  document.getElementById('req-individual-qty-wrap')?.classList.toggle('hidden', packed);
  const pack = document.getElementById('req-pack');
  const boxes = document.getElementById('req-pack-count');
  const items = document.getElementById('req-individual-qty');
  if (pack) pack.required = packed;
  if (boxes) boxes.required = packed;
  if (items) items.required = !packed;
  const note = document.getElementById('req-format-note');
  if (note) note.textContent = packed
    ? 'Enter how many items are in each box and how many boxes arrived.'
    : 'Enter the number of separate items delivered.';
  updateRequestPreview();
}

window.submitProductRequest = submitProductRequest;
window.onRequestBuyModeChange = onRequestBuyModeChange;
