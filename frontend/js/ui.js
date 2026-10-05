// js/ui.js
import { icon } from './icons.js';
import { state, sanitizeId } from './state.js';

// ---------------------------------------------------------------------------
// Formatting / small helpers
// ---------------------------------------------------------------------------
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function money(n) {
  const currency = state.settings?.currency || 'TZS';
  return `${currency} ${Math.round(Number(n) || 0).toLocaleString()}`;
}
export function val(id) { return document.getElementById(id)?.value ?? ''; }
export function debounce(fn, delay = 200) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; }
export function badge(text, kind) { return `<span class="badge badge-${kind}">${escapeHtml(text)}</span>`; }
export function statCard(label, value, warn) { return `<div class="stat-card ${warn ? 'warn' : ''}"><div class="label">${label}</div><div class="value">${value}</div></div>`; }
// supabase.functions.invoke() hides the real message of a failed call behind
// "non-2xx status code"; the useful text is in the response body.
export async function functionError(res) {
  try { const body = await res.error.context.json(); if (body?.error) return body.error; } catch (e) { /* fall through */ }
  return res.error?.message || 'Request failed. Please try again.';
}
export function friendlyError(error) { return error?.message || 'Something went wrong. Please try again.'; }

// Root-cause fix for the "invalid input syntax for type uuid: undefined"
// error: several pages need a branch id before they can query anything
// (inventory, services, sales, resources, returns, cash collection). On a
// fresh install with zero branches, before a manager has picked one, or
// after a stale/poisoned value ever got saved, that id isn't a real UUID -
// querying with it anyway is what produced that exact Postgres error. Every
// branch-scoped page calls this first and gets a friendly, actionable empty
// state instead, never a raw database error.
export function resolveBranchId(mainEl) {
  const raw = state.currentUser.role === 'MANAGER' ? state.selectedBranch : state.currentUser.branchId;
  const branchId = sanitizeId(raw);
  if (!branchId) {
    mainEl.innerHTML = state.currentUser.role === 'MANAGER'
      ? `<div class="empty-state branch-empty-state">
           <div class="confirm-icon">${icon('map-pin')}</div>
           <h3>No branch selected</h3>
           <p class="muted">Create your first branch to start using this page.</p>
           <button class="btn btn-primary" onclick="navigate('branches')">Go to Branches</button>
         </div>`
      : `<div class="empty-state branch-empty-state">
           <div class="confirm-icon danger">${icon('alert-triangle')}</div>
           <h3>No branch assigned</h3>
           <p class="muted">Your account isn't linked to a branch yet. Contact your manager.</p>
         </div>`;
    return null;
  }
  return branchId;
}

export function renderTable(columns, rows, emptyMsg = 'No records yet.') {
  if (!rows || !rows.length) return `<div class="empty-state">${emptyMsg}</div>`;
  return `<div class="table-scroll"><table><thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${columns.map((c) => `<td>${c.render ? c.render(r) : escapeHtml(r[c.key] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// ---------------------------------------------------------------------------
// Animated, stacked notifications (never native alert/confirm/prompt)
// ---------------------------------------------------------------------------
let toastContainerEl = null;
function ensureToastContainer() {
  if (!toastContainerEl || !document.body.contains(toastContainerEl)) {
    toastContainerEl = document.createElement('div');
    toastContainerEl.className = 'toast-container';
    document.body.appendChild(toastContainerEl);
  }
  return toastContainerEl;
}
const TOAST_ICONS = { success: 'check', error: 'x', warning: 'alert-triangle', info: 'info' };
export function toast(message, type = 'info', duration = 4200) {
  const container = ensureToastContainer();
  const el = document.createElement('div');
  el.className = `toast-item toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${icon(TOAST_ICONS[type] || 'info')}</span><span class="toast-msg">${escapeHtml(message)}</span><button class="toast-close" aria-label="Dismiss">${icon('x')}</button><span class="toast-progress" style="animation-duration:${duration}ms"></span>`;
  container.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  const remove = () => { el.classList.remove('show'); el.classList.add('hide'); setTimeout(() => el.remove(), 220); };
  const timer = setTimeout(remove, duration);
  el.querySelector('.toast-close').addEventListener('click', () => { clearTimeout(timer); remove(); });
}

// ---------------------------------------------------------------------------
// Confirm / prompt dialogs
// ---------------------------------------------------------------------------
function ensureDialogRoot() {
  let root = document.getElementById('dialog-root');
  if (!root) { root = document.createElement('div'); root.id = 'dialog-root'; document.body.appendChild(root); }
  return root;
}
function closeDialog(root, backdrop, resolve, result) { backdrop.classList.add('closing'); setTimeout(() => { root.innerHTML = ''; resolve(result); }, 170); }

export function confirmDialog({ title, message = '', icon: iconName = 'alert-triangle', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const root = ensureDialogRoot();
    root.innerHTML = `<div class="modal-backdrop" id="dlg-backdrop"><div class="modal confirm-modal">
      <div class="confirm-icon ${danger ? 'danger' : ''}">${icon(iconName)}</div>
      <h3>${escapeHtml(title)}</h3>${message ? `<p class="muted">${escapeHtml(message)}</p>` : ''}
      <div class="confirm-actions"><button class="btn btn-outline" id="dlg-cancel">${escapeHtml(cancelLabel)}</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="dlg-ok">${escapeHtml(confirmLabel)}</button></div>
    </div></div>`;
    const backdrop = document.getElementById('dlg-backdrop');
    document.getElementById('dlg-ok').addEventListener('click', () => closeDialog(root, backdrop, resolve, true));
    document.getElementById('dlg-cancel').addEventListener('click', () => closeDialog(root, backdrop, resolve, false));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeDialog(root, backdrop, resolve, false); });
  });
}

