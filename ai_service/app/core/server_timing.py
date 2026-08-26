"""Server-Timing middleware.

Emits ``Server-Timing: app;dur=<ms>`` so a browser can subtract our processing
time from the total round trip and attribute the remainder to the network. That
is what lets us tell a client "your connection is slow" instead of guessing when
they report "the LMS is slow".

This is deliberately a **pure ASGI** middleware rather than Starlette's
``BaseHTTPMiddleware``. This service streams SSE and other StreamingResponses
from at least five routers (chat, assistant, TTS, course outline, content
generation); ``BaseHTTPMiddleware`` wraps and buffers response bodies and has a
long history of breaking streaming. Hooking ``http.response.start`` touches only
the header frame and never the body, so streaming is unaffected.

For a streamed response the duration recorded is therefore time-to-first-byte,
not total stream duration — which is the correct figure for this purpose anyway,
since the rest is transfer time, not server work.
"""

import time


class ServerTimingMiddleware:
    """Append Server-Timing (and Timing-Allow-Origin) to every HTTP response."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # Websockets and lifespan carry no response headers — pass straight through.
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        start = time.perf_counter()
        state = {"stamped": False}

        async def send_wrapper(message):
            if message.get("type") == "http.response.start" and not state["stamped"]:
                state["stamped"] = True
                try:
                    duration_ms = int((time.perf_counter() - start) * 1000)
                    # ASGI spec says headers is an iterable of two-item sequences;
                    # Starlette hands us a list, but coerce so a non-list from any
                    # other server cannot raise here.
                    headers = list(message.get("headers") or [])
                    headers.append((b"server-timing", f"app;dur={duration_ms}".encode()))
                    # Required for the value to be readable cross-origin via the
                    # Resource Timing API. Reading it off a fetch/axios response
                    # additionally needs Access-Control-Expose-Headers, set on the
                    # CORS middleware in app_factory.
                    headers.append((b"timing-allow-origin", b"*"))
                    message["headers"] = headers
                except Exception:
                    # Observability must never break the response it observes.
                    pass
            await send(message)

        await self.app(scope, receive, send_wrapper)
