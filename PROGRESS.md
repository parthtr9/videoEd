# PROGRESS.md

This file is the permanent, append-only history of this project. Every sprint gets a new entry added to the bottom. Never edit or delete a previous entry — if something changes, note the change in a new entry, don't rewrite history.

Format for every entry:

```markdown
## Sprint [N] — [date]

### What was built
- ...

### What it achieves
...

### Tests added
- ...

### Known issues / left undone
- ...

### Cost impact
...
```

---

## Sprint 0 — Planning

### What was built
- No code yet. This sprint was all planning: figured out what we're actually building and how.
- Decided the whole pipeline shape: client gives us a product image, one brand color, and some text → we strip the background out of the image, build a full color palette from that one color, optionally add a voiceover, then render a finished branded video with Remotion.
- Decided every tool in the stack on purpose, with cost as the deciding factor: Remotion for rendering (CPU only, no GPU anywhere), rembg for background removal (free, runs on a normal computer), culori + chroma.js for the color math, Piper for narration (free, also CPU).
- Worked out roughly what a video costs to make this way: about a penny to a few cents per video, versus $0.50–$7+ per clip if we used AI video generation instead. That's the whole reason this approach exists.
- Wrote `CLAUDE.md` so any agent picking this up later knows the rules: build one thing at a time, test everything, track costs honestly, write things down plainly.

### What it achieves
This sprint didn't ship a feature — it made sure we're not about to build the wrong thing. Every later sprint should be able to point back to this one and explain how the feature fits into this same pipeline, at this same cost target.

### Tests added
- None yet — no code exists.

### Known issues / left undone
- Nothing built yet: background removal step, color derivation step, Remotion composition/templates, narration step, and the Lambda rendering setup are all still to do.
- `RESOURCES.md` needs to be kept up to date as soon as the first real dependency gets installed.

### Cost impact
- Target: roughly $0.01–$0.03 per finished video (all aspect ratios) using the free/self-hosted defaults. Nothing spent yet — no code running.

---

## Sprint 1 — 2026-06-19

### What was built
- Initialized the npm project with TypeScript (strict mode), Jest (ts-jest), and all planned dependencies: Remotion 4, Zod 4, culori, chroma-js.
- `src/schemas/videoProps.ts` — Zod schemas for every prop that can cross a pipeline boundary: `VideoPropsSchema`, `ColorPaletteSchema`, `AspectRatioSchema`, `TemplateSchema`, `ASPECT_RATIO_DIMENSIONS`. These are the contract — nothing untyped ever flows between stages.
- `src/compositions/ProductVideo.tsx` — first working Remotion composition. Takes a product image, palette, headline, subheadline, and template choice. Springs in the image and headline, fades in the subheadline, renders a brand-colored accent bar at the bottom. Three templates (Minimal / Bold / Luxury) change font, weight, and background color.
- `src/Root.tsx` — registers all three aspect-ratio compositions (16:9, 9:16, 1:1) with Remotion so `npx remotion studio` shows all variants at once.
- `package.json` scripts: `npm test`, `npm run build`, `npm run studio`, `npm run render`.

### What it achieves
The repo goes from empty to a renderable video. You can run `npm run studio` today and see a composition playing in the browser. Every prop that enters the system is validated at the boundary with Zod — bad client inputs get caught before anything renders, not after. This is the foundation every later pipeline stage (background removal, color derivation, narration) plugs into.

### Tests added
- `src/__tests__/videoProps.test.ts` — 12 unit tests covering `VideoPropsSchema` (valid/invalid brandColor, headline bounds, template enum, aspect ratio enum, optional fields) and `ASPECT_RATIO_DIMENSIONS` (all three ratios).

### Known issues / left undone
- Background removal step (rembg) not yet built — `productImageUrl` still expects a pre-processed image.
- Color derivation step (culori + chroma-js) not yet built — palette is currently passed in manually; clients would need to provide all 6 hex values.
- Narration (Piper TTS) not yet built.
- No Remotion Lambda setup yet — all rendering is local.
- `ProductVideo.tsx` has no audio track wired up yet (waiting on narration step).

### Cost impact
- No new paid dependencies added. All installed libraries are free/open source. Zero per-video cost change from Sprint 0.

---

## Sprint 2 — 2026-06-20

