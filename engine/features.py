"""Shared feature engineering. One place for the GMP ratio / P/E discount /
capped rubric-point math so the training script, the runtime scorer, and the
API can never drift out of sync with each other (the original app computed
this inline inside a Streamlit callback, which is how the score and its own
displayed breakdown ended up disagreeing).
"""

from engine.data import RUBRIC_WEIGHTS

# Denominators the original app used to normalize each factor onto its
# rubric weight before capping (e.g. a 50% GMP/price ratio already earns the
# full 35 GMP points).
_NORMALIZERS = {
    "gmp_ratio": 50.0,      # % GMP-to-issue-price ratio that earns full points
    "qib_subscription": 100.0,   # subscription multiple (x)
    "nii_subscription": 50.0,    # subscription multiple (x)
    "pe_discount": 30.0,         # % discount to peer median P/E
    "roe_pct": 25.0,              # % ROE
    "fresh_issue_ratio_pct": 100.0,  # % of issue that is fresh capital
}


def gmp_ratio(gmp, issue_price):
    """GMP as a percentage of issue price. None if GMP isn't available yet."""
    if gmp is None or issue_price is None or issue_price <= 0:
        return None
    return (gmp / issue_price) * 100.0


def pe_discount(asking_pe, peer_median_pe):
    """% discount of asking P/E to peer median P/E, floored at 0 (a premium
    to peers scores zero rather than a negative discount)."""
    if asking_pe is None or peer_median_pe is None or peer_median_pe <= 0:
        return None
    return max(0.0, (peer_median_pe - asking_pe) / peer_median_pe) * 100.0


def _capped_points(value, factor_key):
    if value is None:
        return None
    max_points = RUBRIC_WEIGHTS[factor_key]
    normalizer = _NORMALIZERS[factor_key]
    return min(max_points, (value / normalizer) * max_points)


def rubric_breakdown(record):
    """Given a live-IPO record (dict with gmp, issue_price, qib_subscription,
    nii_subscription, asking_pe, peer_median_pe, roe_pct,
    fresh_issue_ratio_pct), return the per-factor {points, max_points} needed
    for the 100-point scorecard. Any factor whose input is unavailable comes
    back with points=None rather than silently defaulting to 0, so callers
    can tell "scored zero" apart from "no data yet".
    """
    g_ratio = gmp_ratio(record.get("gmp"), record.get("issue_price"))
    discount = pe_discount(record.get("asking_pe"), record.get("peer_median_pe"))

    raw_values = {
        "gmp_ratio": g_ratio,
        "qib_subscription": record.get("qib_subscription"),
        "nii_subscription": record.get("nii_subscription"),
        "pe_discount": discount,
        "roe_pct": record.get("roe_pct"),
        "fresh_issue_ratio_pct": record.get("fresh_issue_ratio_pct"),
    }

    breakdown = {}
    for key, raw_value in raw_values.items():
        breakdown[key] = {
            "raw_value": raw_value,
            "max_points": RUBRIC_WEIGHTS[key],
            "points": _capped_points(raw_value, key),
        }
    return breakdown


def model_score(record):
    """0-100 scorecard total = sum of the breakdown's own points. Returns
    None if any required factor (GMP or subscription data) isn't in yet -
    a partial score would be misleading, matching the existing "Pending
    Audit" state for pre-RHP IPOs.
    """
    breakdown = rubric_breakdown(record)
    points = [component["points"] for component in breakdown.values()]
    if any(p is None for p in points):
        return None
    return round(sum(points), 1)


def non_gmp_overlay_score(record):
    """0..1 normalized score across the 5 factors with no historical
    ground truth (QIB, NII, P/E discount, ROE, fresh-issue mix). None if
    QIB/NII aren't available yet (pre-RHP)."""
    breakdown = rubric_breakdown(record)
    non_gmp_keys = ["qib_subscription", "nii_subscription", "pe_discount", "roe_pct", "fresh_issue_ratio_pct"]
    points = [breakdown[k]["points"] for k in non_gmp_keys]
    if any(p is None for p in points):
        return None
    max_total = sum(RUBRIC_WEIGHTS[k] for k in non_gmp_keys)
    return sum(points) / max_total
