"""Runtime scoring: wraps the trained GMP regression + calibration model
with the literature-cited rubric overlay to score live IPOs, and derives
risk flags/category, scenario targets, and system-wide headline stats -
every one of these computed from the underlying data instead of a separate
hand-typed field, so they can never disagree with each other again.
"""

import json
from pathlib import Path

import joblib

from engine.data import OVERVIEW_RECORDS
from engine.features import gmp_ratio, rubric_breakdown, model_score, non_gmp_overlay_score

MODEL_DIR = Path(__file__).parent / "model"

# Bounded so the un-backtested rubric overlay (QIB/NII/valuation/ROE/
# structure) can never swing the estimate more than this many percentage
# points either way - it adjusts the one empirically-validated GMP
# regression, it doesn't get to dominate it.
OVERLAY_MAX_SWING_PP = 20.0

_cache = {}


def _load():
    if "gmp_model" not in _cache:
        _cache["gmp_model"] = joblib.load(MODEL_DIR / "gmp_gain_model.joblib")
        _cache["calibration_model"] = joblib.load(MODEL_DIR / "calibration_model.joblib")
        _cache["metrics"] = json.loads((MODEL_DIR / "metrics.json").read_text())
    return _cache["gmp_model"], _cache["calibration_model"], _cache["metrics"]


def clear_cache():
    """Called by the backend's /api/recalculate - actually re-reads the
    trained model + metrics from disk instead of the old app's fake
    'Refresh IPO Data' button, which did nothing at all."""
    _cache.clear()


def get_metrics():
    _, _, metrics = _load()
    return metrics


def _overlay_adjustment_pp(record):
    overlay = non_gmp_overlay_score(record)
    if overlay is None:
        return None
    return (overlay - 0.5) * 2 * OVERLAY_MAX_SWING_PP


def score_ipo(record):
    """model_score (0-100, = sum of its own breakdown, by construction) +
    the three % gain estimates. Any figure that can't be computed yet
    (missing GMP/QIB/NII pre-RHP) comes back None rather than a fabricated
    placeholder."""
    gmp_model, calibration_model, metrics = _load()

    breakdown = rubric_breakdown(record)
    score = model_score(record)
    overlay_adj = _overlay_adjustment_pp(record)
    ratio = gmp_ratio(record.get("gmp"), record.get("issue_price"))

    raw_gain = None
    bias_adjusted_gain = None
    if ratio is not None and overlay_adj is not None:
        raw_pred = float(gmp_model.predict([[ratio]])[0])
        calibrated_pred = float(calibration_model.predict([[raw_pred]])[0])
        raw_gain = round(raw_pred + overlay_adj, 1)
        bias_adjusted_gain = round(calibrated_pred + overlay_adj, 1)

    gmp_independent_gain = None
    if overlay_adj is not None:
        gmp_independent_gain = round(metrics["historical_mean_actual_gain_pct"] + overlay_adj, 1)

    return {
        "model_score": score,
        "breakdown": breakdown,
        "raw_expected_gain_pct": raw_gain,
        "bias_adjusted_gain_pct": bias_adjusted_gain,
        "gmp_independent_gain_pct": gmp_independent_gain,
    }


def risk_flags_and_category(record):
    """Flags and category derived from the same rule set in one place, so
    a 'Moderate Risk' label can never sit next to 'no risk flags
    identified' again."""
    flags = []

    asking_pe, peer_pe = record.get("asking_pe"), record.get("peer_median_pe")
    if asking_pe is not None and peer_pe is not None and asking_pe > peer_pe:
        flags.append(f"Valuation Premium: Asking P/E ({asking_pe}x) exceeds industry peer median ({peer_pe}x).")

    qib = record.get("qib_subscription")
    if qib is not None and qib < 10:
        flags.append(f"Low Institutional Bidding: Current QIB subscription multiple is muted ({qib}x).")

    roe = record.get("roe_pct")
    if roe is not None and roe < 15:
        flags.append(f"Sub-optimal ROE: Return on Equity ({roe}%) is below institutional threshold.")

    issue_size = record.get("issue_size_cr")
    if issue_size is not None and issue_size < 100:
        flags.append(f"Liquidity Risk: Small issue size (₹{issue_size} Cr) may cause post-listing volatility.")

    if len(flags) == 0:
        category = "Low Risk"
    elif len(flags) == 1:
        category = "Moderate Risk"
    else:
        category = "High Risk"

    if not flags:
        flags.append("No critical risk flags identified; fundamental and institutional momentum metrics are solid.")

    return flags, category


def scenario_targets(record, scored):
    """Bear/base/bull built from the base estimate +/- one empirical LOOCV
    mean-absolute-error band, instead of hand-typed scenario numbers."""
    issue_price = record.get("issue_price")
    base_gain = scored.get("bias_adjusted_gain_pct")
    if issue_price is None or base_gain is None:
        return None

    mae = get_metrics()["loocv_mae_pp"]
    bear_gain = round(max(0.0, base_gain - mae), 1)
    bull_gain = round(base_gain + mae, 1)

    def target(gain_pct):
        return round(issue_price * (1 + gain_pct / 100.0), 1)

    return {
        "bear": {"target": target(bear_gain), "gain_pct": bear_gain, "note": "Bias-adjusted estimate minus one empirical LOOCV MAE band."},
        "base": {"target": target(base_gain), "gain_pct": base_gain, "note": "Bias-adjusted model estimate."},
        "bull": {"target": target(bull_gain), "gain_pct": bull_gain, "note": "Bias-adjusted estimate plus one empirical LOOCV MAE band."},
    }


def confidence_level(scored):
    if scored["model_score"] is None:
        return "Low"
    if scored["bias_adjusted_gain_pct"] is not None:
        return "High" if scored["model_score"] >= 80 else "Moderate"
    return "Moderate"


def data_health(record, scored):
    if scored["model_score"] is None:
        return "Data Issue (Pending DRHP Audit)"
    if "Verified" in (record.get("gmp_health") or ""):
        return "Fully Verified"
    return "Partial (Bidding Active)"


def score_overview():
    """Full scored payload for every tracked IPO - the single place the
    backend calls into for the Overview/Deep Dive/Comparison pages."""
    results = []
    for record in OVERVIEW_RECORDS:
        scored = score_ipo(record)
        flags, risk_category = risk_flags_and_category(record)
        results.append({
            "record": record,
            "score": scored,
            "risk_flags": flags,
            "risk_category": risk_category,
            "confidence": confidence_level(scored),
            "data_health": data_health(record, scored),
            "scenario": scenario_targets(record, scored),
        })
    return results


def system_health(scored_overview):
    scoreable = [r for r in scored_overview if r["score"]["model_score"] is not None]
    if not scoreable:
        return "Partial"
    return "Fully Verified" if all(r["data_health"] == "Fully Verified" for r in scoreable) else "Partial"


def headline_stats(scored_overview):
    scores = [r["score"]["model_score"] for r in scored_overview if r["score"]["model_score"] is not None]
    gains = [r["score"]["raw_expected_gain_pct"] for r in scored_overview if r["score"]["raw_expected_gain_pct"] is not None]
    metrics = get_metrics()
    return {
        "tracked_ipos": len(scored_overview),
        "highest_model_score": max(scores) if scores else None,
        "top_raw_expected_gain_pct": max(gains) if gains else None,
        "directional_accuracy_pct": metrics["directional_accuracy_pct"],
        "system_health": system_health(scored_overview),
    }
