"""Unit tests for the per-voice WPS resolver in automation_pipeline.

The resolver and _VOICE_WPS table are pure-python with no dependencies, so we
exercise them directly without spinning up the full pipeline. Mirrors the
exec-the-source-block pattern used by test_visual_preferences_scanner.py to
sidestep heavyweight imports (pydantic / faster_whisper / rembg / PIL).

Run with:
    cd ai_service && python3 tests/test_voice_wps_resolver.py
"""
from __future__ import annotations

import sys
from pathlib import Path

AI_SERVICE = Path(__file__).resolve().parent.parent
_PIPELINE_SRC = (AI_SERVICE / "app/ai-video-gen-main/automation_pipeline.py").read_text()

# The _VOICE_WPS table + helper live between two markers we control. Find them
# and exec only that range so we don't pull in the rest of the pipeline.
_START = _PIPELINE_SRC.index("_VOICE_WPS: Dict[str, float]")
_END = _PIPELINE_SRC.index("# Sarvam-supported language → BCP-47 code")
_block = _PIPELINE_SRC[_START:_END]

_ns: dict = {}
exec(  # noqa: S102 — controlled, file-local source
    "from typing import Dict, Optional\n" + _block,
    _ns,
)
_VOICE_WPS = _ns["_VOICE_WPS"]
resolve = _ns["_resolve_voice_wps"]

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"

_passed = 0
_failed: list[tuple[str, str]] = []


def assert_close(name: str, got: float, expected: float, tol: float = 1e-6) -> None:
    global _passed
    if abs(got - expected) <= tol:
        _passed += 1
        print(f"  {PASS} {name}")
    else:
        _failed.append((name, f"expected {expected}, got {got}"))
        print(f"  {FAIL} {name}")
        print(f"      expected: {expected}")
        print(f"      got:      {got}")


print("\n── Sarvam voices (en-IN) ──")
assert_close("sarvam:neha → 1.55 (the Parle-G regression voice)",
             resolve("sarvam", "neha"), 1.55)
assert_close("sarvam:priya → 1.65", resolve("sarvam", "priya"), 1.65)
assert_close("sarvam:amelia → 2.00 (English-trained, faster)",
             resolve("sarvam", "amelia"), 2.00)
assert_close("sarvam:shubh → 1.75 (male default)",
             resolve("sarvam", "shubh"), 1.75)

print("\n── Provider defaults (unknown voice) ──")
assert_close("sarvam:_default → 1.75",
             resolve("sarvam", "unknown_voice_xyz"), 1.75)
assert_close("google:_default → 2.45",
             resolve("google", "en-US-Wavenet-X"), 2.45)
assert_close("edge:_default → 2.55",
             resolve("edge", "anything"), 2.55)
assert_close("elevenlabs:_default → 2.40",
             resolve("elevenlabs", "rachel"), 2.40)

print("\n── Plain voice id (no provider) ──")
assert_close("voice='neha' (any provider) → 1.55",
             resolve(None, "neha"), 1.55)
assert_close("voice='priya' (any provider) → 1.65",
             resolve("", "priya"), 1.65)
assert_close("voice='neha' with WRONG provider falls back to any:neha = 1.55",
             resolve("google", "neha"), 1.55)

print("\n── Empty / None inputs ──")
assert_close("None, None → 2.0 global default",
             resolve(None, None), 2.0)
assert_close("empty strings → 2.0 global default",
             resolve("", ""), 2.0)
assert_close("unknown provider, no voice → 2.0",
             resolve("notarealprovider", None), 2.0)

print("\n── Case insensitivity ──")
assert_close("Provider casing: 'SARVAM' + 'NEHA' → 1.55",
             resolve("SARVAM", "NEHA"), 1.55)
assert_close("Mixed case: 'Sarvam' + 'Neha' → 1.55",
             resolve("Sarvam", "Neha"), 1.55)

print("\n── Whitespace tolerance ──")
assert_close("'  sarvam  ' + '  neha  ' → 1.55",
             resolve("  sarvam  ", "  neha  "), 1.55)

print("\n── _default lookup never returns when querying by voice ──")
# This is a bug guard: resolving voice="_default" alone shouldn't accidentally
# match the "sarvam:_default" entry. The plain-voice lookup explicitly skips
# _default keys.
got = resolve(None, "_default")
assert_close("voice='_default', no provider → 2.0 (NOT a provider default)",
             got, 2.0)

print("\n── Coverage sanity: every Sarvam voice in the table ──")
# 16 female + 11 male measured = 27 voices. (Some voices in SARVAM_VOICES are
# missing from the table — those fall back to sarvam:_default, which is the
# documented behavior.)
_sarvam_keys = [k for k in _VOICE_WPS if k.startswith("sarvam:") and not k.endswith(":_default")]
print(f"  ▸ {len(_sarvam_keys)} Sarvam voices have explicit WPS")
for k in _sarvam_keys:
    wps = _VOICE_WPS[k]
    if not (1.4 <= wps <= 2.2):
        _failed.append((f"WPS sanity {k}", f"value {wps} outside 1.4-2.2 range"))
        print(f"  {FAIL} {k}: {wps} outside expected 1.4-2.2 wps range")
    else:
        _passed += 1
        print(f"  {PASS} {k} = {wps} wps (in 1.4-2.2 range)")

print()
if _failed:
    print(f"{FAIL} {len(_failed)} failed, {_passed} passed")
    for name, msg in _failed:
        print(f"  - {name}: {msg}")
    sys.exit(1)
print(f"{PASS} {_passed} tests passed")
