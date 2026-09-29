// js/pages/manager/returns.js
import { supabase } from '../../supabase-client.js';
import { state } from '../../state.js';
import { renderTable, badge, toast, friendlyError, resolveBranchId, confirmDialog } from '../../ui.js';
import { branchSelectorHtml } from '../../layout.js';

export async function renderReturns() {
  const main = document.getElementById('app-main');
  main.innerHTML = `<h1 class="page-title">Returns ${branchSelectorHtml()}</h1><div id="ret-table" class="panel"></div>`;
  const branchId = resolveBranchId(main);
  if (!branchId) return;
  document.getElementById('ret-table').innerHTML = `<div class="loader-wrap"><div class="loader"></div></div>`;
  const { data: returns, error } = await supabase.from('returns_view').select('*').eq('branch_id', branchId).order('created_at', { ascending: false });
  if (error) throw error;
  const isManager = state.currentUser.role === 'MANAGER';
  document.getElementById('ret-table').innerHTML = renderTable([
    { key: 'product_id', label: 'Product' }, { key: 'quantity', label: 'Qty' }, { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status', render: (r) => badge(r.status, r.status === 'PENDING' ? 'yellow' : r.status === 'APPROVED' ? 'green' : 'red') },
    { key: 'actions', label: '', render: (r) => isManager && r.status === 'PENDING' ? `<button class="btn btn-success btn-sm" onclick="approveReturn('${r.id}')">Approve</button> <button class="btn btn-danger btn-sm" onclick="rejectReturn('${r.id}')">Reject</button>` : '—' }
  ], returns, 'No returns recorded yet.');
}
export async function approveReturn(id) {
  const ok = await confirmDialog({ title: 'Approve This Return?', message: 'Stock will be restored to inventory.', icon: 'check', confirmLabel: 'Approve' });
  if (!ok) return;
  const { error } = await supabase.rpc('approve_return', { p_return_id: id });
  if (error) return toast(friendlyError(error), 'error');
  toast('Return approved, stock restored.', 'success'); renderReturns();
}
export async function rejectReturn(id) {
  const ok = await confirmDialog({ title: 'Reject This Return?', icon: 'x', confirmLabel: 'Reject', danger: true });
  if (!ok) return;
  const { error } = await supabase.rpc('reject_return', { p_return_id: id });
  if (error) return toast(friendlyError(error), 'error');
  toast('Return rejected.', 'info'); renderReturns();
}

window.approveReturn = approveReturn;
window.rejectReturn = rejectReturn;
