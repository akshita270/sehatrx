// Lightweight advisory check: flags a prescribed medicine if it belongs to a drug
// class the patient reported being allergic to. This is a keyword lookup against a
// small curated table, not a clinical drug-interaction database — it's meant to
// catch the common, obvious cases (e.g. Amoxicillin prescribed for a penicillin
// allergy), not to replace the doctor's own judgment.
const ALLERGY_CLASSES = [
  {
    name: "Penicillin",
    triggers: ["penicillin", "amoxicillin", "ampicillin", "augmentin"],
    drugs: [
      "penicillin",
      "amoxicillin",
      "ampicillin",
      "augmentin",
      "co-amoxiclav",
      "coamoxiclav",
      "cloxacillin",
      "dicloxacillin",
      "piperacillin",
    ],
  },
  {
    name: "Sulfa",
    triggers: ["sulfa", "sulpha", "sulfonamide"],
    drugs: [
      "sulfamethoxazole",
      "co-trimoxazole",
      "cotrimoxazole",
      "septran",
      "bactrim",
      "sulfasalazine",
    ],
  },
  {
    name: "NSAID",
    triggers: ["nsaid", "aspirin", "ibuprofen"],
    drugs: [
      "ibuprofen",
      "aspirin",
      "diclofenac",
      "naproxen",
      "ketorolac",
      "mefenamic",
      "nimesulide",
      "combiflam",
      "etoricoxib",
    ],
  },
  {
    name: "Cephalosporin",
    triggers: ["cephalosporin", "cefixime", "cephalexin", "cefpodoxime"],
    drugs: [
      "cefixime",
      "cephalexin",
      "cefadroxil",
      "ceftriaxone",
      "cefpodoxime",
      "cefuroxime",
      "cefdinir",
    ],
  },
  {
    name: "Fluoroquinolone",
    triggers: ["fluoroquinolone", "quinolone", "ciprofloxacin"],
    drugs: [
      "ciprofloxacin",
      "levofloxacin",
      "ofloxacin",
      "moxifloxacin",
      "norfloxacin",
    ],
  },
];

export function findAllergyConflicts(allergiesText, medicines) {
  const allergyLower = (allergiesText || "").toLowerCase();
  if (!allergyLower.trim()) return [];

  const matchedClasses = ALLERGY_CLASSES.filter((cls) =>
    cls.triggers.some((trigger) => allergyLower.includes(trigger))
  );
  if (matchedClasses.length === 0) return [];

  const conflicts = [];
  for (const med of medicines || []) {
    const nameLower = (med.name || "").toLowerCase().trim();
    if (!nameLower) continue;
    for (const cls of matchedClasses) {
      if (cls.drugs.some((drug) => nameLower.includes(drug))) {
        conflicts.push({ medicine: med.name, allergyClass: cls.name });
      }
    }
  }
  return conflicts;
}
