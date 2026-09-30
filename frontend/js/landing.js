// js/landing.js
import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { icon } from './icons.js';
import { escapeHtml, money } from './ui.js';
import { toggleTheme } from './theme.js';

const SERVICE_ICONS = { Printing: 'printer', Photocopying: 'copy', 'Photo Printing': 'image', Lamination: 'layers', Binding: 'book', Typing: 'keyboard', Scanning: 'scan' };
const PRODUCT_ICONS = { 'Writing Materials': 'pencil', 'Paper Products': 'file-text', 'Filing & Organization': 'folder', 'Office Supplies': 'paperclip', Technology: 'hard-drive' };

export function wireLandingNav() {
  document.getElementById('hamburger').addEventListener('click', () => document.getElementById('nav-links').classList.toggle('open'));
  document.getElementById('nav-theme-toggle')?.addEventListener('click', toggleTheme);
}

export function wireScrollReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

export async function loadPublicSite() {
  document.getElementById('footer-year').textContent = new Date().getFullYear();

  // Speed: fire all four requests at the same time instead of one after
  // another (they were previously sequential, so total load time was the
  // SUM of every request; now it is only the slowest single one).
  const [settingsRes, productsRes, servicesRes, branchesRes] = await Promise.allSettled([
    supabase.from('public_settings').select('*').single(),
    supabase.from('public_products').select('*').limit(8),
    supabase.from('public_services').select('*'),
    supabase.from('public_branches').select('*').order('name')
  ]);

  const ok = (r) => (r.status === 'fulfilled' && !r.value.error ? r.value.data : null);
  state.settings = ok(settingsRes);
  renderLocation();
  renderContact();
  renderPublicProducts(ok(productsRes) || []);
  renderPublicServices(ok(servicesRes) || []);
  renderBranchCards(ok(branchesRes) || []);
  wireScrollReveal();
}

function renderBranchCards(branches) {
  const grid = document.getElementById('branches-grid');
  if (!grid) return;
  if (!branches.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Our branch locations will appear here soon.</div>`;
    return;
  }
  grid.innerHTML = branches.map((b) => `
    <div class="card branch-card reveal in-view">
      <div class="card-icon">${icon('map-pin')}</div>
      <h3>${escapeHtml(b.name)}</h3>
      <p>${escapeHtml(b.address || 'Visit us in store')}</p>
      ${b.map_url ? `<a class="btn btn-primary btn-sm branch-map-btn" href="${escapeHtml(b.map_url)}" target="_blank" rel="noopener">${icon('map-pin')} View on Map</a>` : ''}
    </div>`).join('');
}

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
  const s = state.settings || {};
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
  const s = state.settings || {};
  document.getElementById('contact-grid').innerHTML = `
    <div class="card reveal in-view"><div class="card-icon">${icon('phone')}</div><h3>Phone</h3><p>${escapeHtml(s.phone || 'Coming soon')}</p></div>
    <div class="card reveal in-view"><div class="card-icon">${icon('message-circle')}</div><h3>WhatsApp</h3><p>${escapeHtml(s.whatsapp || 'Coming soon')}</p></div>
    <div class="card reveal in-view"><div class="card-icon">${icon('mail')}</div><h3>Email</h3><p>${escapeHtml(s.email || 'Coming soon')}</p></div>
    <div class="card reveal in-view"><div class="card-icon">${icon('clock')}</div><h3>Opening Hours</h3><p>${escapeHtml(s.opening_hours || 'Coming soon')}</p></div>`;
}
