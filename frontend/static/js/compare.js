const COMPARE_MIN = 2;
const COMPARE_MAX = 4;

document.addEventListener('DOMContentLoaded', async () => {
  const checkboxEl = document.getElementById('company-checkboxes');
  const validationEl = document.getElementById('compare-validation');
  const bodyEl = document.getElementById('compare-body');

  try {
    const { companies } = await apiGet('/api/companies');
    if (!companies || companies.length === 0) {
      renderError(checkboxEl, new Error('No tracked companies found.'));
      return;
    }

    checkboxEl.innerHTML = companies.map((c, i) => `
      <label class="checkbox-item" data-index="${i}">
        <input type="checkbox" value="${escapeHtml(c)}" ${i < 3 ? 'checked' : ''}>
        <span>${escapeHtml(c)}</span>
      </label>
    `).join('');

    const inputs = Array.from(checkboxEl.querySelectorAll('input[type="checkbox"]'));
    inputs.forEach(input => {
      input.addEventListener('change', () => onSelectionChange(inputs, validationEl, bodyEl));
    });

    onSelectionChange(inputs, validationEl, bodyEl);
  } catch (err) {
    renderError(checkboxEl, err);
  }
});

function getSelected(inputs) {
  return inputs.filter(i => i.checked).map(i => i.value);
}

function onSelectionChange(inputs, validationEl, bodyEl) {
  const selected = getSelected(inputs);

  // Enforce max 4: disable unchecked boxes once 4 are picked.
  inputs.forEach(input => {
    const item = input.closest('.checkbox-item');
    if (!input.checked && selected.length >= COMPARE_MAX) {
      input.disabled = true;
      if (item) item.classList.add('disabled');
    } else {
      input.disabled = false;
      if (item) item.classList.remove('disabled');
    }
  });

  if (selected.length < COMPARE_MIN) {
    validationEl.textContent = `Select at least ${COMPARE_MIN} IPOs to compare (currently ${selected.length}).`;
    validationEl.classList.add('warn');
    bodyEl.innerHTML = `<div class="placeholder">Select 2 to 4 IPOs above to compare.</div>`;
    return;
  }

  validationEl.textContent = `${selected.length} of ${COMPARE_MAX} selected.`;
  validationEl.classList.remove('warn');
  loadComparison(selected, bodyEl);
}

let compareRequestSeq = 0;

async function loadComparison(companies, bodyEl) {
  const seq = ++compareRequestSeq;
  renderLoading(bodyEl, 'Loading comparison…');
  try {
    const params = companies.map(c => `companies=${encodeURIComponent(c)}`).join('&');
    const data = await apiGet(`/api/compare?${params}`);
    if (seq !== compareRequestSeq) return; // stale response, a newer selection superseded it
    renderComparison(bodyEl, data.companies || []);
  } catch (err) {
    if (seq !== compareRequestSeq) return;
    renderError(bodyEl, err);
  }
}

function gainClass(x) {
  if (x === null || x === undefined) return '';
  return Number(x) >= 0 ? 'gain-positive' : 'gain-negative';
}

const METRIC_ROWS = [
  { key: 'status', label: 'Status', get: p => formatText(p.record.status) },
  { key: 'model_score', label: 'Model Score', get: p => formatPoints(p.score.model_score, 100) },
  { key: 'raw_gain', label: 'Raw Expected Gain', get: p => formatPct(p.score.raw_expected_gain_pct), cls: p => gainClass(p.score.raw_expected_gain_pct) },
  { key: 'bias_gain', label: 'Bias-Adjusted Gain', get: p => formatPct(p.score.bias_adjusted_gain_pct), cls: p => gainClass(p.score.bias_adjusted_gain_pct) },
  { key: 'indep_gain', label: 'GMP-Independent Gain', get: p => formatPct(p.score.gmp_independent_gain_pct), cls: p => gainClass(p.score.gmp_independent_gain_pct) },
  { key: 'risk_category', label: 'Risk Category', get: p => formatText(p.risk_category), badge: true },
  { key: 'confidence', label: 'Confidence', get: p => formatText(p.confidence), badge: true },
  { key: 'data_health', label: 'Data Health', get: p => formatText(p.data_health), badge: true },
  { key: 'qib', label: 'QIB Subscription', get: p => formatMultipleOrNA(p.record.qib_subscription) },
  { key: 'nii', label: 'NII Subscription', get: p => formatMultipleOrNA(p.record.nii_subscription) },
  { key: 'gmp', label: 'GMP', get: p => formatMoney(p.record.gmp) },
  { key: 'issue_price', label: 'Issue Price', get: p => formatMoney(p.record.issue_price) },
];

function formatMultipleOrNA(x) {
  if (x === null || x === undefined) return 'N/A — Pending';
  return formatMultiple(x);
}

function renderComparison(el, payloads) {
  if (!payloads || payloads.length === 0) {
    el.innerHTML = '<div class="placeholder">No comparison data returned.</div>';
    return;
  }

  const companyNames = payloads.map(p => formatText(p.record.company));

  const table = `
    <div class="table-wrap compare-table-wrap">
      <table class="no-min">
        <thead>
          <tr>
            <th>Metric</th>
            ${companyNames.map(n => `<th>${escapeHtml(n)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${METRIC_ROWS.map(row => `
            <tr>
              <td>${escapeHtml(row.label)}</td>
              ${payloads.map(p => {
                const val = row.get(p);
                const cls = row.cls ? row.cls(p) : '';
                const content = row.badge ? `<span class="badge ${badgeClass(val)}">${escapeHtml(val)}</span>` : escapeHtml(val);
                return `<td class="${cls}">${content}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  const cards = `
    <div class="compare-cards">
      ${payloads.map(p => `
        <div class="glass-card">
          <h3>${escapeHtml(formatText(p.record.company))}</h3>
          ${METRIC_ROWS.map(row => {
            const val = row.get(p);
            const cls = row.cls ? row.cls(p) : '';
            const content = row.badge ? `<span class="badge ${badgeClass(val)}">${escapeHtml(val)}</span>` : `<span class="value ${cls}">${escapeHtml(val)}</span>`;
            return `<div class="data-row"><span class="label">${escapeHtml(row.label)}</span>${content}</div>`;
          }).join('')}
        </div>
      `).join('')}
    </div>
  `;

  el.innerHTML = table + cards;
}
