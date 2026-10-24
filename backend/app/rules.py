"""
Rule tables.

!! STARTER VALUES from general references. A pharmacist MUST review every
!! number and pair here before this is used for anything beyond a demo.
Everything the checker flags traces back to a key in this file (see `source`
on each alert), so a reviewer can edit one place.
"""
import re

# ---------------------------------------------------------------- names
SALT_WORDS = {
    "maleate", "hydrobromide", "hydrochloride", "hcl", "sodium", "potassium",
    "besilate", "besylate", "succinate", "tartrate", "sulphate", "sulfate",
    "phosphate", "mesylate", "dihydrate", "trihydrate", "monohydrate",
    "fumarate", "citrate", "acetate", "calcium", "magnesium", "axetil",
    "trometamol", "tromethamine", "dipropionate", "valerate",
}

ALIASES = {
    "amoxycillin": "amoxicillin",
    "acetaminophen": "paracetamol",
    "beclometasone": "beclomethasone",
    "clavulanic acid": "clavulanate",
    "acetylsalicylic acid": "aspirin",
    "glyceryl trinitrate": "nitroglycerin",
    "ascorbic acid": "vitamin c",
    "cotrimoxazole": "sulfamethoxazole",
    "isosorbide mononitrate": "isosorbide",
    "isosorbide dinitrate": "isosorbide",
    "levosalbutamol": "levalbuterol",
    "salbutamol": "albuterol",
}


def normalize_name(s: str) -> str:
    """'Chlorpheniramine Maleate' -> 'chlorpheniramine', 'Amoxycillin' -> 'amoxicillin'."""
    s = re.sub(r"\(.*?\)", " ", (s or "").lower())
    s = re.sub(r"[^a-z0-9 \-]", " ", s)
    words = s.split()
    while len(words) > 1 and words[-1] in SALT_WORDS:
        words.pop()
    name = " ".join(words)
    return ALIASES.get(name, name)


# -------------------------------------------------------------- classes
CLASSES = {
    "anticoagulant": {"warfarin", "acenocoumarol", "rivaroxaban", "apixaban", "dabigatran"},
    "nsaid": {"ibuprofen", "diclofenac", "aceclofenac", "naproxen", "ketorolac", "nimesulide",
              "etoricoxib", "piroxicam", "mefenamic acid", "indomethacin", "celecoxib",
              "etodolac", "ketoprofen", "flurbiprofen", "lornoxicam"},
    "ace_inhibitor": {"enalapril", "ramipril", "lisinopril", "perindopril", "captopril", "benazepril"},
    "arb": {"losartan", "telmisartan", "olmesartan", "valsartan", "irbesartan", "candesartan", "azilsartan"},
    "k_sparing": {"spironolactone", "eplerenone", "amiloride", "triamterene"},
    "statin": {"atorvastatin", "rosuvastatin", "simvastatin", "pravastatin", "lovastatin", "pitavastatin"},
    "statin_cyp3a4": {"simvastatin", "lovastatin", "atorvastatin"},
    "macrolide": {"azithromycin", "clarithromycin", "erythromycin", "roxithromycin"},
    "macrolide_cyp3a4": {"clarithromycin", "erythromycin"},
    "fluoroquinolone": {"ciprofloxacin", "levofloxacin", "ofloxacin", "moxifloxacin", "norfloxacin"},
    "ppi": {"omeprazole", "pantoprazole", "esomeprazole", "rabeprazole", "lansoprazole"},
    "antihistamine_sedating": {"pheniramine", "chlorpheniramine", "hydroxyzine", "promethazine",
                               "diphenhydramine", "cyproheptadine", "triprolidine"},
    "antihistamine_nonsedating": {"cetirizine", "levocetirizine", "fexofenadine", "loratadine",
                                  "desloratadine", "bilastine"},
    "benzodiazepine": {"alprazolam", "clonazepam", "diazepam", "lorazepam", "chlordiazepoxide",
                       "etizolam", "nitrazepam"},
    "opioid": {"tramadol", "codeine", "tapentadol", "morphine", "pethidine"},
    "ssri_snri": {"fluoxetine", "sertraline", "paroxetine", "escitalopram", "citalopram",
                  "fluvoxamine", "venlafaxine", "duloxetine"},
    "nitrate": {"isosorbide", "nitroglycerin"},
    "pde5": {"sildenafil", "tadalafil", "vardenafil"},
    "multivalent": {"calcium", "calcium carbonate", "ferrous", "iron", "zinc", "magaldrate",
                    "aluminium hydroxide", "magnesium hydroxide", "magnesium"},
}
CLASSES["raas"] = CLASSES["ace_inhibitor"] | CLASSES["arb"]
CLASSES["serotonergic"] = CLASSES["ssri_snri"] | {"tramadol", "dextromethorphan", "linezolid", "pethidine"}
CLASSES["cns_depressant"] = (CLASSES["benzodiazepine"] | CLASSES["opioid"]
                             | CLASSES["antihistamine_sedating"] | {"gabapentin", "pregabalin"})
