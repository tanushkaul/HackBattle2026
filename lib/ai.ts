import type { AssessedRow, ExtractedRow } from "./types";

// ---------------------------------------------------------------------------
// The only two places this project talks to a language model.
//
// Design decision worth understanding, because it is the thing that makes
// your project defensible: these are TWO SEPARATE CALLS, with our own
// arithmetic in between.
//
//   Call 1  image  -> numbers                    (no interpretation asked for)
//   -- our code decides high / low / normal --
//   Call 2  judged numbers -> plain English       (flags given as fact)
//
// A single call that did both would have to be trusted to decide what counts
// as abnormal. Splitting it means the model literally cannot make that call:
// by the time it writes any prose, the flag is already fixed.
//
// We talk to OpenRouter (https://openrouter.ai) instead of a single vendor's
// API directly. OpenRouter exposes an OpenAI-compatible /chat/completions
// endpoint in front of many providers (OpenAI, Google, Anthropic, Qwen,
// Meta, ...). Two things fall out of that which matter for a live demo:
//
//   - One outage does not sink you. `models` below is a priority list, not a
//     single id. If the first model 5xx's or is overloaded, OpenRouter
//     retries the next one in the list automatically before it ever gets
//     back to us. Pick fallbacks on *different* underlying providers, not
//     three flavours of the same vendor, or one outage still takes all of
//     them down together.
//   - One API shape for every provider. We use plain fetch rather than an
//     SDK, same reasoning as before: the REST shape is stable and you can
//     see exactly what is on the wire when debugging at 3am.
// ---------------------------------------------------------------------------

const API_ROOT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Model catalogue and ids change. Do not hardcode a single one — set
 * OPENROUTER_MODEL (primary) and optionally OPENROUTER_FALLBACK_MODELS
 * (comma-separated) in .env.local. Copy current ids from
 * https://openrouter.ai/models — filter by "image" input modality, since
 * both calls below go through the same chain and extraction needs vision.
 *
 * The defaults below span three different providers on purpose.
 */
function modelChain(): string[] {
  const primary = (process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini").trim();
  const fallbacks = (
    process.env.OPENROUTER_FALLBACK_MODELS || "google/gemini-2.5-flash,qwen/qwen-2.5-vl-72b-instruct"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set([primary, ...fallbacks].filter(Boolean)));
}

function apiKey(): string {
  const k = (process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY)?.trim();
  if (!k) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Put it in .env.local (never in client code).",
    );
  }
  return k;
}

export class ReadingError extends Error {
  constructor(public code: string, public status = 502) { super(code); }
}

