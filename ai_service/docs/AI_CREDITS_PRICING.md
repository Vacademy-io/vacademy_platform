# AI Credits — Pricing & Packs

## How Credits Work

- **1 credit = ₹0.93** (at $1 = ₹93) — the customer-facing rate, includes margin
- **$1 USD API cost → 150 credits** (DB-tunable, see "Rate configuration" below)
- All AI operations (video, content, chat, images, AI video / Veo) consume credits
- Free models still cost a tiny base amount (0.05 credits) to cover infrastructure
- We maintain a **50% margin** over actual AI API costs

### Rate configuration (V252 onwards)

The conversion ratio is **no longer hardcoded**. It lives in the `credit_rate_config` table as two independent knobs:

- `usd_to_credits` — base ratio (default `100`)
- `margin_pct` — markup percent on top (default `50`)
- **Effective ratio** = `usd_to_credits × (1 + margin_pct/100)` → `100 × 1.5 = 150` at seed

A ROOT_ADMIN can change either knob without a deploy via `POST /credits/v1/admin/rate-config`. Historical `credit_transactions` are NEVER repriced — `amount` and `balance_after` are credit-denominated snapshots that freeze at issue time. Rate changes apply only to future deductions.

The FE reads the live ratio via `GET /credits/v1/rate-config` (24-hour client cache) and converts USD upper bounds (Veo cost cap, per-second avatar rates) to credits at render time.

---

## Credit Packs

| Pack | Credits | Price (USD) | Price (INR) | Best For |
|------|---------|------------|-------------|----------|
| **Starter** | 100 | Free | Free | Signup bonus — lets users try 2-4 videos |
| **Basic** | 500 | $5 | ₹465 | Small institutes, light usage |
| **Pro** | 2,500 | $25 | ₹2,325 | Regular usage, ~50 videos/month |
| **Business** | 6,100 | $61 | ₹5,700 | Heavy usage, ~125 videos/month |
| **Enterprise** | 10,000 | $100 | ₹9,300 | Large institutes, bulk generation |

---

## What Do Credits Buy?

### Video Generation

Estimates **recalibrated 2026-05-15** against live production data from stage. The earlier May 2026 audit numbers (~290 cr / Ultra) assumed Gemini 3.1 Pro pricing as the HTML model; production actually runs Gemini 3 Flash for HTML generation, which is ~20× cheaper. The numbers below match what `TokenUsageService` actually deducts per run.

| Video Type | Credits | Approx per ₹5,700 pack |
|-----------|---------|------------------------|
| Short video (1-3 min, Standard) | ~5–8 | ~750 videos |
| Medium video (5 min, Standard) | ~10–15 | ~450 videos |
| Long video (10 min, Standard) | ~15–25 | ~290 videos |
| Short video (Premium tier) | ~10–18 | ~400 videos |
| Short video (Ultra tier — post-render gates active) | **~8–15** | ~500 videos |
| Short video (Super Ultra tier) | **~15–30** | ~250 videos |
| **+ AI video (Veo, worst case)** | **+225** | — |

> **Why these are so much lower than the worst-case "what if everyone runs Pro" numbers**: Ultra+ HTML generation defaults to Gemini 3 Flash (`preferred_shot_model="google/gemini-3-flash-preview"` in the tier config), which delivers polished output at ~$0.10/M input + $0.40/M output — about 1/20th of Pro pricing. An institute can override to Pro per-request, in which case costs scale up roughly 15-20× (~150-300 cr/video). The default Flash path is what real runs consume.

> **AI video** (fal.ai Veo on Ultra/Super Ultra tiers): hard-capped per video at the Veo upper bound. Today that's 225 credits per video (USD source: $1.50; multiplier from `credit_rate_config`). Typical runs use far less — Director picks AI_VIDEO_HERO shots only when content fits. The cap is the worst case, not the average.

### What changed in May 2026 (audit cycle) — per Ultra video

| Source | Delta |
|---|---|
| Larger system prompt (~1400 input tokens added per shot) | +0.2 cr |
| Continuity brief (~250 tokens per shot) | +0.04 cr |
| Vision review now sends a prior-shot reference PNG | ~+0.3 cr (cap-bounded) |
| Bbox-lint regen (fires on ~30% of shots that overflow) | +0.5 cr expected |
| Brand-asset regen (~10% miss rate on intro/outro) | +0.05 cr |
| Second-beat motion regen (~15% rate on static shots) | +0.4 cr |
| **Total delta** | **~+1.5 cr** (5–20% increase over the pre-audit baseline) |

These show up in `credit_transactions` as standard `USAGE_DEDUCTION` rows tagged `request_type="video"` — same bucket as the rest of the video pipeline. No new request_type was introduced, so historical analytics (`/usage` endpoint, by-request-type breakdown) stay comparable across the audit.

### Pre-flight floor calibration

The router pre-flight (`CreditService.check_video_tier_credits`) gates institutes whose balance can't realistically support the chosen tier. Floors recalibrated 2026-05-15:

| Tier | Floor (credits) | Rationale |
|---|---|---|
| free | 5 | Signup bonus is 100; should be able to try basic runs |
| standard | 10 | Covers typical Flash run + ~30% headroom |
| premium | 20 | Slightly more aggressive than standard |
| ultra | 30 | Covers Flash-based runs with multiple post-render gates firing |
| super_ultra | 50 | Same gates run more aggressively |

