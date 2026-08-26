document.addEventListener('DOMContentLoaded', async () => {
  const stepsEl = document.getElementById('methodology-steps');
  const caveatEl = document.getElementById('methodology-caveat');

  try {
    const data = await apiGet('/api/methodology');
    renderSteps(stepsEl, data.steps || []);
    renderCaveat(caveatEl, data.caveat);
  } catch (err) {
    renderError(stepsEl, err);
    renderError(caveatEl, err);
  }
});

function renderSteps(el, steps) {
  if (!steps || steps.length === 0) {
    el.innerHTML = '<div class="placeholder">No methodology steps available.</div>';
    return;
  }
  el.innerHTML = `<ol class="steps">${steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`;
}

function renderCaveat(el, caveat) {
  el.innerHTML = `
    <div class="callout callout-accent">
      <strong>Caveat:</strong> ${escapeHtml(formatText(caveat))}
    </div>
  `;
}
