document.addEventListener('DOMContentLoaded', async () => {
  const hierarchyEl = document.getElementById('source-hierarchy');
  const tableEl = document.getElementById('traceability-table');

  try {
    const data = await apiGet('/api/data-sources');
    renderHierarchy(hierarchyEl, data.hierarchy || []);
    renderTraceability(tableEl, data.ipos || []);
  } catch (err) {
    renderError(hierarchyEl, err);
    renderError(tableEl, err);
  }
});

function renderHierarchy(el, hierarchy) {
  if (!hierarchy || hierarchy.length === 0) {
    el.innerHTML = '<div class="placeholder">No source hierarchy data available.</div>';
    return;
  }
  el.innerHTML = `
    <div class="card-list">
      ${hierarchy.map(tier => `
        <div class="glass-card">
          <h3>${escapeHtml(formatText(tier.tier))}</h3>
          <ul style="margin: 0; padding-left: 1.2em; color: var(--text-secondary);">
            ${(tier.sources || []).map(s => `<li>${escapeHtml(s)}</li>`).join('')}
          </ul>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTraceability(el, ipos) {
  if (!ipos || ipos.length === 0) {
    el.innerHTML = '<div class="placeholder">No traceability data available.</div>';
    return;
  }
  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Company</th><th>GMP Source</th><th>Timestamp</th><th>Health</th></tr>
        </thead>
        <tbody>
          ${ipos.map(r => `
            <tr>
              <td>${escapeHtml(formatText(r.company))}</td>
              <td>${escapeHtml(formatText(r.gmp_source))}</td>
              <td>${escapeHtml(formatText(r.gmp_timestamp))}</td>
              <td><span class="badge ${badgeClass(r.gmp_health)}">${escapeHtml(formatText(r.gmp_health))}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
