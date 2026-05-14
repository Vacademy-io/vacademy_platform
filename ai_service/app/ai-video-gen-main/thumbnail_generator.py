"""
Thumbnail generator — Seedream batch + headline picker.

Called from automation_pipeline immediately after the Director plan is finalized.
Generates 4 thumbnail options that vary across two compositional axes (subject
focus × layout), uploads each to S3, and pairs them with a "main" headline from
the script title + 3 alternates from a small Gemini Flash call.

Soft-fails everywhere: thumbnails are a nice-to-have, never gate the render.
If the whole batch fails, the caller persists `{}` and the FE shows a
placeholder. If only some options fail, the others are still returned.
"""
from __future__ import annotations

import base64
import concurrent.futures
import json
import time
import traceback
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, List, Optional, Tuple

# Sibling import — `ai-video-gen-main` is not a Python package (the dirname
# contains hyphens and there's no __init__.py). The caller adds the directory
# to sys.path and loads this module flat via `from thumbnail_generator import …`,
# so a plain `from . import thumbnail_prompts` raises
# "attempted relative import with no known parent package". The try/except is
# deliberate so an autoformatter can't silently convert one form into the
# other and break runtime imports.
try:
    import thumbnail_prompts as tp  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover — only if loaded inside a real package
    from . import thumbnail_prompts as tp  # type: ignore[no-redef]


_S3_BUCKET = "vacademy-media-storage-public"
_S3_KEY_PREFIX = "AI_THUMBNAILS"


# ---------------------------------------------------------------------------
# Standalone Seedream caller
# ---------------------------------------------------------------------------


def make_standalone_seedream_call(api_key: str) -> Callable[..., Tuple[Optional[bytes], Optional[Dict[str, Any]]]]:
    """Return a `(prompt, width, height, reference_image_url) -> (bytes, usage)`
    callable that talks to OpenRouter / Seedream directly.

    Used by the regenerate endpoint, which doesn't have an AutomationPipeline
    instance in scope. Matches the signature of
    `AutomationPipeline._call_image_generation_llm` so thumbnail_generator.run()
    is agnostic to its caller.
    """

    def _call(
        prompt: str,
        width: int = 1920,
        height: int = 1080,
        reference_image_url: Optional[str] = None,
    ) -> Tuple[Optional[bytes], Optional[Dict[str, Any]]]:
        if not api_key:
            print("   ⚠️ No OpenRouter API key for standalone Seedream call")
            return None, None

        if width < height:
            aspect_hint = "9:16 vertical framing"
        elif width > height:
            aspect_hint = "16:9 widescreen framing"
        else:
            aspect_hint = "1:1 square framing"
        full_prompt = f"{prompt}\n\n({aspect_hint})"

        if reference_image_url:
            content: Any = [
                {"type": "text", "text": full_prompt},
                {"type": "image_url", "image_url": {"url": reference_image_url}},
            ]
        else:
            content = full_prompt

        payload = {
            "model": "bytedance-seed/seedream-4.5",
            "messages": [{"role": "user", "content": content}],
            "modalities": ["image"],
        }
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://stilllift-automation.local",
                "X-Title": "StillLift Automation",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            print(f"   ⚠️ Standalone Seedream HTTP {e.code}: {e}")
            return None, None
        except Exception as e:
            print(f"   ⚠️ Standalone Seedream call failed: {e}")
            return None, None

        usage_metadata = data.get("usage", {}) or {}
        for choice in (data.get("choices") or []):
            message = choice.get("message", {}) or {}
            for image in (message.get("images") or []):
                image_url = (image.get("image_url") or {}).get("url", "")
                if not image_url:
                    continue
                b64 = image_url.split(",", 1)[1] if "," in image_url else image_url
                try:
                    return base64.b64decode(b64), usage_metadata
                except Exception:
                    return None, None
        return None, None

    return _call


def _resolve_orientation(width: int, height: int) -> str:
    if height > width:
        return "portrait"
    return "landscape"


def _resolve_dimensions(orientation: str) -> Tuple[int, int]:
    """Output dimensions Seedream is asked to honor (textually)."""
    if orientation == "portrait":
        return 1080, 1920
    return 1920, 1080


