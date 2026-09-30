// js/pages/manager/requests.js
import { supabase } from '../../supabase-client.js';
import { escapeHtml, badge, renderTable, money, toast, friendlyError, val, confirmDialog } from '../../ui.js';

export async function renderRequests() {
  const main = document.getElementById('app-main');
  const { data: requests, error } = await supabase.from('product_requests_view').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Confirm Delivered Stock</h1><p class="page-sub">Review what reached each branch, then enter the buying cost for one box or one item. Box costs are divided by the number of items inside.</p>
    <div class="panel">${renderTable([
      { key: 'product_name', label: 'Product' },
      { key: 'intake_type', label: 'Purchase format', render: (r) => r.intake_type === 'PACK' ? 'Box / carton' : 'Individual' },
      { key: 'quantity', label: 'Delivery', render: (r) => r.intake_type === 'PACK'
        ? `${Math.round(Number(r.quantity) / Math.max(1, Number(r.items_per_pack)))} boxes · ${Number(r.quantity).toLocaleString()} ${escapeHtml(r.unit || 'items')}`
        : `${Number(r.quantity).toLocaleString()} ${escapeHtml(r.unit || 'items')}` },
      { key: 'selling_price', label: 'Sell price / item', render: (r) => money(r.selling_price) },
      { key: 'status', label: 'Status', render: (r) => badge(r.status, r.status === 'PENDING' ? 'yellow' : r.status === 'APPROVED' ? 'green' : 'red') },
      { key: 'actions', label: '', render: (r) => r.status === 'PENDING' ? `
        <div class="request-approval">
          <label for="buy-${r.id}">Buying cost · ${r.intake_type === 'PACK' ? 'one box' : 'one item'}</label>
          <input class="request-cost-input" type="number" min="0" step="0.01" placeholder="Enter cost" id="buy-${r.id}" inputmode="decimal" />
          <small id="buy-preview-${r.id}" aria-live="polite">Cost per item: —</small>
          <div class="request-approval-actions"><button class="btn btn-success btn-sm" onclick="approveRequest('${r.id}')">Confirm &amp; Add</button>
          <button class="btn btn-danger btn-sm" onclick="rejectRequest('${r.id}')">Reject</button></div>
        </div>` : '—' }
    ], requests, 'No delivered stock is waiting for confirmation.')}</div>`;
  requests.filter((r) => r.status === 'PENDING').forEach((r) => {
    const input = document.getElementById(`buy-${r.id}`);
    input?.addEventListener('input', () => updateUnitCostPreview(r.id, r.intake_type === 'PACK' ? Number(r.items_per_pack) || 1 : 1));
  });
}

function updateUnitCostPreview(id, divisor) {
  const rawCost = val(`buy-${id}`);
  const cost = Number(rawCost);
  const preview = document.getElementById(`buy-preview-${id}`);
  if (preview) preview.textContent = rawCost !== '' && Number.isFinite(cost) && cost >= 0 ? `Cost per item: ${money(cost / divisor)}` : 'Enter the buying cost to preview cost per item.';
}

export async function approveRequest(id) {
  const price = val(`buy-${id}`);
  if (price === '' || Number(price) < 0) return toast('Enter a valid buying cost first.', 'error');
  const { error } = await supabase.rpc('approve_product_request', { p_request_id: id, p_buying_price: price });
  if (error) return toast(friendlyError(error), 'error');
  toast('Stock confirmed and added to the branch.', 'success');
  renderRequests();
}

export async function rejectRequest(id) {
  const ok = await confirmDialog({ title: 'Reject This Delivery?', icon: 'x', confirmLabel: 'Reject', danger: true });
  if (!ok) return;
  const { error } = await supabase.rpc('reject_product_request', { p_request_id: id });
  if (error) return toast(friendlyError(error), 'error');
  toast('Delivery rejected.', 'info');
  renderRequests();
}

window.approveRequest = approveRequest;
window.rejectRequest = rejectRequest;
