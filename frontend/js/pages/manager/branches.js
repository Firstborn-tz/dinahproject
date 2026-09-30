// js/pages/manager/branches.js
import { supabase } from '../../supabase-client.js';
import { state } from '../../state.js';
import { escapeHtml, badge, renderTable, toast, friendlyError, val, promptDialog } from '../../ui.js';

export async function renderBranches() {
  const main = document.getElementById('app-main');
  const { data: branches, error } = await supabase.from('branches_view').select('*').order('name');
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Branches</h1><p class="page-sub">Each branch has independent inventory, services and cashier. A map link is required so customers can find it from the website.</p>
    <div class="panel"><div class="panel-header"><h3>Add Branch</h3></div>
      <form onsubmit="return submitBranch(event)">
        <div class="form-row">
          <label>Branch Name<input id="branch-name" required /></label>
          <label>Address<input id="branch-address" /></label>
          <label>Google Maps Link (required)<input id="branch-map" type="url" placeholder="https://maps.app.goo.gl/..." required /></label>
        </div>
        <p class="muted small">Open Google Maps, find this branch, click <strong>Share</strong>, copy the link, and paste it here.</p>
        <button class="btn btn-primary" type="submit">Add Branch</button>
      </form>
    </div>
    <div class="panel"><div class="panel-header"><h3>All Branches</h3></div>
      ${renderTable([
        { key: 'name', label: 'Name' }, { key: 'address', label: 'Address' },
        { key: 'map_url', label: 'Map Link', render: (r) => r.map_url ? `<a href="${escapeHtml(r.map_url)}" target="_blank" rel="noopener">Open</a>` : `<span class="badge badge-yellow">Missing</span>` },
        { key: 'active', label: 'Status', render: (r) => badge(r.active ? 'Active' : 'Inactive', r.active ? 'green' : 'gray') },
        { key: 'actions', label: '', render: (r) => `<button class="link-btn" onclick="editBranch('${r.id}','${escapeHtml(r.name)}','${escapeHtml(r.address || '')}','${escapeHtml(r.map_url || '')}',${r.active})">Edit</button>` }
      ], branches)}
    </div>`;
}

export async function submitBranch(e) {
  e.preventDefault();
  const { error } = await supabase.rpc('create_branch', { p_name: val('branch-name'), p_address: val('branch-address'), p_map_url: val('branch-map') });
  if (error) { toast(friendlyError(error), 'error'); return false; }
  toast('Branch created.', 'success');
  const { data } = await supabase.from('branches_view').select('*').order('name');
  state.branches = data || [];
  renderBranches();
  return false;
}

export async function editBranch(id, name, address, mapUrl, active) {
  const result = await promptDialog({
    title: 'Edit Branch', icon: 'map-pin', confirmLabel: 'Save Changes',
    fields: [
      { id: 'name', label: 'Branch Name', value: name },
      { id: 'address', label: 'Address', value: address },
      { id: 'map_url', label: 'Google Maps Link', type: 'url', value: mapUrl },
      { id: 'active', label: 'Status', type: 'select', value: String(active), options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }
    ]
  });
  if (!result) return;
  const { error } = await supabase.rpc('update_branch', { p_branch_id: id, p_name: result.name, p_address: result.address, p_map_url: result.map_url, p_active: result.active === 'true' });
  if (error) return toast(friendlyError(error), 'error');
  toast('Branch updated.', 'success');
  const { data } = await supabase.from('branches_view').select('*').order('name');
  state.branches = data || [];
  renderBranches();
}

window.submitBranch = submitBranch;
window.editBranch = editBranch;
