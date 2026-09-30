// js/pages/manager/users.js
import { supabase } from '../../supabase-client.js';
import { escapeHtml, badge, renderTable, toast, friendlyError, functionError, val, confirmDialog, promptDialog } from '../../ui.js';

function randomPassword() {
  // A readable-enough random password an admin can relay to a cashier verbally or by note.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function renderUsers() {
  const main = document.getElementById('app-main');
  const [{ data: users, error }, { data: branches }] = await Promise.all([
    supabase.from('users_view').select('*').order('created_at', { ascending: false }),
    supabase.from('branches_view').select('*').order('name')
  ]);
  if (error) throw error;
  const hasBranches = (branches || []).length > 0;
  main.innerHTML = `<h1 class="page-title">Users</h1><p class="page-sub">Create Admin (Manager) or Cashier accounts. Exactly one active cashier per branch.</p>
    <div class="panel"><div class="panel-header"><h3>Add User</h3></div>
      <form onsubmit="return submitUser(event)">
        <div class="form-row">
          <label>Role<select id="u-role" onchange="onUserRoleChange(this.value)"><option value="CASHIER">Cashier</option><option value="MANAGER">Admin (Manager)</option></select></label>
          <label id="u-branch-field">Branch<select id="u-branch" ${hasBranches ? '' : 'disabled'}>${hasBranches ? branches.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('') : '<option value="">No branches yet</option>'}</select></label>
          <label>Full Name<input id="u-fullname" required /></label>
          <label>Email<input id="u-email" type="email" required /></label>
          <label>Password (min 8 characters)<input id="u-password" type="password" minlength="8" required /></label>
        </div>
        ${hasBranches ? '' : '<p class="muted small">Create a branch first under <strong>Branches</strong> before adding a Cashier (Admin accounts don\'t need one).</p>'}
        <button class="btn btn-primary" type="submit">Add User</button>
      </form>
    </div>
    <div class="panel"><div class="panel-header"><h3>All Users</h3></div>
      ${renderTable([
        { key: 'full_name', label: 'Name' }, { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role', render: (r) => badge(r.role === 'MANAGER' ? 'Admin' : 'Cashier', r.role === 'MANAGER' ? 'blue' : 'gray') },
        { key: 'branch_id', label: 'Branch', render: (r) => r.branch_id ? escapeHtml(branches.find((b) => b.id === r.branch_id)?.name || '—') : '— (all branches)' },
        { key: 'active', label: 'Status', render: (r) => badge(r.active ? 'Active' : 'Inactive', r.active ? 'green' : 'gray') },
        { key: 'actions', label: '', render: (r) => `
          <button class="link-btn" onclick="toggleUser('${r.id}', ${!r.active}, '${escapeHtml(r.full_name)}')">${r.active ? 'Deactivate' : 'Activate'}</button> ·
          <button class="link-btn" onclick="resetUserPassword('${r.id}', '${escapeHtml(r.full_name)}')">Reset Password</button> ·
          <button class="link-btn" onclick="emailResetLink('${escapeHtml(r.email)}')">Email Reset Link</button>` }
      ], users)}
    </div>`;
}

export function onUserRoleChange(role) { document.getElementById('u-branch-field').style.display = role === 'CASHIER' ? '' : 'none'; }

export async function submitUser(e) {
  e.preventDefault();
  const role = val('u-role');
  if (role === 'CASHIER' && !val('u-branch')) { toast('Create a branch first before adding a cashier.', 'error'); return false; }
  const { data: { session } } = await supabase.auth.getSession();
  const res = await supabase.functions.invoke('create-user', {
    body: { role, branchId: role === 'CASHIER' ? val('u-branch') : null, fullName: val('u-fullname'), email: val('u-email'), password: val('u-password') },
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  if (res.error) { toast(await functionError(res), 'error'); return false; }
  toast(`${role === 'MANAGER' ? 'Admin' : 'Cashier'} account created.`, 'success');
  renderUsers();
  return false;
}

export async function toggleUser(id, active, name) {
  const ok = await confirmDialog({
    title: active ? `Reactivate ${name}?` : `Deactivate ${name}?`,
    message: active ? 'They will be able to log in again.' : 'They will be immediately signed out and unable to log in.',
    icon: active ? 'check' : 'alert-triangle', confirmLabel: active ? 'Reactivate' : 'Deactivate', danger: !active
  });
  if (!ok) return;
  const { error } = await supabase.rpc('set_user_active', { p_user_id: id, p_active: active });
  if (error) return toast(friendlyError(error), 'error');
  toast('Updated.', 'success'); renderUsers();
}

// Admin sets a new password directly - for when a cashier forgot theirs and
// can't access their own email, or you'd rather not wait on email delivery.
export async function resetUserPassword(userId, name) {
  const result = await promptDialog({
    title: `Reset Password — ${name}`,
    message: 'This sets their password immediately. Share it with them securely (in person, a call, etc.) — it will not be emailed.',
    icon: 'settings', confirmLabel: 'Set New Password',
    fields: [{ id: 'password', label: 'New Password (min 8 characters)', type: 'text', value: randomPassword() }]
  });
  if (!result || !result.password || result.password.length < 8) {
    if (result) toast('Password must be at least 8 characters.', 'error');
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  const res = await supabase.functions.invoke('admin-reset-password', {
    body: { userId, newPassword: result.password },
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  if (res.error) { toast(await functionError(res), 'error'); return; }
  await confirmDialog({
    title: 'Password Updated', icon: 'check', confirmLabel: 'Done', cancelLabel: 'Close',
    message: `New password for ${name}: ${result.password}\n\nMake sure to share this with them now — it won't be shown again.`
  });
}

// Alternative: send them the normal self-service reset email instead.
export async function emailResetLink(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) return toast(friendlyError(error), 'error');
  toast(`Reset link sent to ${email}.`, 'success');
}

window.submitUser = submitUser;
window.onUserRoleChange = onUserRoleChange;
window.toggleUser = toggleUser;
window.resetUserPassword = resetUserPassword;
window.emailResetLink = emailResetLink;
