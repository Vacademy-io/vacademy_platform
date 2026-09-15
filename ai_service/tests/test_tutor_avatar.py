"""Premium teacher avatar (Spatius): configuration, settings and pricing —
the parts that need no network."""
import asyncio

import pytest

from app.services import spatius_service as sp
from app.services.tutor.runtime.settings import TutorSettings, _apply


def test_spatius_is_dark_without_keys(monkeypatch):
    monkeypatch.delenv("SPATIUS_API_KEY", raising=False)
    monkeypatch.delenv("SPATIUS_APP_ID", raising=False)
    assert not sp.available() and sp.base_url() == "https://console.us-west.spatius.ai/v1/console"
    with pytest.raises(RuntimeError):
        asyncio.run(sp.mint_session_token())
    monkeypatch.setenv("SPATIUS_API_KEY", "k")
    monkeypatch.setenv("SPATIUS_APP_ID", "app")
    monkeypatch.setenv("SPATIUS_CONSOLE_HOST", "console.eu.spatius.ai/")
    assert sp.available() and sp.app_id() == "app" and sp.base_url() == "https://console.eu.spatius.ai/v1/console"


def test_avatar_settings_parse_and_ignore_unknown_providers():
    s = TutorSettings()
    _apply(s, {"avatarProvider": "spatius", "avatarId": "av_123"})
    assert s.avatar_provider == "spatius" and s.avatar_id == "av_123"
    _apply(s, {"avatarProvider": "heygen"})
    assert s.avatar_provider == "spatius"        # unknown vendor ignored
    _apply(s, {"avatar_provider": "none"})
    assert s.avatar_provider == "none"


def test_avatar_minute_is_priced():
    from app.services.tool_cost_estimator import DEFAULT_TOOL_PRICING
    row = DEFAULT_TOOL_PRICING["tutor_avatar_minute"]
    assert row["unit_field"] == "audio_minutes" and float(row["per_unit_credits"]) == 1.0
    assert sp.SPATIUS_USD_PER_MINUTE < 0.01


def test_vendor_errors_in_a_200_body_are_failures(monkeypatch):
    import httpx
    from app.services.spatius_service import _payload, open_base_url
    r = httpx.Response(200, json={"errors": [{"status": 404, "title": "Not Found", "detail": "Not Found"}]}, request=httpx.Request("GET", "https://x"))
    with pytest.raises(RuntimeError) as ei:
        _payload(r, "avatar job")
    assert "Not Found" in str(ei.value)
    ok = httpx.Response(200, json={"jobId": "j1", "status": "queued"}, request=httpx.Request("POST", "https://x"))
    assert _payload(ok, "avatar creation")["jobId"] == "j1"
    assert open_base_url() == "https://console.spatius.ai/v1/open"
