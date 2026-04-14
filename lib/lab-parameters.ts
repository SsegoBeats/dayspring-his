/**
 * Tier-1 hardcoded lab parameter templates.
 * Covers ~20 common tests ordered in 80% of hospital visits.
 * Works offline, zero latency.
 */

export interface LabParameter {
  name: string
  units: string
  reference: string
}

export interface ParameterRow extends LabParameter {
  value: string
  flag: "Normal" | "Low" | "High" | "Critical" | ""
  active: boolean
}

/** Parse a "low–high" reference string into numeric bounds. */
function parseBounds(ref: string): { lo: number; hi: number } | null {
  const m = ref.match(/([\d.]+)\s*[–\-]\s*([\d.]+)/)
  if (!m) return null
  return { lo: parseFloat(m[1]), hi: parseFloat(m[2]) }
}

/** Auto-compute a flag from a numeric value vs. a reference range string. */
export function computeFlag(value: string, reference: string): ParameterRow["flag"] {
  const v = parseFloat(value)
  if (isNaN(v)) return ""
  const bounds = parseBounds(reference)
  if (!bounds) return ""
  if (v < bounds.lo) return "Low"
  if (v > bounds.hi) return "High"
  return "Normal"
}

/** Build parameter rows from a template (all active by default). */
export function buildParameterRows(params: LabParameter[]): ParameterRow[] {
  return params.map((p) => ({ ...p, value: "", flag: "", active: true }))
}

// ── Test templates ──────────────────────────────────────────────────────────

const CBC: LabParameter[] = [
  { name: "WBC",         units: "10³/µL",  reference: "4.0–11.0"   },
  { name: "RBC",         units: "10⁶/µL",  reference: "4.5–5.5"    },
  { name: "Hemoglobin",  units: "g/dL",    reference: "12.0–16.0"  },
  { name: "Hematocrit",  units: "%",       reference: "36.0–46.0"  },
  { name: "MCV",         units: "fL",      reference: "80–100"     },
  { name: "MCH",         units: "pg",      reference: "27–33"      },
  { name: "MCHC",        units: "g/dL",    reference: "32–36"      },
  { name: "Platelets",   units: "10³/µL",  reference: "150–400"    },
  { name: "Neutrophils", units: "%",       reference: "50–70"      },
  { name: "Lymphocytes", units: "%",       reference: "20–40"      },
  { name: "Monocytes",   units: "%",       reference: "2–8"        },
  { name: "Eosinophils", units: "%",       reference: "1–4"        },
]

const LFT: LabParameter[] = [
  { name: "ALT (SGPT)",        units: "U/L",  reference: "7–56"    },
  { name: "AST (SGOT)",        units: "U/L",  reference: "10–40"   },
  { name: "ALP",               units: "U/L",  reference: "44–147"  },
  { name: "GGT",               units: "U/L",  reference: "9–48"    },
  { name: "Total Bilirubin",   units: "mg/dL",reference: "0.2–1.2" },
  { name: "Direct Bilirubin",  units: "mg/dL",reference: "0–0.3"   },
  { name: "Albumin",           units: "g/dL", reference: "3.4–5.4" },
  { name: "Total Protein",     units: "g/dL", reference: "6.0–8.3" },
  { name: "PT/INR",            units: "",     reference: "0.8–1.2" },
]

const RFT: LabParameter[] = [
  { name: "Urea",         units: "mg/dL",  reference: "7–20"     },
  { name: "Creatinine",   units: "mg/dL",  reference: "0.6–1.2"  },
  { name: "eGFR",         units: "mL/min", reference: ">60"      },
  { name: "Sodium",       units: "mEq/L",  reference: "136–145"  },
  { name: "Potassium",    units: "mEq/L",  reference: "3.5–5.1"  },
  { name: "Chloride",     units: "mEq/L",  reference: "98–107"   },
  { name: "Bicarbonate",  units: "mEq/L",  reference: "22–29"    },
  { name: "Uric Acid",    units: "mg/dL",  reference: "3.5–7.2"  },
]

const LIPID_PANEL: LabParameter[] = [
  { name: "Total Cholesterol",  units: "mg/dL", reference: "<200"   },
  { name: "LDL",                units: "mg/dL", reference: "<130"   },
  { name: "HDL",                units: "mg/dL", reference: ">40"    },
  { name: "Triglycerides",      units: "mg/dL", reference: "<150"   },
  { name: "VLDL",               units: "mg/dL", reference: "2–30"   },
]

