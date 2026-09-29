// js/state.js
// A single shared, mutable state object. Every other module imports this
// same object and reads/writes its properties directly (e.g. `state.cart`)
// rather than each module keeping its own copy — that's what keeps the
// "current branch selected", "who's logged in", "what's in the cart" etc.
// in sync across every page file.

export const state = {
  currentUser: null,     // { id, email, role, branchId, fullName }
  settings: null,        // public business settings (name, currency, contact info...)
  branches: [],
  selectedBranch: localStorage.getItem('dinah_selected_branch') || null,
  activeTab: 'dashboard',
  cart: [],              // POS cart: [{ productId, name, price, quantity, stock }]
  posInventory: []       // cached FOR_SALE inventory for the current POS session
};
