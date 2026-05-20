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
# Tuning: the worst case the cap should cover is "6 audio-off 8s segments
# back-to-back" — 6 × $0.24 = $1.44. The cap is set at $1.50 to leave a
# small buffer for inline `<aivideo>` tags. Beyond $1.50, the circuit
# breaker rejects further Veo calls and the shot falls back to a non-AI
# variant. Bump if you raise `MAX_CHAIN_SEGMENTS` or enable longer chains.
AI_VIDEO_PER_VIDEO_COST_CAP_USD: float = 1.50