const THYROID: LabParameter[] = [
  { name: "TSH",  units: "µIU/mL", reference: "0.4–4.0"  },
  { name: "T3",   units: "ng/dL",  reference: "80–200"   },
  { name: "T4",   units: "µg/dL",  reference: "5.1–14.1" },
  { name: "fT4",  units: "ng/dL",  reference: "0.8–1.8"  },
]

const URINALYSIS: LabParameter[] = [
  { name: "Color",       units: "",        reference: "Pale yellow" },
  { name: "Clarity",     units: "",        reference: "Clear"       },
  { name: "pH",          units: "",        reference: "4.5–8.0"    },
  { name: "Specific Gravity", units: "",  reference: "1.005–1.030" },
  { name: "Glucose",     units: "mg/dL",  reference: "Negative"    },
  { name: "Protein",     units: "mg/dL",  reference: "Negative"    },
  { name: "Ketones",     units: "",       reference: "Negative"    },
  { name: "Blood",       units: "",       reference: "Negative"    },
  { name: "Nitrites",    units: "",       reference: "Negative"    },
  { name: "Leukocytes",  units: "WBCs/hpf", reference: "0–5"      },
  { name: "RBCs",        units: "RBCs/hpf", reference: "0–2"      },
  { name: "Casts",       units: "/lpf",   reference: "Negative"    },
]

const ELECTROLYTES: LabParameter[] = [
  { name: "Sodium",       units: "mEq/L",  reference: "136–145"  },
  { name: "Potassium",    units: "mEq/L",  reference: "3.5–5.1"  },
  { name: "Chloride",     units: "mEq/L",  reference: "98–107"   },
  { name: "Bicarbonate",  units: "mEq/L",  reference: "22–29"    },
  { name: "Magnesium",    units: "mg/dL",  reference: "1.7–2.2"  },
  { name: "Phosphate",    units: "mg/dL",  reference: "2.5–4.5"  },
  { name: "Calcium",      units: "mg/dL",  reference: "8.5–10.5" },
]

const ABG: LabParameter[] = [
  { name: "pH",      units: "",       reference: "7.35–7.45" },
  { name: "pO2",     units: "mmHg",   reference: "75–100"    },
  { name: "pCO2",    units: "mmHg",   reference: "35–45"     },
  { name: "HCO3",    units: "mEq/L",  reference: "22–26"     },
  { name: "SaO2",    units: "%",      reference: "95–100"    },
  { name: "Base Excess", units: "mEq/L", reference: "-2–+2"  },
]

const CRP: LabParameter[] = [
  { name: "CRP",  units: "mg/L",  reference: "<10"  },
]

const ESR: LabParameter[] = [
  { name: "ESR",  units: "mm/hr",  reference: "0–20"  },
]

const FBS_HBAIC: LabParameter[] = [
  { name: "Fasting Blood Sugar",  units: "mg/dL",  reference: "70–100"  },
  { name: "HbA1c",               units: "%",       reference: "<5.7"    },
]

const MALARIA_RDT: LabParameter[] = [
  { name: "P. falciparum Ag",  units: "",  reference: "Negative"  },
  { name: "P. vivax Ag",       units: "",  reference: "Negative"  },
]

const HIV_RAPID: LabParameter[] = [
  { name: "HIV-1/2 Antibody",  units: "",  reference: "Non-Reactive"  },
]

const BLOOD_CULTURE: LabParameter[] = [
  { name: "Growth",            units: "",  reference: "No growth"         },
  { name: "Organism",          units: "",  reference: "N/A"               },
  { name: "Sensitivity",       units: "",  reference: "N/A"               },
]

const COAGULATION: LabParameter[] = [
  { name: "PT",    units: "seconds",  reference: "11–13"    },
  { name: "INR",   units: "",         reference: "0.8–1.2"  },
  { name: "APTT",  units: "seconds",  reference: "25–35"    },
]

const WIDAL: LabParameter[] = [
  { name: "S. typhi O",   units: "",  reference: "<1:80"   },
  { name: "S. typhi H",   units: "",  reference: "<1:160"  },
  { name: "S. typhi AH",  units: "",  reference: "<1:80"   },
  { name: "S. typhi BH",  units: "",  reference: "<1:80"   },
]

const PREGNANCY_TEST: LabParameter[] = [
  { name: "Urine β-hCG",  units: "",  reference: "Negative"  },
]