def _pick_hero_subject_label(
    director_plan: Dict[str, Any],
    subjects_list: List[Dict[str, Any]],
) -> Optional[str]:
    """Pick a human-readable label for the recurring hero of the video.

    Priority:
      1. The subject_extractor's first subject (recurs across multiple shots).
      2. The first shot's image_prompt (truncated).
      3. None → caller falls back to the script title.
    """
    if subjects_list:
        first = subjects_list[0]
        label = (first.get("label") or first.get("id") or "").strip()
        if label:
            return label

    shots = (director_plan or {}).get("shots") or []
    if shots:
        first = shots[0] or {}
        ip = (first.get("image_prompt") or first.get("visual_description") or "").strip()
        if ip:
            return ip[:140]
    return None


def _build_headline_for(
    *,
    variant: Dict[str, str],
    main_headline: str,
    alt_headlines: List[str],
) -> str:
    """Pair an option with a headline.

    - thumb_1 (main): the script's title (Director-picked).
    - thumb_2 / thumb_3: alternates 0 and 1.
    - thumb_4 (type_led): alternate 2 — typography-driven, headline carries the frame.
    """
    if variant["id"] == "thumb_1":
        return main_headline
    if variant["id"] == "thumb_2":
        return alt_headlines[0] if len(alt_headlines) >= 1 else main_headline
    if variant["id"] == "thumb_3":
        return alt_headlines[1] if len(alt_headlines) >= 2 else main_headline
    if variant["id"] == "thumb_4":
        return alt_headlines[2] if len(alt_headlines) >= 3 else main_headline
    return main_headline


def _upload_png_to_s3(
    *,
    image_bytes: bytes,
    run_id: str,
    option_id: str,
    batch_ts: int,
) -> Optional[str]:
    """Upload a Seedream-returned PNG to the public media bucket. Returns the URL.

    `batch_ts` is the generated_at epoch ms — namespacing by it means a
    regenerate produces a fresh URL (no CDN/browser cache poisoning of the
    previous image).

    Goes through the existing `S3Service`, which reads its credentials from
    `settings.s3_aws_access_key` / `s3_aws_access_secret` (i.e. the
    `S3_AWS_ACCESS_KEY` env vars used everywhere else in the codebase).
    A bare `boto3.client(... aws_access_key_id=None)` fails in the
    production pod with "Unable to locate credentials" — there's no IAM
    role attached and the standard `AWS_*` env vars aren't populated.
    """
    s3_key = f"{_S3_KEY_PREFIX}/{run_id}/{batch_ts}/{option_id}.png"
    try:
        # Lazy import: the standalone test path (no `app` on sys.path) still
        # needs to be able to import this module without dragging in the
        # FastAPI app's Pydantic settings.
        from app.services.s3_service import S3Service  # type: ignore[import-not-found]

        s3 = S3Service()
        return s3.upload_file_content(
            content=image_bytes,
            filename=f"{option_id}.png",
            s3_key=s3_key,
            content_type="image/png",
        )
    except Exception as e:
        print(f"   ⚠️ Thumbnail S3 upload failed for {option_id}: {e}")
        return None


def _truncate_title_to_max_words(title: str, max_words: int) -> str:
    title = (title or "").strip()
    if not title:
        return ""
    words = title.split()
    if len(words) <= max_words:
        return title
    return " ".join(words[:max_words])


