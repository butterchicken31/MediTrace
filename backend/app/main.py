import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import rules as R
from .data import MedicineDB
from .pipeline import DISCLAIMER, analyze


class Patient(BaseModel):
    age: float = Field(..., ge=0, le=120, description="Years (use decimals for infants)")
    weight_kg: Optional[float] = Field(None, gt=0, le=300)
    egfr: Optional[float] = Field(None, ge=0, le=200, description="mL/min/1.73m2")
    liver_impairment: bool = False
    pregnant: bool = False


class PrescriptionRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    patient: Patient
    confirmed_matches: dict[str, str] = Field(
        default_factory=dict, description='{"dolo 650": "Dolo 650 Tablet"} to override a brand match')
    use_llm: bool = Field(False, description="Normalise messy text with Groq first (needs GROQ_API_KEY)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = MedicineDB(os.environ.get("DATA_PATH", "data/medicines.csv"))
    print(f"Loaded {len(app.state.db)} medicines")
    yield


app = FastAPI(title="Prescription Safety Checker", version="0.1", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),  # set to your Vercel URL in prod
    allow_methods=["*"], allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "medicines": len(app.state.db)}


@app.get("/search")
def search(q: str = Query(..., min_length=2), limit: int = Query(5, ge=1, le=10)):
    db = app.state.db
    return [{"id": db.row(i).get("id"), "name": db.names[i], "confidence": round(c, 2),
             "ingredients": [g["name"] for g in db.composition(i)]}
            for i, c in db.candidates(q, k=limit)]


@app.post("/check")
def check(req: PrescriptionRequest):
    if not req.text.strip():
        raise HTTPException(422, "Empty prescription")
    return analyze(app.state.db, req.text, req.patient, req.confirmed_matches, req.use_llm)


@app.get("/rules")
def get_rules():
    """The full rules table, so a pharmacist can review exactly what the checker uses."""
    return {"disclaimer": DISCLAIMER, "max_dose": R.MAX_DOSE,
            "interactions": [dict(a=a, b=b, tier=t, message=m) for a, b, t, m in R.INTERACTIONS],
            "classes": {k: sorted(v) for k, v in R.CLASSES.items()}}
