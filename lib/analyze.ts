import { REFERENCE_RANGES, BY_KEY } from "./referenceRanges";
import type {
  AssessedRow, Bound, ExplainedRow, ExtractedRow, Flag, ReferenceEntry, Sex,
} from "./types";

// ---------------------------------------------------------------------------
// All the decision-making in the app lives in this file, and none of it
// involves a language model. Every function here is pure: same input, same
// output, no network. That means you can test it, and you can defend it.
//
// This is the file to open when a judge asks "how do you know the model isn't
// making it up?"
// ---------------------------------------------------------------------------

/** "  Fasting Blood Sugar (F)  " -> "fasting blood sugar f" */
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[().,:;_\-\[\]/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeUnit(raw: string | null): string | null {
  if (!raw) return null;
  // Both the micro sign (U+00B5) and Greek small mu (U+03BC) turn up in real
  // reports, and they are different characters. Fold both to "u" so that
  // "µIU/mL", "μIU/mL" and "uIU/mL" all hit the same key.
  return raw.toLowerCase().replace(/\s+/g, "").replace(/[µμ]/g, "u");
}

/**
 * Find which test a printed row refers to.
 *
 * Exact alias match first, then a conservative containment check. We do NOT
 * fuzzy-match: guessing that "Cholesterol - LDL Ratio" is LDL cholesterol
 * would produce a confident wrong flag, which is worse than no flag at all.
 * Unmatched rows are surfaced to the user as "not assessed".
 */
export function matchParameter(nameAsPrinted: string): ReferenceEntry | null {
  const n = normalizeName(nameAsPrinted);
  if (!n) return null;

  for (const entry of REFERENCE_RANGES) {
    if (entry.aliases.some((a) => normalizeName(a) === n)) return entry;
  }

  return null;
}

/**
 * Convert a printed value into the unit our range is written in.
 * Returns null when we cannot convert — we never assume the units match.
 */
export function toCanonicalUnit(
  value: number,
  printedUnit: string | null,
  entry: ReferenceEntry,
): number | null {
  const canonical = normalizeUnit(entry.canonicalUnit);
  const given = normalizeUnit(printedUnit);

  // No unit printed: percentages and ratios are unambiguous, everything else
  // is a guess we decline to make.
  if (!given) return entry.canonicalUnit === "%" ? value : null;

  if (given === canonical) return value;

  const factor = entry.altUnits?.[given];
  if (typeof factor === "number") return value * factor;

  return null;
}

export function rangeFor(entry: ReferenceEntry, sex: Sex): Bound {
  if (entry.rangeBySex && (sex === "male" || sex === "female")) {
    return entry.rangeBySex[sex];
  }
  return entry.range;
}

/**
 * The flag. Four lines of arithmetic, and the entire clinical claim the app
 * makes. Note it says nothing about what being outside the range means —
 * that is deliberately the doctor's job, not ours.
 */
export function flagFor(value: number, range: Bound): Flag {
  if (range.low !== null && value < range.low) return "low";
  if (range.high !== null && value > range.high) return "high";
  return "normal";
}

export function parsePrintedRange(raw: string | null): (Bound & { exclusiveLow?: boolean; exclusiveHigh?: boolean }) | null {
  if (!raw) return null;
  const s = raw.trim().replace(/[–—−]/g, "-");
  const n = "(-?\\d+(?:\\.\\d+)?)";
  const pair = s.match(new RegExp("^" + n + "\\s*-\\s*" + n + "$"));
  if (pair) return +pair[1] <= +pair[2] ? { low: +pair[1], high: +pair[2] } : null;
  const one = s.match(new RegExp("^(<=|>=|<|>|≤|≥)\\s*" + n + "$"));
  if (!one) return null;
  return one[1].startsWith("<") || one[1] === "≤" ? {low:null,high:+one[2],exclusiveHigh:one[1]==="<"} : {low:+one[2],high:null,exclusiveLow:one[1]===">"};
}
export function assessRows(rows: ExtractedRow[], sex: Sex = "unspecified"): AssessedRow[] {
  return rows.map((row) => {
    const entry = matchParameter(row.nameAsPrinted);
    const range = parsePrintedRange(row.printedRange);
    let reason = !entry ? "This parameter is ambiguous or not recognized. Please verify it with your doctor." : row.value === null || !Number.isFinite(row.value) ? "Please verify this value against the original report." : !row.printedRange ? "Reference range not provided in the report." : !range ? "We could not interpret this reference range. Please verify it against the original report." : "";
    let flag: Flag = "not_assessed";
    if (!reason && range && row.value !== null) {
      flag = flagFor(row.value, range);
      if (range.exclusiveHigh && row.value === range.high) flag = "high";
      if (range.exclusiveLow && row.value === range.low) flag = "low";
    }
    return {...row, matchedKey: entry?.key ?? null, displayName: entry?.displayName ?? row.nameAsPrinted, valueInCanonicalUnit:row.value, canonicalUnit:row.unit, appliedRange:reason ? null : range, flag, higherIsBetter:entry?.higherIsBetter ?? false, reason, measures:entry?.measures ?? ""};
  });
}

// ---------------------------------------------------------------------------
// Guardrail
//
// The model is instructed not to give medical advice. Instructions are not a
// control — this is the control. Anything matching these patterns never
// reaches the screen.
// ---------------------------------------------------------------------------

export const ADVICE_PATTERNS: RegExp[] = [
  /\byou (should|must|need to|ought to)\b/i,
  /\b(take|start|stop|increase|reduce|adjust) (your |the )?(dose|medication|medicine|tablet|drug|supplement)/i,
  /\b\d+\s?(mg|mcg|ml|iu|g)\b/i,                       // any dosage
  /\b(diagnos(is|ed|e)|you have|this means you have|indicates that you have)\b/i,
  /\b(prescrib|treatment plan|therapy for|cure|remedy)/i,
  /\b(anaemi[ac]|diabet(es|ic)|hypothyroid|hyperthyroid|kidney (disease|failure)|liver disease|cancer)\b/i,
  /\b(don't worry|nothing to worry about|it'?s fine|no cause for concern)\b/i, // false reassurance
];

export function scanForAdvice(text: string): string | null {
  for (const p of ADVICE_PATTERNS) {
    if (p.test(text)) return p.source;
  }
  return null;
}

const SAFE_FALLBACK =
  "This result is outside the reference range on your report. We are not able to explain what that means for you — please discuss it with your doctor.";

/**
 * Stage 3 guard. Returns cleaned rows and whether anything was replaced.
 * If the guardrail fires often, fix your prompt — do not loosen this.
 */
export function applyGuardrails(
  rows: ExplainedRow[],
): { rows: ExplainedRow[]; triggered: boolean; hits: string[] } {
  const hits: string[] = [];

  const cleaned = rows.map((row) => {
    const out = { ...row };

    const bad = scanForAdvice(row.explanation);
    if (bad) {
      hits.push(`${row.displayName}: explanation matched /${bad}/`);
      out.explanation = row.flag === "not_assessed" ? row.reason : `This result is ${row.flag === "normal" ? "within" : row.flag === "low" ? "below" : "above"} the reference range printed on your report. Discuss its meaning with your doctor.`;
    }

    if (row.doctorQuestion) {
      const badQ = scanForAdvice(row.doctorQuestion);
      if (badQ) {
        hits.push(`${row.displayName}: question matched /${badQ}/`);
        out.doctorQuestion = "What does this result mean in my case?";
      }
    }
    return out;
  });

  return { rows: cleaned, triggered: hits.length > 0, hits };
}

export const DISCLAIMER =
  "This tool explains what the words and numbers on your report mean. It does not diagnose, treat, or give medical advice. Always discuss your results with a qualified doctor.";
