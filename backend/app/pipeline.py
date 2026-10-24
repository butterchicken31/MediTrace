import re

from .checks import run_checks
from .parser import ParsedLine, llm_normalize, parse_line

DISCLAIMER = ("Decision-support tool only. Not medical advice. Verify every alert with a "
              "qualified pharmacist or physician.")
MIN_MATCH = 0.55     # below this the brand is treated as unmatched
CONFIRM_BELOW = 0.85  # below this the UI should ask the user to confirm the match
DEFAULT_ML = 5.0


def build_item(db, p: ParsedLine, confirmed: dict) -> dict:
    liquid = p.volume_ml is not None or (p.form or "") in ("syrup", "syp", "syr", "susp", "suspension", "drop", "drops")
    solid = (p.form or "") in ("tab", "tabs", "tablet", "tablets", "t", "cap", "caps", "capsule", "capsules", "c")
    cands = db.candidates(p.brand_query, k=3, form_hint="liquid" if liquid else "solid" if solid or p.quantity else None)
    forced = confirmed.get(p.brand_query.lower()) or confirmed.get(p.raw.lower())
    idx, conf = None, 0.0
    if forced and db.exact.get(forced.lower()) is not None:
        idx, conf = db.exact[forced.lower()], 1.0
    elif cands and cands[0][1] >= MIN_MATCH:
        idx, conf = cands[0]

    assumptions = list(p.assumptions)
    ingredients, dbi = [], []
    row = {}
    if idx is not None:
        row = db.row(idx)
        dbi = db.interactions(idx)
        for c in db.composition(idx):
            per_dose = daily = None
            if c["mg"] is not None:
                if c["per_ml"]:  # liquid: strength is per N ml
                    vol = p.volume_ml
                    if vol is None:
                        vol = DEFAULT_ML
                        note = f"No volume given; assumed {DEFAULT_ML:g} ml per dose."
                        if note not in assumptions:
                            assumptions.append(note)
                    per_dose = c["mg"] * vol / c["per_ml"] * p.quantity
                else:
                    per_dose = c["mg"] * p.quantity
                daily = per_dose * p.doses_per_day
            ingredients.append({"name": c["name"], "mg": c["mg"], "per_ml": c["per_ml"], "unit": c["unit"],
                                "topical": c["topical"], "per_dose_mg": per_dose, "daily_mg": daily})
        for g in ingredients:  # tidy floats for the API
            for k in ("per_dose_mg", "daily_mg"):
                if g[k] is not None:
                    g[k] = round(g[k], 2)

    return {
        "raw": p.raw, "brand_query": p.brand_query,
        "match": db.names[idx] if idx is not None else None,
        "match_id": int(row["id"]) if row.get("id", "").isdigit() else None,
        "manufacturer": row.get("manufacturer_name"),
        "discontinued": db.discontinued[idx] if idx is not None else None,
        "confidence": round(conf, 2),
        "needs_confirmation": idx is not None and conf < CONFIRM_BELOW,
        "candidates": [{"name": db.names[i], "confidence": round(c, 2)} for i, c in cands],
        "dose": {"form": p.form, "quantity": p.quantity, "volume_ml": p.volume_ml,
                 "frequency": p.frequency, "duration_days": p.duration_days},
        "daily_doses": p.doses_per_day,
        "assumptions": assumptions,
        "ingredients": ingredients,
        "_dbi": dbi,
    }


def analyze(db, text: str, patient, confirmed: dict | None = None, use_llm: bool = False) -> dict:
    notes = []
    # split on newlines, ';' and on commas that start a new drug ("..., T augmentin"), not "Dolo 650, 1 TDS"
    sep = r"[\n;]+|,\s*(?!(?:od|bd|bid|tds|tid|qid|qds|hs|sos|prn|stat|after|before|for|x)\b)(?=[A-Za-z])"
    lines = [l for l in re.split(sep, text) if l and l.strip()]
    if use_llm:
        try:
            lines = llm_normalize(text)
        except Exception as e:  # missing key, rate limit, no network -> regex fallback
            notes.append(f"LLM parsing unavailable ({type(e).__name__}: {str(e)[:200]}); used regex parser.")
    items = [build_item(db, parse_line(l), {k.lower(): v for k, v in (confirmed or {}).items()}) for l in lines]
    alerts, totals = run_checks(items, patient)
    for it in items:
        it.pop("_dbi", None)
    summary = {t: sum(a["tier"] == t for a in alerts) for t in ("critical", "warning", "info")}
    summary["needs_confirmation"] = sum(i["needs_confirmation"] for i in items)
    summary["unmatched"] = sum(i["match"] is None for i in items)
    return {"patient": patient.model_dump(), "items": items, "totals": totals, "alerts": alerts,
            "summary": summary, "notes": notes, "disclaimer": DISCLAIMER}
