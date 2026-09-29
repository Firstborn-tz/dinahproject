// js/pages/cashier/daily-closing.js
import { supabase } from '../../supabase-client.js';
import { money, badge, toast, friendlyError, confirmDialog } from '../../ui.js';

export async function renderDailyClosing() {
  const main = document.getElementById('app-main');
  const { data: d, error } = await supabase.rpc('cashier_dashboard');
  if (error) throw error;
  main.innerHTML = `<h1 class="page-title">Daily Closing</h1><div class="panel">
    <p>Today's Product Sales: <strong>${money(d.todaysSales)}</strong></p>
    <p>Today's Service Income: <strong>${money(d.todaysServiceIncome)}</strong></p>
    <p>Expected Cash: <strong>${money(d.todaysSales + d.todaysServiceIncome)}</strong></p>
    ${d.dayClosed ? `<p>${badge('Day already closed', 'green')}</p>` : `<button class="btn btn-primary" onclick="closeDay()">Close Business Day</button>`}
  </div>`;
}

export async function closeDay() {
  const ok = await confirmDialog({ title: "Close Today's Business Day?", message: "This finalizes today's totals and cannot be undone.", icon: 'clock', confirmLabel: 'Close Day' });
  if (!ok) return;
  const { error } = await supabase.rpc('close_daily');
  if (error) return toast(friendlyError(error), 'error');
  toast('Day closed successfully.', 'success'); renderDailyClosing();
}

window.closeDay = closeDay;
