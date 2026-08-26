document.addEventListener('DOMContentLoaded', async () => {
  const triggerEl = document.getElementById('company-select-trigger');
  const valueEl = document.getElementById('company-select-value');
  const listEl = document.getElementById('company-select-list');
  const wrapEl = document.getElementById('company-select');
  const bodyEl = document.getElementById('deep-dive-body');

  try {
    const { companies } = await apiGet('/api/companies');
    if (!companies || companies.length === 0) {
      valueEl.textContent = 'No companies available';
      renderError(bodyEl, new Error('No tracked companies found.'));
      return;
    }

    setupCustomSelect({ triggerEl, valueEl, listEl, wrapEl, options: companies, onSelect: (c) => loadCompany(c, bodyEl) });
    await loadCompany(companies[0], bodyEl);
  } catch (err) {
    renderError(bodyEl, err);
  }
});

function setupCustomSelect({ triggerEl, valueEl, listEl, wrapEl, options, onSelect }) {
  let activeIndex = 0;

  listEl.innerHTML = options.map((c, i) => `
    <li class="custom-select-option" role="option" id="company-option-${i}" data-value="${escapeHtml(c)}" aria-selected="${i === 0}">${escapeHtml(c)}</li>
  `).join('');
  valueEl.textContent = options[0];

  const optionEls = Array.from(listEl.querySelectorAll('.custom-select-option'));

  function open() {
    listEl.hidden = false;
    triggerEl.setAttribute('aria-expanded', 'true');
    triggerEl.setAttribute('aria-activedescendant', `company-option-${activeIndex}`);
    optionEls[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  function close() {
    listEl.hidden = true;
    triggerEl.setAttribute('aria-expanded', 'false');
    triggerEl.removeAttribute('aria-activedescendant');
  }

  function select(index) {
    activeIndex = index;
    optionEls.forEach((el, i) => el.setAttribute('aria-selected', String(i === index)));
    valueEl.textContent = options[index];
    close();
    triggerEl.focus();
    onSelect(options[index]);
  }

  triggerEl.addEventListener('click', () => (listEl.hidden ? open() : close()));

  optionEls.forEach((el, i) => {
    el.addEventListener('click', () => select(i));
  });

  triggerEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (listEl.hidden) { open(); } else { select(activeIndex); }
    } else if (e.key === 'Escape') {
      close();
    }
  });

  listEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, optionEls.length - 1);
      triggerEl.setAttribute('aria-activedescendant', `company-option-${activeIndex}`);
      optionEls[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      triggerEl.setAttribute('aria-activedescendant', `company-option-${activeIndex}`);
      optionEls[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(activeIndex);
    } else if (e.key === 'Escape') {
      close();
      triggerEl.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrapEl.contains(e.target)) close();
  });
}

async function loadCompany(company, bodyEl) {
  renderLoading(bodyEl, 'Loading IPO analysis…');
  try {
    const payload = await apiGet(`/api/ipo/${encodeURIComponent(company)}`);
    renderDeepDive(bodyEl, payload);
  } catch (err) {
    renderError(bodyEl, err);
  }
}

function gainClass(x) {
  if (x === null || x === undefined) return '';
  return Number(x) >= 0 ? 'gain-positive' : 'gain-negative';
}

