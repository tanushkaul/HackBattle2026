# MEDIEXPLAIN — updated application

Next.js frontend and report-analysis backend. This update fixes the image preview warning, improves upload/camera handling and extraction validation, translates the full interface into five languages, removes the sample/demo feature, and adds Back/Forward navigation.

## Updating your existing app

1. Stop the development server with Ctrl+C.
2. Extract this archive. Use the new `HackBattle2026` project folder.
3. Copy your existing `.env.local` into the new folder. **Do not overwrite your working key with the empty example.** If you have no key file, create `.env.local` beside `package.json` and set `OPENROUTER_API_KEY` (get one at https://openrouter.ai/keys).
4. Open the new folder in VS Code and run:

```bash
npm ci
npm run dev
```

Open http://localhost:3000. Use a current supported Node.js installation (Node 22 LTS recommended; Next.js requires Node 20.9 or newer).

If updating the existing folder instead, replace the source/configuration files, remove the old `lib/demo.ts`, and delete the old `.next` build directory while the server is stopped. Keep `.env.local`. Run `npm ci`, then start again.

## What changed

- **Preview warning fixed:** file and object URL are committed together. Image/PDF elements only render when a nonempty URL exists, and obsolete URLs are revoked. The app never renders an image with `src=""`.
- **File identification:** inspect actual file bytes rather than relying on the browser's MIME label. JPEGs with a missing or generic MIME label are accepted when their signature matches.
- **Image preparation:** decode through the standard image element for wider mobile support. Preserve small images; resize larger images to a maximum dimension of 3200 pixels and encode at JPEG quality 0.92. A 12 MB image selection limit and 6 MB final request/PDF limit apply. HEIC/HEIF must be exported as JPEG first.
- **Camera:** live camera preview, rear-camera preference, Take Photo and Close Camera controls. No audio is requested. Camera tracks stop after capture, when closing, when navigating away and when the app unmounts. On unsupported/insecure contexts the native file/camera picker is offered. A secure HTTPS origin or localhost is required for live camera access.
- **Extraction:** all expected JSON properties are requested. Missing optional values are normalized to `null`, numeric strings are safely parsed, and a malformed row no longer discards every readable result. Every extracted row is still shown for user review before interpretation.
- **Useful errors:** API-key/permission rejection, quota, model availability, timeout, connection failures, malformed model output and an actual absence of readable rows have distinct localized messages. Provider error payloads and keys are never displayed or logged.
- **Complete app localization:** English, Hindi, Tamil, Kannada and Assamese. Navigation, headings, buttons, settings, errors, status labels, parameter definitions, summaries, doctor questions, accessibility labels and print content use the selected language. HTML language and date/number formatting change too. Original document text, filenames, scientific units and the MEDIEXPLAIN brand remain unchanged intentionally. Original test names are explicitly labelled in the detail dialog.
- **Immediate switching:** built-in translated explanations appear immediately while detailed AI explanations load. A late response from a previous language cannot replace the current language. AI text returned in the wrong script falls back to the selected language.
- **No sample/demo feature:** no sample report, buttons, setting or API branch. Legacy sample history entries are removed on loading. No synthetic data replaces an uploaded report.
- **Back/Forward:** app navigation buttons follow the actual page navigation history, including selected report identity. Navigating to a new page after going back replaces the forward branch. Navigation is disabled during analysis; Cancel remains available.

## Reading a real report

1. Choose a PDF/JPG/PNG/WebP, drag it into the upload area, or use Scan Report and Take Photo.
2. Review the image and agree to send it to OpenRouter for reading.
3. Select Read Report.
4. Verify and correct every extracted name, value, unit and printed range. Expand the report preview to compare it with the original. Add/remove rows if needed.
5. Select Confirm & Explain.
6. View results, change language, listen where a matching device voice is available, prepare questions or print/save a PDF.

You can enter report values manually if automatic reading is unavailable. One row per test, using this format:

```text
Parameter name | Numeric value | Unit | Reference range printed on the report
```

Leave missing ranges blank. Use the exact printed test name. Unknown or ambiguous parameters and missing or complex ranges are not classified. Status comparisons use only the verified printed range, including the difference between strict `<`/`>` and inclusive `≤`/`≥`.

## If a clear image still cannot be read

Read the new specific error message:

- **Not configured:** set `OPENROUTER_API_KEY` (or `AI_API_KEY`) in `.env.local` and restart. This file belongs beside `package.json`, not in `lib` or `app`.
- **Key/permissions rejected:** check your OpenRouter key and account settings at https://openrouter.ai/keys.
- **Quota reached:** check OpenRouter credits/billing at https://openrouter.ai/credits; retry when available or use manual entry.
- **Model unavailable:** set `OPENROUTER_MODEL` to a model id that exists and supports images/structured output — browse current ids at https://openrouter.ai/models, then restart.
- **Timeout/network/service:** retry after checking connectivity; the selected file remains available. A single provider being overloaded no longer fails the request outright — see "Provider resilience" below.
- **No usable rows:** try a straight, well-lit full-page image. All values can also be entered manually.

The server's default model chain is `OPENROUTER_MODEL=openai/gpt-4o-mini` with `OPENROUTER_FALLBACK_MODELS=google/gemini-2.5-flash,qwen/qwen-2.5-vl-72b-instruct`; it does not assert that any specific model is available to every account. OpenRouter documents its API and error shape at https://openrouter.ai/docs .

### Provider resilience

`lib/ai.ts` sends every request with a `models` list, not a single model id (OpenRouter's [model fallback](https://openrouter.ai/docs/guides/routing/model-fallbacks) feature). If the primary model errors — rate-limited, overloaded, temporarily down — OpenRouter automatically retries the next model in `OPENROUTER_FALLBACK_MODELS` before the error ever reaches this app. The default chain spans three different providers (OpenAI, Google, Alibaba/Qwen) on purpose, so one vendor's outage doesn't take the demo down with it. Only if every model in the chain fails does the request surface one of the error codes above.

## Checks

```bash
npm test
npm run lint
npm run build
```

- `lib/selfCheck.ts`: deterministic ranges, optional extraction fields, numeric parsing, MIME signatures and complete five-language dictionary/catalog coverage.
- `scripts/check-api.cjs`: direct route-handler tests using simulated provider responses. Checks typed provider failures, no-key behavior, malformed JSON structures and translated fallback. No external API calls.
- `scripts/check-ui.cjs`: React DOM regression tests using jsdom and simulated file/image/media APIs. Checks the upload-preview warning, missing MIME labels, consent, review/results flow, all languages, translated questions/settings, navigation history and camera lifecycle. These checks do not validate physical camera hardware or visual rendering in a real browser.

The production build, TypeScript check and automated regression tests are verified during delivery. Live OpenRouter behavior still requires your own working key and account with credits. Translation dictionaries have not received professional medical-language review. Voice availability, particularly Assamese, depends on installed device/browser voices; unsupported voices are reported explicitly.

## Files

- `app/page.tsx`: translated UI, navigation state, camera lifecycle and report workflow.
- `app/globals.css`: responsive, expanded-text, accessibility and print styles.
- `app/api/analyze/route.ts`: validation, extraction and explanation endpoint.
- `lib/i18n.ts`: five-language interface dictionary.
- `lib/terms.ts`: localized catalog names and educational definitions.
- `lib/explanations.ts`: localized deterministic fallback and manual-entry parser.
- `lib/files.ts`: MIME signature detection and browser image preparation.
- `lib/ai.ts`: server-side OpenRouter requests (with model fallback) and extraction normalization.
- `lib/analyze.ts`: printed-range comparisons and supplementary text guardrails.

## Privacy and scope

Automatic reading sends the selected file to OpenRouter (and, via it, one of a small set of AI providers) only with user consent. Explanation requests send structured test results. Provider data policies apply. The app does not permanently store original uploads. Results remain in session memory unless optional device storage is enabled; browser storage is unencrypted. Clear Local Data removes saved results from this browser.

This is an educational hackathon app, not a diagnostic or treatment system. Verify extracted values and units against the original, and discuss results with a qualified doctor. Text guardrails are supplementary; they are not clinical certification or a complete multilingual semantic safety check. No public deployment, cloud database or user authentication is included.

The existing app's layout is retained and adapted for longer translations. Exact Figma fidelity and real-browser visual QA remain unverified from the earlier delivery. No secrets, installed packages or build caches are included in the archive.
