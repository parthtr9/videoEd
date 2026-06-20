# CLAUDE.md

This file is the operating manual for any Claude Code agent (or other AI coding assistant) working in this repository. Read it fully before writing any code, and follow it on every single task — not just the first one.

---

## 1. What this project is

This is a **parametric product-video generation pipeline**. A client provides:

- A product image or rendering (whatever background it already has)
- One brand color (a single hex code)
- Headline / subheadline copy, and optionally a voiceover script
- A template/mood choice (Minimal / Bold / Luxury)
- The aspect ratio(s) they want (16:9, 9:16, 1:1)

The system outputs a polished, branded MP4 video — automatically, with no AI video-generation model involved anywhere. It is templated motion graphics: background removal → color palette derivation → optional text-to-speech narration → Remotion rendering.

**Why this exists:** AI video generation (Veo, Kling, etc.) costs $0.50–$7+ per short clip and can't guarantee product accuracy — it sometimes hallucinates details. This pipeline produces a video for a fraction of a cent, with the product looking exactly like the product, every single time.

**The bar for this project:** this is not a prototype to demo once. It is being built to take real paying clients, run unattended at volume, and grow. Every decision — every library choice, every shortcut, every "I'll fix it later" — should be made by asking "will this hold up at 100 clients and 10,000 videos a month," not "does this work once on my machine right now."

---

## 2. Tech stack — do not substitute without explicit discussion

| Layer | Choice | Why |
|---|---|---|
| Rendering | **Remotion** (React → video), local CLI in dev, **Remotion Lambda** in production | CPU-only by design — no GPU anywhere in this stack |
| Background removal | **rembg** (CPU, free, self-hosted), default for everything | Hosted GPU API (fal.ai / Replicate) is a fallback ONLY for cutouts rembg handles badly — never the default |
| Color system | **culori** (OKLCH palette derivation) + **chroma.js** (contrast / text-color math) | Never derive a palette in HSL — it produces uneven, hue-shifting results |
| Narration | **Piper TTS** (CPU, free, self-hosted), default | Paid TTS (ElevenLabs, etc.) only as an explicit opt-in upgrade, never silently swapped in |
| Validation | **Zod** on every prop boundary | No untyped object ever crosses a pipeline stage |
| Infra | AWS Lambda + S3, **SQS** for job queueing once past single-render testing | Pay-per-use, no idle servers |
| Web layer | Next.js + **`@remotion/player`** for live client preview | Catch bad inputs before spending a render |

If you think a substitution is justified (e.g., the free background-removal model is consistently failing on a class of products), say so explicitly, document the tradeoff in `RESOURCES.md` (Section 4), and get confirmation before changing the default — don't silently swap dependencies.

---

## 3. Core development rules

### 3.1 One feature at a time, fully working, before starting the next

- Build one feature, completely, before touching the next one. Never leave feature A half-done while starting feature B.
- Each feature lives on its own branch.
- Commit in small, atomic commits — one logical change per commit, with a clear, specific commit message (not "fixes" or "updates").
- A feature only merges once: (a) it has its own passing unit tests, and (b) the **entire existing test suite** still passes. A regression anywhere is a blocker, not a follow-up item.
- If two features must touch the same file, sequence them. Finish and merge one before starting the other.

### 3.2 Testing is mandatory, not optional, at every stage

- **Every feature gets its own unit tests** before it is considered done. No "I'll add tests later."
- **Every time you add a feature, run the full existing test suite.** If something that used to work breaks, fix it before moving forward — don't note it and move on.
- **Once two or more features are meant to work together** (e.g., the background-removal output feeding into color derivation, or the derived palette feeding into the Remotion render), write an **integration test** that runs them together. Individually-passing unit tests do not prove the pipeline works end-to-end — only an integration test does.
- Keep one command that runs everything (e.g. `npm test`) so there is never ambiguity about whether the system currently works as a whole.

### 3.3 Cost-consciousness is a hard constraint, not a nice-to-have

The entire value of this project is being radically cheaper than AI-generated video. Every new dependency defaults to free/self-hosted/CPU first. A paid service is only introduced when there's a concrete, demonstrated gap the free option can't close — and that decision gets written down (Section 4), not made silently.

---

## 4. Resource tracker — maintain `RESOURCES.md`

Keep a `RESOURCES.md` file at the project root. Every external tool, library, API, or paid service this project touches gets a row:

