# Prescription Safety Checker: backend

FastAPI service. Reads a typed prescription, matches Indian brands against the
[Indian-Medicine-Dataset](https://github.com/junioralive/Indian-Medicine-Dataset), sums doses per
active ingredient across all brands, and returns tiered alerts.

## Run locally
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload      # downloads data/medicines.csv on first start (~45 MB)
pytest                              # 18 tests, use a tiny fixture CSV
```
Interactive docs for the frontend dev: http://localhost:8000/docs

## Endpoints
| | |
|---|---|
| `GET /health` | warm-up ping (hit it before your demo on Render) |
| `GET /search?q=dolo` | brand autocomplete, returns name, confidence and ingredients |
| `POST /check` | main call (below) |
| `GET /rules` | the complete rules table, for the pharmacist to review |

### POST /check
```json
{
  "text": "Dolo 650 1 QID\nCombiflam 1 TDS\nSyp Ascoril LS 5ml TDS",
  "patient": {"age": 35, "weight_kg": 70, "egfr": null, "liver_impairment": false, "pregnant": false},
  "confirmed_matches": {"dolo 650": "Dolo 650 Tablet"},
  "use_llm": false
}
```
Response: `items[]` (match, confidence, `needs_confirmation`, top-3 `candidates`, ingredients with
`per_dose_mg`/`daily_mg`, `assumptions`), `totals{ingredient: mg/day}`, `alerts[]` sorted
critical > warning > info (each has `tier`, `type`, `message`, `ingredients`, `items`, `source`),
`summary` counts, `notes`, `disclaimer`.

**Frontend rule of thumb for alert fatigue:** show `critical` expanded, `warning` collapsed, `info` hidden
behind a toggle. When `needs_confirmation` is true, show `candidates` and re-POST with `confirmed_matches`.

Accepted line styles: `T. Augmentin 625 1 BD x 5d`, `Dolo 650 1-0-1`, `Syp Ascoril LS 5ml TDS`,
`Dolo 650 SOS` (assumes 4 doses/day worst case), `2 tabs Dolo 650 TDS`.

## Deploy
Render (free web service): build `pip install -r requirements.txt`, start
`uvicorn app. main: app --host 0.0.0.0 --port $PORT`. Or use the Dockerfile on Hugging Face Spaces (port 7860).
Env vars: `CORS_ORIGINS` (your frontend URL, comma-separated; defaults to `*`), `GROQ_API_KEY` (optional),
`DATA_PATH` (optional). RAM use is about 250 MB with the full dataset, so keep the free tier's 512 MB in mind.

## Honest limitations 
- `rules.py` values are starter values; **a pharmacist must verify them.** Nothing here is validated clinically.
- The dataset's own `drug_interactions` column looks noisy (e.g. antacids and efavirenz listed against
  ranitidine), so those alerts are downgraded to warning or info and labelled unverified.
- Only systemic oral doses are summed. Creams (%) and IU-based vitamins are skipped from dose math.
- Liquids without a volume assume 5 ml per dose (recorded in `assumptions`).
- No dose-vs-indication checks, no renal dose adjustment of antibiotics, no allergy input yet.
