document.addEventListener('DOMContentLoaded', async () => {
  const statsEl = document.getElementById('backtest-stats');
  const caveatEl = document.getElementById('backtest-caveat');
  const tableEl = document.getElementById('backtest-table');

  try {
    const metrics = await apiGet('/api/backtest');
    renderStats(statsEl, metrics);
    renderCaveat(caveatEl, metrics);
    renderTable(tableEl, metrics.backtest_rows || []);
  } catch (err) {
    renderError(statsEl, err);
    renderError(tableEl, err);
  }
});

function renderStats(el, m) {
  // Bias direction drives both the sign shown and the label - never
  // hardcode "+"/"Overestimation", read it from loocv_bias_direction.
  const isOver = m.loocv_bias_direction === 'overestimation';
  const isUnder = m.loocv_bias_direction === 'underestimation';
  const biasSign = isUnder ? '-' : isOver ? '+' : '';
  const biasLabel = isOver ? 'Overestimation Bias' : isUnder ? 'Underestimation Bias' : 'Bias';
  const biasValue = m.loocv_bias_pp === null || m.loocv_bias_pp === undefined
    ? 'N/A'
    : `${biasSign}${Math.abs(m.loocv_bias_pp).toFixed(2)} pp`;
  const biasClass = isOver ? 'gain-positive' : isUnder ? 'gain-negative' : '';

  const tiles = [
    { label: 'Sample Size', value: m.n_samples !== undefined && m.n_samples !== null ? `${m.n_samples} IPOs` : 'N/A' },
    { label: 'Directional Accuracy', value: formatPct(m.directional_accuracy_pct) },
    { label: 'Pearson r', value: m.loocv_pearson_r === null || m.loocv_pearson_r === undefined ? 'N/A' : m.loocv_pearson_r.toFixed(2) },
    { label: 'Mean Absolute Error', value: formatPP(m.loocv_mae_pp) },
    { label: biasLabel, value: biasValue, cls: biasClass },
  ];

  el.innerHTML = tiles.map(t => `
    <div class="stat-tile">
      <span class="metric-label">${escapeHtml(t.label)}</span>
      <span class="metric-value metric-value--small ${t.cls || ''}">${escapeHtml(t.value)}</span>
    </div>
  `).join('');
}

function renderCaveat(el, m) {
  el.innerHTML = `
    <div class="callout callout-accent">
      <strong>Directional Accuracy Definition:</strong> ${escapeHtml(formatText(m.directional_accuracy_definition))}
    </div>
    <div class="callout" style="margin-top: var(--space-3);">
      <strong>Statistical Caveat:</strong> Sample size is small (N=${escapeHtml(String(m.n_samples))}).
      Metrics are indicative rather than statistically conclusive. Actual listing performance may deviate significantly.
      Method: ${escapeHtml(formatText(m.method))}${m.alpha !== undefined && m.alpha !== null ? ` (alpha=${escapeHtml(String(m.alpha))})` : ''}.
    </div>
  `;
}

function renderTable(el, rows) {
  if (!rows || rows.length === 0) {
    el.innerHTML = '<div class="placeholder">No backtest rows available.</div>';
    return;
  }

  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>GMP Ratio</th>
            <th>Predicted Gain</th>
            <th>Actual Gain</th>
            <th>Error</th>
            <th>Correct Side</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${escapeHtml(formatText(r.company))}</td>
              <td>${escapeHtml(formatPct(r.gmp_ratio_pct))}</td>
              <td>${escapeHtml(formatPct(r.predicted_gain_pct))}</td>
              <td>${escapeHtml(formatPct(r.actual_gain_pct))}</td>
              <td>${escapeHtml(formatPP(r.error_pp))}</td>
              <td>${r.correct_side === true ? '<span class="badge badge-green">✓</span>' : r.correct_side === false ? '<span class="badge badge-red">✗</span>' : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
