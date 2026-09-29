// js/pages/manager/audit.js
import { supabase } from '../../supabase-client.js';
import { renderTable, badge, escapeHtml } from '../../ui.js';

export async function renderAudit() {
  const main = document.getElementById('app-main');
  main.innerHTML = `<h1 class="page-title">Audit Logs</h1><div id="audit-table" class="panel"><div class="loader-wrap"><div class="loader"></div></div></div>`;
  const { data: logs, error } = await supabase.from('audit_logs_view').select('*');
  if (error) throw error;
  document.getElementById('audit-table').innerHTML = renderTable([
    { key: 'created_at', label: 'Time', render: (r) => new Date(r.created_at).toLocaleString() },
    { key: 'username', label: 'User' }, { key: 'action', label: 'Action', render: (r) => badge(r.action, 'blue') },
    { key: 'entity', label: 'Entity' }, { key: 'details', label: 'Details', render: (r) => `<code style="font-size:.78rem">${escapeHtml(JSON.stringify(r.details))}</code>` }
  ], logs, 'No activity logged yet.');
}
