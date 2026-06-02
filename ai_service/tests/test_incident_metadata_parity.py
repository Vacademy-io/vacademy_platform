"""Offline contract test for the migrated Incident/LL + Question-metadata features.

No network/DB. Verifies wire shapes against the Java DTO contracts and the
incident-types catalog against the Java source.

Run:
    cd vacademy_platform/ai_service && PYTHONPATH=.. APP_ENV=local \
        .venv/bin/python tests/test_incident_metadata_parity.py
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ai_service.app.schemas.incident import IncidentAIStructureResponse
from ai_service.app.schemas.question_metadata import QuestionMetadataExtractResponse
from ai_service.app.services.ai_prompts.incident_types import INCIDENT_TYPES
from ai_service.app.services import question_metadata_service as Q
from ai_service.app.services.ai_prompts import incident as incident_prompts
from ai_service.app.services.ai_prompts import question_metadata as qm_prompts

_REPO = "/Volumes/shreyash_ex/Vacademy/vacademy_platform"
_JAVA_LL_REL = "media_service/src/main/java/vacademy/io/media_service/constant/LL_AI_Constant.java"


def _load_java_ll() -> str | None:
    """Return the Java LL_AI_Constant source for the parity check.

    The Java AI code was deleted during the migration, so prefer the working-tree
    file if present, else fall back to the committed version via `git show HEAD`
    (the deletions may be uncommitted). Returns None if neither is available —
    the catalog parity check then skips rather than fails, since ai_service's
    INCIDENT_TYPES is now the source of truth."""
    p = Path(_REPO) / _JAVA_LL_REL
    if p.exists():
        return p.read_text()
    try:
        out = subprocess.run(
            ["git", "-C", _REPO, "show", f"HEAD:{_JAVA_LL_REL}"],
            capture_output=True, text=True, timeout=20,
        )
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout
    except Exception:  # noqa: BLE001
        pass
    return None

INCIDENT_KEYS = [
    "event_code", "category", "subcategory", "description", "title",
    "is_suspect_known", "was_reported_to_police", "people_injured",
    "property_loss", "suspects",
]


def test_incident_types_match_java() -> None:
    java = _load_java_ll()
    if java is None:
        print("  ⊘ skipped: LL_AI_Constant.java removed post-migration "
              "(INCIDENT_TYPES is now the source of truth)")
        return
    pairs = re.findall(
        r'INCIDENT_TYPES\.put\("([^"]+)",\s*new IncidentType\("((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"\)\)',
        java,
    )
    assert pairs, "failed to parse Java incident types"
    java_map = {c: (cat, sub) for c, cat, sub in pairs}
    py_map = {c: (v["category"], v["subcategory"]) for c, v in INCIDENT_TYPES.items()}
    assert java_map == py_map, "incident-types mismatch vs Java"
    print(f"  ✓ incident types match Java ({len(py_map)} entries)")


def test_incident_response_shape() -> None:
    llm = {
        "event_code": "ET1002", "category": "EXTERNAL THREATS",
        "subcategory": "Tribal or Ethnic Conflicts", "description": "d", "title": "t",
        "was_reported_to_police": True,
        "people_injured": [{"name": "A", "nature": "cut", "is_employee": True}],
        "property_damages": [{"name": "fence", "description": "x", "loss_value": 100.0, "type": "DAMAGE"}],
        "suspects": [{"name": "", "description": "unknown"}],
        "EXTRA": "drop",
    }
    out = IncidentAIStructureResponse.model_validate(llm).model_dump(by_alias=True)
    assert list(out.keys()) == INCIDENT_KEYS, out.keys()
    assert out["is_suspect_known"] is None  # phantom null present
    assert out["people_injured"][0]["id_number"] is None  # phantom null present
    assert out["property_loss"][0]["loss_value"] == 100.0  # property_damages→property_loss, float
    assert "EXTRA" not in out
    print("  ✓ incident response shape (snake, field order, nulls, alias, extras dropped)")


def test_incident_prompt_embeds_catalog() -> None:
    p = incident_prompts.build_prompt("A theft happened")
    assert "A theft happened" in p
    assert '"ET1002"' in p and '"THEFT"' in p  # catalog embedded
    # placeholders substituted + template's own skeleton braces collapsed
    # (note: the embedded JSON catalog legitimately contains '}}' from nested
    #  dict closes, so we don't assert absence of doubled braces here).
    assert "{incidentText}" not in p and "{incidentTypes}" not in p
    assert '"event_code"' in p  # JSON skeleton present (template formatted)
    print("  ✓ incident prompt embeds catalog + placeholders filled")


def test_metadata_prompt_builders() -> None:
    idq = Q._build_id_and_questions({"p1": "<p>What is <b>2+2</b>? <img src='x'/></p>"})
    idt = Q._build_id_and_topics({"t1": "Arithmetic"})
    # media tags removed, other HTML kept
    assert idq.startswith("question_id:p1 text : ") and "<p>What is <b>2+2</b>?" in idq, repr(idq)
    assert "<img" not in idq
    assert idt == "topic_id:t1 name : Arithmetic", repr(idt)
    p = qm_prompts.build_prompt(idq, idt)
    assert "{{" not in p and "}}" not in p
    print("  ✓ metadata prompt builders (media-tags removed, markup kept, spacing)")


def test_metadata_response_shape() -> None:
    resp = QuestionMetadataExtractResponse.model_validate(
        {"questions": [{"question_id": "p1", "topic_ids": ["t1"], "tags": ["add"],
                        "difficulty": "easy", "problem_type": "knowledge_based", "junk": 1}]}
    ).model_dump()
    assert list(resp["questions"][0].keys()) == [
        "question_id", "topic_ids", "tags", "difficulty", "problem_type"
    ], resp
    print("  ✓ metadata response shape (raw keys, extras dropped)")


def main() -> int:
    tests = [
        test_incident_types_match_java,
        test_incident_response_shape,
        test_incident_prompt_embeds_catalog,
        test_metadata_prompt_builders,
        test_metadata_response_shape,
    ]
    failed = 0
    for t in tests:
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