CLASSES["qt_prolonging"] = {"azithromycin", "clarithromycin", "levofloxacin", "ciprofloxacin",
                            "moxifloxacin", "ofloxacin", "ondansetron", "domperidone",
                            "hydroxyzine", "haloperidol", "citalopram", "escitalopram"}


def resolve(target: str) -> set:
    """A rule target is either a class name or a single ingredient."""
    return CLASSES.get(target, {target})


# Classes where two *different* members prescribed together = therapeutic duplication.
DUP_CLASSES = ["nsaid", "ppi", "statin", "antihistamine_sedating", "antihistamine_nonsedating",
               "benzodiazepine", "fluoroquinolone", "ace_inhibitor", "arb"]

# Duplicates of these are routine (multivitamin-type); never worth more than 'info'.
TRIVIAL_DUP = {"vitamin c", "zinc", "folic acid", "calcium", "cholecalciferol", "vitamin d3",
               "methylcobalamin", "cyanocobalamin", "magnesium", "iron", "ferrous",
               "sodium chloride", "pyridoxine", "thiamine"}

# ------------------------------------------------------------ max doses
# adult / reduced : mg per day. reduced applies if age>=65, liver impairment or weight<50kg.
# ped_kg_day / ped_kg_dose : mg per kg (applied if age<12). high_risk: exceeding => critical.
MAX_DOSE = {
    "paracetamol":   dict(adult=4000, reduced=3000, ped_kg_day=60, ped_kg_dose=15, high_risk=True),
    "ibuprofen":     dict(adult=2400, ped_kg_day=40),
    "diclofenac":    dict(adult=150),
    "aceclofenac":   dict(adult=200),
    "naproxen":      dict(adult=1250),
    "ketorolac":     dict(adult=40, high_risk=True),
    "nimesulide":    dict(adult=200),
    "etoricoxib":    dict(adult=120),
    "amoxicillin":   dict(adult=3000, ped_kg_day=90),
    "azithromycin":  dict(adult=500, ped_kg_day=12),
    "clarithromycin": dict(adult=1000),
    "ciprofloxacin": dict(adult=1500),
    "levofloxacin":  dict(adult=750),
    "doxycycline":   dict(adult=200),
    "metronidazole": dict(adult=2400),
    "cefixime":      dict(adult=400),
    "cetirizine":    dict(adult=10),
    "levocetirizine": dict(adult=5),
    "fexofenadine":  dict(adult=180),
    "loratadine":    dict(adult=10),
    "montelukast":   dict(adult=10),
    "hydroxyzine":   dict(adult=100),
    "chlorpheniramine": dict(adult=24),
    "phenylephrine": dict(adult=60),
    "dextromethorphan": dict(adult=120),
    "pantoprazole":  dict(adult=80),
    "ranitidine":    dict(adult=300),
    "domperidone":   dict(adult=30),
    "ondansetron":   dict(adult=24),
    "metformin":     dict(adult=2550, high_risk=True),
    "atorvastatin":  dict(adult=80),
    "amlodipine":    dict(adult=10),
    "telmisartan":   dict(adult=80),
    "losartan":      dict(adult=100),
    "tramadol":      dict(adult=400, high_risk=True),
    "alprazolam":    dict(adult=4, high_risk=True),
}

