// js/pages/manager/cash-collection.js
import { supabase } from '../../supabase-client.js';
import { state } from '../../state.js';
import { renderTable, money, badge, toast, friendlyError, resolveBranchId, promptDialog } from '../../ui.js';
import { branchSelectorHtml } from '../../layout.js';

export async function renderCashCollection() {
  const main = document.getElementById('app-main');
  main.innerHTML = `<h1 class="page-title">Cash Collection ${branchSelectorHtml()}</h1><p class="page-sub">Manager-only. Record cash actually collected against each closed business day.</p><div id="cash-body"></div>`;
  const branchId = resolveBranchId(main);
  if (!branchId) return;
  document.getElementById('cash-body').innerHTML = `<div class="loader-wrap"><div class="loader"></div></div>`;
  const [{ data: closings, error }, { data: collections }] = await Promise.all([
    supabase.from('daily_closings_view').select('*').eq('branch_id', branchId).order('business_date', { ascending: false }),
    supabase.from('cash_collections_view').select('*').eq('branch_id', branchId).order('business_date', { ascending: false })
  ]);
  if (error) throw error;
  state.lastCashCollections = collections || [];
  document.getElementById('cash-body').innerHTML = `
    <div class="panel"><div class="panel-header"><h3>Closed Days Awaiting Collection</h3></div>
      ${renderTable([
        { key: 'business_date', label: 'Date' }, { key: 'expected_cash', label: 'Expected Cash', render: (r) => money(r.expected_cash) },
        { key: 'action', label: '', render: (r) => (collections || []).some((c) => c.business_date === r.business_date) ? '<span class="badge badge-green">Collected</span>' : `<button class="btn btn-primary btn-sm" onclick="collectCash('${r.business_date}', ${r.expected_cash})">Record Collection</button>` }
      ], closings, 'No closed business days yet for this branch.')}
    </div>
    <div class="panel"><div class="panel-header"><h3>Collection History</h3></div>
      ${renderTable([
        { key: 'business_date', label: 'Date' }, { key: 'expected_cash', label: 'Expected', render: (r) => money(r.expected_cash) },
        { key: 'collected_amount', label: 'Collected', render: (r) => money(r.collected_amount) },
        { key: 'difference', label: 'Difference', render: (r) => `<span style="color:${r.difference == 0 ? 'var(--success-ink)' : 'var(--danger-ink)'}">${money(r.difference)}</span>` }
      ], collections, 'No collections recorded yet.')}
    </div>`;
}

export async function collectCash(date, expected) {
  const branchId = resolveBranchId(document.getElementById('app-main'));
  if (!branchId) return;
  const result = await promptDialog({
    title: 'Record Cash Collection', message: `Expected cash: ${money(expected)}`, icon: 'dollar', confirmLabel: 'Record Collection',
    fields: [{ id: 'amount', label: 'Amount Actually Collected', type: 'number', min: 0, value: expected }]
  });
  if (!result || result.amount === '') return;
  const { error } = await supabase.rpc('record_cash_collection', { p_branch_id: branchId, p_business_date: date, p_collected_amount: result.amount });
  if (error) return toast(friendlyError(error), 'error');
  toast('Cash collection recorded.', 'success'); renderCashCollection();
}

window.collectCash = collectCash;
