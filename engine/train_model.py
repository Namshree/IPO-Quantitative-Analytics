"""Train + validate the GMP-driven listing-gain regression via leave-one-out
cross-validation - the only honest option at N=15 real historical listings.
Run this script directly to (re)generate engine/model/*.joblib + metrics.json.

Scope: GMP/issue-price ratio is the only factor with row-level historical
ground truth in engine.data.BACKTEST_RECORDS, so it's the only factor this
script fits and validates. QIB/NII/valuation/ROE/structure weights live in
engine.data.RUBRIC_WEIGHTS as a literature-cited (not locally back-tested)
overlay - see engine/score.py.
"""

import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.model_selection import LeaveOneOut

from engine.data import BACKTEST_RECORDS
from engine.features import gmp_ratio

MODEL_DIR = Path(__file__).parent / "model"
ALPHAS = [0.1, 0.3, 1.0, 3.0, 10.0, 30.0, 100.0]


def _build_dataset():
    X, y, companies = [], [], []
    for r in BACKTEST_RECORDS:
        X.append([gmp_ratio(r["gmp"], r["issue_price"])])
        y.append(r["actual_gain"])
        companies.append(r["company"])
    return np.array(X), np.array(y), companies


def _loocv_predict(X, y, alpha):
    n = len(y)
    preds = np.zeros(n)
    loo = LeaveOneOut()
    for train_idx, test_idx in loo.split(X):
        model = Ridge(alpha=alpha)
        model.fit(X[train_idx], y[train_idx])
        preds[test_idx] = model.predict(X[test_idx])
    return preds


def train():
    X, y, companies = _build_dataset()
    n = len(y)

    # Pick alpha via LOOCV grid search on out-of-fold MAE - never on
    # in-sample fit, or the "honest small-sample model" premise breaks.
    best_alpha, best_mae = None, np.inf
    for alpha in ALPHAS:
        mae = float(np.mean(np.abs(_loocv_predict(X, y, alpha) - y)))
        if mae < best_mae:
            best_mae, best_alpha = mae, alpha

    oof_preds = _loocv_predict(X, y, best_alpha)

    mae = float(np.mean(np.abs(oof_preds - y)))
    bias = float(np.mean(oof_preds - y))  # positive = model overestimates, negative = underestimates
    pearson_r = float(np.corrcoef(oof_preds, y)[0, 1])
    median_actual = float(np.median(y))
    mean_actual = float(np.mean(y))

    # "Directional accuracy" redefined to mean something real: did the model
    # correctly flag this listing as stronger- or weaker-than-typical versus
    # the historical median? (All 15 actual gains are positive here, so a
    # naive up/down sign check would be a trivial 100% no-op.)
    correct_side = np.sign(oof_preds - median_actual) == np.sign(y - median_actual)
    directional_accuracy = float(np.mean(correct_side)) * 100.0

    # Calibration correction fit on the OOF predictions themselves, so it
    # corrects the model's actual out-of-sample error pattern rather than
    # an optimistic in-sample residual.
    calibration = Ridge(alpha=1.0)
    calibration.fit(oof_preds.reshape(-1, 1), y)

    # Production model refit on all 15 rows at the honestly-chosen alpha.
    production_model = Ridge(alpha=best_alpha)
    production_model.fit(X, y)

    MODEL_DIR.mkdir(exist_ok=True)
    joblib.dump(production_model, MODEL_DIR / "gmp_gain_model.joblib")
    joblib.dump(calibration, MODEL_DIR / "calibration_model.joblib")

    backtest_rows = []
    for i, company in enumerate(companies):
        backtest_rows.append({
            "company": company,
            "gmp_ratio_pct": round(float(X[i][0]), 1),
            "predicted_gain_pct": round(float(oof_preds[i]), 1),
            "actual_gain_pct": round(float(y[i]), 1),
            "error_pp": round(float(oof_preds[i] - y[i]), 1),
            "correct_side": bool(correct_side[i]),
        })

    metrics = {
        "n_samples": n,
        "method": "Ridge regression on GMP/issue-price ratio; alpha chosen via leave-one-out CV grid search over out-of-fold MAE",
        "alpha": best_alpha,
        "loocv_mae_pp": round(mae, 2),
        "loocv_bias_pp": round(bias, 2),
        "loocv_bias_direction": "overestimation" if bias > 0 else "underestimation",
        "loocv_pearson_r": round(pearson_r, 3),
        "historical_median_actual_gain_pct": round(median_actual, 1),
        "historical_mean_actual_gain_pct": round(mean_actual, 1),
        "directional_accuracy_pct": round(directional_accuracy, 1),
        "directional_accuracy_definition": "Share of the 15 backtest listings where the out-of-fold prediction fell on the same side of the historical median actual gain as the real outcome.",
        "backtest_rows": backtest_rows,
    }
    (MODEL_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2))
    return metrics


if __name__ == "__main__":
    m = train()
    for key, value in m.items():
        if key != "backtest_rows":
            print(f"{key}: {value}")
