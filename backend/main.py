"""FastAPI backend: serves the HTML shell (Jinja2) + a small JSON API that
the frontend's vanilla JS calls for all dynamic data. Replaces the old
Streamlit app.py - all scoring logic lives in engine/, this file is just
routing + request validation.
"""

from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from engine.data import OVERVIEW_RECORDS, RUBRIC_WEIGHTS
from engine.score import (
    clear_cache,
    get_metrics,
    headline_stats,
    scenario_targets,
    score_ipo,
    score_overview,
)

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = FastAPI(title="Indian IPO Quantitative Analytics & Listing Scenario Engine")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR / "static"), name="static")
templates = Jinja2Templates(directory=FRONTEND_DIR / "templates")

COMPANY_NAMES = [r["company"] for r in OVERVIEW_RECORDS]

PAGES = [
    ("index.html", "/", "Overview"),
    ("deep_dive.html", "/deep-dive", "IPO Deep Dive"),
    ("compare.html", "/compare", "IPO Comparison"),
    ("backtest.html", "/backtest", "Model Backtest"),
    ("factor_drivers.html", "/factor-drivers", "Factor Drivers"),
    ("methodology.html", "/methodology", "Methodology"),
    ("data_sources.html", "/data-sources", "Data Sources"),
]


def _nav_context(active_path: str):
    return {"nav_items": [{"path": p, "label": label} for _, p, label in PAGES], "active_path": active_path}


def _render(request: Request, template_name: str, path: str):
    return templates.TemplateResponse(request, template_name, _nav_context(path))


@app.get("/", response_class=HTMLResponse)
def page_overview(request: Request):
    return _render(request, "index.html", "/")


@app.get("/deep-dive", response_class=HTMLResponse)
def page_deep_dive(request: Request):
    return _render(request, "deep_dive.html", "/deep-dive")


@app.get("/compare", response_class=HTMLResponse)
def page_compare(request: Request):
    return _render(request, "compare.html", "/compare")


@app.get("/backtest", response_class=HTMLResponse)
def page_backtest(request: Request):
    return _render(request, "backtest.html", "/backtest")


@app.get("/factor-drivers", response_class=HTMLResponse)
def page_factor_drivers(request: Request):
    return _render(request, "factor_drivers.html", "/factor-drivers")


@app.get("/methodology", response_class=HTMLResponse)
def page_methodology(request: Request):
    return _render(request, "methodology.html", "/methodology")


@app.get("/data-sources", response_class=HTMLResponse)
def page_data_sources(request: Request):
    return _render(request, "data_sources.html", "/data-sources")


def _find_record(company: str):
    for r in OVERVIEW_RECORDS:
        if r["company"] == company:
            return r
    return None


def _deep_dive_payload(record):
    scored = score_ipo(record)
    from engine.score import risk_flags_and_category, confidence_level, data_health
    flags, risk_category = risk_flags_and_category(record)
    return {
        "record": record,
        "score": scored,
        "risk_flags": flags,
        "risk_category": risk_category,
        "confidence": confidence_level(scored),
        "data_health": data_health(record, scored),
        "scenario": scenario_targets(record, scored),
    }


@app.get("/api/overview")
def api_overview():
    results = score_overview()
    ranked = sorted(
        results,
        key=lambda r: (r["score"]["model_score"] is None, -(r["score"]["model_score"] or 0)),
    )
    return {"headline": headline_stats(results), "ipos": ranked}


@app.get("/api/companies")
def api_companies():
    return {"companies": COMPANY_NAMES}


@app.get("/api/ipo/{company}")
def api_ipo(company: str):
    record = _find_record(company)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Unknown company: {company}")
    return _deep_dive_payload(record)


@app.get("/api/compare")
def api_compare(companies: List[str] = Query(...)):
    if len(companies) < 2 or len(companies) > 4:
        raise HTTPException(status_code=400, detail="Select between 2 and 4 companies to compare.")
    payloads = []
    for name in companies:
        record = _find_record(name)
        if record is None:
            raise HTTPException(status_code=404, detail=f"Unknown company: {name}")
        payloads.append(_deep_dive_payload(record))
    return {"companies": payloads}


