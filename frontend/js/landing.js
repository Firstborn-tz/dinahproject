// js/landing.js
import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { icon } from './icons.js';
import { escapeHtml } from './ui.js';
import { toggleTheme } from './theme.js';

const WHATSAPP_NUMBER = '255763033181';
const WHATSAPP_DISPLAY = '+255 763 033 181';
const SHOP_LOCATION = 'Mnada Mpya, Dodoma, Tanzania';
const SERVICE_CARDS = [
  ['printer', 'Document printing', 'Print documents in black and white or colour, from school assignments to office paperwork.'],
  ['copy', 'Photocopying', 'Make clear copies of notes, forms, certificates and other important documents.'],
  ['keyboard', 'Typing and document preparation', 'Prepare, type and format letters, CVs, reports, applications and school work.'],
  ['scan', 'Scanning', 'Turn paper documents into digital files that are easy to save, share or submit.'],
  ['layers', 'Lamination', 'Protect frequently used documents, notices, cards and learning materials with lamination.'],
  ['book', 'Binding', 'Bind reports, projects, proposals and other multi-page documents for a neat finish.'],
  ['image', 'Photo printing', 'Print photos for personal use, school projects, displays and keepsakes.'],
  ['pencil', 'School and office stationery', 'Find everyday writing, paper, filing and office essentials for study and work.'],
  ['file-text', 'Document finishing', 'Get help preparing polished, organised documents ready to present or hand in.']
];

export function wireLandingNav() {
  const menu = document.getElementById('nav-links');
  const toggle = document.getElementById('hamburger');
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { menu.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
  });
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
  const { data } = await supabase.from('public_settings').select('*').single();
  state.settings = data || {};
  renderLocation();
  renderContact();
  renderPublicServices();
  wireScrollReveal();
}

function renderPublicServices() {
  const grid = document.getElementById('services-grid');
  grid.innerHTML = SERVICE_CARDS.map(([glyph, title, description]) => `
    <article class="card service-card reveal in-view">
      <div class="card-icon">${icon(glyph)}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
    </article>`).join('');
}

function renderLocation() {
  const wrap = document.getElementById('map-embed-wrap');
  const details = document.getElementById('location-details');
  const s = state.settings || {};
  const mapQuery = encodeURIComponent(SHOP_LOCATION);
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
  wrap.innerHTML = `<iframe src="https://www.google.com/maps?q=${mapQuery}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Map to Dinah Stationaries, Mnada Mpya, Dodoma"></iframe>`;
  details.innerHTML = `
    <p><strong>${escapeHtml(s.business_name || 'Dinah Stationaries')}</strong></p>
    <p>${icon('map-pin', 'icon-inline')}${escapeHtml(SHOP_LOCATION)}</p>
    <p>${icon('clock', 'icon-inline')}${escapeHtml(s.opening_hours || 'Contact us for current opening hours.')}</p>
    <p>${icon('phone', 'icon-inline')}<a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener noreferrer">${WHATSAPP_DISPLAY}</a></p>
    <a class="btn btn-primary" style="margin-top:10px" href="${directionsUrl}" target="_blank" rel="noopener noreferrer">Get Directions</a>`;
}

function renderContact() {
  const s = state.settings || {};
  document.getElementById('contact-grid').innerHTML = `
    <div class="card reveal in-view"><div class="card-icon">${icon('phone')}</div><h3>Call or WhatsApp</h3><p><a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener noreferrer">${WHATSAPP_DISPLAY}</a></p></div>
    <div class="card reveal in-view"><div class="card-icon">${icon('map-pin')}</div><h3>Visit the shop</h3><p>${escapeHtml(SHOP_LOCATION)}</p></div>
    <div class="card reveal in-view"><div class="card-icon">${icon('clock')}</div><h3>Opening hours</h3><p>${escapeHtml(s.opening_hours || 'Contact us for current opening hours.')}</p></div>
    ${s.email ? `<div class="card reveal in-view"><div class="card-icon">${icon('mail')}</div><h3>Email</h3><p><a href="mailto:${escapeHtml(s.email)}">${escapeHtml(s.email)}</a></p></div>` : ''}`;
}
