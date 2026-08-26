# Indian IPO Quantitative Analytics & Listing Scenario Engine

## Running the app

```bash
pip install -r requirements.txt
python -m engine.train_model      # (re)generates engine/model/*.joblib + metrics.json
uvicorn backend.main:app --reload
```

Then open http://127.0.0.1:8000/.

## Architecture

- `engine/` — data + scoring. `data.py` holds the fixed IPO dataset (4 tracked
  IPOs, 15 historical listings used for backtesting). `features.py` has the
  shared feature-engineering math. `train_model.py` fits + leave-one-out
  cross-validates a Ridge regression of listing gain on GMP/issue-price ratio
  (the only factor with row-level historical ground truth in this dataset)
  and writes the trained artifacts to `engine/model/`. `score.py` is the
  runtime scoring API the backend calls.
- `backend/main.py` — FastAPI app: JSON API under `/api/*` plus the HTML page
  routes (Jinja2 templates from `frontend/templates/`).
- `frontend/` — hand-written HTML/CSS/JS (no framework). `static/css/styles.css`
  is the glassmorphic design system; `static/js/*.js` fetches from `/api/*`
  and renders each page client-side.
- `engine/tests_smoke.py` — run with `python -m engine.tests_smoke`. Checks
  the invariants that were broken in the original app (score/breakdown
  reconciliation, risk-category/flag consistency, bias sign, 2-4 comparison
  validation).

## Legacy

`app.py` is the original Streamlit dashboard and is retired in favor of the
FastAPI + HTML/CSS/JS app above. It's left in place (and in git history) for
reference rather than deleted; it is no longer the app's entrypoint and its
scoring numbers were fabricated/inconsistent (see git history / prior code
review for details) - don't trust its output.

`streamlit`/`pandas`/`plotly`/etc. were removed from the main
`requirements.txt` since the active app doesn't use them. If you want to open
or run `app.py` itself (e.g. your editor's import resolution needs it), install
`requirements-legacy.txt` separately: `pip install -r requirements-legacy.txt`.

## Honesty notes on the model

The backtest sample is small (N=15 real historical Indian IPO listings).
Only GMP has row-level historical ground truth in this dataset, so it's the
only factor that is fit and cross-validated. QIB/NII/valuation/ROE/issue
structure weights are a literature-cited rubric (see `/methodology` and
`/factor-drivers` in the running app for citations and the exact caveat
language) rather than something independently back-tested here - their
combined effect on the % gain estimates is capped at ±20 percentage points
so they can't swamp the one validated signal.
