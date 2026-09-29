// js/pages/shared/profile.js
import { supabase } from '../../supabase-client.js';
import { state } from '../../state.js';
import { escapeHtml, toast, friendlyError, val } from '../../ui.js';
import { buildUserMenu } from '../../layout.js';

export async function renderProfile() {
  const main = document.getElementById('app-main');
  const { data: me, error } = await supabase.from('my_profile_view').select('*').single();
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">My Profile</h1>
    <p class="page-sub">Update your name here anytime. Your login email is fixed; you can change your password below.</p>
    <div class="panel"><div class="panel-header"><h3>Account Details</h3></div>
      <form onsubmit="return submitProfileDetails(event)">
        <div class="form-row"><label>Full Name<input id="pf-fullname" value="${escapeHtml(me.full_name || '')}" /></label><label>Email (read-only)<input value="${escapeHtml(me.email || '')}" disabled /></label></div>
        <button class="btn btn-primary" type="submit">Save Name</button>
      </form>
    </div>
    <div class="panel"><div class="panel-header"><h3>Change Password</h3></div>
      <form onsubmit="return submitProfilePassword(event)">
        <div class="form-row"><label>New Password (min 8 characters)<input id="pf-new" type="password" minlength="8" required /></label></div>
        <button class="btn btn-primary" type="submit">Update Password</button>
      </form>
    </div>`;
}

export async function submitProfileDetails(e) {
  e.preventDefault();
  const { error } = await supabase.rpc('update_my_profile', { p_full_name: val('pf-fullname') });
  if (error) { toast(friendlyError(error), 'error'); return false; }
  toast('Profile updated.', 'success');
  state.currentUser.fullName = val('pf-fullname');
  buildUserMenu();
  return false;
}

export async function submitProfilePassword(e) {
  e.preventDefault();
  const { error } = await supabase.auth.updateUser({ password: val('pf-new') });
  if (error) { toast(friendlyError(error), 'error'); return false; }
  toast('Password updated.', 'success');
  document.getElementById('pf-new').value = '';
  return false;
}

window.submitProfileDetails = submitProfileDetails;
window.submitProfilePassword = submitProfilePassword;
