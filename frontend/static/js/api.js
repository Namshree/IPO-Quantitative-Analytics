// Shared fetch + formatting helpers used by every page-specific script.
// Never hardcode a computed number in a template or page script - always
// pull it through apiGet() from the backend's /api/* endpoints.

async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch (e) {}
    throw new Error(`Request to ${path} failed (${res.status}): ${detail}`);
  }
  return res.json();
}

function isNil(x) {
  return x === null || x === undefined;
}

// Formats a percentage value with an explicit sign, e.g. "+12.3%" / "-4.5%".
// Returns "N/A" for null/undefined.
function formatPct(x, opts) {
  opts = opts || {};
  if (isNil(x)) return 'N/A';
  const n = Number(x);
  if (Number.isNaN(n)) return 'N/A';
  const sign = n > 0 ? '+' : n < 0 ? '' : (opts.forcePositiveSign ? '+' : '');
  const decimals = opts.decimals !== undefined ? opts.decimals : 1;
  return `${sign}${n.toFixed(decimals)}%`;
}

// Formats a plain percentage-point value (no implied "gain" sign framing),
// e.g. for MAE / error columns: "8.9 pp".
function formatPP(x, decimals) {
  if (isNil(x)) return 'N/A';
  const n = Number(x);
  if (Number.isNaN(n)) return 'N/A';
  decimals = decimals === undefined ? 1 : decimals;
  return `${n.toFixed(decimals)} pp`;
}

// Formats a currency value as Indian Rupees, e.g. "₹1,234.5".
function formatMoney(x, opts) {
  opts = opts || {};
  if (isNil(x)) return 'N/A';
  const n = Number(x);
  if (Number.isNaN(n)) return 'N/A';
  const decimals = opts.decimals !== undefined ? opts.decimals : 1;
  const formatted = n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `₹${formatted}${opts.suffix || ''}`;
}

// Formats a model score / points value, e.g. "93.6 / 100" or "35.0 pts".
function formatPoints(x, max) {
  if (isNil(x)) return 'N/A';
  const n = Number(x);
  if (Number.isNaN(n)) return 'N/A';
  if (max === undefined) return n.toFixed(1);
  return `${n.toFixed(1)} / ${max}`;
}

function formatMultiple(x) {
  if (isNil(x)) return 'N/A';
  const n = Number(x);
  if (Number.isNaN(n)) return 'N/A';
  return `${n.toFixed(1)}x`;
}

function formatText(x, fallback) {
  if (isNil(x) || x === '') return fallback || 'N/A — Pending';
  return x;
}

function escapeHtml(str) {
  if (isNil(str)) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Renders a loading placeholder into a container.
function renderLoading(container, label) {
  container.innerHTML = `<div class="placeholder">${escapeHtml(label || 'Loading…')}</div>`;
}

// Renders an error placeholder into a container.
function renderError(container, err) {
  console.error(err);
  container.innerHTML = `<div class="placeholder">Could not load data: ${escapeHtml(err.message || String(err))}</div>`;
}

// Badge color classes for risk category / confidence / data health / correctness.
function badgeClass(label) {
  if (isNil(label)) return 'badge-neutral';
  const s = String(label).toLowerCase();
  if (s.includes('low risk') || s === 'high' || s.includes('fully verified') || s.includes('verified')) {
    return 'badge-green';
  }
  if (s.includes('moderate') || s.includes('partial')) {
    return 'badge-amber';
  }
  if (s.includes('high risk') || s.includes('data issue') || s.includes('unavailable') || s === 'low') {
    return 'badge-red';
  }
  return 'badge-neutral';
}
