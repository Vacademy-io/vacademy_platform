"""Offline wiring/contract test for the migrated Presentation AI feature.

No network/DB: stubs the LLM call + billing and checks that the service returns
the sanitized JSON verbatim and bills as RequestType.PRESENTATION. Also checks
the two ported prompt templates format correctly (placeholders filled, literal
JSON braces collapsed).

Run:
    cd vacademy_platform/ai_service && PYTHONPATH=.. APP_ENV=local \
        .venv/bin/python tests/test_presentation_parity.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ai_service.app.services import presentation_service as PS
from ai_service.app.services.ai_prompts import presentation as prompts
from ai_service.app.models.ai_token_usage import RequestType


def test_templates_format() -> None:
    g = prompts.build_generate_prompt("Photosynthesis", "ENGLISH")
    r = prompts.build_regenerate_prompt('{"elements":[]}', "make title bigger")
    assert "Photosynthesis" in g and "ENGLISH" in g
    assert "make title bigger" in r and "elements" in r
    for p in (g, r):
        assert "{{" not in p and "}}" not in p, "doubled braces must collapse"
    print("  ✓ templates format (placeholders + brace collapse)")


def test_generate_returns_raw_json_and_bills() -> None:
    captured = {}

    async def fake_generate_json(prompt, models, **kw):
        return '{"slides":[],"assessment":{"questions":[]},"title":"T","slides_order":[]}', "google/gemini-2.5-flash", {
            "prompt_tokens": 10,
            "completion_tokens": 20,
            "total_tokens": 30,
        }

    def fake_resolve(db, use_case, preferred):
        assert use_case == "presentation"
        return "google/gemini-2.5-flash", []

    def fake_bill(**kw):
        captured.update(kw)

    PS.llm_json.generate_json = fake_generate_json
    PS.resolve_models = fake_resolve
    PS.ai_billing.record_llm_billing = fake_bill

    out = asyncio.run(
        PS.generate_from_data(
            db=object(), language="ENGLISH", text="Newton's laws",
            preferred_model=None, institute_id="inst-1", user_id="user-1",
        )
    )
    assert out.startswith("{") and '"slides"' in out, out
    assert captured["request_type"] == RequestType.PRESENTATION
    assert captured["model"] == "google/gemini-2.5-flash"
    assert captured["total_tokens"] == 30
    assert captured["institute_id"] == "inst-1" and captured["user_id"] == "user-1"
    print("  ✓ generate returns raw sanitized JSON + bills as PRESENTATION")


def main() -> int:
    failed = 0
    for t in (test_templates_format, test_generate_returns_raw_json_and_bills):
        print(f"\n{t.__name__}:")
        try:
            t()
        except AssertionError as e:
            failed += 1
            print(f"  ✗ FAILED: {e}")
    print("\n" + ("ALL PASSED" if not failed else f"{failed} FAILED"))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