const SICKLE_CELL: LabParameter[] = [
  { name: "Sickling Test",  units: "",  reference: "Negative"  },
  { name: "Hb Genotype",    units: "",  reference: "AA"        },
]

const HAEMOGLOBIN_ELECTROPHORESIS: LabParameter[] = [
  { name: "HbA",   units: "%",  reference: "95–98"   },
  { name: "HbA2",  units: "%",  reference: "1.5–3.5" },
  { name: "HbF",   units: "%",  reference: "<1"      },
  { name: "HbS",   units: "%",  reference: "Absent"  },
  { name: "HbC",   units: "%",  reference: "Absent"  },
]

/** Canonical name → parameter list map. Keys are lowercase for matching. */
const TEMPLATES: Record<string, LabParameter[]> = {
  // CBC and variants
  "cbc": CBC,
  "complete blood count": CBC,
  "full blood count": CBC,
  "fbc": CBC,
  "blood count": CBC,

  // Liver
  "lft": LFT,
  "liver function": LFT,
  "liver function test": LFT,
  "liver function tests": LFT,
  "hepatic function": LFT,

  // Renal
  "rft": RFT,
  "renal function": RFT,
  "renal function test": RFT,
  "renal panel": RFT,
  "urea and electrolytes": RFT,
  "u&e": RFT,
  "ue": RFT,
  "bmp": RFT,
  "basic metabolic panel": RFT,

  // Lipids
  "lipid panel": LIPID_PANEL,
  "lipid profile": LIPID_PANEL,
  "cholesterol panel": LIPID_PANEL,

  // Thyroid
  "thyroid": THYROID,
  "thyroid function": THYROID,
  "thyroid function test": THYROID,
  "tft": THYROID,
  "tsh": THYROID,

  // Urinalysis
  "urinalysis": URINALYSIS,
  "urine analysis": URINALYSIS,
  "ua": URINALYSIS,
  "urine routine": URINALYSIS,

  // Electrolytes
  "electrolytes": ELECTROLYTES,
  "serum electrolytes": ELECTROLYTES,

  // ABG
  "abg": ABG,
  "arterial blood gas": ABG,
  "blood gas": ABG,

  // CRP
  "crp": CRP,
  "c-reactive protein": CRP,

  // ESR
  "esr": ESR,
  "erythrocyte sedimentation rate": ESR,

  // Glucose / HbA1c
  "fbs": FBS_HBAIC,
  "fasting blood sugar": FBS_HBAIC,
  "hba1c": FBS_HBAIC,
  "diabetic screen": FBS_HBAIC,

  // Malaria
  "malaria rdt": MALARIA_RDT,
  "malaria rapid": MALARIA_RDT,
  "malaria antigen": MALARIA_RDT,

  // HIV
  "hiv rapid": HIV_RAPID,
  "hiv test": HIV_RAPID,
  "hiv": HIV_RAPID,

  // Blood culture
  "blood culture": BLOOD_CULTURE,
  "culture and sensitivity": BLOOD_CULTURE,

  // Coagulation
  "coagulation": COAGULATION,
  "coagulation profile": COAGULATION,
  "pt/inr": COAGULATION,
  "clotting time": COAGULATION,

  // Widal
  "widal": WIDAL,
  "widal test": WIDAL,

  // Pregnancy
  "pregnancy test": PREGNANCY_TEST,
  "urine hcg": PREGNANCY_TEST,
  "bhcg": PREGNANCY_TEST,

  // Sickle cell
  "sickle cell": SICKLE_CELL,
  "sickle cell screening": SICKLE_CELL,
  "sickling test": SICKLE_CELL,

  // Haemoglobin electrophoresis
  "haemoglobin electrophoresis": HAEMOGLOBIN_ELECTROPHORESIS,
  "hemoglobin electrophoresis": HAEMOGLOBIN_ELECTROPHORESIS,
  "hb electrophoresis": HAEMOGLOBIN_ELECTROPHORESIS,
}

/**
 * Try to find a hardcoded template for a test name.
 * Returns null if no match is found (caller should try Tier 2 / 3).
 */
export function getTemplateForTest(testName: string): LabParameter[] | null {
  const key = testName.toLowerCase().trim()
  // Exact match
  if (TEMPLATES[key]) return TEMPLATES[key]
  // Partial match — check if any template key appears within the test name
  for (const [k, params] of Object.entries(TEMPLATES)) {
    if (key.includes(k)) return params
  }
  return null
}