# --------------------------------------------------------- interactions
# (A, B, tier, message). A/B = class or ingredient. If A == B, any two different members clash.
INTERACTIONS = [
    ("anticoagulant", "nsaid", "critical", "NSAID + anticoagulant: major bleeding risk."),
    ("anticoagulant", "aspirin", "critical", "Aspirin + anticoagulant: increased bleeding risk."),
    ("anticoagulant", "metronidazole", "critical", "Metronidazole raises INR sharply with warfarin."),
    ("anticoagulant", "fluconazole", "critical", "Fluconazole raises INR sharply with warfarin."),
    ("anticoagulant", "fluoroquinolone", "warning", "Fluoroquinolones can raise INR; monitor."),
    ("anticoagulant", "macrolide", "warning", "Macrolides can raise INR; monitor."),
    ("ace_inhibitor", "k_sparing", "critical", "ACE inhibitor + potassium-sparing diuretic: hyperkalaemia risk."),
    ("arb", "k_sparing", "critical", "ARB + potassium-sparing diuretic: hyperkalaemia risk."),
    ("ace_inhibitor", "arb", "warning", "Dual RAAS blockade: hyperkalaemia and renal injury risk."),
    ("raas", "nsaid", "warning", "NSAID blunts BP control and raises kidney-injury risk with ACEi/ARB."),
    ("macrolide_cyp3a4", "statin_cyp3a4", "critical", "Macrolide raises statin levels: rhabdomyolysis risk."),
    ("nitrate", "pde5", "critical", "Nitrate + PDE5 inhibitor: severe hypotension."),
    ("opioid", "benzodiazepine", "critical", "Opioid + benzodiazepine: respiratory depression."),
    ("serotonergic", "serotonergic", "warning", "Two serotonergic drugs: serotonin syndrome risk."),
    ("cns_depressant", "cns_depressant", "warning", "Additive sedation / CNS depression."),
    ("qt_prolonging", "qt_prolonging", "warning", "Additive QT prolongation."),
    ("fluoroquinolone", "nsaid", "warning", "Fluoroquinolone + NSAID: seizure threshold lowered."),
    ("methotrexate", "nsaid", "critical", "NSAIDs reduce methotrexate clearance: toxicity."),
    ("methotrexate", "sulfamethoxazole", "critical", "Co-trimoxazole + methotrexate: bone marrow toxicity."),
    ("aspirin", "nsaid", "warning", "NSAID + aspirin: GI bleeding; ibuprofen blunts aspirin's antiplatelet effect."),
    ("clopidogrel", "omeprazole", "warning", "Omeprazole reduces clopidogrel activation."),
    ("clopidogrel", "esomeprazole", "warning", "Esomeprazole reduces clopidogrel activation."),
    ("digoxin", "macrolide_cyp3a4", "critical", "Macrolide raises digoxin levels: toxicity."),
    ("digoxin", "amiodarone", "warning", "Amiodarone raises digoxin levels."),
    ("digoxin", "verapamil", "warning", "Verapamil raises digoxin levels."),
    ("theophylline", "ciprofloxacin", "warning", "Ciprofloxacin raises theophylline levels."),
    ("lithium", "nsaid", "warning", "NSAIDs raise lithium levels."),
    ("lithium", "raas", "warning", "ACEi/ARB raise lithium levels."),
    ("fluoroquinolone", "multivalent", "info", "Antacids/iron/calcium/zinc reduce absorption; separate by ~2 h."),
    ("levothyroxine", "multivalent", "info", "Calcium/iron/antacids reduce absorption; separate by ~4 h."),
]

# ------------------------------------------------- patient-context rules
# (target, below_age, tier, message)
AGE_RULES = [
    ("nimesulide", 12, "critical", "Nimesulide is banned for children under 12 in India."),
    ("tramadol", 12, "critical", "Tramadol is not recommended under 12 years."),
    ("codeine", 12, "critical", "Codeine is not recommended under 12 years."),
    ("aspirin", 16, "warning", "Aspirin under 16: Reye syndrome risk."),
    ("fluoroquinolone", 18, "warning", "Fluoroquinolones are generally avoided in children/adolescents."),
    ("doxycycline", 8, "warning", "Doxycycline under 8: tooth discolouration."),
]
# (target, tier, message) for age >= 65
ELDERLY_RULES = [
    ("antihistamine_sedating", "warning", "Sedating antihistamine at 65+ (Beers criteria): confusion, falls, urinary retention."),
    ("benzodiazepine", "warning", "Benzodiazepine at 65+ (Beers criteria): falls, cognitive impairment."),
]
# (target, critical_if_egfr_below, warning_if_egfr_below, message)
RENAL_RULES = [
    ("nsaid", 30, 60, "NSAID with reduced kidney function: avoid or use with great caution."),
    ("metformin", 30, 45, "Metformin with reduced eGFR: lactic acidosis risk; contraindicated <30, review dose <45."),
]
# (target, tier, message)
PREGNANCY_RULES = [
    ("raas", "critical", "ACE inhibitors/ARBs are contraindicated in pregnancy."),
    ("warfarin", "critical", "Warfarin is teratogenic."),
    ("methotrexate", "critical", "Methotrexate is contraindicated in pregnancy."),
    ("misoprostol", "critical", "Misoprostol is contraindicated in pregnancy."),
    ("nsaid", "warning", "NSAIDs: avoid in pregnancy, especially from ~20 weeks."),
    ("statin", "warning", "Statins are generally stopped in pregnancy."),
    ("doxycycline", "warning", "Tetracyclines are avoided in pregnancy."),
    ("fluoroquinolone", "warning", "Fluoroquinolones are generally avoided in pregnancy."),
]
