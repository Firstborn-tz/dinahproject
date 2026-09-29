// js/pages/manager/settings.js
import { supabase } from '../../supabase-client.js';
import { escapeHtml, toast, friendlyError, val } from '../../ui.js';

export async function renderSettings() {
  const main = document.getElementById('app-main');
  main.innerHTML = `<h1 class="page-title">Settings</h1><div id="settings-body"><div class="loader-wrap"><div class="loader"></div></div></div>`;
  const { data: s, error } = await supabase.from('public_settings').select('*').single();
  if (error) throw error;
  document.getElementById('settings-body').innerHTML = `<p class="page-sub">Configure business info shown on the public website. Nothing here is invented — fill in your real details.</p>
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
      <p class="muted small">Tip: Google Maps → Share → Embed a map → copy the src="..." URL into the field above. This is your main office location — each branch also has its own map link under <strong>Branches</strong>.</p>
      <button class="btn btn-primary" type="submit">Save Settings</button>
    </form></div>`;
}

export async function submitSettings(e) {
  e.preventDefault();
  const payload = {};
  ['businessName', 'currency', 'phone', 'whatsapp', 'email', 'officeAddress', 'openingHours', 'googleMapsUrl', 'googleMapsEmbedUrl'].forEach((k) => { payload[k] = val(`s-${k}`); });
  payload.lowStockDefault = Number(val('s-lowStockDefault')) || 10;
  const { error } = await supabase.rpc('update_settings', { p_settings: payload });
  if (error) return toast(friendlyError(error), 'error');
  toast('Settings saved.', 'success');
  return false;
}

window.submitSettings = submitSettings;
