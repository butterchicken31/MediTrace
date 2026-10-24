import csv, os, tempfile

COLS = ["id","name","price","Is_discontinued","manufacturer_name","type","pack_size_label",
        "short_composition1","short_composition2","salt_composition","medicine_desc","side_effects","drug_interactions"]
EMPTY = '{"drug": [], "brand": [], "effect": []}'
# first 7 rows are real rows from the dataset; the rest are SYNTHETIC fixtures for testing
ROWS = [
 (1,"Augmentin 625 Duo Tablet","Amoxycillin  (500mg) ","  Clavulanic Acid (125mg)","Amoxycillin  (500mg) +  Clavulanic Acid (125mg)",EMPTY),
 (2,"Azithral 500 Tablet","Azithromycin (500mg)","","Azithromycin (500mg)",
  '{"drug": ["Astemizole"], "brand": [" Alestol"], "effect": ["LIFE-THREATENING"]}'),
 (3,"Ascoril LS Syrup","Ambroxol (30mg/5ml) "," Levosalbutamol (1mg/5ml) ","Ambroxol (30mg/5ml) + Levosalbutamol (1mg/5ml) + Guaifenesin (50mg/5ml)",EMPTY),
 (5,"Avil 25 Tablet","Pheniramine (25mg)","","Pheniramine (25mg)",
  '{"drug": ["Alprazolam"], "brand": [" Eurolam"], "effect": ["MODERATE"]}'),
 (9,"Atarax 25mg Tablet","Hydroxyzine (25mg)","","Hydroxyzine (25mg)",EMPTY),
 (10,"Ascoril D Plus Syrup Sugar Free","Phenylephrine (5mg) "," Chlorpheniramine Maleate (2mg) ","Phenylephrine (5mg) + Chlorpheniramine Maleate (2mg) + Dextromethorphan Hydrobromide (10mg)",EMPTY),
 (13,"Anovate Cream","Phenylephrine (0.10% w/w) "," Beclometasone (0.025% w/w) ","",""),
 (101,"Dolo 650 Tablet","Paracetamol (650mg)","","Paracetamol (650mg)",EMPTY),
 (102,"Crocin 500 Tablet","Paracetamol (500mg)","","Paracetamol (500mg)",EMPTY),
 (103,"Combiflam Tablet","Ibuprofen (400mg)"," Paracetamol (325mg)","Ibuprofen (400mg) + Paracetamol (325mg)",EMPTY),
 (104,"Warf 5 Tablet","Warfarin (5mg)","","Warfarin (5mg)",EMPTY),
 (105,"Voveran 50 Tablet","Diclofenac (50mg)","","Diclofenac (50mg)",EMPTY),
 (106,"Alprax 0.25 Tablet","Alprazolam (0.25mg)","","Alprazolam (0.25mg)",EMPTY),
 (107,"Glycomet 500 Tablet","Metformin (500mg)","","Metformin (500mg)",EMPTY),
]
path = os.path.join(tempfile.gettempdir(), "rx_test.csv")
with open(path, "w", newline="") as f:
    w = csv.writer(f); w.writerow(COLS)
    for id_, name, s1, s2, salt, di in ROWS:
        w.writerow([id_, name, 10, "FALSE", "TestCo", "allopathy", "strip", s1, s2, salt, "", "", di])
os.environ["DATA_PATH"] = path
