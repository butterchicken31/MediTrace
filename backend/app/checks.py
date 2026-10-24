from collections import defaultdict

from . import rules as R

TIER_ORDER = {"critical": 0, "warning": 1, "info": 2}
DATASET_TIER = {"LIFE-THREATENING": "warning", "SERIOUS": "warning"}  # downgraded: dataset is unverified


def _a(tier, type_, message, ingredients=(), items=(), source="", idx=()):
    return {"tier": tier, "type": type_, "message": message, "ingredients": sorted(set(ingredients)),
            "items": [i for i in dict.fromkeys(items)], "source": source, "_idx": set(idx)}


def _distinct(s1, s2):
    return any(i != j for i in s1 for j in s2)


def _limit(rule, p):
    limit, basis = rule["adult"], "adult maximum"
    if rule.get("reduced") and (p.age >= 65 or p.liver_impairment or (p.weight_kg and p.weight_kg < 50)):
        limit, basis = rule["reduced"], "reduced limit (age 65+, liver impairment or weight <50 kg)"
    if p.age < 12:
        if not rule.get("ped_kg_day"):
            return None, "no_ped_rule"
        if not p.weight_kg:
            return None, "no_weight"
        limit = min(limit, rule["ped_kg_day"] * p.weight_kg)
        basis = f"{rule['ped_kg_day']} mg/kg/day x {p.weight_kg:g} kg"
    return limit, basis


