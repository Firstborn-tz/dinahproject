// js/layout.js
// The authenticated app shell: builds the sidebar and topbar, and routes
// each sidebar tab to its own page file under js/pages/.
import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { icon } from './icons.js';
import { escapeHtml, toast } from './ui.js';
import { toggleTheme, updateThemeToggleIcons } from './theme.js';

import { renderManagerDashboard } from './pages/manager/dashboard.js';
import { renderBranches } from './pages/manager/branches.js';
import { renderUsers } from './pages/manager/users.js';
import { renderProducts } from './pages/manager/products.js';
import { renderRequests } from './pages/manager/requests.js';
import { renderInventory } from './pages/manager/inventory.js';
import { renderResources } from './pages/manager/resources.js';
import { renderReturns } from './pages/manager/returns.js';
import { renderCashCollection } from './pages/manager/cash-collection.js';
import { renderReports } from './pages/manager/reports.js';
import { renderAudit } from './pages/manager/audit.js';
import { renderSettings } from './pages/manager/settings.js';
import { renderServices } from './pages/shared/services.js';
import { renderSales } from './pages/shared/sales.js';
import { renderProfile } from './pages/shared/profile.js';
import { renderCashierDashboard } from './pages/cashier/dashboard.js';
import { renderPOS } from './pages/cashier/pos.js';
import { renderCashierResources } from './pages/cashier/resources.js';
import { renderCashierRequests } from './pages/cashier/requests.js';
import { renderDailyClosing } from './pages/cashier/daily-closing.js';

// ---- Tab -> page registries (one sidebar tab = one page file) ----
const managerRenderers = {
  dashboard: renderManagerDashboard, branches: renderBranches, users: renderUsers, products: renderProducts,
  requests: renderRequests, inventory: renderInventory, services: renderServices, sales: renderSales,
  resources: renderResources, returns: renderReturns, cash: renderCashCollection, reports: renderReports,
  audit: renderAudit, profile: renderProfile, settings: renderSettings
};
const cashierRenderers = {
  dashboard: renderCashierDashboard, pos: renderPOS, services: renderServices, resources: renderCashierResources,
  requests: renderCashierRequests, sales: renderSales, closing: renderDailyClosing, profile: renderProfile
};

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

// ---- Enter the app after a successful login / session restore ----
export async function enterApp() {
  const { data: profile, error } = await supabase.from('my_profile_view').select('*').single();
  if (error || !profile) { toast('Could not load your account. Please try logging in again.', 'error'); await supabase.auth.signOut(); return; }
  if (!profile.active) { toast('Your account has been deactivated. Contact your manager.', 'error'); await supabase.auth.signOut(); return; }

  state.currentUser = { id: profile.id, email: profile.email, role: profile.role, branchId: profile.branch_id, fullName: profile.full_name };

  document.getElementById('public-site').classList.add('hidden');
  document.getElementById('app-view').classList.remove('hidden');
  buildUserMenu();
  updateSyncBadge();
  window.addEventListener('online', updateSyncBadge);
  window.addEventListener('offline', updateSyncBadge);
  wireShellControls();

  const { data: branches } = await supabase.from('branches_view').select('*').order('name');
  state.branches = branches || [];

  if (state.currentUser.role === 'MANAGER') {
    // Never leave this undefined: a stale/missing id is exactly what caused
    // 'invalid input syntax for type uuid: "undefined"'. Fall back to the
    // first real branch, or null when there are none yet.
    const stillValid = state.branches.some((b) => b.id === state.selectedBranch);
    state.selectedBranch = stillValid ? state.selectedBranch : (state.branches[0]?.id || null);
  } else {
    state.selectedBranch = state.currentUser.branchId || null;
  }

  buildSidebar();
  navigate('dashboard');
}

export function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

