# RESOURCES.md

Every external tool, library, API, or paid service this project depends on gets a row here. Update this **before** merging the feature that introduces it — not after. If a free/self-hosted default ever gets swapped for a paid one, the reason goes in this table, not just in a commit message.

| Resource | Purpose | Cost | Free/self-hosted alternative | Added in sprint |
|---|---|---|---|---|
| Remotion | Renders the React video composition into an MP4 | Free for individuals/teams ≤3 people. Companies of 4+ need a paid license (~$25/dev/mo, ~$100/mo company minimum) | N/A — this is the core tool | Sprint 1 |
| Remotion Lambda | Parallelized, CPU-only production rendering on AWS | Pay-per-use, AWS Lambda billing (GB-seconds). Roughly $0.001–$0.01 per short clip | Local `npx remotion render` for dev/low-volume, no AWS needed | Sprint 0 |
| rembg | Background removal from product images | Free, self-hosted, CPU only | N/A — already the free default | Sprint 0 |
| culori | Derives a full OKLCH color palette from one brand hex | Free, open source | N/A | Sprint 1 |
| chroma.js | Contrast math — picks readable text color against any background | Free, open source | N/A | Sprint 1 |
| Piper TTS | Generates voiceover narration audio from script text | Free, self-hosted, CPU only | N/A — already the free default | Sprint 0 |
| AWS S3 | Stores rendered output videos and intermediate assets | Pay-per-use, storage + egress. Fractions of a cent per video at this scale | N/A | Sprint 0 |
| AWS SQS | Queues render jobs once past single-render local testing | Pay-per-use, $0.40/million requests. At 10k renders/month (3 calls each) ≈ $0.012/mo | N/A — needed once volume requires queueing | Sprint 8 |
| AWS CloudWatch | Billing + Lambda invocation alarms. Alerts fire via SNS email | Free tier: 10 alarms free. We use 2. $0.10/alarm/mo after free tier | N/A | Sprint 11 |
| AWS SNS | Delivers cost alert emails | Free tier: first 1,000 email notifications/mo free | N/A | Sprint 11 |
| Hosted bg-removal API (fal.ai / Replicate) | Fallback only for product cutouts rembg handles badly (glass, fine edges) | ~$0.004–$0.02 per image | rembg is the default — this is opt-in per image, not a blanket swap | Planned, not yet added |
| Paid TTS (e.g. ElevenLabs) | Higher-quality narration than Piper, opt-in upgrade | ~$0.01–$0.05 per video depending on script length | Piper is the default — this is an explicit upgrade, never silent | Planned, not yet added |

Keep every "Planned, not yet added" row honest — move it to a real sprint number the moment it's actually wired into the codebase, and add the real observed cost once you have it, not just the estimate.
