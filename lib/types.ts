// ---------------------------------------------------------------------------
// Shared types for the whole pipeline.
//
// Read this file first. The type names describe the four stages a lab value
// passes through, and the whole architecture is visible in them:
//
//   ExtractedRow   what the model read off the image  (model's job)
//   AssessedRow    + which test it is, and high/low   (OUR CODE's job)
//   ExplainedRow   + plain-language wording           (model's job)
//   AnalyzeResult  what the browser receives
//
// The important line in this file is that `flag` appears on AssessedRow, not
// on ExtractedRow. The model is never asked whether a value is abnormal.
// ---------------------------------------------------------------------------

export type Flag = "low" | "normal" | "high" | "not_assessed";

export type Sex = "male" | "female" | "unspecified";

export interface Bound {
  low: number | null;  // null = no lower bound for this test
  high: number | null; // null = no upper bound for this test
}

export interface ReferenceEntry {
  /** Stable internal id. Never shown to the user. */
  key: string;
  /** What we show the user. */
  displayName: string;
  /** Every spelling we have actually seen printed on a real report. */
  aliases: string[];
  /** The unit our `range` numbers are expressed in. */
  canonicalUnit: string;
  /**
   * Other units this test is reported in, and the factor to MULTIPLY by to
   * reach `canonicalUnit`. These factors are per-test, never global — the
   * mmol/L to mg/dL factor for glucose (18.0182) is different from the one
   * for cholesterol (38.67). Getting this wrong silently produces a wrong
   * flag, which is the worst bug this app can have.
   */
  altUnits?: Record<string, number>;
  /** Range used when we do not know the patient's sex. */
  range: Bound;
  /** Used instead of `range` when sex is known and the test is sex-specific. */
  rangeBySex?: { male: Bound; female: Bound };
  /**
   * True for tests where a LOW result is the notable one (HDL cholesterol).
   * Does not change the flag — low is still "low" — but the UI uses it to
   * word things correctly instead of implying high is bad.
   */
  higherIsBetter?: boolean;
  /** One factual line: what the test measures. Not what a result means. */
  measures: string;
  /**
   * Set to true only after a human has checked this range against a real
   * printed report from the lab you are demoing with. Ships as false.
   */
  verified: boolean;
}

/** Stage 1 — straight off the image. No interpretation. */
export interface ExtractedRow {
  nameAsPrinted: string;
  value: number | null;
  unit: string | null;
  /** The range printed on the report itself, verbatim, if there was one. */
  printedRange: string | null;
}

/** Stage 2 — our code has matched and judged it. */
export interface AssessedRow extends ExtractedRow {
  matchedKey: string | null;
  displayName: string;
  valueInCanonicalUnit: number | null;
  canonicalUnit: string | null;
  appliedRange: Bound | null;
  flag: Flag;
  higherIsBetter: boolean;
  /** Why this row could not be assessed. Empty string when it was. */
  reason: string;
  measures: string;
}

/** Stage 3 — the model has worded it for a patient. */
export interface ExplainedRow extends AssessedRow {
  explanation: string;
  doctorQuestion: string | null;
}

/** Stage 4 — what /api/analyze returns. */
export interface AnalyzeResult {
  rows: ExplainedRow[];
  summary: string;
  /** Things the model said it could not read. Shown honestly, never guessed. */
  unreadable: string[];
  /** True if the guardrail had to replace any model text. */
  guardrailTriggered: boolean;
  /** Always rendered by the UI. Never conditional. */
  disclaimer: string;
}