export async function callModel(body: {
  messages: unknown;
  temperature: number;
  response_format: unknown;
}): Promise<string> {
  let res: Response;
  try {
    res = await fetch(API_ROOT, {
      method: "POST",
      signal: AbortSignal.timeout(45000),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey()}`,
        // Recommended by OpenRouter for attribution; harmless if ignored.
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
        "X-Title": "MediExplain",
      },
      body: JSON.stringify({
        models: modelChain(),
        max_tokens: 4096,
        ...body,
      }),
    });
  } catch (error) {
    throw new ReadingError(error instanceof Error && /timeout|abort/i.test(error.name) ? "TIMEOUT" : "NETWORK", 503);
  }
  if (!res.ok) {
    const code =
      res.status === 429 || res.status === 402 ? "RATE_LIMIT"
      : res.status === 401 || res.status === 403 ? "API_KEY"
      : res.status === 404 ? "MODEL"
      : res.status === 408 || res.status === 504 ? "TIMEOUT"
      : res.status >= 500 ? "SERVICE"
      : "BAD_REQUEST";
    throw new ReadingError(code, res.status === 429 || res.status === 402 ? 429 : 502);
  }
  let json;
  try { json = await res.json(); } catch { throw new ReadingError("BAD_RESPONSE"); }
  const choice = json?.choices?.[0];
  // "length" = truncated before the JSON closed; "content_filter" = provider
  // withheld the output. Everything else (stop, eos, missing) is fine —
  // providers are not consistent about setting this field.
  if (["length", "content_filter"].includes(choice?.finish_reason)) throw new ReadingError("BAD_RESPONSE");
  const text = choice?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new ReadingError("BAD_RESPONSE");
  return text;
}

function parseJson(text: string): any {
  try { return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); }
  catch { throw new ReadingError("BAD_RESPONSE"); }
}

export function normalizeExtraction(parsed: unknown): { rows: ExtractedRow[]; unreadable: string[] } {
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as any).rows)) throw new ReadingError("BAD_RESPONSE");
  const source = parsed as any;
  const rows: ExtractedRow[] = [];
  const unreadable: string[] = Array.isArray(source.unreadable) ? source.unreadable.filter((x: unknown) => typeof x === "string").slice(0, 100) : [];
  for (const r of source.rows.slice(0, 100)) {
    if (!r || typeof r.nameAsPrinted !== "string" || !r.nameAsPrinted.trim()) { unreadable.push("omitted"); continue; }
    const raw = r.value;
    const parsedValue = typeof raw === "number" && Number.isFinite(raw) ? raw : typeof raw === "string" && /^-?\d+(?:\.\d+)?$/.test(raw.trim()) ? Number(raw) : null;
    const value = parsedValue !== null && Number.isFinite(parsedValue) ? parsedValue : null;
    rows.push({ nameAsPrinted: r.nameAsPrinted.trim().slice(0, 200), value, unit: typeof r.unit === "string" ? r.unit.trim().slice(0, 80) || null : null, printedRange: typeof r.printedRange === "string" ? r.printedRange.trim().slice(0, 200) || null : null });
  }
  return { rows, unreadable };
}

// ---------------------------------------------------------------------------
// CALL 1 — extraction
// ---------------------------------------------------------------------------

const JSON_ONLY = "Respond with a single JSON object only, matching the required schema exactly. No markdown, no code fences, no commentary before or after it.";

const EXTRACTION_PROMPT = `You are transcribing a medical laboratory report image into structured data.

Transcribe ONLY. Do not interpret, assess, or comment on any result.

Rules:
- One entry per test result row in the report.
- "nameAsPrinted" must be the test name EXACTLY as it appears on the report, including any abbreviation or punctuation. Do not correct, expand, or standardise it.
- "value" is the numeric result only, as a number. If the result is not numeric (for example "Negative", "Nil", "Trace"), set value to null.
- "unit" is the unit exactly as printed next to the value, or null if none is printed.
- "printedRange" is the reference range printed on the report for that row, verbatim as a string, or null if none is printed.
- If a row is blurred, cropped, or you cannot read it with confidence, DO NOT GUESS. Leave it out of "rows" and add a short description of it to "unreadable".
- Ignore patient name, age, address, doctor name, registration numbers, barcodes and any other identifying detail. Do not transcribe them anywhere in your output.

Accuracy matters more than completeness. An omitted row is recoverable; a wrong number is not.

${JSON_ONLY}`;

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nameAsPrinted: { type: "string" },
          value: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          printedRange: { type: ["string", "null"] },
        },
        required: ["nameAsPrinted", "value", "unit", "printedRange"],
        additionalProperties: false,
      },
    },
    unreadable: { type: "array", items: { type: "string" } },
  },
  required: ["rows", "unreadable"],
  additionalProperties: false,
};

export async function extractFromImage(
  base64Data: string,
  mimeType: string,
): Promise<{ rows: ExtractedRow[]; unreadable: string[] }> {
  const text = await callModel({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACTION_PROMPT },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } },
        ],
      },
    ],
    // temperature 0 so the same image gives the same numbers every run.
    // Extraction should be reproducible.
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: { name: "lab_extraction", strict: true, schema: EXTRACTION_SCHEMA },
    },
  });

  return normalizeExtraction(parseJson(text));
}

// ---------------------------------------------------------------------------
// CALL 2 — explanation
//
// Note what this prompt receives: rows where `status` has ALREADY been
// decided by our code. The model is told the flag as a fact and asked only
// to put it into words. It is not asked to evaluate anything.
// ---------------------------------------------------------------------------

const EXPLANATION_PROMPT = `You write plain-language explanations of medical test results for patients with no medical training, including elderly readers and readers with low health literacy.

You will receive test results where whether each one is inside or outside its reference range HAS ALREADY BEEN DETERMINED. Treat the "status" field as established fact. Never re-evaluate it, never contradict it, never soften or strengthen it.

For each result, write:

1. "explanation" — two or three short sentences, at a reading age of about 12.
   - Sentence one: what this test measures, in everyday words.
   - Sentence two: state the result's relationship to the reference range, in the same terms as the given status.
   - Sentence three (only if status is not "normal"): note that many ordinary things can move this number and that a doctor interprets it in context.

2. "doctorQuestion" — one specific question the patient could ask their doctor about this result. Null if the status is "normal".

Also write a "summary": two sentences covering how many results were inside the range and how many were outside. Neutral in tone.

ABSOLUTE RULES — output violating any of these is discarded:
- Never name a disease or condition.
- Never say or imply the patient has, might have, or is at risk of anything.
- Never mention any medication, supplement, dose or treatment.
- Never give instructions beginning "you should" or "you need to".
- Never offer reassurance such as "nothing to worry about" — you cannot know that.
- Never state a numeric reference range of your own. The ranges given to you are the only ones that exist.

Write for someone frightened by a number they don't understand. Be calm, clear, and short.

If a language other than English is requested, write both "explanation" and "doctorQuestion" in that language, using everyday spoken vocabulary rather than formal or literary register. Keep "summary" in that language too.

${JSON_ONLY}`;

const EXPLANATION_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          explanation: { type: "string" },
          doctorQuestion: { type: ["string", "null"] },
        },
        required: ["key", "explanation", "doctorQuestion"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "items"],
  additionalProperties: false,
};

export interface ExplanationOut {
  summary: string;
  byKey: Record<string, { explanation: string; doctorQuestion: string | null }>;
}

export async function explainRows(
  rows: AssessedRow[],
  language = "English",
): Promise<ExplanationOut> {
  // Only send what the model needs. No patient data, no raw printed text.
  const payload = rows
    .map((r, i) => ({
      key: String(i),
      test: r.displayName,
      measures: r.measures,
      value: r.valueInCanonicalUnit,
      unit: r.canonicalUnit,
      referenceRange:
        r.printedRange || "unknown",
      status: r.flag, // <-- decided by our code, not by the model
      lowerIsNotable: r.higherIsBetter,
    }));

  const text = await callModel({
    messages: [
      {
        role: "user",
        content: `${EXPLANATION_PROMPT}\n\nOutput language: ${language}\n\nResults:\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: { name: "lab_explanation", strict: true, schema: EXPLANATION_SCHEMA },
    },
  });

  const parsed = parseJson(text);
  if (!Array.isArray(parsed?.items) || typeof parsed.summary !== "string") throw new ReadingError("BAD_RESPONSE");
  const byKey: ExplanationOut["byKey"] = {};
  for (const item of parsed.items ?? []) {
    if (typeof item?.key !== "string" || typeof item.explanation !== "string" || item.explanation.length > 4000) continue;
    byKey[item.key] = {
      explanation: String(item.explanation ?? ""),
      doctorQuestion: item.doctorQuestion ? String(item.doctorQuestion) : null,
    };
  }
  return { summary: String(parsed.summary ?? ""), byKey };
}
