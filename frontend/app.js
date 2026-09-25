// app.js — Dinah Stationaries frontend, running entirely against Supabase
// (Postgres + Auth). This is an ES module (see index.html's <script type="module">),
// so every function referenced from inline onclick="..." in generated HTML is
// explicitly attached to window at the bottom of this file.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let CURRENT_USER = null; // { id, email, role, branchId, fullName }
let SETTINGS = null;
let BRANCHES = [];
let SELECTED_BRANCH = localStorage.getItem('dinah_selected_branch') || null;
let ACTIVE_TAB = 'dashboard';
let CART = [];

// ---------------------------------------------------------------------------
// Icon system — inline SVG only, never emoji.
// ---------------------------------------------------------------------------
const ICONS = {
  pen: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  'map-pin': '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  'graduation-cap': '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12.5V17c0 1.66 2.69 3 6 3s6-1.34 6-3v-4.5"/>',
  'trending-up': '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/>',
  'message-circle': '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2" ry="2"/><line x1="6" y1="10" x2="6.01" y2="10"/><line x1="10" y1="10" x2="10.01" y2="10"/><line x1="14" y1="10" x2="14.01" y2="10"/><line x1="18" y1="10" x2="18.01" y2="10"/><line x1="7" y1="14" x2="17" y2="14"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/>',
  pencil: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  paperclip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  'hard-drive': '<line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/>',
  package: '<path d="M16.5 9.4L7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/>',
  tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  'alert-triangle': '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  'corner-up-left': '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
  'credit-card': '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  'bar-chart': '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  'shopping-cart': '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'
};
function icon(name, cls = 'icon') { return `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${ICONS[name] || ICONS.package}</svg>`; }
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.getAttribute('data-icon')); }); }

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------
function escapeHtml(str) { return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function money(n) { const currency = SETTINGS?.currency || 'TZS'; return `${currency} ${Math.round(Number(n) || 0).toLocaleString()}`; }
function val(id) { return document.getElementById(id)?.value ?? ''; }
function debounce(fn, delay = 200) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; }
function badge(text, kind) { return `<span class="badge badge-${kind}">${escapeHtml(text)}</span>`; }
function renderTable(columns, rows, emptyMsg = 'No records yet.') {
  if (!rows || !rows.length) return `<div class="empty-state">${emptyMsg}</div>`;
  return `<div class="table-scroll"><table><thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${columns.map((c) => `<td>${c.render ? c.render(r) : escapeHtml(r[c.key] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function friendlyError(error) { return error?.message || 'Something went wrong. Please try again.'; }

// ---------------------------------------------------------------------------
// Notifications (stacked, animated)
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
function toast(message, type = 'info', duration = 4200) {
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
function confirmDialog({ title, message = '', icon: iconName = 'alert-triangle', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
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
function promptDialog({ title, message = '', fields, confirmLabel = 'Submit', icon: iconName = 'pencil', danger = false }) {
  return new Promise((resolve) => {
    const root = ensureDialogRoot();
    const fieldHtml = (f) => {
      if (f.type === 'select') return `<label>${escapeHtml(f.label)}<select id="pd-${f.id}">${f.options.map((o) => `<option value="${escapeHtml(o.value)}" ${o.value === f.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select></label>`;
      if (f.type === 'textarea') return `<label>${escapeHtml(f.label)}<textarea id="pd-${f.id}" rows="3" placeholder="${escapeHtml(f.placeholder || '')}">${escapeHtml(f.value || '')}</textarea></label>`;
      return `<label>${escapeHtml(f.label)}<input id="pd-${f.id}" type="${f.type || 'text'}" placeholder="${escapeHtml(f.placeholder || '')}" value="${escapeHtml(f.value ?? '')}" ${f.min != null ? `min="${f.min}"` : ''} /></label>`;
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
// Scroll-reveal motion for the landing page
// ---------------------------------------------------------------------------
function wireScrollReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

// ---------------------------------------------------------------------------
// Public landing page
// ---------------------------------------------------------------------------
async function loadPublicSite() {
  document.getElementById('footer-year').textContent = new Date().getFullYear();
  try {
    const { data } = await supabase.from('public_settings').select('*').single();
    SETTINGS = data;
    renderLocation();
    renderContact();
  } catch (e) { console.error(e); }

  try {
    const { data } = await supabase.from('public_products').select('*').limit(8);
    renderPublicProducts(data || []);
  } catch (e) { renderPublicProducts([]); }

  try {
    const { data } = await supabase.from('public_services').select('*');
    renderPublicServices(data || []);
  } catch (e) { renderPublicServices([]); }

  wireScrollReveal();
}

const SERVICE_ICONS = { Printing: 'printer', Photocopying: 'copy', 'Photo Printing': 'image', Lamination: 'layers', Binding: 'book', Typing: 'keyboard', Scanning: 'scan' };
const PRODUCT_ICONS = { 'Writing Materials': 'pencil', 'Paper Products': 'file-text', 'Filing & Organization': 'folder', 'Office Supplies': 'paperclip', Technology: 'hard-drive' };

function renderPublicProducts(products) {
  const grid = document.getElementById('products-grid');
  if (!products.length) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Product catalogue is being updated. Please check back soon or visit our office.</div>`; return; }
  grid.innerHTML = products.map((p) => `
    <div class="product-card reveal in-view">
      <div class="emoji">${icon(PRODUCT_ICONS[p.category] || 'package')}</div>
      <div>${escapeHtml(p.name)}</div>
      <div class="price">${money(p.selling_price)}</div>
    </div>`).join('');
}
function renderPublicServices(services) {
  const grid = document.getElementById('services-grid');
  const list = services.length ? services : Object.keys(SERVICE_ICONS).map((name) => ({ name }));
  grid.innerHTML = list.map((s) => `
    <div class="card reveal in-view">
      <div class="card-icon">${icon(SERVICE_ICONS[s.name] || 'tool')}</div>
      <h3>${escapeHtml(s.name)}</h3>
      <p>Professional ${escapeHtml(s.name).toLowerCase()} for school, office and business needs.</p>
    </div>`).join('');
}
function renderLocation() {
  const wrap = document.getElementById('map-embed-wrap');
  const details = document.getElementById('location-details');
  const s = SETTINGS || {};
  if (s.google_maps_embed_url) wrap.innerHTML = `<iframe src="${escapeHtml(s.google_maps_embed_url)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Dinah Stationaries location"></iframe>`;
  else if (s.office_address) wrap.innerHTML = `<iframe src="https://www.google.com/maps?q=${encodeURIComponent(s.office_address)}&output=embed" loading="lazy" title="Dinah Stationaries location"></iframe>`;
  else wrap.innerHTML = `<div class="card" style="height:100%;display:flex;align-items:center;justify-content:center;text-align:center;">Location coming soon — set it up in Manager → Settings.</div>`;
  details.innerHTML = `
    <p><strong>${escapeHtml(s.business_name || 'Dinah Stationaries')}</strong></p>
    <p>${icon('map-pin', 'icon-inline')}${escapeHtml(s.office_address || 'Address to be added by Manager in Settings.')}</p>
    <p>${icon('clock', 'icon-inline')}${escapeHtml(s.opening_hours || 'Opening hours to be added.')}</p>
    <p>${icon('phone', 'icon-inline')}${escapeHtml(s.phone || 'Phone to be added.')}</p>
    ${s.google_maps_url ? `<a class="btn btn-primary" style="margin-top:10px" href="${escapeHtml(s.google_maps_url)}" target="_blank" rel="noopener">Get Directions</a>` : ''}`;
}
function renderContact() {
  const s = SETTINGS || {};
  document.getElementById('contact-grid').innerHTML = `
    <div class="card reveal in-view"><div class="card-icon">${icon('phone')}</div><h3>Phone</h3><p>${escapeHtml(s.phone || 'Coming soon')}</p></div>
    <div class="card reveal in-view"><div class="card-icon">${icon('message-circle')}</div><h3>WhatsApp</h3><p>${escapeHtml(s.whatsapp || 'Coming soon')}</p></div>
    <div class="card reveal in-view"><div class="card-icon">${icon('mail')}</div><h3>Email</h3><p>${escapeHtml(s.email || 'Coming soon')}</p></div>
    <div class="card reveal in-view"><div class="card-icon">${icon('clock')}</div><h3>Opening Hours</h3><p>${escapeHtml(s.opening_hours || 'Coming soon')}</p></div>`;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function wireLanding() {
  document.getElementById('login-open-btn').addEventListener('click', () => openAuthModal('login'));
  document.getElementById('login-modal').addEventListener('click', (e) => { if (e.target.id === 'login-modal') closeAuthModal(); });
  document.getElementById('hamburger').addEventListener('click', () => document.getElementById('nav-links').classList.toggle('open'));
  document.getElementById('logout-btn').addEventListener('click', () => logout());
}
function openAuthModal(mode, opts = {}) { document.getElementById('login-modal').classList.remove('hidden'); renderAuthModal(mode, opts); }
function closeAuthModal() { document.getElementById('login-modal').classList.add('hidden'); }

function renderAuthModal(mode, opts = {}) {
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
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    errBox.textContent = 'Invalid email or password.'; errBox.classList.remove('hidden');
    submitBtn.disabled = false; submitBtn.textContent = 'Login';
    return;
  }
  closeAuthModal();
  await enterApp();
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  const msgBox = document.getElementById('forgot-message');
  const btn = document.getElementById('forgot-submit-btn');
  btn.disabled = true; btn.textContent = 'Sending…';
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  msgBox.classList.remove('hidden');
  if (error) { msgBox.className = 'form-error'; msgBox.textContent = friendlyError(error); }
  else { msgBox.className = 'form-success'; msgBox.textContent = 'If that email has an account, a reset link is on its way.'; }
  btn.disabled = false; btn.textContent = 'Send Reset Link';
}

async function handleResetPassword(e) {
  e.preventDefault();
  const pass = document.getElementById('reset-password').value;
  const confirmPass = document.getElementById('reset-password-confirm').value;
  const errBox = document.getElementById('reset-error');
  errBox.classList.add('hidden');
  if (pass !== confirmPass) { errBox.textContent = 'Passwords do not match.'; errBox.classList.remove('hidden'); return; }
  const { error } = await supabase.auth.updateUser({ password: pass });
  if (error) { errBox.textContent = friendlyError(error); errBox.classList.remove('hidden'); return; }
  toast('Password updated.', 'success');
  closeAuthModal();
  await enterApp();
}

function logout() {
  supabase.auth.signOut();
  CURRENT_USER = null; CART = [];
  document.getElementById('app-view').classList.add('hidden');
  document.getElementById('public-site').classList.remove('hidden');
  toast('Logged out.', 'info');
}

// Supabase fires PASSWORD_RECOVERY when the user lands here from a reset-password email link.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') openAuthModal('reset');
});

async function tryAutoLogin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await enterApp();
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------
async function enterApp() {
  const { data: profile, error } = await supabase.from('my_profile_view').select('*').single();
  if (error || !profile) { toast('Could not load your account. Please try logging in again.', 'error'); await supabase.auth.signOut(); return; }
  if (!profile.active) { toast('Your account has been deactivated. Contact your manager.', 'error'); await supabase.auth.signOut(); return; }

  CURRENT_USER = { id: profile.id, email: profile.email, role: profile.role, branchId: profile.branch_id, fullName: profile.full_name };

  document.getElementById('public-site').classList.add('hidden');
  document.getElementById('app-view').classList.remove('hidden');
  document.getElementById('app-user-label').textContent = `${CURRENT_USER.fullName || CURRENT_USER.email} · ${CURRENT_USER.role}`;
  updateSyncBadge();
  window.addEventListener('online', updateSyncBadge);
  window.addEventListener('offline', updateSyncBadge);
  wireSidebarToggle();

  const { data: branches } = await supabase.from('branches_view').select('*').order('name');
  BRANCHES = branches || [];
  SELECTED_BRANCH = CURRENT_USER.role === 'MANAGER' ? (SELECTED_BRANCH || BRANCHES[0]?.id) : CURRENT_USER.branchId;

  buildSidebar();
  navigate('dashboard');
}

function wireSidebarToggle() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('app-sidebar');
  const scrim = document.getElementById('sidebar-scrim');
  if (toggleBtn.dataset.wired) return;
  toggleBtn.dataset.wired = '1';
  const setOpen = (open) => { sidebar.classList.toggle('open', open); scrim.classList.toggle('show', open); };
  toggleBtn.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
  scrim.addEventListener('click', () => setOpen(false));
}
function updateSyncBadge() {
  const el = document.getElementById('sync-status');
  if (navigator.onLine) { el.textContent = '● Online'; el.classList.remove('offline'); }
  else { el.textContent = '● Offline'; el.classList.add('offline'); }
}

const MANAGER_TABS = [
  ['dashboard', 'Dashboard', 'trending-up'], ['branches', 'Branches', 'map-pin'], ['users', 'Users', 'user'],
  ['products', 'Products', 'package'], ['requests', 'Product Requests', 'file-text'], ['inventory', 'Inventory', 'layers'],
  ['services', 'Services', 'tool'], ['sales', 'Sales', 'dollar'], ['resources', 'Resources', 'hard-drive'],
  ['returns', 'Returns', 'corner-up-left'], ['cash', 'Cash Collection', 'credit-card'], ['reports', 'Reports', 'bar-chart'],
  ['audit', 'Audit Logs', 'clock'], ['profile', 'My Profile', 'user'], ['settings', 'Settings', 'settings']
];
const CASHIER_TABS = [
  ['dashboard', 'Dashboard', 'trending-up'], ['pos', 'POS', 'shopping-cart'], ['services', 'Services', 'tool'],
  ['resources', 'Resources Used', 'hard-drive'], ['requests', 'Product Requests', 'file-text'],
  ['sales', 'Transactions', 'dollar'], ['closing', 'Daily Closing', 'clock'], ['profile', 'My Profile', 'user']
];
function buildSidebar() {
  const tabs = CURRENT_USER.role === 'MANAGER' ? MANAGER_TABS : CASHIER_TABS;
  document.getElementById('app-sidebar').innerHTML = tabs.map(([key, label, iconName]) => `<button data-tab="${key}" onclick="navigate('${key}')">${icon(iconName)}<span>${label}</span></button>`).join('');
}
function navigate(tab) {
  ACTIVE_TAB = tab;
  document.querySelectorAll('#app-sidebar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('app-sidebar').classList.remove('open');
  document.getElementById('sidebar-scrim').classList.remove('show');
  document.getElementById('app-main').innerHTML = `<div class="loading-line"><span class="spinner"></span>Loading…</div>`;
  const renderer = CURRENT_USER.role === 'MANAGER' ? managerRenderers[tab] : cashierRenderers[tab];
  if (renderer) renderer().catch((e) => { document.getElementById('app-main').innerHTML = `<div class="empty-state">${escapeHtml(friendlyError(e))}</div>`; });
  else document.getElementById('app-main').innerHTML = `<div class="empty-state">Not implemented yet.</div>`;
}
function branchSelectorHtml() {
  if (CURRENT_USER.role !== 'MANAGER') return '';
  return `<select onchange="onBranchChange(this.value)">${BRANCHES.map((b) => `<option value="${b.id}" ${b.id === SELECTED_BRANCH ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}</select>`;
}
function onBranchChange(id) { SELECTED_BRANCH = id; localStorage.setItem('dinah_selected_branch', id); navigate(ACTIVE_TAB); }
function statCard(label, value, warn) { return `<div class="stat-card ${warn ? 'warn' : ''}"><div class="label">${label}</div><div class="value">${value}</div></div>`; }

// ---------------------------------------------------------------------------
// MANAGER views
// ---------------------------------------------------------------------------
const managerRenderers = {
  dashboard: renderManagerDashboard, branches: renderBranches, users: renderUsers, products: renderProducts,
  requests: renderRequests, inventory: renderInventory, services: renderServices, sales: renderSales,
  resources: renderResources, returns: renderReturns, cash: renderCashCollection, reports: renderReports,
  audit: renderAudit, profile: renderProfile, settings: renderSettings
};

async function renderManagerDashboard() {
  const main = document.getElementById('app-main');
  const { data, error } = await supabase.rpc('manager_dashboard');
  if (error) throw error;
  const maxVal = Math.max(1, ...data.salesByBranch.map((b) => b.sales));
  main.innerHTML = `
    <h1 class="page-title">Manager Dashboard</h1><p class="page-sub">Business overview across all branches.</p>
    <div class="stat-grid">
      ${statCard('Total Sales', money(data.totalSales))}${statCard('Service Income', money(data.serviceIncome))}
      ${statCard('Product Profit', money(data.productProfit))}${statCard('Service Profit', money(data.serviceProfit))}
      ${statCard('Low Stock Items', data.lowStockItems, data.lowStockItems > 0)}${statCard('Pending Requests', data.pendingRequests, data.pendingRequests > 0)}
      ${statCard('Active Branches', data.activeBranches)}
    </div>
    <div class="panel"><div class="panel-header"><h3>Sales by Branch</h3></div>
      <div class="bars">${data.salesByBranch.map((b) => `<div class="bar-col"><div class="bar" style="height:${Math.max(4, (b.sales / maxVal) * 120)}px" title="${money(b.sales)}"></div><div class="bar-label">${escapeHtml(b.branch)}</div></div>`).join('')}</div>
      ${renderTable([{ key: 'branch', label: 'Branch' }, { key: 'sales', label: 'Product Sales', render: (r) => money(r.sales) }, { key: 'services', label: 'Service Income', render: (r) => money(r.services) }], data.salesByBranch)}
    </div>`;
}

async function renderBranches() {
  const main = document.getElementById('app-main');
  const { data: branches, error } = await supabase.from('branches_view').select('*').order('name');
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Branches</h1><p class="page-sub">Each branch has independent inventory, services and cashier.</p>
    <div class="panel"><div class="panel-header"><h3>Add Branch</h3></div>
      <form onsubmit="return submitBranch(event)"><div class="form-row"><label>Branch Name<input id="branch-name" required /></label><label>Address<input id="branch-address" /></label></div>
      <button class="btn btn-primary" type="submit">Add Branch</button></form></div>
    <div class="panel"><div class="panel-header"><h3>All Branches</h3></div>
      ${renderTable([{ key: 'name', label: 'Name' }, { key: 'address', label: 'Address' }, { key: 'active', label: 'Status', render: (r) => badge(r.active ? 'Active' : 'Inactive', r.active ? 'green' : 'gray') }], branches)}
    </div>`;
}
async function submitBranch(e) {
  e.preventDefault();
  const { error } = await supabase.rpc('create_branch', { p_name: val('branch-name'), p_address: val('branch-address') });
  if (error) return toast(friendlyError(error), 'error');
  toast('Branch created.', 'success');
  const { data } = await supabase.from('branches_view').select('*').order('name');
  BRANCHES = data || [];
  renderBranches();
  return false;
}

async function renderUsers() {
  const main = document.getElementById('app-main');
  const [{ data: users, error }, { data: branches }] = await Promise.all([
    supabase.from('users_view').select('*').order('created_at', { ascending: false }),
    supabase.from('branches_view').select('*').order('name')
  ]);
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Users</h1><p class="page-sub">Create Admin (Manager) or Cashier accounts. Exactly one active cashier per branch.</p>
    <div class="panel"><div class="panel-header"><h3>Add User</h3></div>
      <form onsubmit="return submitUser(event)">
        <div class="form-row">
          <label>Role<select id="u-role" onchange="onUserRoleChange(this.value)"><option value="CASHIER">Cashier</option><option value="MANAGER">Admin (Manager)</option></select></label>
          <label id="u-branch-field">Branch<select id="u-branch">${branches.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}</select></label>
          <label>Full Name<input id="u-fullname" required /></label>
          <label>Email<input id="u-email" type="email" required /></label>
          <label>Password (min 8 characters)<input id="u-password" type="password" minlength="8" required /></label>
        </div>
        <button class="btn btn-primary" type="submit">Add User</button>
      </form>
    </div>
    <div class="panel"><div class="panel-header"><h3>All Users</h3></div>
      ${renderTable([
        { key: 'full_name', label: 'Name' }, { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role', render: (r) => badge(r.role === 'MANAGER' ? 'Admin' : 'Cashier', r.role === 'MANAGER' ? 'blue' : 'gray') },
        { key: 'branch_id', label: 'Branch', render: (r) => r.branch_id ? escapeHtml(branches.find((b) => b.id === r.branch_id)?.name || '—') : '— (all branches)' },
        { key: 'active', label: 'Status', render: (r) => `${badge(r.active ? 'Active' : 'Inactive', r.active ? 'green' : 'gray')} <button class="link-btn" onclick="toggleUser('${r.id}', ${!r.active}, '${escapeHtml(r.full_name)}')">${r.active ? 'Deactivate' : 'Activate'}</button>` }
      ], users)}
    </div>`;
}
function onUserRoleChange(role) { document.getElementById('u-branch-field').style.display = role === 'CASHIER' ? '' : 'none'; }
async function submitUser(e) {
  e.preventDefault();
  const role = val('u-role');
  const { data: { session } } = await supabase.auth.getSession();
  const res = await supabase.functions.invoke('create-user', {
    body: { role, branchId: role === 'CASHIER' ? val('u-branch') : null, fullName: val('u-fullname'), email: val('u-email'), password: val('u-password') },
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  if (res.error) { toast(res.data?.error || friendlyError(res.error), 'error'); return false; }
  toast(`${role === 'MANAGER' ? 'Admin' : 'Cashier'} account created.`, 'success');
  renderUsers();
  return false;
}
async function toggleUser(id, active, name) {
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

async function renderProfile() {
  const main = document.getElementById('app-main');
  const { data: me, error } = await supabase.from('my_profile_view').select('*').single();
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">My Profile</h1>
    <p class="page-sub">Update your name here anytime. Your login email and password are managed by Supabase Auth directly below.</p>
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
async function submitProfileDetails(e) {
  e.preventDefault();
  const { error } = await supabase.rpc('update_my_profile', { p_full_name: val('pf-fullname') });
  if (error) return toast(friendlyError(error), 'error');
  toast('Profile updated.', 'success');
  CURRENT_USER.fullName = val('pf-fullname');
  document.getElementById('app-user-label').textContent = `${CURRENT_USER.fullName || CURRENT_USER.email} · ${CURRENT_USER.role}`;
  return false;
}
async function submitProfilePassword(e) {
  e.preventDefault();
  const { error } = await supabase.auth.updateUser({ password: val('pf-new') });
  if (error) return toast(friendlyError(error), 'error');
  toast('Password updated.', 'success');
  document.getElementById('pf-new').value = '';
  return false;
}

async function renderProducts() {
  const main = document.getElementById('app-main');
  const { data: products, error } = await supabase.from('products_view').select('*').order('name');
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Products</h1><p class="page-sub">Manage the master catalogue, then assign to a branch with opening stock.</p>
    <div class="panel"><div class="panel-header"><h3>Add Product</h3></div>
      <form onsubmit="return submitProduct(event)">
        <div class="form-row">
          <label>Name<input id="p-name" required /></label>
          <label>Type<select id="p-type"><option value="FOR_SALE">For Sale</option><option value="RESOURCE">Resource (consumed by services)</option></select></label>
          <label>Category<input id="p-category" placeholder="e.g. Writing Materials" /></label>
          <label>Unit<input id="p-unit" placeholder="piece / ream / sheet" value="piece" /></label>
          <label>Buying Price<input id="p-buy" type="number" min="0" required /></label>
          <label>Selling Price (blank for resources)<input id="p-sell" type="number" min="0" /></label>
        </div>
        <button class="btn btn-primary" type="submit">Add Product</button>
      </form>
    </div>
    <div class="panel"><div class="panel-header"><h3>Assign Product to a Branch</h3></div>
      <form onsubmit="return submitAssign(event)">
        <div class="form-row">
          <label>Branch<select id="a-branch">${BRANCHES.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}</select></label>
          <label>Product<select id="a-product">${products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select></label>
          <label>Opening Quantity<input id="a-qty" type="number" min="0" value="0" /></label>
          <label>Low Stock Level (blank = default)<input id="a-low" type="number" min="0" /></label>
        </div>
        <button class="btn btn-primary" type="submit">Assign to Branch</button>
      </form>
    </div>
    <div class="panel"><div class="panel-header"><h3>Catalogue</h3></div>
      ${renderTable([
        { key: 'name', label: 'Name' }, { key: 'type', label: 'Type', render: (r) => badge(r.type, r.type === 'FOR_SALE' ? 'blue' : 'yellow') },
        { key: 'category', label: 'Category' }, { key: 'unit', label: 'Unit' },
        { key: 'buying_price', label: 'Buying Price', render: (r) => money(r.buying_price) },
        { key: 'selling_price', label: 'Selling Price', render: (r) => r.type === 'FOR_SALE' ? money(r.selling_price) : '—' }
      ], products)}
    </div>`;
}
async function submitProduct(e) {
  e.preventDefault();
  const { error } = await supabase.rpc('create_product', { p_name: val('p-name'), p_type: val('p-type'), p_category: val('p-category'), p_unit: val('p-unit'), p_buying_price: val('p-buy'), p_selling_price: val('p-sell') || 0 });
  if (error) return toast(friendlyError(error), 'error');
  toast('Product created. Now assign it to a branch below.', 'success');
  renderProducts();
  return false;
}
async function submitAssign(e) {
  e.preventDefault();
  const { error } = await supabase.rpc('assign_product_to_branch', { p_branch_id: val('a-branch'), p_product_id: val('a-product'), p_quantity: val('a-qty'), p_low_stock_level: val('a-low') || null });
  if (error) return toast(friendlyError(error), 'error');
  toast('Assigned to branch.', 'success');
  renderProducts();
  return false;
}

async function renderRequests() {
  const main = document.getElementById('app-main');
  const { data: requests, error } = await supabase.from('product_requests_view').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Product Requests</h1><p class="page-sub">Cashiers request new products; you set the buying price before approval.</p>
    <div class="panel">${renderTable([
      { key: 'product_name', label: 'Product' }, { key: 'selling_price', label: 'Requested Selling Price', render: (r) => money(r.selling_price) },
      { key: 'quantity', label: 'Qty' },
      { key: 'status', label: 'Status', render: (r) => badge(r.status, r.status === 'PENDING' ? 'yellow' : r.status === 'APPROVED' ? 'green' : 'red') },
      { key: 'actions', label: '', render: (r) => r.status === 'PENDING' ? `
          <input type="number" placeholder="Buying price" id="buy-${r.id}" style="width:110px;padding:6px;border:1px solid var(--border);border-radius:6px" />
          <button class="btn btn-success btn-sm" onclick="approveRequest('${r.id}')">Approve</button>
          <button class="btn btn-danger btn-sm" onclick="rejectRequest('${r.id}')">Reject</button>` : '—' }
    ], requests, 'No product requests yet.')}</div>`;
}
async function approveRequest(id) {
  const price = val(`buy-${id}`);
  if (!price) return toast('Enter a buying price first.', 'error');
  const { error } = await supabase.rpc('approve_product_request', { p_request_id: id, p_buying_price: price });
  if (error) return toast(friendlyError(error), 'error');
  toast('Request approved.', 'success'); renderRequests();
}
async function rejectRequest(id) {
  const ok = await confirmDialog({ title: 'Reject This Product Request?', icon: 'x', confirmLabel: 'Reject', danger: true });
  if (!ok) return;
  const { error } = await supabase.rpc('reject_product_request', { p_request_id: id });
  if (error) return toast(friendlyError(error), 'error');
  toast('Request rejected.', 'info'); renderRequests();
}

async function renderInventory() {
  const main = document.getElementById('app-main');
  main.innerHTML = `<h1 class="page-title">Inventory ${branchSelectorHtml()}</h1><p class="page-sub">Branch-specific stock levels.</p><div id="inv-table" class="panel">Loading…</div>`;
  const { data: rows, error } = await supabase.from('branch_inventory_view').select('*').eq('branch_id', SELECTED_BRANCH);
  if (error) throw error;
  document.getElementById('inv-table').innerHTML = renderTable([
    { key: 'name', label: 'Product' }, { key: 'type', label: 'Type' }, { key: 'quantity', label: 'Qty', render: (r) => `${r.quantity} ${r.unit || ''}` },
    { key: 'buying_price', label: 'Buying Price', render: (r) => money(r.buying_price) },
    { key: 'inventory_value', label: 'Inventory Value', render: (r) => money(r.inventory_value) },
    { key: 'low_stock', label: 'Status', render: (r) => r.low_stock ? badge('LOW STOCK', 'red') : badge('OK', 'green') },
    { key: 'adjust', label: '', render: (r) => `<button class="btn btn-outline btn-sm" onclick="promptAdjust('${r.product_id}','${escapeHtml(r.name)}')">Adjust</button>` }
  ], rows);
}
async function promptAdjust(productId, name) {
  const result = await promptDialog({
    title: 'Adjust Stock', message: `Product: ${name}`, icon: 'package', confirmLabel: 'Apply Adjustment',
    fields: [
      { id: 'direction', label: 'Direction', type: 'select', options: [{ value: 'INCREASE', label: 'Increase' }, { value: 'DECREASE', label: 'Decrease' }] },
      { id: 'quantity', label: 'Quantity', type: 'number', min: 1 },
      { id: 'reason', label: 'Reason', type: 'select', options: ['Damaged', 'Lost', 'Expired', 'Physical Count Correction', 'Wrong Entry', 'Returned', 'Other'].map((r) => ({ value: r, label: r })) }
    ]
  });
  if (!result || !result.quantity) return;
  const { error } = await supabase.rpc('adjust_stock', { p_branch_id: SELECTED_BRANCH, p_product_id: productId, p_direction: result.direction, p_quantity: result.quantity, p_reason: result.reason });
  if (error) return toast(friendlyError(error), 'error');
  toast('Stock adjusted.', 'success'); renderInventory();
}

async function renderServices() {
  const main = document.getElementById('app-main');
  const branchId = CURRENT_USER.role === 'MANAGER' ? SELECTED_BRANCH : CURRENT_USER.branchId;
  const { data: services, error } = await supabase.from('services_view').select('*').eq('branch_id', branchId);
  if (error) throw error;
  const managerControls = CURRENT_USER.role === 'MANAGER' ? `
    <div class="panel"><div class="panel-header"><h3>Add Service ${branchSelectorHtml()}</h3></div>
      <form onsubmit="return submitService(event)"><div class="form-row"><label>Name<input id="svc-name" required /></label><label>Description<input id="svc-desc" /></label></div>
      <button class="btn btn-primary" type="submit">Add Service</button></form></div>` : '';
  main.innerHTML = `<h1 class="page-title">Services</h1><p class="page-sub">Services have no fixed price — the amount is entered per transaction at POS.</p>${managerControls}
    <div class="panel">${renderTable([
      { key: 'name', label: 'Name' }, { key: 'description', label: 'Description' },
      { key: 'active', label: 'Status', render: (r) => CURRENT_USER.role === 'MANAGER' ? `<button class="link-btn" onclick="toggleService('${r.id}', ${!r.active})">${badge(r.active ? 'Active' : 'Inactive', r.active ? 'green' : 'gray')}</button>` : badge(r.active ? 'Active' : 'Inactive', r.active ? 'green' : 'gray') }
    ], services)}</div>`;
}
async function submitService(e) {
  e.preventDefault();
  const { error } = await supabase.rpc('create_service', { p_branch_id: SELECTED_BRANCH, p_name: val('svc-name'), p_description: val('svc-desc') });
  if (error) return toast(friendlyError(error), 'error');
  toast('Service added.', 'success'); renderServices();
  return false;
}
async function toggleService(id, active) {
  const { error } = await supabase.rpc('update_service', { p_service_id: id, p_name: null, p_description: null, p_active: active });
  if (error) return toast(friendlyError(error), 'error');
  renderServices();
}

async function renderSales() {
  const main = document.getElementById('app-main');
  main.innerHTML = `<h1 class="page-title">Sales ${branchSelectorHtml()}</h1><div id="sales-table" class="panel">Loading…</div>`;
  const branchId = CURRENT_USER.role === 'MANAGER' ? SELECTED_BRANCH : CURRENT_USER.branchId;
  const { data: sales, error } = await supabase.from('sales_view').select('*').eq('branch_id', branchId).order('created_at', { ascending: false });
  if (error) throw error;
  document.getElementById('sales-table').innerHTML = renderTable([
    { key: 'txn_number', label: 'Txn #' }, { key: 'total', label: 'Total', render: (r) => money(r.total) },
    { key: 'items', label: 'Items', render: (r) => (r.items || []).map((i) => `${i.name} x${i.quantity}`).join(', ') },
    { key: 'status', label: 'Status', render: (r) => badge(r.status, r.status === 'COMPLETED' ? 'green' : 'red') },
    { key: 'created_at', label: 'Time', render: (r) => new Date(r.created_at).toLocaleString() },
    { key: 'void', label: '', render: (r) => r.status === 'COMPLETED' ? `<button class="btn btn-danger btn-sm" onclick="voidSale('${r.id}')">Void</button>` : '—' }
  ], sales, 'No sales recorded yet.');
}
async function voidSale(id) {
  const result = await promptDialog({
    title: 'Void This Sale?', message: 'Stock will be restored automatically. This cannot be undone.', icon: 'alert-triangle', confirmLabel: 'Void Sale', danger: true,
    fields: [{ id: 'reason', label: 'Reason', type: 'textarea', placeholder: 'e.g. Customer changed their mind' }]
  });
  if (!result || !result.reason) return;
  const { error } = await supabase.rpc('void_sale', { p_sale_id: id, p_reason: result.reason });
  if (error) return toast(friendlyError(error), 'error');
  toast('Sale voided, stock restored.', 'success'); renderSales();
}

async function renderResources() {
  const main = document.getElementById('app-main');
  const branchId = CURRENT_USER.role === 'MANAGER' ? SELECTED_BRANCH : CURRENT_USER.branchId;
  main.innerHTML = `<h1 class="page-title">Resource Usage ${branchSelectorHtml()}</h1><p class="page-sub">Resources consumed while providing services.</p><div id="res-table" class="panel">Loading…</div>`;
  const { data: rows, error } = await supabase.from('resource_usage_view').select('*').eq('branch_id', branchId).order('created_at', { ascending: false });
  if (error) throw error;
  const cols = [{ key: 'product_name', label: 'Resource' }, { key: 'quantity', label: 'Quantity' }];
  if (CURRENT_USER.role === 'MANAGER') cols.push({ key: 'cost', label: 'Cost', render: (r) => money(r.cost) });
  cols.push({ key: 'created_at', label: 'Time', render: (r) => new Date(r.created_at).toLocaleString() });
  document.getElementById('res-table').innerHTML = renderTable(cols, rows, 'No resource usage recorded yet.');
}

async function renderReturns() {
  const main = document.getElementById('app-main');
  const branchId = CURRENT_USER.role === 'MANAGER' ? SELECTED_BRANCH : CURRENT_USER.branchId;
  const { data: returns, error } = await supabase.from('returns_view').select('*').eq('branch_id', branchId).order('created_at', { ascending: false });
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Returns ${branchSelectorHtml()}</h1><div class="panel">${renderTable([
    { key: 'product_id', label: 'Product' }, { key: 'quantity', label: 'Qty' }, { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status', render: (r) => badge(r.status, r.status === 'PENDING' ? 'yellow' : r.status === 'APPROVED' ? 'green' : 'red') },
    { key: 'actions', label: '', render: (r) => CURRENT_USER.role === 'MANAGER' && r.status === 'PENDING' ? `<button class="btn btn-success btn-sm" onclick="approveReturn('${r.id}')">Approve</button> <button class="btn btn-danger btn-sm" onclick="rejectReturn('${r.id}')">Reject</button>` : '—' }
  ], returns, 'No returns recorded yet.')}</div>`;
}
async function approveReturn(id) {
  const ok = await confirmDialog({ title: 'Approve This Return?', message: 'Stock will be restored to inventory.', icon: 'check', confirmLabel: 'Approve' });
  if (!ok) return;
  const { error } = await supabase.rpc('approve_return', { p_return_id: id });
  if (error) return toast(friendlyError(error), 'error');
  toast('Return approved, stock restored.', 'success'); renderReturns();
}
async function rejectReturn(id) {
  const ok = await confirmDialog({ title: 'Reject This Return?', icon: 'x', confirmLabel: 'Reject', danger: true });
  if (!ok) return;
  const { error } = await supabase.rpc('reject_return', { p_return_id: id });
  if (error) return toast(friendlyError(error), 'error');
  toast('Return rejected.', 'info'); renderReturns();
}

async function renderCashCollection() {
  const main = document.getElementById('app-main');
  const branchId = SELECTED_BRANCH;
  const [{ data: closings, error }, { data: collections }] = await Promise.all([
    supabase.from('daily_closings_view').select('*').eq('branch_id', branchId).order('business_date', { ascending: false }),
    supabase.from('cash_collections_view').select('*').eq('branch_id', branchId).order('business_date', { ascending: false })
  ]);
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Cash Collection ${branchSelectorHtml()}</h1><p class="page-sub">Manager-only. Record cash actually collected against each closed business day.</p>
    <div class="panel"><div class="panel-header"><h3>Closed Days Awaiting Collection</h3></div>
      ${renderTable([
        { key: 'business_date', label: 'Date' }, { key: 'expected_cash', label: 'Expected Cash', render: (r) => money(r.expected_cash) },
        { key: 'action', label: '', render: (r) => collections.some((c) => c.business_date === r.business_date) ? badge('Collected', 'green') : `<button class="btn btn-primary btn-sm" onclick="collectCash('${r.business_date}', ${r.expected_cash})">Record Collection</button>` }
      ], closings, 'No closed business days yet for this branch.')}
    </div>
    <div class="panel"><div class="panel-header"><h3>Collection History</h3></div>
      ${renderTable([
        { key: 'business_date', label: 'Date' }, { key: 'expected_cash', label: 'Expected', render: (r) => money(r.expected_cash) },
        { key: 'collected_amount', label: 'Collected', render: (r) => money(r.collected_amount) },
        { key: 'difference', label: 'Difference', render: (r) => `<span style="color:${r.difference == 0 ? 'var(--green)' : 'var(--red)'}">${money(r.difference)}</span>` }
      ], collections, 'No collections recorded yet.')}
    </div>`;
}
async function collectCash(date, expected) {
  const result = await promptDialog({
    title: 'Record Cash Collection', message: `Expected cash: ${money(expected)}`, icon: 'dollar', confirmLabel: 'Record Collection',
    fields: [{ id: 'amount', label: 'Amount Actually Collected', type: 'number', min: 0, value: expected }]
  });
  if (!result || result.amount === '') return;
  const { error } = await supabase.rpc('record_cash_collection', { p_branch_id: SELECTED_BRANCH, p_business_date: date, p_collected_amount: result.amount });
  if (error) return toast(friendlyError(error), 'error');
  toast('Cash collection recorded.', 'success'); renderCashCollection();
}

async function renderReports() {
  const main = document.getElementById('app-main');
  const { data: rows, error } = await supabase.from('product_report_view').select('*').order('revenue', { ascending: false });
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Product Report</h1><p class="page-sub">Revenue, cost and profit per product across all branches.</p>
    <div class="panel">${renderTable([
      { key: 'product', label: 'Product' }, { key: 'qty_sold', label: 'Qty Sold' },
      { key: 'revenue', label: 'Revenue', render: (r) => money(r.revenue) }, { key: 'cost', label: 'Cost', render: (r) => money(r.cost) },
      { key: 'profit', label: 'Profit', render: (r) => `<span style="color:${r.profit >= 0 ? 'var(--green)' : 'var(--red)'}">${money(r.profit)}</span>` }
    ], rows, 'No sales recorded yet.')}</div>`;
}

async function renderAudit() {
  const main = document.getElementById('app-main');
  const { data: logs, error } = await supabase.from('audit_logs_view').select('*');
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Audit Logs</h1><div class="panel">${renderTable([
    { key: 'created_at', label: 'Time', render: (r) => new Date(r.created_at).toLocaleString() },
    { key: 'username', label: 'User' }, { key: 'action', label: 'Action', render: (r) => badge(r.action, 'blue') },
    { key: 'entity', label: 'Entity' }, { key: 'details', label: 'Details', render: (r) => `<code style="font-size:.78rem">${escapeHtml(JSON.stringify(r.details))}</code>` }
  ], logs, 'No activity logged yet.')}</div>`;
}

async function renderSettings() {
  const main = document.getElementById('app-main');
  const { data: s, error } = await supabase.from('public_settings').select('*').single();
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Settings</h1><p class="page-sub">Configure business info shown on the public website. Nothing here is invented — fill in your real details.</p>
    <div class="panel"><form onsubmit="return submitSettings(event)">
      <div class="form-row">
        <label>Business Name<input id="s-businessName" value="${escapeHtml(s.business_name)}" /></label>
        <label>Currency<input id="s-currency" value="${escapeHtml(s.currency)}" /></label>
        <label>Phone<input id="s-phone" value="${escapeHtml(s.phone)}" /></label>
        <label>WhatsApp<input id="s-whatsapp" value="${escapeHtml(s.whatsapp)}" /></label>
        <label>Email<input id="s-email" value="${escapeHtml(s.email)}" /></label>
        <label>Office Address<input id="s-officeAddress" value="${escapeHtml(s.office_address)}" /></label>
        <label>Opening Hours<input id="s-openingHours" value="${escapeHtml(s.opening_hours)}" /></label>
        <label>Google Maps URL (Get Directions link)<input id="s-googleMapsUrl" value="${escapeHtml(s.google_maps_url)}" /></label>
        <label>Google Maps Embed URL (free, no API key)<input id="s-googleMapsEmbedUrl" value="${escapeHtml(s.google_maps_embed_url)}" /></label>
        <label>Default Low Stock Level<input id="s-lowStockDefault" type="number" value="10" /></label>
      </div>
      <p class="muted small">Tip: Google Maps → Share → Embed a map → copy the src="..." URL into the field above.</p>
      <button class="btn btn-primary" type="submit">Save Settings</button>
    </form></div>`;
}
async function submitSettings(e) {
  e.preventDefault();
  const payload = {};
  ['businessName', 'currency', 'phone', 'whatsapp', 'email', 'officeAddress', 'openingHours', 'googleMapsUrl', 'googleMapsEmbedUrl'].forEach((k) => { payload[k] = val(`s-${k}`); });
  payload.lowStockDefault = Number(val('s-lowStockDefault')) || 10;
  const { error } = await supabase.rpc('update_settings', { p_settings: payload });
  if (error) return toast(friendlyError(error), 'error');
  toast('Settings saved.', 'success');
  return false;
}

// ---------------------------------------------------------------------------
// CASHIER views
// ---------------------------------------------------------------------------
const cashierRenderers = {
  dashboard: renderCashierDashboard, pos: renderPOS, services: renderServices, resources: renderCashierResources,
  requests: renderCashierRequests, sales: renderSales, closing: renderDailyClosing, profile: renderProfile
};

async function renderCashierDashboard() {
  const main = document.getElementById('app-main');
  const { data: d, error } = await supabase.rpc('cashier_dashboard');
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">My Branch Dashboard</h1><div class="stat-grid">
    ${statCard("Today's Sales", money(d.todaysSales))}${statCard("Today's Service Income", money(d.todaysServiceIncome))}
    ${statCard('Transactions', d.transactionCount)}${statCard('Low Stock Alerts', d.lowStockItems, d.lowStockItems > 0)}
    ${statCard('Pending Requests', d.pendingRequests)}${statCard('Day Status', d.dayClosed ? 'Closed' : 'Open', d.dayClosed)}
  </div>`;
}

async function renderPOS() {
  const main = document.getElementById('app-main');
  main.innerHTML = `<h1 class="page-title">Point of Sale</h1>
    <input id="pos-search" placeholder="Search products…" style="width:100%;max-width:320px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:16px;min-height:44px;" oninput="posSearchDebounced(this.value)" />
    <div class="pos-layout"><div id="pos-grid" class="pos-grid"></div>
      <div class="pos-cart"><h3>Cart</h3><div id="cart-lines"></div>
        <div class="cart-total"><span>Total</span><span id="cart-total">${money(0)}</span></div>
        <button class="btn btn-primary btn-block" onclick="completeSale()">Complete Sale</button>
      </div></div>`;
  const { data } = await supabase.from('branch_inventory_view').select('*').eq('branch_id', CURRENT_USER.branchId).eq('type', 'FOR_SALE');
  window._posInventory = data || [];
  renderPosGrid('');
  renderCart();
}
const posSearchDebounced = debounce((q) => renderPosGrid(q), 150);
function renderPosGrid(query) {
  const items = (window._posInventory || []).filter((i) => i.name.toLowerCase().includes((query || '').toLowerCase()));
  document.getElementById('pos-grid').innerHTML = items.map((i) => `
    <div class="pos-item" onclick="addToCart('${i.product_id}','${escapeHtml(i.name)}',${i.selling_price},${i.quantity})">
      <div class="name">${escapeHtml(i.name)}</div><div class="price">${money(i.selling_price)}</div>
      <div class="stock">${i.quantity} ${i.unit} in stock${i.low_stock ? ' · LOW' : ''}</div>
    </div>`).join('') || `<div class="empty-state">No products found.</div>`;
}
function addToCart(productId, name, price, stock) {
  const existing = CART.find((c) => c.productId === productId);
  if (existing) { if (existing.quantity >= stock) return toast('No more stock available.', 'error'); existing.quantity += 1; }
  else CART.push({ productId, name, price, quantity: 1, stock });
  renderCart();
}
function changeCartQty(productId, delta) {
  const line = CART.find((c) => c.productId === productId);
  if (!line) return;
  line.quantity += delta;
  if (line.quantity <= 0) CART = CART.filter((c) => c.productId !== productId);
  else if (line.quantity > line.stock) { line.quantity = line.stock; toast('No more stock available.', 'error'); }
  renderCart();
}
function renderCart() {
  const box = document.getElementById('cart-lines');
  if (!box) return;
  box.innerHTML = CART.length ? CART.map((c) => `
    <div class="cart-line"><div>${escapeHtml(c.name)}<br><span class="muted small">${money(c.price)} each</span></div>
      <div class="cart-qty-controls"><button onclick="changeCartQty('${c.productId}',-1)">−</button><span>${c.quantity}</span><button onclick="changeCartQty('${c.productId}',1)">+</button></div>
    </div>`).join('') : `<p class="muted small">Cart is empty. Tap a product to add it.</p>`;
  document.getElementById('cart-total').textContent = money(CART.reduce((sum, c) => sum + c.price * c.quantity, 0));
}
async function completeSale() {
  if (!CART.length) return toast('Cart is empty.', 'error');
  const items = CART.map((c) => ({ productId: c.productId, quantity: c.quantity }));
  const clientTxnId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { data, error } = await supabase.rpc('create_sale', { p_items: items, p_client_txn_id: clientTxnId });
  if (error) return toast(friendlyError(error), 'error');
  toast(`Sale complete — Txn ${data.txnNumber} — ${money(data.total)}`, 'success');
  CART = [];
  renderPOS();
}

async function renderCashierResources() {
  const main = document.getElementById('app-main');
  const { data: inventory } = await supabase.from('branch_inventory_view').select('*').eq('branch_id', CURRENT_USER.branchId).eq('type', 'RESOURCE');
  main.innerHTML = `<h1 class="page-title">Record Resources Used</h1><p class="page-sub">Enter the quantity consumed while providing services today.</p>
    <div class="panel"><form onsubmit="return submitResourceUsage(event)">
      <div class="form-row"><label>Resource<select id="res-select">${(inventory || []).map((i) => `<option value="${i.product_id}">${escapeHtml(i.name)} (${i.quantity} ${i.unit} left)</option>`).join('')}</select></label>
      <label>Quantity Used<input id="res-qty" type="number" min="1" required /></label></div>
      <button class="btn btn-primary" type="submit">Record Usage</button></form></div>
    <div class="panel" id="res-usage-table">Loading…</div>`;
  const { data: rows } = await supabase.from('resource_usage_view').select('*').eq('branch_id', CURRENT_USER.branchId).order('created_at', { ascending: false });
  document.getElementById('res-usage-table').innerHTML = renderTable([
    { key: 'product_name', label: 'Resource' }, { key: 'quantity', label: 'Qty' },
    { key: 'created_at', label: 'Time', render: (r) => new Date(r.created_at).toLocaleString() }
  ], rows, 'No resource usage recorded yet.');
}
async function submitResourceUsage(e) {
  e.preventDefault();
  const { error } = await supabase.rpc('record_resource_usage', { p_product_id: val('res-select'), p_quantity: val('res-qty') });
  if (error) return toast(friendlyError(error), 'error');
  toast('Resource usage recorded.', 'success'); renderCashierResources();
  return false;
}

async function renderCashierRequests() {
  const main = document.getElementById('app-main');
  main.innerHTML = `<h1 class="page-title">Request a Product</h1><p class="page-sub">You set the selling price and quantity — the manager sets the buying price before approving.</p>
    <div class="panel"><form onsubmit="return submitProductRequest(event)">
      <div class="form-row"><label>Product Name<input id="req-name" required /></label><label>Suggested Selling Price<input id="req-price" type="number" min="0" required /></label>
      <label>Unit<input id="req-unit" value="piece" /></label><label>Quantity Needed<input id="req-qty" type="number" min="1" required /></label></div>
      <button class="btn btn-primary" type="submit">Submit Request</button></form></div>
    <div class="panel" id="req-table">Loading…</div>`;
  const { data: rows } = await supabase.from('product_requests_view').select('*').order('created_at', { ascending: false });
  document.getElementById('req-table').innerHTML = renderTable([
    { key: 'product_name', label: 'Product' }, { key: 'selling_price', label: 'Price', render: (r) => money(r.selling_price) },
    { key: 'status', label: 'Status', render: (r) => badge(r.status, r.status === 'PENDING' ? 'yellow' : r.status === 'APPROVED' ? 'green' : 'red') }
  ], rows, 'No requests submitted yet.');
}
async function submitProductRequest(e) {
  e.preventDefault();
  const { error } = await supabase.rpc('create_product_request', { p_product_name: val('req-name'), p_selling_price: val('req-price'), p_unit: val('req-unit'), p_quantity: val('req-qty') });
  if (error) return toast(friendlyError(error), 'error');
  toast('Request submitted.', 'success'); renderCashierRequests();
  return false;
}

async function renderDailyClosing() {
  const main = document.getElementById('app-main');
  const { data: d, error } = await supabase.rpc('cashier_dashboard');
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Daily Closing</h1><div class="panel">
    <p>Today's Product Sales: <strong>${money(d.todaysSales)}</strong></p>
    <p>Today's Service Income: <strong>${money(d.todaysServiceIncome)}</strong></p>
    <p>Expected Cash: <strong>${money(d.todaysSales + d.todaysServiceIncome)}</strong></p>
    ${d.dayClosed ? `<p>${badge('Day already closed', 'green')}</p>` : `<button class="btn btn-primary" onclick="closeDay()">Close Business Day</button>`}
  </div>`;
}
async function closeDay() {
  const ok = await confirmDialog({ title: "Close Today's Business Day?", message: "This finalizes today's totals and cannot be undone.", icon: 'clock', confirmLabel: 'Close Day' });
  if (!ok) return;
  const { error } = await supabase.rpc('close_daily');
  if (error) return toast(friendlyError(error), 'error');
  toast('Day closed successfully.', 'success'); renderDailyClosing();
}

// ---------------------------------------------------------------------------
// Expose everything referenced from inline onclick/onchange/oninput in the
// HTML strings above — required because this file is an ES module, and
// module-scope functions are not automatically globals.
// ---------------------------------------------------------------------------
Object.assign(window, {
  navigate, onBranchChange, closeAuthModal, renderAuthModal,
  submitBranch, submitUser, onUserRoleChange, toggleUser,
  submitProfileDetails, submitProfilePassword,
  submitProduct, submitAssign, approveRequest, rejectRequest, promptAdjust,
  submitService, toggleService, voidSale, collectCash, closeDay,
  approveReturn, rejectReturn, submitSettings,
  addToCart, changeCartQty, completeSale, submitResourceUsage, submitProductRequest,
  posSearchDebounced
});

document.addEventListener('DOMContentLoaded', () => {
  hydrateIcons();
  wireLanding();
  loadPublicSite();
  tryAutoLogin();
});
