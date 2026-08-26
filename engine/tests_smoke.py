"""Smoke checks for the invariants that were broken in the original app:
- Model Score must equal the sum of its own displayed breakdown (bug #1).
- Risk Category must never contradict the risk flags list (bug #6).
- Backtest bias sign/label must be internally consistent (bug #3).
- System health must require ALL scoreable IPOs verified, not >=1 (bug #4).
- The comparison endpoint must actually enforce 2-4 companies (bug #9).

Run with: python -m engine.tests_smoke
"""

from fastapi.testclient import TestClient

from backend.main import app
from engine.score import get_metrics, score_overview

client = TestClient(app)


def check_score_matches_breakdown():
    for result in score_overview():
        score = result["score"]
        if score["model_score"] is None:
            continue
        points = [c["points"] for c in score["breakdown"].values()]
        assert all(p is not None for p in points), f"{result['record']['company']}: partial breakdown but a model_score was set"
        total = round(sum(points), 1)
        assert total == score["model_score"], (
            f"{result['record']['company']}: model_score={score['model_score']} != breakdown sum={total}"
        )
    print("OK: model_score == sum(breakdown points) for every scoreable IPO")


def check_risk_category_matches_flags():
    from engine.score import risk_flags_and_category
    from engine.data import OVERVIEW_RECORDS

    for record in OVERVIEW_RECORDS:
        flags, category = risk_flags_and_category(record)
        real_flag_count = 0 if flags and flags[0].startswith("No critical risk flags") else len(flags)
        expected = "Low Risk" if real_flag_count == 0 else ("Moderate Risk" if real_flag_count == 1 else "High Risk")
        assert category == expected, f"{record['company']}: category={category} but {real_flag_count} real flag(s) implies {expected}"
    print("OK: risk_category always matches the flags that produced it")


def check_bias_sign_matches_label():
    metrics = get_metrics()
    bias = metrics["loocv_bias_pp"]
    direction = metrics["loocv_bias_direction"]
    expected = "overestimation" if bias > 0 else "underestimation"
    assert direction == expected, f"bias={bias} but labelled {direction}"
    print(f"OK: bias {bias:+.2f}pp correctly labelled '{direction}'")


def check_system_health_requires_all_verified():
    results = score_overview()
    from engine.score import system_health
    scoreable = [r for r in results if r["score"]["model_score"] is not None]
    all_verified = all(r["data_health"] == "Fully Verified" for r in scoreable)
    health = system_health(results)
    expected = "Fully Verified" if all_verified else "Partial"
    assert health == expected, f"system_health={health}, expected {expected} given {[r['data_health'] for r in scoreable]}"
    print(f"OK: system_health='{health}' correctly requires ALL scoreable IPOs verified (not just one)")


def check_compare_enforces_2_to_4():
    r0 = client.get("/api/compare", params={"companies": ["Tempsens Instruments (India) Ltd."]})
    assert r0.status_code == 400, f"1 company should be rejected, got {r0.status_code}"

    r2 = client.get("/api/compare", params={"companies": ["Tempsens Instruments (India) Ltd.", "Augmont Enterprises Ltd."]})
    assert r2.status_code == 200, f"2 companies should be accepted, got {r2.status_code}"

    five = ["Tempsens Instruments (India) Ltd.", "Augmont Enterprises Ltd.", "Skyways Air Services Ltd.", "ABH Healthcare Ltd.", "Tempsens Instruments (India) Ltd."]
    r5 = client.get("/api/compare", params={"companies": five})
    assert r5.status_code == 400, f"5 companies should be rejected, got {r5.status_code}"
    print("OK: /api/compare rejects <2 and >4 companies, accepts 2-4")


def check_api_endpoints_respond():
    for path in ["/api/overview", "/api/companies", "/api/backtest", "/api/factor-drivers", "/api/methodology", "/api/data-sources"]:
        r = client.get(path)
        assert r.status_code == 200, f"{path} returned {r.status_code}"
    print("OK: all /api/* JSON endpoints return 200")


if __name__ == "__main__":
    check_score_matches_breakdown()
    check_risk_category_matches_flags()
    check_bias_sign_matches_label()
    check_system_health_requires_all_verified()
    check_compare_enforces_2_to_4()
    check_api_endpoints_respond()
    print("\nALL SMOKE CHECKS PASSED")
