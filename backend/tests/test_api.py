import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

ADULT = {"age": 35, "weight_kg": 70}

def check(client, text, patient=ADULT):
    r = client.post("/check", json={"text": text, "patient": patient})
    assert r.status_code == 200, r.text
    return r.json()

def types(res, tier=None):
    return {(a["type"], a["tier"]) for a in res["alerts"] if tier in (None, a["tier"])}

def test_health(client):
    assert client.get("/health").json()["status"] == "ok"

def test_search(client):
    r = client.get("/search", params={"q": "dolo 650"}).json()
    assert r[0]["name"] == "Dolo 650 Tablet" and r[0]["ingredients"] == ["paracetamol"]

def test_strength_matters(client):
    res = check(client, "Dolo 650 1 TDS")
    assert res["items"][0]["match"] == "Dolo 650 Tablet"
    assert res["totals"]["paracetamol"] == 1950

def test_clean_prescription_has_no_alerts(client):
    res = check(client, "T. Augmentin 625 1 BD x 5d")
    assert res["alerts"] == [] and res["items"][0]["dose"]["duration_days"] == 5
    assert res["totals"]["amoxicillin"] == 1000

def test_hidden_paracetamol_duplicate_and_overdose(client):
    res = check(client, "Dolo 650 1 QID\nCrocin 500 1 QID")
    assert res["totals"]["paracetamol"] == 4600
    assert ("max_dose", "critical") in types(res)
    assert ("duplicate_ingredient", "warning") in types(res)

def test_combo_hides_paracetamol(client):
    res = check(client, "Dolo 650 1 TDS\nCombiflam 1 TDS")
    assert res["totals"]["paracetamol"] == 650 * 3 + 325 * 3
    assert ("duplicate_ingredient", "warning") in types(res)

def test_warfarin_nsaid(client):
    res = check(client, "Warf 5 1 OD\nVoveran 50 1 BD")
    assert ("interaction", "critical") in types(res)

def test_child_weight_based_dose(client):
    res = check(client, "Dolo 650 1 TDS", {"age": 8, "weight_kg": 20})
    assert ("max_dose", "critical") in types(res)

def test_child_without_weight(client):
    res = check(client, "Dolo 650 1 TDS", {"age": 8})
    assert ("weight_needed", "warning") in types(res)

def test_sos_assumes_worst_case(client):
    it = check(client, "Dolo 650 SOS")["items"][0]
    assert it["daily_doses"] == 4 and it["assumptions"]

def test_syrup_volume(client):
    it = check(client, "Syp Ascoril LS 5ml TDS")["items"][0]
    amb = next(g for g in it["ingredients"] if g["name"] == "ambroxol")
    assert amb["daily_mg"] == 90 and len(it["ingredients"]) == 3  # guaifenesin comes from salt_composition

def test_pattern_frequency(client):
    assert check(client, "Dolo 650 1-0-1")["items"][0]["daily_doses"] == 2

def test_renal_nsaid_and_metformin(client):
    res = check(client, "Voveran 50 BD\nGlycomet 500 BD", {"age": 60, "egfr": 25})
    assert {("renal", "critical")} <= types(res)

def test_elderly_sedating_antihistamine_plus_benzo(client):
    res = check(client, "Avil 25 1 HS\nAlprax 0.25 1 HS", {"age": 72})
    t = types(res)
    assert ("elderly_caution", "warning") in t and ("interaction", "warning") in t
    assert not any(a["type"] == "interaction_dataset" for a in res["alerts"])  # deduped vs curated

def test_cough_cold_fdc_under_4(client):
    res = check(client, "Ascoril D Plus 5ml BD", {"age": 3, "weight_kg": 14})
    assert ("age_contraindication", "critical") in types(res)

def test_topical_skipped_from_dose_math(client):
    res = check(client, "Anovate Cream BD")
    assert res["totals"] == {} and res["items"][0]["match"] == "Anovate Cream"

def test_unmatched_is_flagged_not_hidden(client):
    res = check(client, "Zzzqqx 500 BD")
    assert ("unmatched_brand", "warning") in types(res)

def test_confirmed_match_override(client):
    res = client.post("/check", json={"text": "Dolo 1 TDS", "patient": ADULT,
                      "confirmed_matches": {"dolo 1": "Crocin 500 Tablet"}}).json()
    assert res["items"][0]["match"] == "Crocin 500 Tablet" and res["items"][0]["confidence"] == 1.0
