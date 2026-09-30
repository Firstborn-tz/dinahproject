// js/auth.js
import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { icon } from './icons.js';
import { toast, friendlyError } from './ui.js';
import { stopInactivitySession } from './session.js';

// The whole authenticated app (sidebar + every admin/cashier page) is loaded
// lazily, only when someone actually logs in. Visitors who just browse the
// landing page never download any of it, which makes the public page much faster.
async function goToApp() {
  const { enterApp } = await import('./layout.js');
  await enterApp();
}

export function wireAuthModalTriggers() {
  document.getElementById('login-open-btn').addEventListener('click', () => openAuthModal('login'));
  document.getElementById('login-modal').addEventListener('click', (e) => { if (e.target.id === 'login-modal') closeAuthModal(); });
}

export function openAuthModal(mode, opts = {}) { document.getElementById('login-modal').classList.remove('hidden'); renderAuthModal(mode, opts); }
export function closeAuthModal() { document.getElementById('login-modal').classList.add('hidden'); }

export function renderAuthModal(mode, opts = {}) {
  const body = document.getElementById('auth-modal-body');
  const brandHtml = `<button class="modal-close" onclick="closeAuthModal()">${icon('x')}</button><div class="brand login-brand"><span class="brand-icon">${icon('pen')}</span> DINAH <strong>STATIONARIES</strong></div>`;

  if (mode === 'login') {
    body.innerHTML = `${brandHtml}<h2>Welcome Back</h2>
      <form id="login-form">
        <label>Email<input type="email" id="login-email" autocomplete="username" required /></label>
        <label>Password<div class="password-field"><input type="password" id="login-password" autocomplete="current-password" required /><button type="button" id="toggle-password" class="link-btn">Show</button></div></label>
        <div id="login-error" class="form-error hidden"></div>
        <button type="submit" class="btn btn-primary btn-block" id="login-submit-btn">Login</button>
      </form>
      <p class="muted small" style="text-align:center;margin-top:12px;"><button class="link-btn" onclick="renderAuthModal('forgot')">Forgot Password?</button></p>`;
    document.getElementById('toggle-password').addEventListener('click', () => {
      const input = document.getElementById('login-password'); const btn = document.getElementById('toggle-password');
      input.type = input.type === 'password' ? 'text' : 'password'; btn.textContent = input.type === 'password' ? 'Show' : 'Hide';
    });
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    setTimeout(() => document.getElementById('login-email')?.focus(), 50);
  } else if (mode === 'forgot') {
    body.innerHTML = `${brandHtml}<h2>Reset Your Password</h2>
      <p class="muted small">Enter your account email — we'll send you a reset link.</p>
      <form id="forgot-form"><label>Email<input type="email" id="forgot-email" required /></label>
        <div id="forgot-message" class="hidden"></div>
        <button type="submit" class="btn btn-primary btn-block" id="forgot-submit-btn">Send Reset Link</button>
      </form>
      <p class="muted small" style="text-align:center;margin-top:12px;"><button class="link-btn" onclick="renderAuthModal('login')">Back to Login</button></p>`;
    document.getElementById('forgot-form').addEventListener('submit', handleForgotPassword);
  } else if (mode === 'reset') {
    body.innerHTML = `${brandHtml}<h2>Set a New Password</h2>
      <form id="reset-form">
        <label>New Password<input type="password" id="reset-password" minlength="8" required /></label>
        <label>Confirm New Password<input type="password" id="reset-password-confirm" minlength="8" required /></label>
        <div id="reset-error" class="form-error hidden"></div>
        <button type="submit" class="btn btn-primary btn-block">Update Password</button>
      </form>`;
    document.getElementById('reset-form').addEventListener('submit', handleResetPassword);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errBox = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit-btn');
  errBox.classList.add('hidden'); submitBtn.disabled = true; submitBtn.textContent = 'Logging in…';
  stopInactivitySession();
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      errBox.textContent = error.message || 'Could not sign in. Check your email and password.';
      errBox.classList.remove('hidden');
      submitBtn.disabled = false; submitBtn.textContent = 'Login';
      return;
    }
    const result = await goToApp();
    if (!result?.ok) {
      errBox.textContent = result?.reason || 'Login succeeded, but the app could not open. Contact an admin.';
      errBox.classList.remove('hidden');
      submitBtn.disabled = false; submitBtn.textContent = 'Login';
      return;
    }
    closeAuthModal();
  } catch (error) {
    errBox.textContent = friendlyError(error);
    errBox.classList.remove('hidden');
    submitBtn.disabled = false; submitBtn.textContent = 'Login';
  }
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  const msgBox = document.getElementById('forgot-message');
  const btn = document.getElementById('forgot-submit-btn');
  btn.disabled = true; btn.textContent = 'Sending…';
  const redirectTo = getAppRedirectUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  msgBox.classList.remove('hidden');
  if (error) { msgBox.className = 'form-error'; msgBox.textContent = friendlyError(error); }
  else {
    msgBox.className = 'form-success';
    msgBox.textContent = `If that email has an account, a reset link is on its way. The link will open ${redirectTo}.`;
  }
  btn.disabled = false; btn.textContent = 'Send Reset Link';
}

