"""mcp_tool_call_log.args_json: a base64 image is stored as size + hash, never
whole (client artwork, up to ~13 MB of text per call on the primary), and any
call's args are bounded; ordinary calls are logged exactly as before."""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.mcp import repository as repo_mod  # noqa: E402


def test_ordinary_args_are_logged_unchanged():
    args = {"action": "update_page", "tag_name": "home", "ops": [{"op": "set_props", "props": {"title": "Hi"}}]}
    assert json.loads(repo_mod._audit_args_json(args)) == args
    assert repo_mod._audit_args_json(None) == "{}"


def test_base64_image_is_replaced_by_its_size_and_hash():
    blob = "iVBORw0KGgo" * 1_000_000  # ~11 MB of base64
    out = repo_mod._audit_args_json({"action": "import_image", "data_base64": blob, "file_name": "hero.png"})
    assert len(out) < 1_000 and "iVBORw0KGgo" not in out
    logged = json.loads(out)
    assert logged["action"] == "import_image" and logged["file_name"] == "hero.png"
    assert logged["data_base64"] == {"bytes": len(blob), "sha256": hashlib.sha256(blob.encode()).hexdigest()}


def test_oversized_args_keep_their_small_fields_only():
    page = {"components": [{"type": "textBlock", "props": {"text": "x" * 1_000}} for _ in range(200)]}
    out = repo_mod._audit_args_json({"action": "create_page", "tag_name": "bv", "route": "/about", "page": page})
    assert len(out) <= repo_mod._AUDIT_ARGS_MAX_CHARS
    logged = json.loads(out)
    assert logged["_truncated"] is True and logged["action"] == "create_page" and logged["route"] == "/about"
    assert set(logged["page"]) == {"bytes", "sha256"}


def test_log_tool_call_writes_the_bounded_args():
    captured = {}

    class _Db:
        def execute(self, stmt, params):
            captured.update(params)

        def commit(self):
            pass

        def rollback(self):
            pass

    repo = repo_mod.McpOAuthRepository(_Db(), cipher=None)
    repo.log_tool_call(user_id="u", institute_id="i", client_id=None, client_name=None, tool_name="website_edit",
                       args={"action": "import_image", "data_base64": "A" * 5_000_000}, ok=True, error_code=None,
                       duration_ms=5)
    assert len(captured["args"]) < 1_000 and json.loads(captured["args"])["data_base64"]["bytes"] == 5_000_000
