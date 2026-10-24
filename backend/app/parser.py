import json
import os
import re
from dataclasses import dataclass, field
from typing import Optional

SOS_ASSUMED_DOSES = 4  # worst-case doses/day assumed for SOS/PRN
FREQ = {"od": 1, "qd": 1, "daily": 1, "once daily": 1, "bd": 2, "bid": 2, "twice daily": 2,
        "tds": 3, "tid": 3, "thrice daily": 3, "qid": 4, "qds": 4, "hs": 1, "at night": 1,
        "bedtime": 1, "stat": 1, "sos": None, "prn": None}

_FREQ_RE = re.compile(
    r"\b(?:once daily|twice daily|thrice daily|at night|every \d+ hours?|q\d{1,2}h|"
    r"od|qd|bd|bid|tds|tid|qid|qds|hs|sos|prn|stat|daily|bedtime)\b", re.I)
_PATTERN_RE = re.compile(r"\b(\d(?:\.5)?)\s*[-–]\s*(\d(?:\.5)?)\s*[-–]\s*(\d(?:\.5)?)(?:\s*[-–]\s*(\d(?:\.5)?))?\b")
_DUR_RE = [re.compile(r"(?:\bx\s*|\bfor\s+)(\d+)\s*(days?|d|weeks?|wks?|w|months?|m)\b", re.I),
           re.compile(r"\b(\d+)\s*(days?|weeks?|wks?|months?)\b", re.I)]
_VOL_RE = re.compile(r"\b(\d+(?:\.\d+)?)\s*(ml|tsp|tbsp|teaspoons?|tablespoons?)\b", re.I)
_QTY_RE = re.compile(r"(1/2|½|half|\d+(?:\.\d+)?)\s*(tabs?|tablets?|caps?|capsules?|puffs?)?\s*$", re.I)
_FORM_RE = re.compile(
    r"^(?:(tablets?|tabs?|capsules?|caps?|syrup|syp|syr|susp(?:ension)?|inj(?:ection)?|"
    r"oint(?:ment)?|cream|gel|drops?)\b\.?|([tc])(?:\.|\s+(?=[A-Za-z]{3})))\s*", re.I)
_NOISE_RE = re.compile(r"\b(?:pc|ac|after food|before food|after meals?|before meals?|with water|empty stomach)\b", re.I)


@dataclass
class ParsedLine:
    raw: str
    brand_query: str
    form: Optional[str] = None
    quantity: float = 1.0
    volume_ml: Optional[float] = None
    frequency: Optional[str] = None
    doses_per_day: float = 1.0
    duration_days: Optional[int] = None
    assumptions: list = field(default_factory=list)


def _to_float(t: str) -> float:
    return 0.5 if t.lower() in ("1/2", "½", "half") else float(t)


def _doses(token: str) -> Optional[float]:
    t = token.lower()
    if t in FREQ:
        return FREQ[t]
    m = re.match(r"q(\d+)h$", t) or re.match(r"every (\d+) hours?$", t)
    return 24 / int(m.group(1)) if m else 1


def _cut(s: str, m: re.Match) -> str:
    return s[:m.start()] + " " + s[m.end():]


def parse_line(raw: str) -> ParsedLine:
    s = re.sub(r"^\s*(?:\d+[.)]\s+|[-*•]\s*)", "", raw.strip())
    s = re.sub(r"([A-Za-z]{3,})(\d)", r"\1 \2", s)  # dolo650 -> dolo 650
    p = ParsedLine(raw=raw.strip(), brand_query="")
    lead = re.match(r"^(\d+(?:\.\d+)?)\s+(?=[A-Za-z])", s)  # '1 Tab Dolo 650 TDS'
    if lead and float(lead.group(1)) <= 10:
        p.quantity, s = float(lead.group(1)), s[lead.end():]
    m = _FORM_RE.match(s)
    if m:
        p.form, s = (m.group(1) or m.group(2)).lower(), s[m.end():]

    doses = None
    m = _PATTERN_RE.search(s)  # '1-0-1'
    if m:
        doses = sum(float(x) for x in m.groups() if x)
        p.frequency, p.quantity, s = m.group(0), 1.0, _cut(s, m)

    for rx in _DUR_RE:
        m = rx.search(s)
        if m:
            mult = {"d": 1, "w": 7, "m": 30}[m.group(2)[0].lower()]
            p.duration_days, s = int(m.group(1)) * mult, _cut(s, m)
            break

    m = _VOL_RE.search(s)
    if m:
        u = m.group(2).lower()
        vol = float(m.group(1)) * (5 if u.startswith(("tsp", "teasp")) else 15 if u.startswith(("tbsp", "tablesp")) else 1)
        if vol <= 30:  # larger numbers are pack sizes ('100ml'), not doses
            p.volume_ml = vol
        s = _cut(s, m)

    if doses is None:
        m = _FREQ_RE.search(s)
        if m:
            p.frequency, doses = m.group(0).upper(), _doses(m.group(0))
            before = s[:m.start()]
            q = _QTY_RE.search(before)
            if q:
                val = _to_float(q.group(1))
                # a lone number after the brand is a strength ('Dolo 650 TDS'), not a quantity
                if val <= 10 and (q.group(2) or re.search(r"\d", before[:q.start()]) or val == 0.5):
                    p.quantity, before = val, before[:q.start()]
            s = before + " " + s[m.end():]
    if doses is None and p.frequency is None:
        doses = 1
        p.assumptions.append("No frequency found; assumed once daily.")
    elif doses is None:  # SOS / PRN
        doses = SOS_ASSUMED_DOSES
        p.assumptions.append(f"{p.frequency}: worst case of {SOS_ASSUMED_DOSES} doses/day assumed.")
    p.doses_per_day = doses

    s = _NOISE_RE.sub(" ", s)
    s = re.sub(r"[,;:]+", " ", s)
    p.brand_query = re.sub(r"\s+", " ", s).strip(" .-x")
    return p


# ---------------------------------------------------------------- optional LLM
def llm_normalize(text: str) -> list[str]:
    """Groq turns messy text into clean 'Brand Strength FREQ x Nd' lines.
    The regex parser still does all dose semantics; the LLM never decides doses or safety."""
    from groq import Groq
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    models = [m for m in (os.environ.get("GROQ_MODEL"), "openai/gpt-oss-120b",
                          "qwen/qwen3.6-27b", "openai/gpt-oss-20b") if m]
    last = None
    for model in models:  # model names churn; fall through until one works
        try:
            resp = client.chat.completions.create(
                model=model, response_format={"type": "json_object"}, temperature=0,
                messages=[
                    {"role": "system", "content":
                        'Extract prescription lines as JSON: {"items":[{"brand":str,"strength":str|null,'
                        '"frequency":"OD|BD|TDS|QID|HS|SOS"|null,"duration_days":int|null}]}. '
                        "Do not infer or add drugs. Output JSON only."},
                    {"role": "user", "content": text}])
            break
        except Exception as e:
            last = e
    else:
        raise last
    lines = []
    for it in json.loads(resp.choices[0].message.content)["items"]:
        line = f"{it['brand']} {it.get('strength') or ''} {it.get('frequency') or ''}"
        if it.get("duration_days"):
            line += f" x {it['duration_days']}d"
        lines.append(re.sub(r"\s+", " ", line).strip())
    return lines
