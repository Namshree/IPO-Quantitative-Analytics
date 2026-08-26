document.addEventListener('DOMContentLoaded', async () => {
  const statsEl = document.getElementById('headline-stats');
  const rankingEl = document.getElementById('ipo-ranking');

  try {
    const data = await apiGet('/api/overview');
    renderHeadline(statsEl, data.headline);
    renderRanking(rankingEl, data.ipos);
  } catch (err) {
    renderError(statsEl, err);
    renderError(rankingEl, err);
  }
});

function renderHeadline(el, h) {
  const tiles = [
    { label: 'Tracked IPOs', value: isNil(h.tracked_ipos) ? 'N/A' : String(h.tracked_ipos) },
    { label: 'Highest Model Score', value: formatPoints(h.highest_model_score, 100) },
    { label: 'Top Raw Expected Gain', value: formatPct(h.top_raw_expected_gain_pct) },
    { label: 'Directional Accuracy', value: formatPct(h.directional_accuracy_pct, { forcePositiveSign: false }) },
    { label: 'System Health', value: formatText(h.system_health) },
  ];
  el.innerHTML = tiles.map(t => `
    <div class="stat-tile">
      <span class="metric-label">${escapeHtml(t.label)}</span>
      <span class="metric-value metric-value--small">${escapeHtml(t.value)}</span>
    </div>
  `).join('');
}

function isNil(x) {
  return x === null || x === undefined;
}

function gainClass(x) {
  if (isNil(x)) return '';
  return Number(x) >= 0 ? 'gain-positive' : 'gain-negative';
}

function renderRanking(el, ipos) {
  if (!ipos || ipos.length === 0) {
    el.innerHTML = '<div class="placeholder">No tracked IPOs found.</div>';
    return;
  }

  const rows = ipos.map(item => {
    const record = item.record || {};
    const score = item.score || {};
    return {
      company: formatText(record.company),
      status: formatText(record.status),
      model_score: formatPoints(score.model_score, 100),
      raw_gain: formatPct(score.raw_expected_gain_pct),
      bias_gain: formatPct(score.bias_adjusted_gain_pct),
      indep_gain: formatPct(score.gmp_independent_gain_pct),
      raw_gain_class: gainClass(score.raw_expected_gain_pct),
      bias_gain_class: gainClass(score.bias_adjusted_gain_pct),
      indep_gain_class: gainClass(score.gmp_independent_gain_pct),
      risk_category: formatText(item.risk_category),
      confidence: formatText(item.confidence),
      data_health: formatText(item.data_health),
    };
  });

  // Desktop/tablet table (hidden on mobile via CSS media query below).
  const table = `
    <div class="table-wrap desktop-ranking">
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>Status</th>
            <th>Model Score</th>
            <th>Raw Gain</th>
            <th>Bias-Adj. Gain</th>
            <th>GMP-Indep. Gain</th>
            <th>Risk</th>
            <th>Confidence</th>
            <th>Data Health</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${escapeHtml(r.company)}</td>
              <td>${escapeHtml(r.status)}</td>
              <td>${escapeHtml(r.model_score)}</td>
              <td class="${r.raw_gain_class}">${escapeHtml(r.raw_gain)}</td>
              <td class="${r.bias_gain_class}">${escapeHtml(r.bias_gain)}</td>
              <td class="${r.indep_gain_class}">${escapeHtml(r.indep_gain)}</td>
              <td><span class="badge ${badgeClass(r.risk_category)}">${escapeHtml(r.risk_category)}</span></td>
              <td><span class="badge ${badgeClass(r.confidence)}">${escapeHtml(r.confidence)}</span></td>
              <td><span class="badge ${badgeClass(r.data_health)}">${escapeHtml(r.data_health)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Mobile stacked card list (hidden on tablet/desktop via CSS media query).
  const cards = `
    <div class="card-list mobile-ranking">
      ${rows.map(r => `
        <div class="glass-card">
          <div class="flex-between" style="margin-bottom: var(--space-2);">
            <strong>${escapeHtml(r.company)}</strong>
            <span class="badge ${badgeClass(r.risk_category)}">${escapeHtml(r.risk_category)}</span>
          </div>
          <div class="data-row"><span class="label">Status</span><span class="value">${escapeHtml(r.status)}</span></div>
          <div class="data-row"><span class="label">Model Score</span><span class="value">${escapeHtml(r.model_score)}</span></div>
          <div class="data-row"><span class="label">Raw Gain</span><span class="value ${r.raw_gain_class}">${escapeHtml(r.raw_gain)}</span></div>
          <div class="data-row"><span class="label">Bias-Adj. Gain</span><span class="value ${r.bias_gain_class}">${escapeHtml(r.bias_gain)}</span></div>
          <div class="data-row"><span class="label">GMP-Indep. Gain</span><span class="value ${r.indep_gain_class}">${escapeHtml(r.indep_gain)}</span></div>
          <div class="data-row"><span class="label">Confidence</span><span class="value">${escapeHtml(r.confidence)}</span></div>
          <div class="data-row"><span class="label">Data Health</span><span class="value">${escapeHtml(r.data_health)}</span></div>
        </div>
      `).join('')}
    </div>
  `;

  el.innerHTML = table + cards;
}
