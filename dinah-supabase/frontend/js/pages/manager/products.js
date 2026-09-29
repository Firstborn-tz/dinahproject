// js/pages/manager/products.js
import { supabase } from '../../supabase-client.js';
import { state } from '../../state.js';
import { escapeHtml, badge, renderTable, money, toast, friendlyError, val } from '../../ui.js';

export async function renderProducts() {
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
      ${state.branches.length ? `<form onsubmit="return submitAssign(event)">
        <div class="form-row">
          <label>Branch<select id="a-branch">${state.branches.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}</select></label>
          <label>Product<select id="a-product">${products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select></label>
          <label>Opening Quantity<input id="a-qty" type="number" min="0" value="0" /></label>
          <label>Low Stock Level (blank = default)<input id="a-low" type="number" min="0" /></label>
        </div>
        <button class="btn btn-primary" type="submit">Assign to Branch</button>
      </form>` : `<p class="muted">Create a branch first under <strong>Branches</strong> before assigning products.</p>`}
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

export async function submitProduct(e) {
  e.preventDefault();
  const { error } = await supabase.rpc('create_product', { p_name: val('p-name'), p_type: val('p-type'), p_category: val('p-category'), p_unit: val('p-unit'), p_buying_price: val('p-buy'), p_selling_price: val('p-sell') || 0 });
  if (error) { toast(friendlyError(error), 'error'); return false; }
  toast('Product created. Now assign it to a branch below.', 'success');
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

window.submitProduct = submitProduct;
window.submitAssign = submitAssign;