def run(
    *,
    seedream_call: Callable[..., Tuple[Optional[bytes], Optional[Dict[str, Any]]]],
    run_id: str,
    script_plan: Dict[str, Any],
    director_plan: Optional[Dict[str, Any]],
    orientation: str = "landscape",
    subjects_list: Optional[List[Dict[str, Any]]] = None,
    brand_kit: Optional[Dict[str, Any]] = None,
    llm_chat: Optional[Callable[..., Tuple[str, Dict[str, Any]]]] = None,
) -> Dict[str, Any]:
    """Generate 4 thumbnail options + persist images to S3.

    Args:
        seedream_call: callable matching `(prompt, width, height,
                       reference_image_url=None) -> (image_bytes, usage)`.
                       In-pipeline path passes `pipeline._call_image_generation_llm`;
                       regenerate path passes a thin standalone adapter.
        run_id: stable id used both as the S3 key prefix and the run_dir name.
        script_plan: the JSON returned by `_generate_script_plan` (with the
                     new `intent` field — falls back to 'explainer').
        director_plan: the Director's shot plan (may be None when Director
                       was skipped — we still produce thumbnails from the
                       script title + intent).
        orientation: 'landscape' (16:9) or 'portrait' (9:16); matches the
                     video's own orientation so thumbnails crop correctly.
        subjects_list: subject_extractor output for hero-subject lookup.
        brand_kit: optional vimotion brand kit; only its `palette` is used
                   by Seedream prompts. Heading font + watermark are applied
                   client-side by the FE overlay.
        llm_chat: callable used to draft 3 alternate headlines. If None,
                  falls back to title-derived placeholders.

    Returns:
        A dict matching the `thumbnails` JSONB shape on `ai_gen_video`:
        {selected_id, intent, orientation, generated_at, options:[...]}.
        Returns `{}` on catastrophic failure (caller falls back to placeholder).
    """
    try:
        intent = tp.normalize_intent(script_plan.get("intent") if script_plan else None)
        orientation = "portrait" if orientation == "portrait" else "landscape"
        out_w, out_h = _resolve_dimensions(orientation)
        batch_ts = int(time.time() * 1000)

        visual_style = (script_plan or {}).get("visual_style") if script_plan else None
        title = ((script_plan or {}).get("title") or "").strip()
        palette = (brand_kit or {}).get("palette") if brand_kit else None

        # Hero subject — recurring subject from extractor wins; otherwise first shot's prompt.
        hero_label = _pick_hero_subject_label(director_plan or {}, subjects_list or [])

        # Headlines — main from Director's title, 3 alternates from a small LLM call.
        preset = tp.INTENT_PRESETS[intent]
        main_words_cap = int(preset.get("max_words", 5))
        main_headline = _truncate_title_to_max_words(title, main_words_cap)
        if not main_headline:
            main_headline = "Watch this"  # ultimate fallback

        # Narration hint helps the LLM write alternates that mirror the actual video.
        narration_hint = None
        if script_plan:
            narration_hint = (script_plan.get("script") or script_plan.get("key_takeaway") or None)

        alt_headlines: List[str] = []
        if llm_chat is not None and title:
            try:
                alt_headlines, _ = tp.generate_alt_headlines(
                    llm_chat=llm_chat,
                    title=title,
                    intent=intent,
                    narration_hint=narration_hint,
                )
            except Exception as e:
                print(f"   ⚠️ Alt-headline generation errored: {e}")
                alt_headlines = []
        if not alt_headlines:
            # Deterministic fallback so thumb_2/3/4 still get distinct labels.
            alt_headlines = [main_headline, main_headline, main_headline]

        # Kick off all 4 Seedream calls in parallel. Each variant gets a
        # different prompt, but the same hero subject reference if present.
        # We do NOT attach a reference_image_url here — thumbnails should
        # explore variation, not be locked to a single subject pose.
        results: List[Optional[Dict[str, Any]]] = [None, None, None, None]

        def _one(variant: Dict[str, str]) -> Optional[Dict[str, Any]]:
            prompt = tp.build_seedream_prompt(
                intent=intent,
                variant=variant,
                hero_subject_label=hero_label,
                visual_style=visual_style,
                palette=palette,
                title=title or None,
            )
            try:
                image_bytes, _usage = seedream_call(
                    prompt=prompt,
                    width=out_w,
                    height=out_h,
                    reference_image_url=None,
                )
            except Exception as e:
                print(f"   ⚠️ Thumbnail Seedream call failed ({variant['id']}): {e}")
                return None
            if not image_bytes:
                return None

            url = _upload_png_to_s3(
                image_bytes=image_bytes,
                run_id=run_id,
                option_id=variant["id"],
                batch_ts=batch_ts,
            )
            if not url:
                return None

            return {
                "id": variant["id"],
                "image_url": url,
                "headline": _build_headline_for(
                    variant=variant,
                    main_headline=main_headline,
                    alt_headlines=alt_headlines,
                ),
                "layout": variant["layout"],
                "subject_focus": variant["subject_focus"],
                "intent_style": intent,
            }

        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
            futures = {
                ex.submit(_one, v): i for i, v in enumerate(tp.OPTION_VARIANTS)
            }
            for fut in concurrent.futures.as_completed(futures):
                idx = futures[fut]
                try:
                    results[idx] = fut.result()
                except Exception as e:
                    print(f"   ⚠️ Thumbnail worker {idx} raised: {e}")

        options = [r for r in results if r]
        if not options:
            print("   ⚠️ No thumbnail options succeeded — leaving thumbnails empty")
            return {}

        # Selected = the first successful option in canonical order.
        selected_id = options[0]["id"]

        return {
            "selected_id": selected_id,
            "intent": intent,
            "orientation": orientation,
            "generated_at": batch_ts,
            "options": options,
        }
    except Exception as e:
        print(f"   ⚠️ Thumbnail generator crashed: {e}")
        print(f"   📋 {traceback.format_exc()[:400]}")
        return {}
