"""Static IPO datasets. Same values as the original Streamlit app's inline
DataFrames, just relocated so the training script and the API share one
source of truth instead of two independently hand-typed copies.

BACKTEST_RECORDS intentionally carries only the fields that were present in
the original app.py backtest table (company, cohort, date, issue price, GMP,
actual listing gain). QIB/NII/ROE/valuation data was never recorded for
these 15 historical listings, so it is not fabricated here - the scoring
engine treats GMP as the only factor with real historical ground truth and
keeps the other factors as a clearly-labelled, literature-informed rubric
that applies only to the 4 live overview IPOs (which do have that data).
"""

OVERVIEW_RECORDS = [
    {
        "company": "Tempsens Instruments (India) Ltd.",
        "status": "Closed / Awaiting Listing",
        "issue_price": 300.0,
        "issue_size_cr": 820.0,
        "gmp": 290.0,
        "gmp_source": "InvestorGain OTC Desk",
        "gmp_timestamp": "23 Aug 2026, 14:43 IST",
        "gmp_health": "Verified (Cross-checked)",
        "qib_subscription": 215.0,
        "nii_subscription": 142.5,
        "roe_pct": 24.5,
        "asking_pe": 38.5,
        "peer_median_pe": 45.0,
        "fresh_issue_ratio_pct": 80.0,
    },
    {
        "company": "Augmont Enterprises Ltd.",
        "status": "Open",
        "issue_price": 788.0,
        "issue_size_cr": 1250.0,
        "gmp": 310.0,
        "gmp_source": "Chittorgarh Market Intelligence",
        "gmp_timestamp": "23 Aug 2026, 12:15 IST",
        "gmp_health": "Partial (OTC Feed)",
        "qib_subscription": 12.4,
        "nii_subscription": 28.1,
        "roe_pct": 19.8,
        "asking_pe": 42.1,
        "peer_median_pe": 40.0,
        "fresh_issue_ratio_pct": 60.0,
    },
    {
        "company": "Skyways Air Services Ltd.",
        "status": "Open",
        "issue_price": 138.0,
        "issue_size_cr": 45.0,
        "gmp": 45.0,
        "gmp_source": "InvestorGain OTC Desk",
        "gmp_timestamp": "23 Aug 2026, 13:00 IST",
        "gmp_health": "Partial (OTC Feed)",
        "qib_subscription": 4.2,
        "nii_subscription": 11.5,
        "roe_pct": 15.2,
        "asking_pe": 28.4,
        "peer_median_pe": 32.0,
        "fresh_issue_ratio_pct": 100.0,
    },
    {
        "company": "ABH Healthcare Ltd.",
        "status": "Upcoming",
        "issue_price": 102.0,
        "issue_size_cr": 110.0,
        "gmp": None,
        "gmp_source": "N/A - Unlisted / Pre-RHP",
        "gmp_timestamp": "N/A",
        "gmp_health": "Unavailable",
        "qib_subscription": None,
        "nii_subscription": None,
        "roe_pct": 11.0,
        "asking_pe": 52.0,
        "peer_median_pe": 44.0,
        "fresh_issue_ratio_pct": 50.0,
    },
]

# Historical walk-forward backtest cohort - GMP and actual_gain are the only
# fields that were present in the original dataset for these 15 listings.
BACKTEST_RECORDS = [
    {"company": "DOMS Industries Ltd.", "cohort": "2022-2023 Train", "date": "2023-12-20", "issue_price": 790, "gmp": 530, "actual_gain": 77.6},
    {"company": "Inox CWA Ltd.", "cohort": "2022-2023 Train", "date": "2023-12-21", "issue_price": 660, "gmp": 555, "actual_gain": 90.7},
    {"company": "Happy Forgings Ltd.", "cohort": "2022-2023 Train", "date": "2023-12-27", "issue_price": 850, "gmp": 220, "actual_gain": 46.7},
    {"company": "Mufti (Credo Brands)", "cohort": "2022-2023 Train", "date": "2023-12-27", "issue_price": 280, "gmp": 135, "actual_gain": 62.7},
    {"company": "Jyoti CNC Automation", "cohort": "2024 Validation", "date": "2024-01-16", "issue_price": 331, "gmp": 45, "actual_gain": 19.7},
    {"company": "Medi Assist Healthcare", "cohort": "2024 Validation", "date": "2024-01-23", "issue_price": 418, "gmp": 38, "actual_gain": 19.7},
    {"company": "BLS E-Services Ltd.", "cohort": "2024 Validation", "date": "2024-02-06", "issue_price": 135, "gmp": 160, "actual_gain": 112.0},
    {"company": "Exicom Tele-Systems", "cohort": "2024 Validation", "date": "2024-03-05", "issue_price": 142, "gmp": 170, "actual_gain": 107.8},
    {"company": "JG Chemicals Ltd.", "cohort": "2024 Validation", "date": "2024-03-13", "issue_price": 221, "gmp": 30, "actual_gain": 29.4},
    {"company": "Kross Ltd.", "cohort": "2025 Test", "date": "2024-09-16", "issue_price": 240, "gmp": 0, "actual_gain": 12.2},
    {"company": "Tolins Tyres Ltd.", "cohort": "2025 Test", "date": "2024-09-16", "issue_price": 226, "gmp": 30, "actual_gain": 22.7},
    {"company": "Northern Arc Capital", "cohort": "2025 Test", "date": "2024-09-24", "issue_price": 263, "gmp": 128, "actual_gain": 64.4},
    {"company": "Premier Energies Ltd.", "cohort": "2025 Test", "date": "2024-09-03", "issue_price": 450, "gmp": 350, "actual_gain": 120.0},
    {"company": "Baazar Style Retail", "cohort": "2025 Test", "date": "2024-09-03", "issue_price": 389, "gmp": 110, "actual_gain": 31.0},
    {"company": "PN Gadgil Jewellers", "cohort": "2025 Test", "date": "2024-09-10", "issue_price": 480, "gmp": 330, "actual_gain": 73.5},
]

# Fixed weights (100-point scale) for the transparent Model Score scorecard.
# Values reflect published empirical correlations with Indian IPO listing
# returns: GMP r~0.80-0.89, QIB subscription r~0.82 (Suresh, 2012, PES
# University). Only the GMP factor has row-level historical ground truth in
# BACKTEST_RECORDS, so only GMP feeds the regression-based % gain estimates
# below; QIB/NII/valuation/ROE/structure stay a transparent, literature-cited
# rubric used solely for the 0-100 Model Score and the bounded overlay
# adjustment - both are clearly labelled as not locally back-tested, since
# this dataset has no historical rows pairing them with actual outcomes.
RUBRIC_WEIGHTS = {
    "gmp_ratio": 35.0,
    "qib_subscription": 25.0,
    "nii_subscription": 15.0,
    "pe_discount": 10.0,
    "roe_pct": 10.0,
    "fresh_issue_ratio_pct": 5.0,
}
