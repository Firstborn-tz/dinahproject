// js/pages/manager/products.js
import { supabase } from '../../supabase-client.js';
import { state } from '../../state.js';
import { escapeHtml, badge, renderTable, money, toast, friendlyError, val } from '../../ui.js';

export async function renderProducts() {
  const main = document.getElementById('app-main');
  const { data: products, error } = await supabase.from('products_view').select('*').order('name');
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Products</h1><p class="page-sub">Add stock directly to a branch. For packed products, enter the cost and item count for one pack; stock is recorded as individual units.</p>
    <div class="panel intake-panel"><div class="panel-header"><div><h3>Add Product to Branch</h3><p class="muted small">Choose how it is purchased. Cost per item and stock quantity update automatically.</p></div></div>
      <form class="intake-form" onsubmit="return submitProduct(event)">
        <div class="intake-mode-row">
          <label class="intake-mode-field">Purchase format<select id="p-buy-mode" onchange="onProductBuyModeChange(this.value)"><option value="PACK">Packed together (box / carton)</option><option value="INDIVIDUAL">Individual items</option></select></label>
          <div class="intake-format-note" id="p-format-note">Enter the cost for one box, how many items it contains, and how many boxes were received.</div>
        </div>
        <div class="intake-fields">
          <label>Product name<input id="p-name" autocomplete="off" required /></label>
          <label>Branch<select id="p-branch" required>${state.branches.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}</select></label>
          <label>Product kind<select id="p-type"><option value="FOR_SALE">For sale</option><option value="RESOURCE">Resource used by services</option></select></label>
          <label>Item name<input id="p-unit" value="piece" placeholder="e.g. pen, sheet" required /></label>
          <label><span id="p-buy-label">Cost for one box</span><input id="p-buy" type="number" min="0" step="0.01" required inputmode="decimal" /></label>
          <label id="p-pack-wrap">Items in one box<input id="p-pack" type="number" min="1" step="1" value="1" required inputmode="numeric" /></label>
          <label id="p-pack-count-wrap">Number of boxes received<input id="p-pack-count" type="number" min="1" step="1" value="1" required inputmode="numeric" /></label>
          <label id="p-individual-qty-wrap" class="hidden">Number of items received<input id="p-individual-qty" type="number" min="1" step="1" value="1" inputmode="numeric" /></label>
          <label id="p-sell-wrap">Selling price per item<input id="p-sell" type="number" min="0.01" step="0.01" required inputmode="decimal" /></label>
        </div>
        <div class="intake-summary" aria-live="polite">
          <div><span>Cost per item</span><strong id="p-unit-cost">—</strong></div>
          <div><span>Stock added to branch</span><strong id="p-stock-total">1 piece</strong></div>
        </div>
        <div class="intake-actions"><button class="btn btn-primary" type="submit">Add to Branch Inventory</button></div>
      </form>
    </div>
    <div class="panel"><div class="panel-header"><h3>Product Catalogue</h3></div>
      ${renderTable([
        { key: 'name', label: 'Name' }, { key: 'type', label: 'Type', render: (r) => badge(r.type === 'FOR_SALE' ? 'For sale' : 'Resource', r.type === 'FOR_SALE' ? 'blue' : 'yellow') },
        { key: 'unit', label: 'Item' },
        { key: 'buying_price', label: 'Cost per item', render: (r) => money(r.buying_price) },
        { key: 'selling_price', label: 'Selling price / item', render: (r) => r.type === 'FOR_SALE' ? money(r.selling_price) : '—' }
      ], products)}
    </div>`;

  ['p-buy', 'p-pack', 'p-pack-count', 'p-individual-qty', 'p-unit'].forEach((id) => document.getElementById(id).addEventListener('input', updateProductPreview));
  document.getElementById('p-type').addEventListener('change', updateProductKindFields);
  updateProductPreview();
  updateProductKindFields();
}

function updateProductPreview() {
  const packed = val('p-buy-mode') === 'PACK';
  const itemsPerPack = packed ? Math.max(1, Number(val('p-pack')) || 1) : 1;
  const packCount = packed ? Math.max(0, Number(val('p-pack-count')) || 0) : 0;
  const individualCount = packed ? 0 : Math.max(0, Number(val('p-individual-qty')) || 0);
  const unitCost = (Number(val('p-buy')) || 0) / itemsPerPack;
  const count = (itemsPerPack * packCount) + individualCount;
  const cost = document.getElementById('p-unit-cost');
  const stock = document.getElementById('p-stock-total');
  if (cost) cost.textContent = money(unitCost);
  if (stock) stock.textContent = `${count.toLocaleString()} ${val('p-unit') || 'item'}${count === 1 ? '' : 's'}`;
}

function updateProductKindFields() {
  const isForSale = val('p-type') === 'FOR_SALE';
  const label = document.getElementById('p-sell-wrap');
  const sell = document.getElementById('p-sell');
  if (label) label.classList.toggle('hidden', !isForSale);
  if (sell) sell.required = isForSale;
}

export async function submitProduct(e) {
  e.preventDefault();
  const packed = val('p-buy-mode') === 'PACK';
  const itemsPerPack = packed ? Number(val('p-pack')) : 1;
  const quantity = packed ? itemsPerPack * Number(val('p-pack-count')) : Number(val('p-individual-qty'));
  if (!Number.isInteger(quantity) || quantity < 1) { toast('Enter a valid number of items or packs received.', 'error'); return false; }
  const { error } = await supabase.rpc('add_product_to_branch', {
    p_branch_id: val('p-branch'), p_name: val('p-name'), p_type: val('p-type'), p_category: 'General', p_unit: val('p-unit'),
    p_purchase_total: val('p-buy'), p_items_per_pack: itemsPerPack, p_selling_price: val('p-sell') || 0,
    p_quantity: quantity, p_low_stock_level: null
  });
  if (error) { toast(friendlyError(error), 'error'); return false; }
  toast('Product added to branch inventory.', 'success');
  renderProducts();
  return false;
}

export async function submitAssign(e) {
  e.preventDefault();
  const { error } = await supabase.rpc('assign_product_to_branch', { p_branch_id: val('a-branch'), p_product_id: val('a-product'), p_quantity: val('a-qty'), p_low_stock_level: val('a-low') || null });
  if (error) { toast(friendlyError(error), 'error'); return false; }
  toast('Assigned to branch.', 'success');
  renderProducts();
  return false;
}

export function onProductBuyModeChange(mode) {
  const packed = mode === 'PACK';
  document.getElementById('p-pack-wrap')?.classList.toggle('hidden', !packed);
  document.getElementById('p-pack-count-wrap')?.classList.toggle('hidden', !packed);
  document.getElementById('p-individual-qty-wrap')?.classList.toggle('hidden', packed);
  const pack = document.getElementById('p-pack');
  const boxes = document.getElementById('p-pack-count');
  const items = document.getElementById('p-individual-qty');
  if (pack) pack.required = packed;
  if (boxes) boxes.required = packed;
  if (items) items.required = !packed;
  const label = document.getElementById('p-buy-label');
  if (label) label.textContent = packed ? 'Cost for one box' : 'Buying cost per item';
  const note = document.getElementById('p-format-note');
  if (note) note.textContent = packed
    ? 'Enter the cost for one box, how many items it contains, and how many boxes were received.'
    : 'Enter the cost and quantity for individual items received.';
  updateProductPreview();
}

window.submitProduct = submitProduct;
window.submitAssign = submitAssign;
window.onProductBuyModeChange = onProductBuyModeChange;
