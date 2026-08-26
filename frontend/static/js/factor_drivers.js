document.addEventListener('DOMContentLoaded', async () => {
  const noteEl = document.getElementById('factor-note');
  const tableEl = document.getElementById('factor-table');

  try {
    const data = await apiGet('/api/factor-drivers');
    renderNote(noteEl, data);
    renderTable(tableEl, data.factors || []);
  } catch (err) {
    renderError(noteEl, err);
    renderError(tableEl, err);
  }
});

const LABELS = {
  gmp_ratio: 'GMP Ratio',
  qib_subscription: 'QIB Subscription',
  nii_subscription: 'NII Subscription',
  pe_discount: 'P/E Discount vs Peer',
  roe_pct: 'ROE',
  fresh_issue_ratio_pct: 'Fresh Issue Ratio',
};

function renderNote(el, data) {
  el.innerHTML = `
    <div class="callout callout-accent">
      <strong>Backtested vs. Literature-Cited:</strong> ${escapeHtml(formatText(data.note))}
    </div>
    <p class="inline-note" style="margin-top: var(--space-2);">
      Non-GMP overlay is capped at ±${escapeHtml(formatText(data.overlay_max_swing_pp !== undefined ? String(data.overlay_max_swing_pp) : null))} percentage points.
    </p>
  `;
}

function renderTable(el, factors) {
  if (!factors || factors.length === 0) {
    el.innerHTML = '<div class="placeholder">No factor data available.</div>';
    return;
  }

  const totalPts = factors.reduce((sum, f) => sum + (f.weight_pts || 0), 0);

  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Factor Component</th><th>Model Weight (Pts)</th><th>Description</th></tr>
        </thead>
        <tbody>
          ${factors.map(f => `
            <tr>
              <td>${escapeHtml(LABELS[f.key] || f.key)}</td>
              <td>${escapeHtml(f.weight_pts === null || f.weight_pts === undefined ? 'N/A' : f.weight_pts.toFixed(1))}</td>
              <td>${escapeHtml(formatText(f.description))}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr><td>Total</td><td>${escapeHtml(totalPts.toFixed(1))}</td><td></td></tr>
        </tfoot>
      </table>
    </div>
  `;
}
