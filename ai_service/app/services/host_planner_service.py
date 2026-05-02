"""
Host Planner — runs in the pre-script preamble (alongside IntentRouter +
VideoTypeClassifier). No LLM call.

Validates + normalises `request.host` (a HostConfig) into a HostPlan that the
pipeline operates on. Tier-gates the feature: rejects ultra/super_ultra
violations early so the rest of the pipeline doesn't have to know.

Output is persisted to:
  • run_dir/host_plan.json                 (resume-safe cache)
  • extra_metadata.host (inputs block)     (debugging + history view)
"""
from __future__ import annotations

import logging
from typing import Optional

from ..schemas.routing import HostAvatarPlan, HostPlan
from ..schemas.video_generation import HostConfig

logger = logging.getLogger(__name__)


_ALLOWED_TIERS = {"ultra", "super_ultra"}


class HostFeatureError(ValueError):
    """Raised when a host request violates a hard constraint (tier, missing key, etc.)."""


def make_host_plan(
    host_config: Optional[HostConfig],
    *,
    quality_tier: str,
    fal_api_key: Optional[str],
) -> HostPlan:
    """Build a HostPlan from the request's HostConfig + runtime constraints.

    Returns a `disabled` HostPlan when host_config is None — downstream stages
    branch on `plan.enabled`.

    Raises HostFeatureError if the request violates hard constraints.
    """
    if host_config is None:
        return HostPlan(enabled=False)

    # Tier gate. We chose at planning time to *reject* (not silently degrade)
    # so the user immediately knows the feature isn't available on their tier
    # and can pick a higher tier or disable host. Silent-degrade would hide
    # the cost surprise on lower-tier subscriptions.
    if quality_tier not in _ALLOWED_TIERS:
        raise HostFeatureError(
            f"Host feature requires quality_tier in {sorted(_ALLOWED_TIERS)}; "
            f"got {quality_tier!r}. Either upgrade the tier or remove `host` from the request."
        )

    if host_config.type == "avatar":
        if not fal_api_key:
            raise HostFeatureError(
                "host.type='avatar' requires FAL_API_KEY to be set on the AI service. "
                "Configure the secret and retry."
            )
        if host_config.avatar is None:
            # Pydantic validator already enforces this, but belt-and-braces.
            raise HostFeatureError("host.avatar is required when host.type='avatar'.")
        plan = HostPlan(
            enabled=True,
            type="avatar",
            host_in_video_percentage=int(host_config.host_in_video_percentage),
            avatar=HostAvatarPlan(
                face_image_url=host_config.avatar.face_image_url,
                details_prompt=host_config.avatar.details_prompt or "",
                avatar_model=host_config.avatar.avatar_model,
                quality=host_config.avatar.quality,
            ),
        )
        logger.info(
            f"[HostPlanner] enabled=avatar pct={plan.host_in_video_percentage}%% "
            f"model={plan.avatar.avatar_model} quality={plan.avatar.quality}"
        )
        return plan

    if host_config.type == "raw":
        # Raw-input host (clips spliced from already-indexed input videos) is
        # PLUMBED ONLY this round. The request schema, DB persistence, and
        # Director branch are all in place, but the generation path (script
        # ← input video transcript + per-shot clip selection) hasn't shipped.
        # Reject at the API edge instead of silently falling through to a
        # non-host video — the caller paid for ultra-tier expecting host
        # behaviour and deserves a clear error.
        raise HostFeatureError(
            "host.type='raw' is not yet supported. Please use host.type='avatar' "
            "(per-shot AI talking-head). Raw-input host is on the roadmap."
        )

    raise HostFeatureError(f"Unknown host.type: {host_config.type!r}")


__all__ = ["make_host_plan", "HostFeatureError"]
