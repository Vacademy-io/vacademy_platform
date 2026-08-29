"""The v3 ShotPlanner must know about the user's uploaded images.

IMAGE_CLIP — the shot type that puts an uploaded screenshot on screen — was
reachable only from the deprecated v2 `_run_director`, which built its own
SOURCE IMAGE CONTEXTS block. v3 is the only supported pipeline, and its planner
was never told the images existed: `plan_shots` had no parameter for them, none
was passed, and IMAGE_CLIP appeared nowhere in its shot-type menu.

An image-led run therefore indexed every still, paid for every caption and OCR
pass, and then planned a video that referenced none of them.
"""

import os
import sys

import pytest

_HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(_HERE, "..", "app", "ai-video-gen-main"))

import shot_planner as sp  # noqa: E402


def _image(idx, name, text_blocks=(), ui=(), mode="screenshot"):
    return {
        "index": idx,
        "kind": "image",
        "name": name,
        "mode": mode,
        "source_public_url": f"https://s3/{name}",
        "duration_seconds": 6.0,
        "context": {
            "meta": {"width": 1600, "height": 900},
            "caption": {
                "short": f"{name} caption",
                "tags": ["dashboard", "form"],
                "ui_elements": list(ui),
            },
            "ocr": {
                "blocks": [
                    {"text": t, "bbox_norm": [0.1, 0.2, 0.3, 0.4]} for t in text_blocks
                ]
            },
        },
    }


def _prompt(**kw):
    base = dict(
        prompt="explain the flow",
        target_duration_s=270.0,
        target_audience="General/Adult",
        language="English",
        content_type="VIDEO",
        tier="super_ultra",
        image_ratio="16:9",
    )
    base.update(kw)
    return sp.build_shot_planner_user_prompt(**base)


def test_image_clip_is_offered_when_images_are_uploaded():
    out = _prompt(input_images=[_image(0, "dashboard.png", ["Stage tracker"])])
    assert "IMAGE_CLIP IS AVAILABLE" in out
    assert "SOURCE IMAGE CONTEXTS" in out
    assert "image_index: 0" in out
    assert "https://s3/dashboard.png" in out


def test_image_clip_is_forbidden_when_none_are_uploaded():
    """Mirrors the SOURCE_CLIP gating — an ungated shot type gets picked and
    then has nothing to render."""
    out = _prompt()
    assert "IMAGE_CLIP IS NOT AVAILABLE" in out
    assert "SOURCE IMAGE CONTEXTS" not in out


def test_the_shot_type_menu_documents_image_clip():
    assert "**IMAGE_CLIP**" in sp.SHOT_PLANNER_SYSTEM_PROMPT
    assert "image_index" in sp.SHOT_PLANNER_SYSTEM_PROMPT


def test_ocr_bboxes_reach_the_planner():
    """The bboxes are the whole reason this block is worth its tokens — they
    are what let a callout land on the element it names."""
    out = _prompt(input_images=[_image(0, "form.png", ["Send OTP", "School name"])])
    assert "bbox_norm" in out
    assert "Send OTP" in out


def test_ocr_volume_scales_down_with_many_images():
    """A 20-still run must not emit 15 OCR blocks per image."""
    many = [_image(i, f"s{i}.png", [f"line{j}" for j in range(30)]) for i in range(20)]
    few = [_image(0, "s0.png", [f"line{j}" for j in range(30)])]
    big = sp.build_input_image_block(many)
    small = sp.build_input_image_block(few)
    assert small.count("bbox_norm") >= 15
    assert big.count("bbox_norm") / 20 < small.count("bbox_norm")
    assert big.count("bbox_norm") >= 20 * 4  # floor keeps anchors usable


def test_labels_stay_one_namespace_past_ten_images():
    block = sp.build_input_image_block([_image(i, f"s{i}.png") for i in range(12)])
    assert "Image K:" in block
    assert "Image 10:" not in block


def test_planner_is_told_not_to_invent_a_substitute():
    """The failure this guards is a generated illustration standing in for a
    real screenshot the user supplied."""
    block = sp.build_input_image_block([_image(0, "cert.png")])
    assert "Do NOT invent an illustration" in block


def test_image_index_survives_normalization():
    """Without the pass-through the planner's choice is dropped and every clip
    falls back to image 0."""
    shot = sp._normalize_shot(
        {
            "shot_type": "IMAGE_CLIP",
            "image_index": 7,
            "duration_estimate_s": 6,
            "narration_brief": "the dashboard",
        },
        0,
    )
    assert shot["image_index"] == 7


def test_source_video_index_survives_normalization():
    """Same bug on the video side: source_start/source_end were passed through
    but the index naming WHICH video they refer to was not."""
    shot = sp._normalize_shot(
        {
            "shot_type": "SOURCE_CLIP",
            "source_video_index": 2,
            "source_start": 10,
            "source_end": 18,
            "duration_estimate_s": 8,
            "narration_brief": "the demo",
        },
        0,
    )
    assert shot["source_video_index"] == 2


def test_plan_shots_accepts_input_images():
    import inspect

    assert "input_images" in inspect.signature(sp.plan_shots).parameters
