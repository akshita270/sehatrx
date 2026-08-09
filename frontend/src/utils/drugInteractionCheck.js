// Advisory check for a small set of well-known, clinically significant drug-drug
// interactions. This is NOT an exhaustive interaction database — it's a short,
// hand-picked list of the combinations most likely to cause real harm and most
// often missed in a busy clinic. Absence of a warning here does not mean a
// combination is safe; it only means it isn't one of the pairs below.
const DRUG_CLASSES = {
  warfarin: ["warfarin", "acitrom", "coumadin"],
  nsaid: ["ibuprofen", "diclofenac", "aspirin", "naproxen", "ketorolac", "mefenamic", "nimesulide", "combiflam", "etoricoxib"],
  maoi: ["phenelzine", "tranylcypromine", "selegiline", "isocarboxazid"],
  ssri: ["fluoxetine", "sertraline", "paroxetine", "escitalopram", "citalopram", "fluvoxamine"],
  ace_inhibitor: ["enalapril", "ramipril", "lisinopril", "captopril", "perindopril", "telmisartan", "losartan"],
  potassium_sparing_diuretic: ["spironolactone", "amiloride", "triamterene", "eplerenone"],
  statin: ["atorvastatin", "simvastatin", "rosuvastatin", "lovastatin"],
  macrolide: ["clarithromycin", "erythromycin"],
  pde5_inhibitor: ["sildenafil", "tadalafil", "vardenafil"],
  nitrate: ["nitroglycerin", "isosorbide", "nitroglycerine"],
  methotrexate: ["methotrexate"],
};

const INTERACTION_RULES = [
  { a: "warfarin", b: "nsaid", severity: "high", note: "Significantly increased bleeding risk" },
  { a: "maoi", b: "ssri", severity: "high", note: "Risk of serotonin syndrome" },
  { a: "ace_inhibitor", b: "potassium_sparing_diuretic", severity: "moderate", note: "Risk of dangerously high potassium (hyperkalemia)" },
  { a: "statin", b: "macrolide", severity: "moderate", note: "Increased risk of muscle toxicity (rhabdomyolysis)" },
  { a: "pde5_inhibitor", b: "nitrate", severity: "high", note: "Severe, potentially fatal drop in blood pressure" },
  { a: "methotrexate", b: "nsaid", severity: "moderate", note: "Increased methotrexate toxicity" },
];

function classifyDrug(nameLower) {
  const classes = [];
  for (const [className, keywords] of Object.entries(DRUG_CLASSES)) {
    if (keywords.some((kw) => nameLower.includes(kw))) classes.push(className);
  }
  return classes;
}

export function findDrugInteractions(medicines) {
  const named = (medicines || [])
    .map((m) => ({ name: (m.name || "").trim(), lower: (m.name || "").toLowerCase().trim() }))
    .filter((m) => m.lower);

  const conflicts = [];
  for (let i = 0; i < named.length; i++) {
    for (let j = i + 1; j < named.length; j++) {
      const classesA = classifyDrug(named[i].lower);
      const classesB = classifyDrug(named[j].lower);
      if (classesA.length === 0 || classesB.length === 0) continue;

      for (const rule of INTERACTION_RULES) {
        const matchesForward = classesA.includes(rule.a) && classesB.includes(rule.b);
        const matchesReverse = classesA.includes(rule.b) && classesB.includes(rule.a);
        if (matchesForward || matchesReverse) {
          conflicts.push({
            drugA: named[i].name,
            drugB: named[j].name,
            severity: rule.severity,
            note: rule.note,
          });
        }
      }
    }
  }
  return conflicts;
}