When `ai_video_enabled=True`, the Veo cap (225 cr) is added to the floor. Resume endpoints scale the floor by 0.7×; retry by 0.4× (less work remains on these paths).

> **Why these are NOT the worst-case maximum**: the pre-flight catches truly bankrupt institutes. Mid-run depletion is handled by `TokenUsageService.refund_video_credits` — institutes don't get partially charged for a failed run. Reserving the absolute maximum upfront would block users who can comfortably complete most runs.

### Content Generation

| Operation | Credits per use | Approx per ₹5,700 pack |
|-----------|----------------|------------------------|
| Course outline | ~4 | ~1,500 outlines |
| Lesson/document content | ~4 | ~1,500 documents |
| Quiz/assessment | ~4 | ~1,500 quizzes |
| AI Chat message | ~4 | ~1,500 messages |
| Image generation | 0.3 | ~20,000 images |
| Text-to-Speech (per 1000 chars) | 0.03 | ~200,000 pages of audio |

### By Model Tier

| Tier | Example Models | Cost vs Standard |
|------|---------------|-----------------|
| **Free** | MIMO Flash, Trinity Preview | Base cost only (0.05 credits) |
| **Standard** | Gemini 2.5 Flash, DeepSeek V3, GPT-4o Mini | 1x (default) |
| **Premium** | Gemini 2.5 Pro, Claude Sonnet | ~2-3x |
| **Ultra** | GPT-4o, Claude Opus | ~5-8x |

> **Tip:** Most use cases work great with Standard tier models. Recommend Premium/Ultra only for complex evaluation or high-quality content needs.

---

## Video Cost Breakdown

Observed in production (Labour Link 60s Ultra-tier run, 2026-05-15):

| Component | Credits | What it does |
|-----------|---------|-------------|
| Script generation (Gemini 3 Flash, ~8.5K tokens) | 0.29 | LLM writes narration script |
| HTML stage (Director + 10 shots + regens, ~314K tokens) | 6.49 | LLM plans shots + generates HTML/CSS/GSAP per shot + post-render regens |
| Image generation (1 cutout via Gemini-image) | 0.30 | Single brand-logo cutout image |
| Stock media (1 Pexels hit) | 0.10 | Aerial farmland stock image |
| TTS premium (609 chars, Google) | 0.04 | Voice synthesis |
| **Total observed** | **~7.22** | Real-cost path via `TokenUsageService` |

For institutes overriding to Gemini 3.1 Pro for HTML generation, the HTML stage cost scales by ~15-20× → typical Pro-based ultra video runs **~100-150 credits**. The pre-flight floor doesn't reserve this worst case; institutes choosing the more expensive model are expected to maintain a sufficient balance separately.

A 10-minute Standard video uses ~2× more tokens → **~15-20 credits** typical.

> **Why the May 2026 numbers in this doc are dramatically lower than the May audit cycle's initial estimates**: the audit cycle authored estimates against worst-case Pro pricing without confirming production tier defaults. Live stage data showed the default HTML model on Ultra is Flash, not Pro. The recalibration brings the doc back in line with what `credit_transactions` actually shows.

> **Pre-flight check vs. real spend**: The pre-flight `require_credits("video", ...)` dependency in the router is a coarse floor check (bumped to estimated_tokens=60_000 in the May audit). It blocks zero-balance institutes but doesn't predict the realistic cost — the real per-stage deduction happens via `TokenUsageService` as each pipeline stage completes, using actual OpenRouter token counts. If credits run out mid-render, the run aborts and `refund_video_credits` returns everything deducted so the institute isn't half-charged.

---

## Margin Summary

| | Per Credit |
|---|---|
| Customer pays | ₹0.93 ($0.01) |
| Our AI cost | ₹0.62 ($0.0067) |
| **Gross margin** | **₹0.31 (50%)** |

---

## Signup Bonus

Every new institute gets **100 credits free** on signup. This lets them:
- Generate **2-4 short videos** to evaluate the platform
- Create **~20 course outlines**
- Try **~20 content generations**

---

## Low Balance Alerts

- Warning at **10 credits** remaining
- Zero balance alert when credits run out
- Operations are blocked at 0 balance with a clear "insufficient credits" message

---

## For Sales Team — Quick Reference

| Customer asks... | Answer |
|-----------------|--------|
| "How much per video?" | ~₹5–15 per short video at any tier (Flash). Pro override pushes Ultra to ~₹100–140. |
| "₹5,700 gets me how many videos?" | ~400–750 short videos at default tier settings; ~50–80 if every run overrides to Pro |
| "Can I try before buying?" | Yes, 100 free credits on signup — enough for ~12–20 short videos |
| "What if credits run out mid-generation?" | Pre-flight blocks institutes below the per-tier floor (5–50 cr). If credits exhaust mid-render, the run is refunded fully (`refund_video_credits`). |
| "Why is Ultra not much more expensive than Standard?" | Both default to Gemini 3 Flash for HTML generation. Ultra adds quality gates (deterministic bbox-lint, vision review v3, second-beat motion check) — these add ~1–2 credits, not the order-of-magnitude users sometimes assume. The price difference shows up when an institute overrides to Pro. |
| "Which tier should I use?" | Standard for educational explainers (best value); Premium for short brand reels; Ultra for client-facing announcements / product launches where output quality matters and you want the post-render gates. |
| "Do free models cost anything?" | Almost nothing — 0.05 credits base cost per use |

---

*Last updated: May 2026 (post-audit refresh)*
*Exchange rate: $1 = ₹93*