### What was built
- `src/pipeline/colorDerivation.ts` — `derivePalette(brandHex)` function. Client gives one hex code; function returns all six colors the system needs: brand, accent, backgroundLight, backgroundDark, textOnLight, textOnDark.
- Color math uses OKLCH (via culori) — perceptually uniform, no hue-shifting artifacts you get with HSL. Accent is derived by deepening lightness and boosting chroma. Backgrounds are near-white/near-black with a subtle hue echo from the brand color.
- Contrast enforcement uses chroma-js: textOnLight and textOnDark are picked from a ranked candidate list, falling back to pure black/white until WCAG AA (4.5:1) is met. A bad brand color (e.g. near-white) can never produce unreadable text.
- `src/Root.tsx` updated — hardcoded palette removed, now calls `derivePalette(brandColor)` so the composition always reflects the auto-derived palette.
- Added `@types/culori` dev dependency (culori ships no bundled types).

### What it achieves
Clients now give one input (a hex code) and get a full, readable, on-brand color system automatically. This is what keeps the product "one field" simple and prevents clients from needing to be designers. Every future template and composition just uses the palette — no color decisions happen anywhere else.

### Tests added
- `src/__tests__/colorDerivation.test.ts` — 9 tests across 8 brand colors covering: invalid input rejection, schema validity, hex format, brand field round-trip, WCAG AA contrast on light bg, WCAG AA contrast on dark bg, bgLight perceptual lightness, bgDark perceptual darkness, accent distinctness.

### Known issues / left undone
- Background removal (rembg) still not built — composition uses a raw image URL with whatever background it already has.
- Narration (Piper TTS) not yet built.
- No Remotion Lambda setup yet.

### Cost impact
- `@types/culori` is a dev-only type package. Zero runtime cost. No change to per-video cost.

---

## Sprint 3 — 2026-06-20

### What was built
- `scripts/remove_bg.py` — Python script wrapping rembg. Takes input path + output path as CLI args, writes a transparent-background PNG to the output path, prints the resolved output path to stdout on success, all errors to stderr with a non-zero exit code.
- `src/pipeline/backgroundRemoval.ts` — Node async wrapper around the Python script. Validates inputs with Zod, checks input file exists before spawning, spawns `python3 remove_bg.py`, surfaces the stderr message on failure, verifies output file was actually written. Returns the output path on success.
- `src/__tests__/backgroundRemoval.test.ts` — 6 unit tests with `child_process` and `fs` fully mocked: empty input validation, missing file detection, stderr surfacing, missing output detection, success return value, correct args passed to python3.
- `src/__tests__/backgroundRemoval.integration.test.ts` — 1 real rembg integration test (skipped by default, runs with `INTEGRATION=true`). Verified working: rembg processes a real PNG, writes a non-empty output file.
- `src/__tests__/fixtures/red_square.png` — minimal 100×100 red PNG for integration testing.
- Installed `rembg[cpu]` via pip3 (Python 3.12).

### What it achieves
Product images no longer need to arrive pre-processed. The pipeline can now accept any JPEG/PNG with any background and output a clean transparent PNG — which is what the Remotion composition needs to show the product against a colored brand background. First paid-API-free stage of the pipeline proven working on real hardware.

### Tests added
- 6 unit tests in `backgroundRemoval.test.ts`
- 1 integration test in `backgroundRemoval.integration.test.ts` (opt-in via `INTEGRATION=true`)

### Known issues / left undone
- rembg downloads its U²-Net ONNX model (~170MB) on first run to `~/.u2net/`. This is a one-time download per machine, not per video. No issue in production, but cold-start on a fresh Lambda container will be slow unless we bake the model into the container image.
- Color derivation (Sprint 2) and background removal (Sprint 3) are not yet wired together into a single pipeline function — each stage is still called independently.
- Narration (Piper TTS) not yet built.
- No Remotion Lambda setup yet.

### Cost impact
- rembg is free, self-hosted, CPU-only. Zero per-video cost. No change from Sprint 0 target.

---

## Sprint 4 — 2026-06-20

### What was built
- `src/pipeline/buildVideoJob.ts` — `buildVideoJob(rawInput)` orchestrates the full pipeline. Validates raw client input with `JobInputSchema` (Zod), fires `derivePalette` and `removeBackground` concurrently (independent steps), assembles and validates a complete `VideoProps` object with the auto-derived palette and a `file://` URL pointing to the processed PNG.
- `JobInputSchema` — Zod schema for raw client input (productImagePath, outputDir, brandColor, headline, subheadline, voiceoverScript, template, aspectRatio). This is the single front door — anything malformed is rejected here before any processing starts.

### What it achieves
For the first time, all three stages talk to each other. A caller gives raw client inputs — an image path, a hex code, some copy — and gets back a fully-formed `VideoProps` ready to hand to Remotion for rendering. This is the function that a web handler, CLI, or SQS consumer will call. Every stage has its own error handling; if bg removal fails, the whole job fails loudly with the reason, not silently.