export function buildUserMenu() {
  const u = state.currentUser;
  document.getElementById('user-menu').innerHTML = `
    <button class="dropdown-trigger" onclick="toggleDropdown(this)">
      <span class="avatar-badge">${escapeHtml(initials(u.fullName || u.email))}</span>
      <span class="dropdown-name">${escapeHtml(u.fullName || u.email)}</span>
      ${icon('chevron-down', 'icon chevron')}
    </button>
    <div class="dropdown-menu">
      <div class="dropdown-menu-label">${escapeHtml(u.role === 'MANAGER' ? 'Admin' : 'Cashier')} · ${escapeHtml(u.email)}</div>
      <div class="dropdown-menu-divider"></div>
      <button class="dropdown-item" onclick="navigate('profile');closeAllDropdowns();">${icon('user')}My Profile</button>
      <div class="dropdown-menu-divider"></div>
      <button class="dropdown-item danger" onclick="logout()">${icon('log-out')}Logout</button>
    </div>`;
}

function wireShellControls() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('app-sidebar');
  const scrim = document.getElementById('sidebar-scrim');
  const themeBtn = document.getElementById('app-theme-toggle');
  if (!toggleBtn.dataset.wired) {
    toggleBtn.dataset.wired = '1';
    const setOpen = (open) => { sidebar.classList.toggle('open', open); scrim.classList.toggle('show', open); };
    toggleBtn.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
    scrim.addEventListener('click', () => setOpen(false));
  }
  if (themeBtn && !themeBtn.dataset.wired) {
    themeBtn.dataset.wired = '1';
    themeBtn.addEventListener('click', toggleTheme);
  }
  updateThemeToggleIcons();
}

function updateSyncBadge() {
  const el = document.getElementById('sync-status');
  if (navigator.onLine) { el.textContent = '● Online'; el.classList.remove('offline'); }
  else { el.textContent = '● Offline'; el.classList.add('offline'); }
}

export function buildSidebar() {
  const tabs = state.currentUser.role === 'MANAGER' ? MANAGER_TABS : CASHIER_TABS;
  document.getElementById('app-sidebar').innerHTML = tabs.map(([key, label, iconName]) => `<button data-tab="${key}" onclick="navigate('${key}')">${icon(iconName)}<span>${label}</span></button>`).join('');
}

// A counter so a slow response from a previous tab can't overwrite the page
// the user has already moved on to (which looked like "loads, then flashes an error").
let navToken = 0;

export function navigate(tab) {
  state.activeTab = tab;
  const token = ++navToken;
  document.querySelectorAll('#app-sidebar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('app-sidebar').classList.remove('open');
  document.getElementById('sidebar-scrim').classList.remove('show');
  const main = document.getElementById('app-main');
  main.innerHTML = `<div class="loader-wrap"><div class="loader"></div></div>`;

  const renderer = (state.currentUser.role === 'MANAGER' ? managerRenderers : cashierRenderers)[tab];
  if (!renderer) { main.innerHTML = `<div class="empty-state">Not implemented yet.</div>`; return; }
  Promise.resolve(renderer()).catch((e) => {
    if (token !== navToken) return; // user already navigated elsewhere
    main.innerHTML = `<div class="empty-state">${escapeHtml(e?.message || 'Something went wrong loading this page.')}</div>`;
  });
}

// Branch dropdown shown at the top of branch-scoped manager pages.
export function branchSelectorHtml() {
  if (state.currentUser.role !== 'MANAGER') return '';
  if (!state.branches.length) return `<select class="select-branch" disabled><option>No branches yet</option></select>`;
  return `<select class="select-branch" onchange="onBranchChange(this.value)">${state.branches.map((b) => `<option value="${b.id}" ${b.id === state.selectedBranch ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}</select>`;
}

export function onBranchChange(id) {
  state.selectedBranch = id;
  localStorage.setItem('dinah_selected_branch', id);
  navigate(state.activeTab);
}

window.navigate = navigate;
window.onBranchChange = onBranchChange;
