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

Estimates refreshed **May 2026** to reflect the post-generation gate chain shipped in the May audit (bbox-lint, brand-asset assertion, second-beat motion check, vision review v3 with prior-shot continuity). See "What changed in May 2026" below.

| Video Type | Credits | Approx per ₹5,700 pack |
|-----------|---------|------------------------|
| Short video (1-3 min, Gemini Flash, Standard tier) | ~26 | ~230 videos |
| Medium video (5 min, Standard tier) | ~38 | ~150 videos |
| Long video (10 min, Standard tier) | ~52 | ~115 videos |
| Short video (Gemini 2.5 Pro, Premium tier) | ~70 | ~85 videos |
| Short video (Ultra tier — post-render gates active) | **~290** | ~20 videos |
| Short video (Super Ultra tier) | **~360** | ~16 videos |
| **+ AI video (Veo, worst case)** | **+225** | — |

> **Why ultra+ jumped vs the April 2026 numbers**: the May 2026 audit shipped four post-render quality gates (animation density validator + deterministic bbox-lint + brand-asset assertion + vision review v3) plus larger system prompts (continuity brief, OUTPUT FORMAT envelope, BACKGROUND CONTRACT, branded easings). Each gate may fire one corrective regen on a fraction of shots (~30% for bbox-lint, ~15% for second-beat motion, ~10% for brand-asset misses). The amplification is what makes ultra+ output noticeably more polished — and what costs the extra credits. Standard/premium tiers don't run the validator/bbox-lint gates so they're affected only by the small system-prompt growth (+2 credits).

> **AI video** (fal.ai Veo on Ultra/Super Ultra tiers): hard-capped per video at the Veo upper bound. Today that's 225 credits per video (USD source: $1.50; multiplier from `credit_rate_config`). Typical runs use far less — Director picks AI_VIDEO_HERO shots only when content fits. The cap is the worst case, not the average.

### What changed in May 2026 (audit cycle)

| Source | Per ultra video (8 shots) |
|---|---|
| Larger system prompt (~1400 input tokens added) | +4 credits |
| Continuity brief (~250 tokens per shot) | +0.7 credits |
| Vision review now sends a prior-shot reference PNG | +5.6 credits |
| Bbox-lint regen (fires on ~30% of shots that overflow the canvas) | +14 credits |
| Brand-asset regen (~10% miss rate on intro/outro shots) | +1.2 credits |
| Second-beat motion regen (~15% rate on static shots) | +7 credits |
| **Total delta** | **~+32 credits** |

Super Ultra: ~+45 credits (same gates, longer prompts, slightly higher regen rates).

These show up in `credit_transactions` as standard `USAGE_DEDUCTION` rows tagged `request_type="video"` — same bucket as the rest of the video pipeline. No new request_type was introduced, so historical analytics (`/usage` endpoint, by-request-type breakdown) stay comparable across the audit.

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

A typical short video on **Standard tier** (Gemini Flash) costs ~26 credits, broken down as:

| Component | Credits | What it does |
|-----------|---------|-------------|
| Script generation | ~2 | AI writes the narration script |
| HTML slides creation | ~15 | AI generates visual slides |
| Image generation (10 images) | 3 | Custom images for slides |
| Text-to-Speech | ~0.5 | Converts script to audio |
| Word timing | ~2 | Syncs audio to slides |
| Vision review (May 2026 audit) | ~2 | Per-shot quality check; lower regen rate at Standard |
| Base costs | ~1.5 | Infrastructure overhead |
| **Total** | **~26** | |

An **Ultra tier** short video runs ~290 credits because more rigorous gates fire:

| Component | Credits | What it does |
|-----------|---------|-------------|
| Director plan | ~10 | LLM plans shot structure with pacing profile + background_treatment + recurring motifs |
| Per-shot HTML generation (8 shots) | ~170 | Gemini 3.1 Pro renders each shot's HTML/CSS/GSAP |
| Bbox-lint regens (~30% of shots) | ~14 | Deterministic Chromium check; demote-tier corrective regen |
| Second-beat motion regens (~15%) | ~7 | Animation density check; back-half life corrective regen |
| Brand-asset regens (~10% on intro/outro) | ~1 | Forces brand logo embed on key shots |
| Vision review (8 shots × Gemini 2.5 Pro) | ~85 | Rubric v3: TEXT_CLIPPED, WHITESPACE_COLLISION, BG_DISCONTINUITY |
| Vision review prior-shot reference (~7 PNGs) | ~6 | Cross-shot continuity check |
| TTS + word timing + images + stock | ~5 | Audio + word alignment + supporting media |
| Base costs + infra | ~2 | Render worker, S3 |
| **Total** | **~290** | |

A 10-minute Standard video uses ~2× more tokens and ~2× more images → ~52 credits.

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
| "How much per video?" | Standard ~₹24/video; Premium ~₹65/video; Ultra ~₹270/video; Super Ultra ~₹335/video |
| "₹5,700 gets me how many videos?" | ~230 short Standard / ~85 Premium / ~20 Ultra / ~16 Super Ultra |
| "Can I try before buying?" | Yes, 100 free credits on signup — enough for ~4 Standard videos |
| "What if credits run out mid-generation?" | Pre-flight blocks zero-balance institutes. If credits exhaust mid-render, the run is refunded fully (`refund_video_credits`). |
| "Why does Ultra cost so much more than Standard?" | Ultra runs four post-render quality gates that fire corrective regens on bad shots — that's what produces the polished output. Standard skips the heavier gates. |
| "Which tier should I use?" | Standard for educational explainers (best value); Premium for short brand reels; Ultra for client-facing announcements / product launches where output quality matters more than per-video cost. |
| "Do free models cost anything?" | Almost nothing — 0.05 credits base cost per use |

---

*Last updated: May 2026 (post-audit refresh)*
*Exchange rate: $1 = ₹93*
