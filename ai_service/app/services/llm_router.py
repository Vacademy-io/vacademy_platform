"""
Which gateway serves a chat model.

OpenRouter serves every model by default. A model can be sent to another
OpenAI-compatible gateway (e.g. Isoquant for GLM) by listing it in the route
map — the platform setting `llm.model_routes` (super-admin portal, applies
within 30 s) or, when that is unset, the `LLM_MODEL_ROUTES` env var:

    {"z-ai/glm-5.3-flash": "isoquant"}
    {"z-ai/glm-5.3-flash": {"router": "isoquant", "model": "glm-5.3-flash",
                            "reasoning_effort": "low"}}

The registry id (`ai_models.model_id`, the OpenRouter id) stays the id used
everywhere else — billing, model health, the portal. Only the wire request
changes: URL, key, headers, the gateway's model id and its reasoning shape.

A route is skipped (the call stays on OpenRouter) when:
  * the caller passes its own key that is not the platform OpenRouter key —
    an institute's BYO key is an OpenRouter key, and must never be sent to
    another vendor;
  * the gateway's key is not configured;
  * the gateway failed recently (`mark_router_failed`), so a dead gateway
    costs one failed call per cooldown instead of one per request.

Call sites build their payload in OpenRouter's shape as before and call
`route_chat(payload, api_key)`, which returns (url, headers, payload) for the
gateway that should serve it. `openrouter_chat(...)` gives the plain
OpenRouter request for a failover retry.
"""
from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Optional, Tuple

from ..config import get_settings

logger = logging.getLogger(__name__)

ROUTES_SETTING_KEY = "llm.model_routes"
DEFAULT_ROUTER = "openrouter"

# Request keys only OpenRouter understands. Other gateways either reject
# unknown keys or ignore them silently; neither is worth finding out per call.
_OPENROUTER_ONLY_KEYS = ("reasoning", "provider", "transforms", "plugins", "route", "models", "usage")

_FAILED_UNTIL: Dict[str, float] = {}
_FAILURE_COOLDOWN_SECONDS = 120.0


@dataclass(frozen=True)
class RouterSpec:
    name: str
    label: str
    chat_url: Callable[[], str]
    api_key: Callable[[], Optional[str]]
    headers: Dict[str, str] = field(default_factory=dict)
    # "openrouter": `reasoning: {enabled, effort}` passes through.
    # "effort": OpenAI-style top-level `reasoning_effort`.
    reasoning_style: str = "openrouter"
    # Efforts the gateway accepts, lowest first (the "off" request maps to the first).
    efforts: Tuple[str, ...] = ()
    default_effort: Optional[str] = None


ROUTERS: Dict[str, RouterSpec] = {
    "openrouter": RouterSpec(
        name="openrouter",
        label="OpenRouter",
        # LLM_BASE_URL keeps working for self-hosted installs that point it elsewhere.
        chat_url=lambda: get_settings().llm_base_url or "https://openrouter.ai/api/v1/chat/completions",
        api_key=lambda: get_settings().openrouter_api_key,
        headers={"HTTP-Referer": "https://vacademy.io", "X-Title": "Vacademy AI Tutor"},
    ),
    "isoquant": RouterSpec(
        name="isoquant",
        label="Isoquant",
        chat_url=lambda: os.getenv("ISOQUANT_BASE_URL", "https://api.isoquant.ai/v1").rstrip("/") + "/chat/completions",
        api_key=lambda: get_settings().isoquant_api_key,
        # Zero data retention: learner content must not be kept by the gateway.
        headers={"Isoquant-ZDR": "required"},
        reasoning_style="effort",
        # glm-5.3-flash accepts low|high|max and DEFAULTS TO max when nothing
        # is sent — so a request that says nothing must still say "low".
        efforts=("low", "high", "max"),
        default_effort="low",
    ),
}


