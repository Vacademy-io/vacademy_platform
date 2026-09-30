"""Give a finished call's memory back at once — not at the interpreter's next
full collection.

WHY (2026-09-30). A call's pipeline is a web of reference cycles (every
processor links to its neighbours both ways; services point at their task
manager, closures at the transport). Reference counting can never free it; only
the cyclic collector's FULL (generation-2) pass can — and CPython runs that pass
rarely on a big heap (it waits until the objects promoted since the last one
exceed 25 % of all long-lived objects). Meanwhile each finished call keeps its
Silero VAD and Smart Turn ONNX sessions (~35 MB) and two executor threads. On
the Mumbai box, after the un-awaited drift-task leak was fixed (9b674bae7a), idle
memory still climbed 206 MB → 1.12 GB over ~60 calls, with threads creeping
16 → 41, before a full pass knocked it back. probes/leak_probe.py --never-gc
reproduces it: 1, 2, 3 … 6 finished pipelines still in memory after 10 calls.

WHAT. After every call: one full collection, which frees that call. Cheap
because the long-lived heap (modules, pipecat, google-auth — ~220 k objects) is
FROZEN into the permanent generation, which collections skip: measured 25-32 ms
per collection unfrozen vs 1.4-2.3 ms frozen (Mac; the 1-vCPU box is slower, so
the unfrozen cost would be an audible stall on the other live calls). The heap
is frozen once after the LLM warm-up and once more at the first idle moment
after a call, when the lazily imported call modules (STT/TTS SDKs, onnxruntime)
are in — and ONLY when no call is live, so no live call is ever frozen. When the
box is idle, glibc is also asked to hand freed arenas back (malloc_trim), so RSS
— what the OOM killer and the safety valve read — reflects it.
"""
from __future__ import annotations

import ctypes
import gc
import logging
import time

logger = logging.getLogger("app.memory")

_frozen_after_call = False


def _rss_mb() -> int:
    try:
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return int(line.split()[1]) // 1024
    except OSError:
        pass
    return -1


def _malloc_trim() -> bool:
    try:
        return bool(ctypes.CDLL("libc.so.6").malloc_trim(0))
    except Exception:          # not glibc (macOS dev boxes): nothing to trim
        return False


def freeze_startup() -> None:
    """Freeze everything alive after startup (no call can be live yet)."""
    gc.collect()
    gc.freeze()
    logger.info("memory: froze %d startup objects", gc.get_freeze_count())


def reclaim(idle: bool, corr: str = "") -> dict:
    """Free what a finished call left for the cyclic collector. `idle` = no call
    is live: then (once) freeze the survivors and return freed arenas to the OS."""
    global _frozen_after_call
    before = _rss_mb()
    t0 = time.perf_counter()
    freed = gc.collect()
    gc_ms = (time.perf_counter() - t0) * 1000.0
    froze = trimmed = False
    if idle:
        if not _frozen_after_call:
            gc.freeze()
            _frozen_after_call = froze = True
        trimmed = _malloc_trim()
    after = _rss_mb()
    logger.info("memory: after call %s — freed %d objects in %.1f ms%s%s; rss %d -> %d MB",
                corr[:8], freed, gc_ms, "; froze survivors" if froze else "",
                "; trimmed" if trimmed else "", before, after)
    return {"freed": freed, "gc_ms": round(gc_ms, 1), "rss_before": before,
            "rss_after": after, "froze": froze, "trimmed": trimmed}
