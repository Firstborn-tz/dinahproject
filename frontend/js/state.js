// js/state.js
// A single shared, mutable state object. Every other module imports this
// same object and reads/writes its properties directly (e.g. `state.cart`)
// rather than each module keeping its own copy — that's what keeps the
// "current branch selected", "who's logged in", "what's in the cart" etc.
// in sync across every page file.

// localStorage only stores strings, so `localStorage.setItem(key, undefined)`
// anywhere (a bug, or an older version of this app) silently writes the
// literal 3-character string "undefined" - which is truthy in JS and slips
// past a plain `if (!value)` check, then hits Postgres exactly as
// 'invalid input syntax for type uuid: "undefined"'. Every read/write of a
// branch id goes through this pair of helpers so that can never happen again,
// including self-healing anyone who already has a poisoned value saved.
export function sanitizeId(value) {
  if (!value || value === 'undefined' || value === 'null') return null;
  return value;
}
export function saveSelectedBranch(id) {
  const clean = sanitizeId(id);
  if (clean) localStorage.setItem('dinah_selected_branch', clean);
  else localStorage.removeItem('dinah_selected_branch');
  return clean;
}

export const state = {
  currentUser: null,     // { id, email, role, branchId, fullName }
  settings: null,        // public business settings (name, currency, contact info...)
  branches: [],
  selectedBranch: sanitizeId(localStorage.getItem('dinah_selected_branch')),
  activeTab: 'dashboard',
  cart: [],              // POS cart: [{ productId, name, price, quantity, stock }]
  posInventory: []       // cached FOR_SALE inventory for the current POS session
};