| Resource | Purpose | Cost | Free/self-hosted alternative | Added in sprint |
|---|---|---|---|---|

Update this **before** merging the feature that introduces a new dependency, not after. This file is the single source of truth for "what does running this thing actually cost," and it must stay accurate as the project grows. A starter version is included in this repo — extend it, don't replace it.

---

## 5. Communication style — use the caveman skill, always

When explaining work — commit messages, PR descriptions, comments explaining *why* (not just what), or any summary given to the user — use the **caveman skill** if it's available in your skills directory. If it isn't available, write in that style yourself by default: short, plain sentences, no jargon, no corporate fluff, as if explaining to someone with zero context on this codebase.

Every summary must clearly answer two things, in plain words:
1. **What did I just do?**
2. **What is this trying to achieve, and why does it matter for getting this to production?**

Bad summary: "Improved the pipeline for clarity."
Good summary: "Added the color step. It takes the one brand color a client gives us and builds the full set of colors we need — accent, light background, dark text — automatically, so clients never have to pick a whole palette themselves. This is what keeps the system 'one input field' simple instead of turning into a design tool."

---

## 6. Progress tracking — maintain `PROGRESS.md`

Keep a `PROGRESS.md` file at the project root. After every sprint (one focused work session, or one cohesive batch of related features), **append** a new entry. Never overwrite or delete a previous entry — this file is the permanent history of the project.

Use this exact format for every entry:

```markdown
## Sprint [N] — [date]

### What was built
- [Feature/change 1, plain language]
- [Feature/change 2]

### What it achieves
[1-3 sentences: why this matters for getting the project to production]

### Tests added
- [List of new unit/integration tests]

### Known issues / left undone
- [Anything incomplete, deferred, or flagged for follow-up]

### Cost impact
[Any change to per-video or fixed monthly cost — reference RESOURCES.md]
```

A new agent (or human) should be able to read `PROGRESS.md` top to bottom, cold, and understand exactly how the system got to its current state. A starter file with a Sprint 0 entry is included — continue from there.

---

## 7. Production-readiness checklist

Before this is considered ready for real users, confirm every box:

- [ ] Every pipeline stage (bg removal, color derivation, narration, render) has error handling and retries — one failed stage must not silently corrupt the whole job
- [ ] Render jobs are queued (SQS or equivalent) — never triggered synchronously from a web request
- [ ] Rate limiting exists on any endpoint that can trigger a render or an external API call
- [ ] Secrets (AWS keys, any API keys) live in environment variables / a secrets manager — never committed to the repo
- [ ] Cost monitoring/alerting exists for every pay-per-use service in play (Lambda, hosted bg-removal fallback, paid TTS)
- [ ] Automated QA gates run before a video is marked complete: contrast/readability check on text-over-color, basic cutout-quality check on bg-removal output
- [ ] `@remotion/player` preview is wired up so bad inputs get caught before any render is triggered
- [ ] Multi-aspect-ratio renders are visually verified, not assumed to work just because one ratio worked
- [ ] The full test suite (unit + integration) passes before any deploy

---

## 8. Coding standards

- TypeScript, strict mode, no `any`
- Every prop boundary (between pipeline stages, into Remotion compositions) validated with Zod
- All Remotion animation derives from `useCurrentFrame()` — never `Date.now()`, `setTimeout`, or CSS transitions; never `Math.random()` (use Remotion's seeded random)
- Small, single-responsibility functions/components, not large multi-purpose ones
- No silent failures — every stage either succeeds clearly or throws/logs clearly, with enough detail to debug without re-running

---

## 9. Definition of done (applies to every feature, no exceptions)

A feature is not done until **all** of the following are true:

1. It works in isolation, proven by its own unit tests
2. The full test suite still passes — no regressions anywhere
3. `RESOURCES.md` is updated if a new dependency/service was introduced
4. A clear, caveman-style summary was given of what was built and why it matters
5. It's committed in small, atomic, clearly-described commits
6. `PROGRESS.md` is updated at the end of the sprint that included this feature

---

## 10. Quick reference

```bash
# Run the full test suite (unit + integration)
npm test

# Render locally during development
npx remotion render src/index.ts ProductVideo out/video.mp4 --props='{"...":"..."}'

# Preview live in the browser (no render triggered)
npx remotion studio

# Deploy/update the Remotion Lambda site after a composition change
npx remotion lambda sites create
```

Keep this section updated as real project-specific commands get added — don't let it go stale.
