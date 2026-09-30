// js/pages/shared/services.js
import { supabase } from '../../supabase-client.js';
import { state } from '../../state.js';
import { escapeHtml, badge, renderTable, money, toast, friendlyError, val, resolveBranchId } from '../../ui.js';
import { branchSelectorHtml } from '../../layout.js';

export async function renderServices() {
  const main = document.getElementById('app-main');
  const isManager = state.currentUser.role === 'MANAGER';

  if (isManager) {
    main.innerHTML = `<h1 class="page-title">Services</h1><p class="page-sub">Services have no fixed price — the amount is entered per transaction at POS.</p><div id="svc-body"></div>`;
    const branchId = resolveBranchId(document.getElementById('svc-body'));
    if (!branchId) return;
    const { data: services, error } = await supabase.from('services_view').select('*').eq('branch_id', branchId);
    if (error) throw error;
    document.getElementById('svc-body').innerHTML = `
      <div class="panel"><div class="panel-header"><h3>Add Service ${branchSelectorHtml()}</h3></div>
        <form onsubmit="return submitService(event)"><div class="form-row"><label>Name<input id="svc-name" required /></label><label>Description<input id="svc-desc" /></label></div>
        <button class="btn btn-primary" type="submit">Add Service</button></form></div>
      <div class="panel">${renderTable([
        { key: 'name', label: 'Name' }, { key: 'description', label: 'Description' },
        { key: 'active', label: 'Status', render: (r) => `<button class="link-btn" onclick="toggleService('${r.id}', ${!r.active})">${badge(r.active ? 'Active' : 'Inactive', r.active ? 'green' : 'gray')}</button>` }
      ], services)}</div>`;
    return;
  }

  // Cashier: record a service transaction for their own branch.
  main.innerHTML = `<h1 class="page-title">Record a Service</h1><p class="page-sub">Enter the actual amount charged for this transaction.</p><div id="svc-cashier-body"></div>`;
  const branchId = resolveBranchId(document.getElementById('svc-cashier-body'));
  if (!branchId) return;
  document.getElementById('svc-cashier-body').innerHTML = `
    <form onsubmit="return submitServiceTxn(event)">
      <div class="panel"><div class="panel-header"><h3>New service sale</h3></div><div class="form-row" id="svc-select-row"><div class="loader-wrap"><div class="loader"></div></div></div>
      <p class="muted small">Choose the service provided and enter the amount charged for this customer.</p>
      <button class="btn btn-primary" id="svc-submit" type="submit">Record Service Sale</button></div>
    </form>
    <div class="panel" id="svc-txn-table"><div class="loader-wrap"><div class="loader"></div></div></div>`;
  const [{ data: services, error: servicesError }, { data: txns, error: txnsError }] = await Promise.all([
    supabase.from('services_view').select('*').eq('branch_id', branchId).eq('active', true),
    supabase.from('service_transactions_view').select('*').eq('branch_id', branchId).order('created_at', { ascending: false })
  ]);
  if (servicesError) throw servicesError;
  if (txnsError) throw txnsError;
  document.getElementById('svc-select-row').innerHTML = `
    <label>Service<select id="svc-select" required ${services?.length ? '' : 'disabled'}><option value="">${services?.length ? 'Select a service' : 'No active services at this branch'}</option>${(services || []).map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select></label>
    <label>Amount Charged<input id="svc-amount" type="number" min="0.01" step="0.01" required ${services?.length ? '' : 'disabled'} /></label>`;
  document.getElementById('svc-submit').disabled = !services?.length;
  document.getElementById('svc-txn-table').innerHTML = renderTable([
    { key: 'service_name', label: 'Service' }, { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
    { key: 'created_at', label: 'Time', render: (r) => new Date(r.created_at).toLocaleString() }
  ], txns, 'No services recorded yet today.');
}

export async function submitService(e) {
  e.preventDefault();
  const branchId = resolveBranchId(document.getElementById('app-main'));
  if (!branchId) return false;
  const { error } = await supabase.rpc('create_service', { p_branch_id: branchId, p_name: val('svc-name'), p_description: val('svc-desc') });
  if (error) { toast(friendlyError(error), 'error'); return false; }
  toast('Service added.', 'success'); renderServices();
  return false;
}
export async function toggleService(id, active) {
  const { error } = await supabase.rpc('update_service', { p_service_id: id, p_name: null, p_description: null, p_active: active });
  if (error) return toast(friendlyError(error), 'error');
  renderServices();
}
export async function submitServiceTxn(e) {
  e.preventDefault();
  const { error } = await supabase.rpc('record_service_transaction', { p_service_id: val('svc-select'), p_amount: val('svc-amount') });
  if (error) { toast(friendlyError(error), 'error'); return false; }
  toast('Service recorded.', 'success'); renderServices();
  return false;
}

window.submitService = submitService;
window.toggleService = toggleService;
window.submitServiceTxn = submitServiceTxn;