### Tests added
- `src/__tests__/buildVideoJob.test.ts` — 15 unit tests: JobInputSchema validation (6 cases), buildVideoJob behavior (9 cases) with removeBackground mocked — verifies correct args passed, file:// URL shape, palette correctness, error bubbling, optional field passthrough.
- `src/__tests__/buildVideoJob.integration.test.ts` — 1 integration test (`INTEGRATION=true`): full pipeline on a real image, asserts processed PNG exists, props pass schema, palette brand matches input, template/ratio pass through. Verified passing.

### Known issues / left undone
- Narration (Piper TTS) not yet built — voiceoverScript is accepted and validated but not acted on.
- No Remotion Lambda setup yet — renders still local only.
- No web handler or CLI entry point yet — buildVideoJob exists but nothing calls it from outside the test suite.

### Cost impact
- No new dependencies. Zero per-video cost change.

---

## Sprint 5 — 2026-06-20

### What was built
- `scripts/synthesize_speech.py` — Piper TTS wrapper. Takes text, output WAV path, and ONNX model path as args. All errors to stderr with non-zero exit code. Validates model + config existence before running.
- `src/pipeline/narration.ts` — Node async wrapper. Zod-validates inputs, checks model exists before spawning, surfaces stderr on failure, verifies output WAV was written. Exports `DEFAULT_MODEL_PATH` pointing to the bundled `en_US-lessac-medium` voice.
- Downloaded `en_US-lessac-medium.onnx` (~60MB) voice model to `models/`. CPU-only, no GPU needed.
- `src/schemas/videoProps.ts` — added `narrationUrl` optional field to `VideoPropsSchema` (validated URL, set to `file://` path when narration runs).
- `src/compositions/ProductVideo.tsx` — added Remotion `<Audio src={narrationUrl} />` so narration plays in sync during render when provided.
- `src/pipeline/buildVideoJob.ts` — narration now runs concurrently with bg removal (both are independent). `VideoJob` return type gains `narrationPath: string | null`. `narrationUrl` passed into props when script provided.

### What it achieves
Clients can now provide a voiceover script and get a video with real synthesized speech — free, CPU-only, no ElevenLabs or other paid TTS. Audio is synced to the video at render time by Remotion. When no script is provided, the video renders silently — narration is strictly opt-in, never forced.

### Tests added
- `src/__tests__/narration.test.ts` — 7 unit tests (child_process + fs mocked): empty text/path rejection, model not found, stderr surfacing, missing output WAV, success return, correct args to python3.
- `src/__tests__/narration.integration.test.ts` — 1 real Piper integration test (`INTEGRATION=true`). Verified working on this machine.
- 5 new tests in `buildVideoJob.test.ts`: synthesizeSpeech not called without script, called with correct text when provided, narrationPath null without script, narrationUrl in props when script provided, error bubbling from synthesizeSpeech.

### Known issues / left undone
- `models/` directory (60MB ONNX file) is not committed to git (too large for a repo). Need a download script or documented setup step for new machines and Lambda containers.
- No CLI or web handler yet — buildVideoJob still only callable from tests.
- Remotion Lambda not set up yet.

### Cost impact
- `piper-tts` Python package: free, open source. Voice model: free (rhasspy/piper-voices on HuggingFace). Zero per-video cost change.

---

## Sprint 6 — 2026-06-20

### What was built
- `src/cli.ts` — full CLI entry point. Parses `--image`, `--brand`, `--headline`, `--template`, `--ratio` (required) plus `--subheadline`, `--script`, `--out` (optional). Calls `buildVideoJob`, copies processed assets into `public/processed/` (so Remotion's dev server can serve them as relative URLs), then spawns `remotion render` to produce an MP4.
- `public/processed/` directory — where processed images and narration WAVs land before a render. Remotion serves this automatically as static assets.
- `package.json` — added `"cli": "ts-node src/cli.ts"` script.
- `src/__tests__/cli.test.ts` — 5 unit tests: missing args exits 1, --help exits 0, buildVideoJob called with correct flags, processed image copied to public/, correct composition ID passed to remotion render.

### What it achieves
First time the whole pipeline can be triggered with a single command from the terminal. A developer (or a future web handler) just runs `npm run cli -- --image product.jpg --brand "#FF5500" --headline "Buy Now" --template Minimal --ratio 16:9` and gets an MP4. No manual step-by-step needed.

### Tests added
- 5 unit tests in `src/__tests__/cli.test.ts`

### Known issues / left undone
- CLI hasn't been tested with a real end-to-end render yet — that's the next demo step.
- No Remotion Lambda setup yet.
- SQS job queue not built.

### Cost impact
- No new paid dependencies. Zero per-video cost change.
