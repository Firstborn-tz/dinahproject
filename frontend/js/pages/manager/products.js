// js/pages/manager/products.js
import { supabase } from '../../supabase-client.js';
import { state } from '../../state.js';
import { escapeHtml, badge, renderTable, money, toast, friendlyError, val } from '../../ui.js';

export async function renderProducts() {
  const main = document.getElementById('app-main');
  const { data: products, error } = await supabase.from('products_view').select('*').order('name');
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Products</h1><p class="page-sub">Choose whether each product is bought as a carton/box or as individual items. For packs, the system calculates cost per item.</p>
    <div class="panel"><div class="panel-header"><h3>Add Product</h3></div>
      <form onsubmit="return submitProduct(event)">
        <div class="form-row">
          <label>Branch<select id="p-branch" required>${state.branches.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}</select></label>
          <label>Name<input id="p-name" required /></label>
          <label>Type<select id="p-type"><option value="FOR_SALE">For Sale</option><option value="RESOURCE">Resource (consumed by services)</option></select></label>
          <label>Buying format<select id="p-buy-mode" onchange="onProductBuyModeChange(this.value)"><option value="PACK">Packed together (carton / box)</option><option value="INDIVIDUAL">Individual items</option></select></label>
          <label>Category<input id="p-category" placeholder="e.g. Writing Materials" /></label>
          <label>Sellable unit<input id="p-unit" placeholder="piece / sheet" value="piece" /></label>
          <label><span id="p-buy-label">Buying price for one pack</span><input id="p-buy" type="number" min="0" step="0.01" required /></label>
          <label id="p-pack-wrap">Items in one pack<input id="p-pack" type="number" min="1" step="1" value="1" required /></label>
          <label>Quantity received (individual items)<input id="p-qty" type="number" min="0" step="1" value="0" required /></label>
          <label>Selling Price (blank for resources)<input id="p-sell" type="number" min="0" /></label>
        </div>
        <p class="muted small">Cost per item: <strong id="p-unit-cost">—</strong>. Set the selling price per item.</p>
        <button class="btn btn-primary" type="submit">Add Product</button>
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
  const updateCost = () => { const pack = Number(val('p-pack')); const total = Number(val('p-buy')); const out = document.getElementById('p-unit-cost'); if (out) out.textContent = pack > 0 ? money(total / pack) : '—'; };
  document.getElementById('p-pack').addEventListener('input', updateCost);
  document.getElementById('p-buy').addEventListener('input', updateCost);
  updateCost();
}

export async function submitProduct(e) {
  e.preventDefault();
  const { error } = await supabase.rpc('add_product_to_branch', { p_branch_id: val('p-branch'), p_name: val('p-name'), p_type: val('p-type'), p_category: val('p-category'), p_unit: val('p-unit'), p_purchase_total: val('p-buy'), p_items_per_pack: val('p-pack'), p_selling_price: val('p-sell') || 0, p_quantity: val('p-qty'), p_low_stock_level: null });
  if (error) { toast(friendlyError(error), 'error'); return false; }
  toast('Product added to the branch.', 'success');
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
  const wrap = document.getElementById('p-pack-wrap');
  const pack = document.getElementById('p-pack');
  if (wrap) wrap.style.display = packed ? '' : 'none';
  if (pack) { pack.required = packed; if (!packed) pack.value = '1'; }
  const label = document.getElementById('p-buy-label');
  if (label) label.textContent = packed ? 'Buying price for one pack' : 'Buying price per item';
  const output = document.getElementById('p-unit-cost');
  if (output) output.textContent = money(Number(val('p-buy')) / (packed ? Math.max(1, Number(val('p-pack'))) : 1));
}

window.submitProduct = submitProduct;
window.submitAssign = submitAssign;
window.onProductBuyModeChange = onProductBuyModeChange;
