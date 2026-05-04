"""
Host Planner — runs in the pre-script preamble (alongside IntentRouter +
VideoTypeClassifier). No LLM call.

Validates + normalises `request.host` (a HostConfig) into a HostPlan that the
pipeline operates on. Tier-gates the feature: rejects ultra/super_ultra
violations early so the rest of the pipeline doesn't have to know.

When the request carries `host.avatar.saved_avatar_id`, the *caller* is
expected to have resolved the studio_avatar row (via vimotion_resolver) and
pass it as `resolved_saved_avatar`. We do the row → plan field merge here so
both pieces — request payload + resolved DB row — turn into a single
HostAvatarPlan in one place.

Output is persisted to:
  • run_dir/host_plan.json                 (resume-safe cache)
  • extra_metadata.host (inputs block)     (debugging + history view)
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from ..schemas.routing import HostAvatarPlan, HostPlan
from ..schemas.video_generation import HostConfig

logger = logging.getLogger(__name__)


_ALLOWED_TIERS = {"ultra", "super_ultra"}

# Built-in catalog providers route by `provider` directly; the actual fal.ai
# endpoint slug is owned by FalAvatarClient (`_resolve_endpoint_model`). The
# `avatar_model` field on HostAvatarPlan stays one of the two custom-model
# Literals — for built-ins it's ignored downstream, so we leave the user's
# choice (or default Kling) untouched rather than stamping a non-Literal
# value that Pydantic would reject.
_BUILTIN_PROVIDERS = {"argil", "veed"}


class HostFeatureError(ValueError):
    """Raised when a host request violates a hard constraint (tier, missing key, etc.)."""


def make_host_plan(
    host_config: Optional[HostConfig],
    *,
    quality_tier: str,
    fal_api_key: Optional[str],
    resolved_saved_avatar: Optional[Dict[str, Any]] = None,
) -> HostPlan:
    """Build a HostPlan from the request's HostConfig + runtime constraints.

    Returns a `disabled` HostPlan when host_config is None — downstream stages
    branch on `plan.enabled`.

    `resolved_saved_avatar` is the dict returned by
    `vimotion_resolver.resolve_studio_avatar`. When non-None, it overrides
    the corresponding fields on `host_config.avatar` (provider,
    external_avatar_id, face_image_url, details_prompt, voice metadata).
    The voice override is applied by the *caller* against the request's
    voice_id/voice_provider/etc. — we only stamp provider + identity here.

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

        cfg = host_config.avatar

        # Resolution merge. Saved avatar fields take precedence over the
        # request's free-form fields when both are present (e.g. caller sent
        # face_image_url *and* saved_avatar_id — the saved row wins so the
        # picked avatar's identity is canonical).
        if resolved_saved_avatar:
            provider = (resolved_saved_avatar.get("provider") or "custom").lower()
            external_avatar_id = resolved_saved_avatar.get("external_avatar_id") or None
            resolved_face = resolved_saved_avatar.get("face_image_url") or None
            resolved_details = resolved_saved_avatar.get("description") or None
        else:
            provider = "custom"
            external_avatar_id = None
            resolved_face = None
            resolved_details = None

        # Per-provider validation. Custom needs a face image; built-ins need
        # the catalog enum. Fail fast so the user sees the specific problem
        # rather than a generic fal.ai 400 deep in the pipeline.
        if provider == "custom":
            face_image_url = resolved_face or cfg.face_image_url or ""
            if not face_image_url:
                raise HostFeatureError(
                    "Custom-avatar host requires a face image. Either upload one "
                    "(face_image_url) or pick a saved avatar with provider='custom'."
                )
            avatar_model = cfg.avatar_model
        elif provider in _BUILTIN_PROVIDERS:
            if not external_avatar_id:
                raise HostFeatureError(
                    f"Built-in avatar (provider={provider!r}) requires external_avatar_id "
                    f"on the saved studio_avatar row. The DB row resolved without one."
                )
            face_image_url = ""  # built-ins don't use a reference image
            # avatar_model on the plan stays one of the custom-model Literals.
            # Downstream FalAvatarClient picks the actual catalog endpoint
            # (`argil/avatars/audio-to-video` or `veed/avatars/audio-to-video`)
            # from `provider`, so this field is unused for built-ins — we
            # preserve cfg.avatar_model rather than stamping a non-Literal
            # string that Pydantic would reject.
            avatar_model = cfg.avatar_model
        else:
            raise HostFeatureError(
                f"Unsupported avatar provider {provider!r}. "
                f"Allowed: 'custom', 'argil', 'veed'."
            )

        details_prompt = (resolved_details or cfg.details_prompt or "").strip()

        plan = HostPlan(
            enabled=True,
            type="avatar",
            host_in_video_percentage=int(host_config.host_in_video_percentage),
            avatar=HostAvatarPlan(
                provider=provider,                       # type: ignore[arg-type]
                external_avatar_id=external_avatar_id,
                face_image_url=face_image_url,
                details_prompt=details_prompt,
                avatar_model=avatar_model,               # type: ignore[arg-type]
                quality=cfg.quality,
            ),
        )
        logger.info(
            f"[HostPlanner] enabled=avatar provider={provider} "
            f"pct={plan.host_in_video_percentage}%% "
            f"model={plan.avatar.avatar_model} quality={plan.avatar.quality} "
            f"external_avatar_id={external_avatar_id!r}"
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
