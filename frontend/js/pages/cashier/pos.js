// js/pages/cashier/pos.js
import { supabase } from '../../supabase-client.js';
import { state } from '../../state.js';
import { escapeHtml, money, toast, friendlyError, debounce, resolveBranchId } from '../../ui.js';

export async function renderPOS() {
  const main = document.getElementById('app-main');
  const branchId = resolveBranchId(main);
  if (!branchId) return;
  main.innerHTML = `<h1 class="page-title">Point of Sale</h1>
    <input id="pos-search" placeholder="Search products…" class="pos-search" oninput="posSearchDebounced(this.value)" />
    <div class="pos-layout"><div id="pos-grid" class="pos-grid"><div class="loader-wrap"><div class="loader"></div></div></div>
      <div class="pos-cart"><h3>Cart</h3><div id="cart-lines"></div>
        <div class="cart-total"><span>Total</span><span id="cart-total">${money(0)}</span></div>
        <button class="btn btn-primary btn-block" onclick="completeSale()">Complete Sale</button>
      </div></div>`;
  const { data, error } = await supabase.from('branch_inventory_view').select('*').eq('branch_id', branchId).eq('type', 'FOR_SALE');
  if (error) throw error;
  state.posInventory = data || [];
  renderPosGrid('');
  renderCart();
}

const posSearchDebounced = debounce((q) => renderPosGrid(q), 150);

function renderPosGrid(query) {
  const items = state.posInventory.filter((i) => i.name.toLowerCase().includes((query || '').toLowerCase()));
  document.getElementById('pos-grid').innerHTML = items.map((i) => `
    <div class="pos-item" onclick="addToCart('${i.product_id}','${escapeHtml(i.name)}',${i.selling_price},${i.quantity})">
      <div class="name">${escapeHtml(i.name)}</div><div class="price">${money(i.selling_price)}</div>
      <div class="stock">${i.quantity} ${i.unit} in stock${i.low_stock ? ' · LOW' : ''}</div>
    </div>`).join('') || `<div class="empty-state">No products found.</div>`;
}

export function addToCart(productId, name, price, stock) {
  const existing = state.cart.find((c) => c.productId === productId);
  if (existing) { if (existing.quantity >= stock) return toast('No more stock available.', 'error'); existing.quantity += 1; }
  else state.cart.push({ productId, name, price, quantity: 1, stock });
  renderCart();
}

export function changeCartQty(productId, delta) {
  const line = state.cart.find((c) => c.productId === productId);
  if (!line) return;
  line.quantity += delta;
  if (line.quantity <= 0) state.cart = state.cart.filter((c) => c.productId !== productId);
  else if (line.quantity > line.stock) { line.quantity = line.stock; toast('No more stock available.', 'error'); }
  renderCart();
}

function renderCart() {
  const box = document.getElementById('cart-lines');
  if (!box) return;
  box.innerHTML = state.cart.length ? state.cart.map((c) => `
    <div class="cart-line"><div>${escapeHtml(c.name)}<br><span class="muted small">${money(c.price)} each</span></div>
      <div class="cart-qty-controls"><button onclick="changeCartQty('${c.productId}',-1)">−</button><span>${c.quantity}</span><button onclick="changeCartQty('${c.productId}',1)">+</button></div>
    </div>`).join('') : `<p class="muted small">Cart is empty. Tap a product to add it.</p>`;
  document.getElementById('cart-total').textContent = money(state.cart.reduce((sum, c) => sum + c.price * c.quantity, 0));
}

export async function completeSale() {
  if (!state.cart.length) return toast('Cart is empty.', 'error');
  const items = state.cart.map((c) => ({ productId: c.productId, quantity: c.quantity }));
  const clientTxnId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { data, error } = await supabase.rpc('create_sale', { p_items: items, p_client_txn_id: clientTxnId });
  if (error) return toast(friendlyError(error), 'error');
  toast(`Sale complete — Txn ${data.txnNumber} — ${money(data.total)}`, 'success');
  state.cart = [];
  renderPOS();
}

window.posSearchDebounced = posSearchDebounced;
window.addToCart = addToCart;
window.changeCartQty = changeCartQty;
window.completeSale = completeSale;
