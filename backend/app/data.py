import json
import os
import re
import urllib.request

import pandas as pd
from rapidfuzz import fuzz, process

from .rules import normalize_name

CSV_URL = ("https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/"
           "main/DATA/updated_indian_medicine_data.csv")
KEEP = {"id", "name", "price", "Is_discontinued", "manufacturer_name", "type", "pack_size_label",
        "short_composition1", "short_composition2", "salt_composition", "drug_interactions"}

_MG = {"mg": 1.0, "g": 1000.0, "gm": 1000.0, "mcg": 0.001, "ug": 0.001, "µg": 0.001}
_PART = re.compile(
    r"\s*([^()]+?)\s*\(\s*([\d.,]+)\s*([a-zA-Zµ%]+)?\s*(?:/\s*([\d.]*)\s*([a-zA-Z]+))?[^)]*\)")
_NUM = re.compile(r"\d+(?:\.\d+)?")
_LIQUID = re.compile(r"syrup|suspension|drops?|solution|liquid|elixir|emulsion|lotion|spray")


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9. ]", " ", s.lower())).strip()


def parse_composition(text: str) -> list[dict]:
    """'Amoxycillin (500mg) + Clavulanic Acid (125mg)' -> [{name, mg, per_ml, topical,...}]"""
    out = []
    for part in (text or "").split("+"):
        part = part.strip()
        if not part:
            continue
        m = _PART.match(part)
        if not m:
            out.append(dict(name=normalize_name(part), unit=None, amount=None, mg=None,
                            per_ml=None, topical=False))
            continue
        name, amt, unit, per, per_unit = m.groups()
        try:
            amount = float(amt.replace(",", ""))
        except ValueError:
            amount = None
        unit = (unit or "").lower() or None
        per_unit = (per_unit or "").lower()
        topical = unit == "%" or per_unit in ("g", "gm")
        mg = amount * _MG[unit] if (amount is not None and unit in _MG and not topical) else None
        per_ml = None
        if per_unit == "ml":
            per_ml = float(per) if per else 1.0
        out.append(dict(name=normalize_name(name), unit=unit, amount=amount, mg=mg,
                        per_ml=per_ml, topical=topical))
    return out


class MedicineDB:
    def __init__(self, path: str):
        if not os.path.exists(path):
            os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
            print(f"Downloading dataset to {path} ...")
            urllib.request.urlretrieve(CSV_URL, path)
        df = pd.read_csv(path, dtype=str, keep_default_na=False, usecols=lambda c: c in KEEP)
        df = df[df["name"].str.strip() != ""].reset_index(drop=True)
        self.df = df
        self.names = df["name"].tolist()
        self.norm = [_norm(n) for n in self.names]
        self.discontinued = (df["Is_discontinued"].str.upper() == "TRUE").tolist()
        self.by_first = {}
        for i, n in enumerate(self.norm):
            if n:
                self.by_first.setdefault(n.split()[0], []).append(i)
        self.exact = {}
        for i, n in enumerate(self.names):
            self.exact.setdefault(n.lower(), i)

    def __len__(self):
        return len(self.names)

    def row(self, idx: int) -> dict:
        return self.df.iloc[idx].to_dict()

    def candidates(self, query: str, k: int = 3, form_hint: str | None = None) -> list[tuple[int, float]]:
        """form_hint: 'solid' (tablet/capsule), 'liquid' (syrup/drops/suspension) or None."""
        q = _norm(query)
        if not q:
            return []
        first = q.split()[0]
        hits = self._search(q, self.by_first.get(first))
        if not hits or hits[0][1] < 85:  # no same-first-word brand, or likely a typo: search everything
            hits += self._search(q, None)
        qnums = set(_NUM.findall(q))
        qalpha = _NUM.sub(" ", q).strip()
        scored = {}
        for idx, score in hits:
            n = self.norm[idx]
            nalpha = _NUM.sub(" ", n).strip()
            if qalpha and fuzz.WRatio(qalpha, nalpha) < 65:
                score -= 45  # the name itself must match; a shared strength ('500') is not enough
            # first word must resemble the candidate's first word ('string' is not 'Strigesic' or 'Dentakind')
            if qalpha and nalpha and fuzz.ratio(qalpha.split()[0], nalpha.split()[0]) < 70:
                score -= 30
            if qnums:  # strength digits matter: 'dolo 650' must not match 'dolo 500'
                score += 8 if qnums <= set(_NUM.findall(n)) else -20
            if n.split()[0] == first:
                score += 10  # 'pan 40' should mean Pan, not Asopan
            if n.startswith(q):
                score += 3
            if form_hint:
                is_liquid = bool(_LIQUID.search(n))
                score += 4 if (form_hint == "liquid") == is_liquid else 0
            if self.discontinued[idx]:
                score -= 5
            score -= min(max(len(n) - len(q), 0), 30) * 0.1  # prefer the tighter name
            scored[idx] = max(0.0, min(100.0, score)) / 100
        return sorted(scored.items(), key=lambda t: -t[1])[:k]

    def _search(self, q, pool):
        if pool is None:
            return [(i, sc) for _, sc, i in process.extract(q, self.norm, scorer=fuzz.WRatio, limit=30, score_cutoff=50)]
        names = [self.norm[i] for i in pool]
        return [(pool[j], sc) for _, sc, j in process.extract(q, names, scorer=fuzz.WRatio, limit=30, score_cutoff=50)]

    def composition(self, idx: int) -> list[dict]:
        r = self.row(idx)
        short = " + ".join(x for x in (r.get("short_composition1", ""), r.get("short_composition2", "")) if x.strip())
        a, b = parse_composition(r.get("salt_composition", "")), parse_composition(short)
        # salt_composition is usually complete (short_* drops the 3rd ingredient), but is blank for some rows
        return a if len(a) >= len(b) else b

    def interactions(self, idx: int) -> list[tuple[str, str]]:
        raw = self.row(idx).get("drug_interactions", "")
        try:
            d = json.loads(raw)
            return [(normalize_name(x), (e or "").upper()) for x, e in zip(d["drug"], d["effect"])]
        except Exception:
            return []