function renderDeepDive(el, payload) {
  const record = payload.record || {};
  const score = payload.score || {};
  const breakdown = score.breakdown || {};
  const scenario = payload.scenario;

  const headerCards = `
    <div class="grid grid-stats" style="margin-bottom: var(--space-8);">
      <div class="stat-tile">
        <span class="metric-label">Model Score</span>
        <span class="metric-value">${escapeHtml(formatPoints(score.model_score, 100))}</span>
      </div>
      <div class="stat-tile">
        <span class="metric-label">Raw Expected Gain</span>
        <span class="metric-value ${gainClass(score.raw_expected_gain_pct)}">${escapeHtml(formatPct(score.raw_expected_gain_pct))}</span>
      </div>
      <div class="stat-tile">
        <span class="metric-label">Bias-Adjusted Gain</span>
        <span class="metric-value ${gainClass(score.bias_adjusted_gain_pct)}">${escapeHtml(formatPct(score.bias_adjusted_gain_pct))}</span>
      </div>
      <div class="stat-tile">
        <span class="metric-label">Confidence</span>
        <span class="metric-value metric-value--small"><span class="badge ${badgeClass(payload.confidence)}">${escapeHtml(formatText(payload.confidence))}</span></span>
      </div>
    </div>
  `;

  const infoPanel = `
    <div class="grid grid-2col" style="margin-bottom: var(--space-8);">
      <div class="glass-card">
        <h3>Issue Structure &amp; Key Facts</h3>
        <div class="data-row"><span class="label">Company</span><span class="value">${escapeHtml(formatText(record.company))}</span></div>
        <div class="data-row"><span class="label">Status</span><span class="value">${escapeHtml(formatText(record.status))}</span></div>
        <div class="data-row"><span class="label">Issue Price</span><span class="value">${escapeHtml(formatMoney(record.issue_price))}</span></div>
        <div class="data-row"><span class="label">Issue Size</span><span class="value">${escapeHtml(formatMoney(record.issue_size_cr, { suffix: ' Cr' }))}</span></div>
        <div class="data-row"><span class="label">Fresh Issue Ratio</span><span class="value">${escapeHtml(isNilPct(record.fresh_issue_ratio_pct))}</span></div>
        <div class="data-row"><span class="label">Data Health</span><span class="value"><span class="badge ${badgeClass(payload.data_health)}">${escapeHtml(formatText(payload.data_health))}</span></span></div>
      </div>
      <div class="glass-card">
        <h3>Unofficial OTC Sentiment &amp; Valuation</h3>
        <div class="data-row"><span class="label">Grey Market Premium</span><span class="value">${escapeHtml(formatMoney(record.gmp))}</span></div>
        <div class="data-row"><span class="label">GMP Source</span><span class="value">${escapeHtml(formatText(record.gmp_source))}</span></div>
        <div class="data-row"><span class="label">GMP Timestamp</span><span class="value">${escapeHtml(formatText(record.gmp_timestamp))}</span></div>
        <div class="data-row"><span class="label">GMP Health</span><span class="value">${escapeHtml(formatText(record.gmp_health))}</span></div>
        <div class="data-row"><span class="label">Asking P/E vs Peer</span><span class="value">${escapeHtml(formatPeVsPeer(record))}</span></div>
        <div class="data-row"><span class="label">ROE</span><span class="value">${escapeHtml(isNilPct(record.roe_pct))}</span></div>
        <div class="data-row"><span class="label">QIB / NII Subscription</span><span class="value">${escapeHtml(formatSubscription(record))}</span></div>
      </div>
    </div>
  `;

  const scenarioSection = renderScenario(scenario);
  const breakdownSection = renderBreakdown(breakdown, score.model_score);
  const riskSection = renderRisk(payload.risk_category, payload.risk_flags);

  el.innerHTML = headerCards + infoPanel + scenarioSection + breakdownSection + riskSection;
}

function isNilPct(x) {
  if (x === null || x === undefined) return 'N/A — Pending';
  return `${x}%`;
}

function formatPeVsPeer(record) {
  if (record.asking_pe === null || record.asking_pe === undefined ||
      record.peer_median_pe === null || record.peer_median_pe === undefined) {
    return 'N/A — Pending';
  }
  return `${record.asking_pe}x vs ${record.peer_median_pe}x`;
}

function formatSubscription(record) {
  if (record.qib_subscription === null || record.qib_subscription === undefined) {
    return 'N/A — Pending (Awaiting RHP / Bidding Close)';
  }
  const nii = record.nii_subscription === null || record.nii_subscription === undefined
    ? 'N/A' : formatMultiple(record.nii_subscription);
  return `QIB ${formatMultiple(record.qib_subscription)} | NII ${nii}`;
}

