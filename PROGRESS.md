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