def run_checks(items, p):
    alerts = []
    ing_items, totals = defaultdict(set), defaultdict(float)
    for i, it in enumerate(items):
        for g in it["ingredients"]:
            ing_items[g["name"]].add(i)
            if g["daily_mg"] is not None:
                totals[g["name"]] += g["daily_mg"]
    present = set(ing_items)
    names = lambda ing: [items[i]["match"] for i in sorted(ing_items[ing])]

    for i, it in enumerate(items):
        if not it["match"]:
            alerts.append(_a("warning", "unmatched_brand",
                             f'Could not identify "{it["brand_query"]}"; this line was NOT checked.',
                             items=[it["raw"]], idx=[i], source="matcher"))

    # ---- max dose
    for ing, total in totals.items():
        rule = R.MAX_DOSE.get(ing)
        if not rule or total <= 0:
            continue
        src = f"rules.MAX_DOSE.{ing}"
        limit, basis = _limit(rule, p)
        if limit is None:
            if basis == "no_weight":
                alerts.append(_a("warning", "weight_needed", f"{ing.title()}: child dose cannot be checked without weight.",
                                 [ing], names(ing), src, ing_items[ing]))
            else:
                alerts.append(_a("info", "paediatric_unverified", f"{ing.title()}: no paediatric rule in the rules table; dose not verified.",
                                 [ing], names(ing), src, ing_items[ing]))
            continue
        if total > limit:
            tier = "critical" if rule.get("high_risk") or total > 1.5 * limit else "warning"
            alerts.append(_a(tier, "max_dose",
                             f"{ing.title()} totals {total:.0f} mg/day, above the {limit:.0f} mg/day limit ({basis}).",
                             [ing], names(ing), src, ing_items[ing]))
        elif rule.get("high_risk") and total >= 0.9 * limit:
            alerts.append(_a("warning", "near_max_dose",
                             f"{ing.title()} totals {total:.0f} mg/day, within 10% of the {limit:.0f} mg/day limit ({basis}).",
                             [ing], names(ing), src, ing_items[ing]))
        per_kg = rule.get("ped_kg_dose")
        if per_kg and p.age < 12 and p.weight_kg:
            for i in ing_items[ing]:
                g = next(x for x in items[i]["ingredients"] if x["name"] == ing)
                if g["per_dose_mg"] and g["per_dose_mg"] > per_kg * p.weight_kg * 1.2:
                    alerts.append(_a("warning", "single_dose_high",
                                     f"{ing.title()} single dose {g['per_dose_mg']:.0f} mg exceeds {per_kg} mg/kg ({per_kg * p.weight_kg:.0f} mg).",
                                     [ing], [items[i]["match"]], src, [i]))

    # ---- duplicate ingredients
    for ing, idxs in ing_items.items():
        if len(idxs) < 2:
            continue
        rule, total = R.MAX_DOSE.get(ing), totals.get(ing)
        trivial = ing in R.TRIVIAL_DUP or (rule and total is not None and total < 0.25 * rule["adult"])
        extra = f" Combined: {total:.0f} mg/day." if total else ""
        alerts.append(_a("info" if trivial else "warning", "duplicate_ingredient",
                         f"{ing.title()} appears in {len(idxs)} medicines: {', '.join(names(ing))}.{extra}",
                         [ing], names(ing), "duplicate_check", idxs))
    for cls in R.DUP_CLASSES:
        members = [m for m in present if m in R.CLASSES[cls]]
        if len(members) < 2:
            continue
        its = set().union(*(ing_items[m] for m in members))
        if len(its) >= 2 and _distinct(*[ing_items[m] for m in members[:2]]):
            alerts.append(_a("warning", "class_duplication",
                             f"Two or more {cls.replace('_', ' ')} drugs prescribed: {', '.join(sorted(members))}.",
                             members, [items[i]["match"] for i in sorted(its)], f"rules.DUP_CLASSES.{cls}", its))

    # ---- curated interactions
    seen = set()
    for a, b, tier, msg in R.INTERACTIONS:
        A, B = R.resolve(a), R.resolve(b)
        xs, ys = sorted(present & A), sorted(present & B)
        pairs = ([(x, y) for k, x in enumerate(xs) for y in xs[k + 1:]] if a == b
                 else [(x, y) for x in xs for y in ys if x != y])
        for x, y in pairs:
            key = frozenset((x, y))
            if key in seen or not _distinct(ing_items[x], ing_items[y]):
                continue
            seen.add(key)
            idx = ing_items[x] | ing_items[y]
            alerts.append(_a(tier, "interaction", f"{x.title()} + {y.title()}: {msg}", [x, y],
                             [items[i]["match"] for i in sorted(idx)], f"rules.INTERACTIONS.{a}+{b}", idx))

    # ---- dataset interactions (second source, downgraded, deduped against curated)
    for i, it in enumerate(items):
        mine = {g["name"] for g in it["ingredients"]}
        for drug, effect in it.get("_dbi", []):
            for y in present:
                if y != drug or not _distinct({i}, ing_items[y]) or any(frozenset((x, y)) in seen for x in mine):
                    continue
                for x in mine:
                    seen.add(frozenset((x, y)))
                idx = {i} | ing_items[y]
                alerts.append(_a(DATASET_TIER.get(effect, "info"), "interaction_dataset",
                                 f"{it['match']} lists {y.title()} as an interacting drug (dataset severity: {effect.title() or 'unknown'}). "
                                 "Unverified dataset entry; confirm with a pharmacist.",
                                 [y], [items[j]["match"] for j in sorted(idx)], "dataset.drug_interactions", idx))

    # ---- patient context
    def hit(target):
        return sorted(present & R.resolve(target))

    for target, below, tier, msg in R.AGE_RULES:
        for ing in hit(target):
            if p.age < below:
                alerts.append(_a(tier, "age_contraindication", f"{ing.title()}: {msg}", [ing], names(ing),
                                 f"rules.AGE_RULES.{target}", ing_items[ing]))
    if p.age < 4:
        for i, it in enumerate(items):
            have = {g["name"] for g in it["ingredients"]}
            if {"chlorpheniramine", "phenylephrine"} <= have:
                alerts.append(_a("critical", "age_contraindication",
                                 "Chlorpheniramine + phenylephrine combination must not be used under 4 years "
                                 "(CDSCO directive, Dec 2023; verify current status).",
                                 ["chlorpheniramine", "phenylephrine"], [it["match"]], "rules.cdsco_fdc_under4", [i]))
    if p.age >= 65:
        for target, tier, msg in R.ELDERLY_RULES:
            for ing in hit(target):
                alerts.append(_a(tier, "elderly_caution", f"{ing.title()}: {msg}", [ing], names(ing),
                                 f"rules.ELDERLY_RULES.{target}", ing_items[ing]))
    if p.egfr is not None:
        for target, crit, warn, msg in R.RENAL_RULES:
            for ing in hit(target):
                if p.egfr < warn:
                    alerts.append(_a("critical" if p.egfr < crit else "warning", "renal",
                                     f"{ing.title()} with eGFR {p.egfr:g}: {msg}", [ing], names(ing),
                                     f"rules.RENAL_RULES.{target}", ing_items[ing]))
    if p.pregnant:
        for target, tier, msg in R.PREGNANCY_RULES:
            for ing in hit(target):
                alerts.append(_a(tier, "pregnancy", f"{ing.title()}: {msg}", [ing], names(ing),
                                 f"rules.PREGNANCY_RULES.{target}", ing_items[ing]))

    alerts.sort(key=lambda a: (TIER_ORDER[a["tier"]], a["type"]))
    for n, a in enumerate(alerts, 1):
        a["id"] = f"A{n}"
        a.pop("_idx")
    return alerts, {k: round(v, 1) for k, v in totals.items()}