function renderScenario(scenario) {
  const heading = `
    <h2 class="section-title">Scenario Price &amp; Return Model</h2>
    <p class="subtitle">Bear, base, and bull projections derived from the bias-adjusted estimate plus/minus one empirical LOOCV mean-absolute-error band.</p>
  `;

  if (!scenario) {
    return `
      ${heading}
      <div class="callout" style="margin-bottom: var(--space-8);">
        Scenario models are inactive until official price band and RHP data are audited.
      </div>
    `;
  }

  const cases = [
    { key: 'bear', label: 'Bear Case' },
    { key: 'base', label: 'Base Case' },
    { key: 'bull', label: 'Bull Case' },
  ];

  const cards = cases.map(c => {
    const s = scenario[c.key] || {};
    return `
      <div class="glass-card">
        <h3>${escapeHtml(c.label)}</h3>
        <div class="metric-label">Target Price</div>
        <div class="metric-value metric-value--small" style="margin-bottom: var(--space-2);">${escapeHtml(formatMoney(s.target))}</div>
        <div class="metric-label">Expected Gain</div>
        <div class="metric-value metric-value--small ${gainClass(s.gain_pct)}" style="margin-bottom: var(--space-3);">${escapeHtml(formatPct(s.gain_pct))}</div>
        <p style="margin: 0; font-size: var(--fs-small); font-style: italic;">${escapeHtml(formatText(s.note))}</p>
      </div>
    `;
  }).join('');

  return `
    ${heading}
    <div class="grid grid-3col" style="margin-bottom: var(--space-8);">
      ${cards}
    </div>
  `;
}

function renderBreakdown(breakdown, modelScore) {
  const keys = Object.keys(breakdown);
  const heading = `
    <h2 class="section-title">100-Point Quantitative Model Score Reconciliation</h2>
    <p class="subtitle">Factor breakdown and point allocation — these points sum to the model score above.</p>
  `;

  if (keys.length === 0) {
    return `
      ${heading}
      <div class="callout" style="margin-bottom: var(--space-8);">Factor breakdown unavailable for this record.</div>
    `;
  }

  const labelMap = {
    gmp_ratio: 'GMP Ratio',
    qib_subscription: 'QIB Subscription',
    nii_subscription: 'NII Subscription',
    pe_discount: 'P/E Discount vs Peer',
    roe_pct: 'ROE',
    fresh_issue_ratio_pct: 'Fresh Issue Ratio',
  };

  const rows = keys.map(k => {
    const c = breakdown[k] || {};
    return `
      <tr>
        <td>${escapeHtml(labelMap[k] || k)}</td>
        <td>${c.raw_value === null || c.raw_value === undefined ? 'N/A — Pending' : escapeHtml(String(c.raw_value))}</td>
        <td>${escapeHtml(String(c.max_points))}</td>
        <td>${c.points === null || c.points === undefined ? 'N/A — Pending' : escapeHtml(c.points.toFixed(1))}</td>
      </tr>
    `;
  }).join('');

  const anyMissing = keys.some(k => breakdown[k].points === null || breakdown[k].points === undefined);

  return `
    ${heading}
    <div class="table-wrap" style="margin-bottom: var(--space-8);">
      <table>
        <thead>
          <tr><th>Component</th><th>Raw Value</th><th>Max Points</th><th>Allocated Points</th></tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td colspan="3">Total (Model Score)</td><td>${anyMissing ? 'N/A — Pending' : escapeHtml(formatPoints(modelScore, 100))}</td></tr>
        </tfoot>
      </table>
    </div>
  `;
}

function renderRisk(riskCategory, flags) {
  const items = (flags || []).map(f => `<li>${escapeHtml(f)}</li>`).join('');
  return `
    <h2 class="section-title">Risk Assessment Framework &amp; Dynamic Flags</h2>
    <p class="subtitle">Assigned Risk Category: <span class="badge ${badgeClass(riskCategory)}">${escapeHtml(formatText(riskCategory))}</span></p>
    <ul class="flag-list">${items || '<li>No risk flag data available.</li>'}</ul>
  `;
}