@dataclass(frozen=True)
class ChatRoute:
    router: str
    label: str
    url: str
    api_key: str
    wire_model: str
    extra_headers: Dict[str, str]
    reasoning_style: str
    efforts: Tuple[str, ...]
    effort: Optional[str]  # the route entry's effort; None = the gateway default

    @property
    def is_default(self) -> bool:
        return self.router == DEFAULT_ROUTER

    def headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            **self.extra_headers,
        }

    def prepare(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """The payload in this gateway's shape. OpenRouter's is returned as-is."""
        if self.reasoning_style == "openrouter":
            return payload
        p = {k: v for k, v in payload.items() if k not in _OPENROUTER_ONLY_KEYS}
        p["model"] = self.wire_model
        if self.efforts:
            effort = _map_effort(payload.get("reasoning"), self.effort, self.efforts)
            if effort:
                p["reasoning_effort"] = effort
        if p.get("stream") and "stream_options" not in p:
            p["stream_options"] = {"include_usage": True}
        return p


def _map_effort(reasoning: Any, route_effort: Optional[str], efforts: Tuple[str, ...]) -> Optional[str]:
    """OpenRouter's `reasoning` object → the gateway's effort level.

    Off (`enabled: false`) becomes the lowest level — these models cannot turn
    reasoning off. An explicit OpenRouter effort maps to the nearest level the
    gateway has; otherwise the route's configured effort applies.
    """
    r = reasoning if isinstance(reasoning, dict) else {}
    if r.get("enabled") is False:
        return efforts[0]
    wanted = str(r.get("effort") or route_effort or "").lower()
    if not wanted:
        return None
    if wanted in efforts:
        return wanted
    order = ("none", "minimal", "low", "medium", "high", "xhigh", "max")
    rank = order.index(wanted) if wanted in order else order.index("low")
    for level in efforts:
        if level in order and order.index(level) >= rank:
            return level
    return efforts[-1]


# --------------------------------------------------------------------------
# Route map
# --------------------------------------------------------------------------

def parse_routes(raw: Any) -> Dict[str, Dict[str, Any]]:
    """Normalise a route map (JSON text or dict) to {model_id: entry}.
    Raises ValueError on anything malformed or on an unknown router."""
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return {}
    data = json.loads(raw) if isinstance(raw, str) else raw
    if not isinstance(data, dict):
        raise ValueError('routes must be a JSON object like {"z-ai/glm-5.3-flash": "isoquant"}')
    out: Dict[str, Dict[str, Any]] = {}
    for model_id, entry in data.items():
        if isinstance(entry, str):
            entry = {"router": entry}
        if not isinstance(entry, dict) or not entry.get("router"):
            raise ValueError(f"route for {model_id} needs a router name")
        router = str(entry["router"]).strip().lower()
        if router not in ROUTERS:
            raise ValueError(f"unknown router '{router}' for {model_id} (known: {', '.join(ROUTERS)})")
        # `"reasoning_effort": false` → send none (models without the parameter).
        send_effort = entry.get("reasoning_effort") is not False
        effort = entry.get("reasoning_effort") if send_effort else None
        spec = ROUTERS[router]
        if effort is not None and spec.efforts and str(effort).lower() not in spec.efforts:
            raise ValueError(f"{spec.label} accepts reasoning_effort {', '.join(spec.efforts)}, not '{effort}'")
        out[str(model_id).strip()] = {
            "router": router,
            "model": str(entry.get("model") or "").strip() or None,
            "reasoning_effort": str(effort).lower() if effort is not None else None,
            "send_effort": send_effort,
        }
    return out


def _env_routes() -> str:
    return os.getenv("LLM_MODEL_ROUTES", "") or "{}"


def model_routes() -> Dict[str, Dict[str, Any]]:
    try:
        from .platform_settings_service import get_platform_setting
        raw = get_platform_setting(ROUTES_SETTING_KEY, default=_env_routes())
    except Exception:  # noqa: BLE001
        raw = _env_routes()
    try:
        return parse_routes(raw)
    except Exception as exc:  # noqa: BLE001
        # A bad map must never take generation down: everything stays on OpenRouter.
        logger.error("LLM route map is invalid (%s); every model stays on OpenRouter", exc)
        return {}


def _default_wire_model(model_id: str) -> str:
    """OpenRouter ids carry a vendor prefix and variant suffix
    ("z-ai/glm-5.3-flash:batch"); direct gateways use the bare name."""
    return model_id.split("/", 1)[-1].split(":", 1)[0]


# --------------------------------------------------------------------------
# Resolution
# --------------------------------------------------------------------------

def mark_router_failed(router: str) -> None:
    if router != DEFAULT_ROUTER:
        _FAILED_UNTIL[router] = time.monotonic() + _FAILURE_COOLDOWN_SECONDS
        logger.warning("LLM router %s failed; sending its models to OpenRouter for %.0f s",
                       router, _FAILURE_COOLDOWN_SECONDS)


def _router_cooling_down(router: str) -> bool:
    until = _FAILED_UNTIL.get(router)
    if until is None:
        return False
    if time.monotonic() >= until:
        _FAILED_UNTIL.pop(router, None)
        return False
    return True


def _openrouter_route(model: str, api_key: Optional[str]) -> ChatRoute:
    spec = ROUTERS[DEFAULT_ROUTER]
    return ChatRoute(
        router=spec.name, label=spec.label, url=spec.chat_url(),
        api_key=api_key or spec.api_key() or "", wire_model=model,
        extra_headers=dict(spec.headers), reasoning_style=spec.reasoning_style,
        efforts=spec.efforts, effort=None,
    )


def route_for(
    model: str, api_key: Optional[str] = None, routes: Optional[Dict[str, Dict[str, Any]]] = None
) -> ChatRoute:
    """The gateway that should serve `model`. `api_key` is the key the caller
    resolved (None = the platform key); `routes` overrides the live map (the
    portal probes a map before saving it)."""
    entry = (model_routes() if routes is None else routes).get(model or "")
    if not entry or entry["router"] == DEFAULT_ROUTER:
        return _openrouter_route(model, api_key)

    platform_key = get_settings().openrouter_api_key
    if api_key and api_key != platform_key:
        return _openrouter_route(model, api_key)  # caller's own OpenRouter key

    spec = ROUTERS[entry["router"]]
    key = spec.api_key()
    if not key:
        logger.warning("Model %s is routed to %s but its API key is not set; using OpenRouter",
                       model, spec.label)
        return _openrouter_route(model, api_key)
    if _router_cooling_down(spec.name):
        return _openrouter_route(model, api_key)

    effort = entry["reasoning_effort"] or spec.default_effort
    return ChatRoute(
        router=spec.name, label=spec.label, url=spec.chat_url(), api_key=key,
        wire_model=entry["model"] or _default_wire_model(model),
        extra_headers=dict(spec.headers), reasoning_style=spec.reasoning_style,
        efforts=spec.efforts if entry["send_effort"] else (),
        effort=effort,
    )


def route_chat(
    payload: Dict[str, Any], api_key: Optional[str] = None,
    routes: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Tuple[str, Dict[str, str], Dict[str, Any], ChatRoute]:
    """(url, headers, payload, route) for one chat completion whose payload is
    in OpenRouter's shape with the registry model id in `payload["model"]`."""
    route = route_for(payload.get("model") or "", api_key, routes)
    return route.url, route.headers(), route.prepare(payload), route


def openrouter_chat(
    payload: Dict[str, Any], api_key: Optional[str] = None
) -> Tuple[str, Dict[str, str], Dict[str, Any], ChatRoute]:
    """The same request sent to OpenRouter — the failover for a routed call."""
    route = _openrouter_route(payload.get("model") or "", api_key)
    return route.url, route.headers(), payload, route


def should_fail_over(route: ChatRoute, status: Optional[int]) -> bool:
    """Whether a routed call's failure should be retried on OpenRouter.
    `status` None = the request never got a response (timeout, connect error).
    A 400 is the request's own fault and would fail on OpenRouter too."""
    if route.is_default:
        return False
    return status is None or status in (401, 402, 403, 404, 408, 429) or status >= 500


# --------------------------------------------------------------------------
# Sending
# --------------------------------------------------------------------------

async def post_chat(client, payload: Dict[str, Any], api_key: Optional[str] = None, **kwargs):
    """POST one chat completion through the model's gateway with an
    httpx.AsyncClient. A routed gateway that is unreachable or refuses is
    retried once on OpenRouter. Returns the httpx.Response (status untouched,
    so callers keep their own error handling)."""
    import httpx

    url, headers, wire, route = route_chat(payload, api_key)
    try:
        response = await client.post(url, headers=headers, json=wire, **kwargs)
        if not should_fail_over(route, response.status_code):
            return response
        reason = f"{response.status_code}: {response.text[:200]}"
    except httpx.TransportError as exc:
        if route.is_default:
            raise
        reason = str(exc)
    mark_router_failed(route.router)
    logger.warning("%s failed for %s (%s); retrying on OpenRouter", route.label, payload.get("model"), reason)
    url, headers, wire, _ = openrouter_chat(payload, api_key)
    return await client.post(url, headers=headers, json=wire, **kwargs)


def post_chat_sync(payload: Dict[str, Any], api_key: Optional[str] = None, timeout: float = 60.0):
    """`post_chat` for synchronous code paths (httpx.Client)."""
    import httpx

    url, headers, wire, route = route_chat(payload, api_key)
    with httpx.Client(timeout=timeout) as client:
        try:
            response = client.post(url, headers=headers, json=wire)
            if not should_fail_over(route, response.status_code):
                return response
            reason = f"{response.status_code}: {response.text[:200]}"
        except httpx.TransportError as exc:
            if route.is_default:
                raise
            reason = str(exc)
        mark_router_failed(route.router)
        logger.warning("%s failed for %s (%s); retrying on OpenRouter", route.label, payload.get("model"), reason)
        url, headers, wire, _ = openrouter_chat(payload, api_key)
        return client.post(url, headers=headers, json=wire)


class open_chat_stream:
    """`async with open_chat_stream(client, payload, api_key) as resp:` — a
    streaming chat completion through the model's gateway. The failover to
    OpenRouter happens before the body is read, so no token is ever repeated."""

    def __init__(self, client, payload: Dict[str, Any], api_key: Optional[str] = None, **kwargs):
        self._client, self._payload, self._api_key, self._kwargs = client, payload, api_key, kwargs
        self._cm = None
        self.route: Optional[ChatRoute] = None

    async def _open(self, url, headers, wire):
        self._cm = self._client.stream("POST", url, headers=headers, json=wire, **self._kwargs)
        return await self._cm.__aenter__()

    async def __aenter__(self):
        import httpx

        url, headers, wire, self.route = route_chat(self._payload, self._api_key)
        try:
            response = await self._open(url, headers, wire)
            if not should_fail_over(self.route, response.status_code):
                return response
            reason = f"{response.status_code}: {(await response.aread())[:200]!r}"
            await self._cm.__aexit__(None, None, None)
        except httpx.TransportError as exc:
            if self.route.is_default:
                raise
            reason = str(exc)
        mark_router_failed(self.route.router)
        logger.warning("%s failed for %s (%s); streaming from OpenRouter",
                       self.route.label, self._payload.get("model"), reason)
        url, headers, wire, self.route = openrouter_chat(self._payload, self._api_key)
        return await self._open(url, headers, wire)

    async def __aexit__(self, *exc_info):
        if self._cm is not None:
            return await self._cm.__aexit__(*exc_info)
        return False


__all__ = [
    "ROUTERS", "ROUTES_SETTING_KEY", "ChatRoute", "parse_routes", "model_routes",
    "route_for", "route_chat", "openrouter_chat", "should_fail_over", "mark_router_failed",
    "post_chat", "post_chat_sync", "open_chat_stream",
]
