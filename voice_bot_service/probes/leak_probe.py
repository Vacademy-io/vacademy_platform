"""Does a finished call leave memory behind? (2026-09-30: the Mumbai box grew
~30 MB per call — 320 MB → 1.84 GB over ~45 calls — until the OOM killer took
uvicorn at 07:22 with calls live.)

Runs timing-sim scenarios back to back in ONE process, like the service does,
and after each call reports RSS, the pipeline objects still alive after a full
gc, and the asyncio tasks that outlived the call.

    python -m probes.leak_probe --runs 8 --scenarios farewell_without_marker,navana_live_then_cached
"""
from __future__ import annotations

import argparse
import asyncio
import collections
import gc
import json
import os
import sys
import tempfile


def _rss_mb() -> float:
    with open("/proc/self/status") as f:
        for line in f:
            if line.startswith("VmRSS:"):
                return int(line.split()[1]) / 1024
    return -1.0


_WATCH = ("PipelineTask", "Pipeline", "PipelineWorker", "SileroVADAnalyzer",
          "LocalSmartTurnAnalyzerV3", "InferenceSession", "CallOutcome", "NoRepeatGate",
          "RunGuard", "LLMContext", "OpenAILLMContext", "BodhiTTSService",
          "GoogleVertexLLMService", "SarvamSTTService", "Line", "SpeechCache")


def _census() -> collections.Counter:
    gc.collect()
    c = collections.Counter()
    for o in gc.get_objects():
        n = type(o).__name__
        if n in _WATCH:
            c[n] += 1
    return c


def _task_names() -> list:
    out = []
    for t in asyncio.all_tasks():
        if t is asyncio.current_task():
            continue
        out.append(t.get_name()[:90])
    return sorted(out)


def _referrer_chain(obj, depth=4) -> list:
    """Who keeps the first surviving PipelineTask alive — one referrer per hop."""
    chain, cur, seen = [], obj, {id(obj)}
    for _ in range(depth):
        refs = [r for r in gc.get_referrers(cur)
                if id(r) not in seen and not isinstance(r, list) or
                (isinstance(r, list) and len(r) < 50 and id(r) not in seen)]
        refs = [r for r in refs if r is not chain and type(r).__name__ != "frame"]
        if not refs:
            break
        r = refs[0]
        seen.add(id(r))
        desc = type(r).__name__
        if isinstance(r, dict):
            keys = [k for k, v in r.items() if v is cur][:3]
            desc += f" keys={keys}"
        chain.append(desc)
        cur = r
    return chain


async def main():
    os.environ.setdefault("TTS_CACHE_DIR", tempfile.mkdtemp(prefix="leak-cache-"))
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=8)
    ap.add_argument("--scenarios", default="farewell_without_marker")
    args = ap.parse_args()
    # Only this probe's lines on stdout: pipecat's DEBUG stream is ~1 MB per call.
    from loguru import logger as _lg
    _lg.remove()
    import logging
    logging.disable(logging.CRITICAL)
    from sim import timing as T
    base_ctx = json.loads((T.FIXTURE_DIR / "yoga_agent_context.json").read_text(encoding="utf-8"))
    for key in args.scenarios.split(","):
        sc = T.BY_KEY[key]
        ctx = (json.loads((T.FIXTURE_DIR / sc.context).read_text(encoding="utf-8"))
               if sc.context else base_ctx)
        print(f"=== {key}", flush=True)
        first = None
        for i in range(args.runs):
            res = await T.run_scenario(sc, ctx)
            await asyncio.sleep(1.5)          # let cancelled tasks unwind
            census = _census()
            rss = _rss_mb()
            first = first if first is not None else rss
            tasks = _task_names()
            print(f"run {i + 1:2d} rss {rss:7.1f} MB (+{rss - first:6.1f})  fails={len(res['fails'])}  "
                  f"tasks={len(tasks)}  alive={dict(sorted(census.items()))}", flush=True)
            if i == args.runs - 1:
                for name, n in collections.Counter(tasks).most_common(15):
                    print(f"    task x{n}: {name}")
                pts = [o for o in gc.get_objects() if type(o).__name__ == "PipelineTask"]
                if pts:
                    print(f"    PipelineTask referrer chain: {_referrer_chain(pts[0])}")
    sys.stdout.flush()


if __name__ == "__main__":
    asyncio.run(main())
