// js/pages/manager/requests.js
import { supabase } from '../../supabase-client.js';
import { badge, renderTable, money, toast, friendlyError, val, confirmDialog } from '../../ui.js';

export async function renderRequests() {
  const main = document.getElementById('app-main');
  const { data: requests, error } = await supabase.from('product_requests_view').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Delivered Stock Pending</h1><p class="page-sub">Cashiers register products physically brought to a branch. Enter the buying price per pack for boxed products or per item for individual products; pack cost is divided by the item count automatically.</p>
    <div class="panel">${renderTable([
      { key: 'product_name', label: 'Product' }, { key: 'intake_type', label: 'Purchase type' }, { key: 'items_per_pack', label: 'Items per pack' },
      { key: 'quantity', label: 'Received qty' }, { key: 'selling_price', label: 'Selling price / item', render: (r) => money(r.selling_price) },
      { key: 'status', label: 'Status', render: (r) => badge(r.status, r.status === 'PENDING' ? 'yellow' : r.status === 'APPROVED' ? 'green' : 'red') },
      { key: 'actions', label: '', render: (r) => r.status === 'PENDING' ? `
          <input type="number" min="0" step="0.01" placeholder="${r.intake_type === 'PACK' ? 'Price per pack' : 'Price per item'}" id="buy-${r.id}" style="width:145px;padding:6px;border:1px solid var(--border);border-radius:6px" />
          <button class="btn btn-success btn-sm" onclick="approveRequest('${r.id}')">Approve</button>
          <button class="btn btn-danger btn-sm" onclick="rejectRequest('${r.id}')">Reject</button>` : '—' }
    ], requests, 'No product requests yet.')}</div>`;
}

export async function approveRequest(id) {
  const price = val(`buy-${id}`);
  if (price === '' || Number(price) < 0) return toast('Enter a valid buying price first.', 'error');
  const { error } = await supabase.rpc('approve_product_request', { p_request_id: id, p_buying_price: price });
  if (error) return toast(friendlyError(error), 'error');
  toast('Request approved.', 'success'); renderRequests();
}
export async function rejectRequest(id) {
  const ok = await confirmDialog({ title: 'Reject This Product Request?', icon: 'x', confirmLabel: 'Reject', danger: true });
  if (!ok) return;
  const { error } = await supabase.rpc('reject_product_request', { p_request_id: id });
  if (error) return toast(friendlyError(error), 'error');
  toast('Request rejected.', 'info'); renderRequests();
}

window.approveRequest = approveRequest;
window.rejectRequest = rejectRequest;