@app.get("/api/backtest")
def api_backtest():
    return get_metrics()


@app.get("/api/factor-drivers")
def api_factor_drivers():
    descriptions = {
        "gmp_ratio": "OTC premium as a % of issue price. The only factor with row-level historical ground truth in this dataset; fit + leave-one-out cross-validated against 15 real past listings.",
        "qib_subscription": "Institutional bidding multiple at offer close.",
        "nii_subscription": "High-Net-Worth Individual bidding multiple.",
        "pe_discount": "Asking P/E discount relative to industry peer median.",
        "roe_pct": "Return on Equity from DRHP filings.",
        "fresh_issue_ratio_pct": "Fresh issue capital mix relative to Offer For Sale (OFS).",
    }
    factors = [
        {"key": k, "weight_pts": v, "description": descriptions[k]}
        for k, v in RUBRIC_WEIGHTS.items()
    ]
    return {
        "factors": factors,
        "overlay_max_swing_pp": 20.0,
        "note": (
            "Only the GMP factor is locally back-tested (leave-one-out CV against 15 real listings, "
            "Pearson r and MAE shown on the Model Backtest page). QIB, NII, valuation, ROE, and issue "
            "structure weights are a literature-cited rubric (published Indian-market studies report "
            "GMP r~0.80-0.89 and QIB subscription r~0.82 with listing returns) - not independently "
            "back-tested in this dataset, since no historical rows pair them with actual outcomes. "
            "Their combined influence on the % gain estimates is capped at ±20 percentage points "
            "so they can adjust, but never dominate, the validated GMP-driven estimate."
        ),
    }


@app.get("/api/methodology")
def api_methodology():
    metrics = get_metrics()
    return {
        "steps": [
            "Data Collection: Fixed reference dataset of tracked and historical Indian IPOs (no live scraping in this deployment).",
            "GMP Regression: Ridge regression of listing gain on GMP/issue-price ratio, alpha chosen via leave-one-out cross-validation grid search - the only factor with paired historical ground truth.",
            f"Validation: N={metrics['n_samples']} historical listings, LOOCV MAE {metrics['loocv_mae_pp']}pp, Pearson r {metrics['loocv_pearson_r']}, directional accuracy {metrics['directional_accuracy_pct']}% (correctly placed above/below the historical median gain).",
            "Bias Calibration: A second regression fit on the GMP model's out-of-fold predictions corrects its historical over/under-estimation pattern.",
            "Rubric Overlay: QIB/NII/valuation/ROE/issue-structure factors apply a literature-cited, capped (±20pp) adjustment - clearly separated from the backtested GMP component.",
            "GMP-Independent Estimate: Historical mean actual gain plus the rubric overlay only, with no GMP term at all.",
            "Scenario Range: Bear/bull targets = bias-adjusted estimate ± one empirical LOOCV mean-absolute-error band, not hand-set percentages.",
        ],
        "caveat": f"Sample size is small (N={metrics['n_samples']}). Metrics are indicative, not statistically conclusive.",
    }


@app.get("/api/data-sources")
def api_data_sources():
    return {
        "hierarchy": [
            {"tier": "Priority 1 - Primary Official Feeds", "sources": ["SEBI DRHP/RHP Filings", "Exchange Bidding Feeds (NSE/BSE)"]},
            {"tier": "Priority 2 - Secondary Market OTC Desks", "sources": ["InvestorGain OTC Desk", "Chittorgarh Market Intelligence"]},
        ],
        "ipos": [
            {"company": r["company"], "gmp_source": r.get("gmp_source"), "gmp_timestamp": r.get("gmp_timestamp"), "gmp_health": r.get("gmp_health")}
            for r in OVERVIEW_RECORDS
        ],
    }


@app.post("/api/recalculate")
def api_recalculate():
    """Actually recomputes scores from the stored dataset + trained model -
    unlike the old Streamlit button, which just printed a fake success
    message. There is no live feed in this deployment (by design - see
    Methodology), so this recalculates rather than re-syncing."""
    clear_cache()
    results = score_overview()
    return {"status": "recalculated", "headline": headline_stats(results)}