export function getAppRedirectUrl() {
  const configured = typeof window.APP_URL === 'string' ? window.APP_URL.trim() : '';
  try {
    const target = new URL(configured || window.location.origin);
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Invalid app URL protocol');
    return target.origin;
  } catch {
    return window.location.origin;
  }
}

async function handleResetPassword(e) {
  e.preventDefault();
  const pass = document.getElementById('reset-password').value;
  const confirmPass = document.getElementById('reset-password-confirm').value;
  const errBox = document.getElementById('reset-error');
  errBox.classList.add('hidden');
  if (pass !== confirmPass) { errBox.textContent = 'Passwords do not match.'; errBox.classList.remove('hidden'); return; }
  const submit = document.querySelector('#reset-form button[type="submit"]');
  submit.disabled = true; submit.textContent = 'Updating password…';
  const { error } = await supabase.auth.updateUser({ password: pass });
  if (error) {
    errBox.textContent = friendlyError(error); errBox.classList.remove('hidden');
    submit.disabled = false; submit.textContent = 'Update Password';
    return;
  }
  recoveryMode = false;
  window.history.replaceState({}, '', window.location.pathname);
  toast('Password updated. You are now logged in.', 'success');
  closeAuthModal();
  await goToApp();
}

export async function logout(reason = 'manual') {
  stopInactivitySession();
  await supabase.auth.signOut();
  state.currentUser = null; state.cart = [];
  document.getElementById('app-view').classList.add('hidden');
  document.getElementById('public-site').classList.remove('hidden');
  toast(reason === 'idle' ? 'You were logged out after 15 minutes without activity.' : 'Logged out.', 'info');
}

// ---------------------------------------------------------------------------
// Password-recovery links.
// The emailed link lands here with the recovery token in the URL hash
// (#access_token=...&type=recovery). Two things used to break this:
//  1. The app auto-logged the user in with that temporary recovery session
//     and dropped them on the dashboard instead of showing the reset form.
//  2. Expired/invalid links (#error=...&error_code=otp_expired) were ignored.
// We now detect both synchronously, before any auto-login happens.
// ---------------------------------------------------------------------------
function urlParams() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  return { hash, query };
}
export function isRecoveryUrl() {
  const { hash, query } = urlParams();
  return hash.get('type') === 'recovery' || query.get('type') === 'recovery';
}
export function handleAuthUrlErrors() {
  const { hash, query } = urlParams();
  const code = hash.get('error_code') || query.get('error_code');
  if (!code && !hash.get('error') && !query.get('error')) return false;
  window.history.replaceState({}, '', window.location.pathname);
  toast('This reset link is invalid or has expired. Please request a new one.', 'error', 6000);
  openAuthModal('forgot');
  return true;
}

let recoveryMode = false;

// Supabase fires PASSWORD_RECOVERY once it has read the recovery token.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') { recoveryMode = true; openAuthModal('reset'); }
});

export async function tryAutoLogin() {
  if (isRecoveryUrl() || recoveryMode) { openAuthModal('reset'); return; } // never auto-enter the app during recovery
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const result = await goToApp();
    if (!result?.ok) toast(result?.reason || 'Could not open your account. Please sign in again.', 'error');
  }
}

// Referenced from inline onclick="..." in the HTML this module generates.
window.closeAuthModal = closeAuthModal;
window.renderAuthModal = renderAuthModal;
window.logout = logout;