export function promptDialog({ title, message = '', fields, confirmLabel = 'Submit', icon: iconName = 'pencil', danger = false }) {
  return new Promise((resolve) => {
    const root = ensureDialogRoot();
    const fieldHtml = (f) => {
      if (f.type === 'select') return `<label>${escapeHtml(f.label)}<select id="pd-${f.id}">${f.options.map((o) => `<option value="${escapeHtml(o.value)}" ${o.value === f.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select></label>`;
      if (f.type === 'textarea') return `<label>${escapeHtml(f.label)}<textarea id="pd-${f.id}" rows="3" placeholder="${escapeHtml(f.placeholder || '')}">${escapeHtml(f.value || '')}</textarea></label>`;
      return `<label>${escapeHtml(f.label)}<input id="pd-${f.id}" type="${f.type || 'text'}" placeholder="${escapeHtml(f.placeholder || '')}" value="${escapeHtml(f.value ?? '')}" ${f.min != null ? `min="${f.min}"` : ''} ${f.step != null ? `step="${f.step}"` : ''} /></label>`;
    };
    root.innerHTML = `<div class="modal-backdrop" id="dlg-backdrop"><div class="modal confirm-modal">
      <div class="confirm-icon ${danger ? 'danger' : ''}">${icon(iconName)}</div>
      <h3>${escapeHtml(title)}</h3>${message ? `<p class="muted">${escapeHtml(message)}</p>` : ''}
      <form id="dlg-form">${fields.map(fieldHtml).join('')}
        <div class="confirm-actions"><button type="button" class="btn btn-outline" id="dlg-cancel">Cancel</button>
        <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${escapeHtml(confirmLabel)}</button></div>
      </form></div></div>`;
    const backdrop = document.getElementById('dlg-backdrop');
    document.getElementById('dlg-cancel').addEventListener('click', () => closeDialog(root, backdrop, resolve, null));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeDialog(root, backdrop, resolve, null); });
    document.getElementById('dlg-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const result = {};
      fields.forEach((f) => { result[f.id] = document.getElementById(`pd-${f.id}`).value; });
      closeDialog(root, backdrop, resolve, result);
    });
    setTimeout(() => document.getElementById(`pd-${fields[0].id}`)?.focus(), 50);
  });
}

// ---------------------------------------------------------------------------
// Dropdown menus (topbar user menu, and any future menu button)
// ---------------------------------------------------------------------------
export function closeAllDropdowns(except) {
  document.querySelectorAll('.dropdown.open').forEach((d) => {
    if (d === except) return;
    d.classList.remove('open');
    d.querySelector('.dropdown-trigger')?.setAttribute('aria-expanded', 'false');
  });
}
export function toggleDropdown(el) {
  const dropdown = el.closest('.dropdown');
  const willOpen = !dropdown.classList.contains('open');
  closeAllDropdowns(willOpen ? dropdown : null);
  dropdown.classList.toggle('open', willOpen);
  el.setAttribute('aria-expanded', String(willOpen));
}
document.addEventListener('click', (e) => { if (!e.target.closest('.dropdown')) closeAllDropdowns(); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const trigger = document.querySelector('.dropdown.open .dropdown-trigger');
  closeAllDropdowns();
  trigger?.focus();
});

// These two are only ever invoked from inline onclick="..." in generated
// HTML, so they need to be reachable on window (see main.js for the full
// explanation of why modules require this).
window.toggleDropdown = toggleDropdown;
window.closeAllDropdowns = closeAllDropdowns;
