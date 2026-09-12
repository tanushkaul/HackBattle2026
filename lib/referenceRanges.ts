import type { ReferenceEntry } from "./types";

// Legacy parameter catalog retained from the supplied backend.
// Only aliases and educational descriptions are used for assessment.
// Built-in ranges are NEVER used to classify reports; printed ranges are required.

export const REFERENCE_RANGES: ReferenceEntry[] = [
  {
    key: "haemoglobin",
    displayName: "Haemoglobin",
    aliases: ["haemoglobin", "hemoglobin", "hb", "hgb", "haemoglobin (hb)"],
    canonicalUnit: "g/dL",
    altUnits: { "g/l": 0.1 },
    range: { low: 12.0, high: 17.0 },
    rangeBySex: {
      male: { low: 13.0, high: 17.0 },
      female: { low: 12.0, high: 15.0 },
    },
    measures: "the protein in red blood cells that carries oxygen around the body",
    verified: false,
  },
  {
    key: "wbc",
    displayName: "White blood cell count",
    aliases: [
      "wbc", "total leucocyte count", "total leukocyte count", "tlc",
      "white blood cell count", "wbc count", "leucocyte count",
    ],
    canonicalUnit: "cells/uL",
    // Labs often print 10^3/uL (i.e. 7.2 meaning 7,200).
    altUnits: { "10^3/ul": 1000, "x10^3/ul": 1000, "10*3/ul": 1000, "k/ul": 1000 },
    range: { low: 4000, high: 11000 },
    measures: "the number of immune cells in the blood",
    verified: false,
  },
  {
    key: "platelets",
    displayName: "Platelet count",
    aliases: ["platelet count", "platelets", "plt", "platelet"],
    canonicalUnit: "cells/uL",
    altUnits: { "10^3/ul": 1000, "x10^3/ul": 1000, "lakhs/ul": 100000, "k/ul": 1000 },
    range: { low: 150000, high: 450000 },
    measures: "the cell fragments that help blood clot",
    verified: false,
  },
  {
    key: "glucose_fasting",
    displayName: "Fasting blood glucose",
    aliases: [
      "fasting blood sugar", "fasting blood glucose", "fbs", "glucose fasting",
      "fasting plasma glucose", "blood sugar fasting", "glucose (fasting)",
    ],
    canonicalUnit: "mg/dL",
    altUnits: { "mmol/l": 18.0182 },
    range: { low: 70, high: 99 },
    measures: "the amount of sugar in the blood after not eating for several hours",
    verified: false,
  },
  {
    key: "hba1c",
    displayName: "HbA1c",
    aliases: ["hba1c", "glycated haemoglobin", "glycosylated hemoglobin", "a1c", "hb a1c"],
    canonicalUnit: "%",
    range: { low: null, high: 5.7 },
    measures: "average blood sugar levels over roughly the past three months",
    verified: false,
  },
  {
    key: "cholesterol_total",
    displayName: "Total cholesterol",
    aliases: ["total cholesterol", "cholesterol total", "cholesterol", "serum cholesterol"],
    canonicalUnit: "mg/dL",
    altUnits: { "mmol/l": 38.67 },
    range: { low: null, high: 200 },
    measures: "the total amount of cholesterol, a fat, carried in the blood",
    verified: false,
  },
  {
    key: "ldl",
    displayName: "LDL cholesterol",
    aliases: ["ldl", "ldl cholesterol", "ldl-c", "low density lipoprotein", "ldl cholesterol - direct"],
    canonicalUnit: "mg/dL",
    altUnits: { "mmol/l": 38.67 },
    range: { low: null, high: 100 },
    measures: "the cholesterol that can build up in blood vessel walls",
    verified: false,
  },
  {
    key: "hdl",
    displayName: "HDL cholesterol",
    aliases: ["hdl", "hdl cholesterol", "hdl-c", "high density lipoprotein"],
    canonicalUnit: "mg/dL",
    altUnits: { "mmol/l": 38.67 },
    // NOTE the shape of this one: a lower bound and no upper bound. This is
    // the test that catches out naive implementations, which assume "above
    // the range" is the only thing worth flagging.
    range: { low: 40, high: null },
    rangeBySex: {
      male: { low: 40, high: null },
      female: { low: 50, high: null },
    },
    higherIsBetter: true,
    measures: "the cholesterol that helps carry other cholesterol out of the blood",
    verified: false,
  },
  {
    key: "triglycerides",
    displayName: "Triglycerides",
    aliases: ["triglycerides", "triglyceride", "tg", "serum triglycerides"],
    canonicalUnit: "mg/dL",
    altUnits: { "mmol/l": 88.57 },
    range: { low: null, high: 150 },
    measures: "a type of fat carried in the blood, mostly from food",
    verified: false,
  },
  {
    key: "tsh",
    displayName: "TSH",
    aliases: ["tsh", "thyroid stimulating hormone", "thyroid-stimulating hormone", "s. tsh"],
    canonicalUnit: "mIU/L",
    // uIU/mL and mIU/L are numerically the same; mIU/mL is 1000x.
    altUnits: { "uiu/ml": 1, "miu/ml": 1000 },
    range: { low: 0.4, high: 4.0 },
    measures: "the hormone that tells the thyroid gland how much to work",
    verified: false,
  },
  {
    key: "free_t4",
    displayName: "Free T4",
    aliases: ["free t4", "ft4", "free thyroxine", "t4 free"],
    canonicalUnit: "ng/dL",
    range: { low: 0.8, high: 1.8 },
    measures: "one of the two main thyroid hormones, in its active form",
    verified: false,
  },
  {
    key: "creatinine",
    displayName: "Creatinine",
    aliases: ["creatinine", "serum creatinine", "s. creatinine", "creatinine serum"],
    canonicalUnit: "mg/dL",
    altUnits: { "umol/l": 0.0113 },
    range: { low: 0.6, high: 1.3 },
    rangeBySex: {
      male: { low: 0.7, high: 1.3 },
      female: { low: 0.6, high: 1.1 },
    },
    measures: "a waste product the kidneys filter out, used to check kidney function",
    verified: false,
  },
  {
    key: "urea",
    displayName: "Blood urea",
    aliases: ["urea", "blood urea", "serum urea", "bun urea"],
    canonicalUnit: "mg/dL",
    range: { low: 15, high: 40 },
    measures: "another waste product the kidneys remove from the blood",
    verified: false,
  },
  {
    key: "bilirubin_total",
    displayName: "Total bilirubin",
    aliases: ["total bilirubin", "bilirubin total", "bilirubin (total)", "s. bilirubin total"],
    canonicalUnit: "mg/dL",
    altUnits: { "umol/l": 0.0585 },
    range: { low: 0.2, high: 1.2 },
    measures: "a yellow substance made when old red blood cells break down",
    verified: false,
  },
  {
    key: "vitamin_d",
    displayName: "Vitamin D (25-OH)",
    aliases: ["vitamin d", "25-oh vitamin d", "25 hydroxy vitamin d", "vitamin d3", "25(oh)d"],
    canonicalUnit: "ng/mL",
    altUnits: { "nmol/l": 0.4 },
    range: { low: 30, high: 100 },
    higherIsBetter: false,
    measures: "the amount of vitamin D stored in the body",
    verified: false,
  },
  {
    key: "vitamin_b12",
    displayName: "Vitamin B12",
    aliases: ["vitamin b12", "b12", "cobalamin", "vit b12"],
    canonicalUnit: "pg/mL",
    altUnits: { "pmol/l": 1.355 },
    range: { low: 200, high: 900 },
    measures: "a vitamin the body needs for nerves and red blood cells",
    verified: false,
  },
];

/** Fast lookup by key. */
export const BY_KEY: Record<string, ReferenceEntry> = Object.fromEntries(
  REFERENCE_RANGES.map((e) => [e.key, e]),
);

/** How many entries a human has actually checked. Print this in your logs. */
export function verifiedCount(): { verified: number; total: number } {
  return {
    verified: REFERENCE_RANGES.filter((e) => e.verified).length,
    total: REFERENCE_RANGES.length,
  };
}
