"""
Shared AI video constants — single source of truth for values that need
to be referenced from multiple modules.

Why this module exists
----------------------
The pipeline (`ai-video-gen-main/automation_pipeline.py`) lives in a
hyphenated directory that can't be imported via Python's dotted import
syntax. Constants the router layer needs (e.g. the per-video Veo cost
cap, for the FastAPI pre-flight balance check) used to be hardcoded in
both places — risking silent drift on future config changes.

Anything here can be imported from BOTH `app/routers/...` (via
`from app.services.ai_video_constants import ...`) AND from inside
`ai-video-gen-main/` (via the same path — that directory is on
sys.path).
"""

# Per-video Veo cost cap, in USD. Mirrored into `QUALITY_TIERS["ultra"]`
# and `["super_ultra"]` as `ai_video_per_video_cost_cap_usd`. The pipeline
# loads this into `AiVideoCostTracker(cap_usd=...)`. The FastAPI router's
# Veo-aware pre-flight check reads this directly to compute the credit
# upper bound the institute must have on hand before a run can start.
#
# Tuning: sized so a full 2-minute video can be ENTIRELY full-Veo footage.
# A full-Veo 8s 720p clip costs ~$1.60 (lite ~$0.24), and 2 min ≈ 15 clips,
# so $24.00 covers ~15 full-Veo clips (a wholly AI-shot 2-min film) or far
# more on the cheaper tiers. This is a per-video BLAST RADIUS ceiling, not a
# target — a typical run plans a handful of AI shots and spends a fraction.
# NOTE: the credit pre-flight holds cap × AI_VIDEO_PREFLIGHT_HOLD_FRACTION
# before a run starts (~$9.6 ≈ 1440 credits at 150/USD here), so institutes
# on thin balances may need a top-up to start an AI-video run. The
# planner derives its per-run AI shot budget from THIS cap divided by the
# SELECTED model's per-clip cost (shot_planner: _ai_shot_budget), so the
# budget auto-scales with model choice — raising the cap widens how
# AI-heavy a plan may be, without over-planning on the pricey tiers.
# Beyond the cap the circuit breaker rejects further Veo calls and the
# shot falls back to a non-AI variant. Institute credits are still billed
# per call by AiVideoLedger — this is a per-video blast radius, not a
# spend allowance.
AI_VIDEO_PER_VIDEO_COST_CAP_USD: float = 24.00

# Fraction of the cap the credit pre-flight holds before a run may start.
# The cap is a blast radius sized for an ALL-AI film; most runs spend a
# fraction of it. Requiring the full cap up front turned a cap raise into
# an access regression (institutes that could run yesterday hit 402s).
# Exhausting the budget mid-run is handled gracefully — the shot demotes
# to stock footage — so a partial hold trades a rare, soft degradation
# for not gating users out entirely. Raise toward 1.0 to be stricter.
AI_VIDEO_PREFLIGHT_HOLD_FRACTION: float = 0.4
