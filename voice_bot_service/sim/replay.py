"""Replay a LIVE call through the real pipeline and check invariants.

Every call logs one line at its end — `replay corr=<id> {json}` — with the
STT finals, VAD on/off, bot audio on/off and the model's raw replies. This
turns that record into a timing-sim scenario (the real pipeline, stub STT
emitting the recorded finals at the recorded times, stub LLM answering with
the recorded replies in order) and runs a fixed set of invariants over what
the pipeline did with it. Production produces conversation shapes nobody
writes down by hand; this makes every call a regression test.

On the box:
    C=<corr>; journalctl CONTAINER_NAME=voice-bot-voice-bot-1 -o cat --since "1 day ago" \
      | grep -a "app.bot replay corr=$C" | sed -E 's/.*corr=[^ ]* //' > /tmp/probe/replay_$C.json
    docker run --rm --env-file .env -v /tmp/probe/replay_$C.json:/srv/rec.json:ro $IMG \
      python -m sim.replay --file rec.json --corr $C [--verbose]
`--corr` fetches the agent context from admin-core (the record is not enough
to rebuild the prompt); without network, `--context <json>` takes a fixture.
`--dir <folder>` replays every *.json in it and prints one line per call.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

from sim import timing as T
from sim.timing import Say, Scenario

# ── record → scenario ──────────────────────────────────────────────────────

def _segments(vad: List[List[float]]) -> List[List[float]]:
    """[t, 1/0] events → [[start, stop], …]. An unclosed start ends 0.5 s later."""
    out, start = [], None
    for t, on in vad:
        if on and start is None:
            start = t
        elif not on and start is not None:
            if t - start >= 0.15:
                out.append([start, t])
            start = None
    if start is not None:
        out.append([start, start + 0.5])
    return out


def scenario_from_record(rec: Dict[str, Any], key: str, checks) -> Scenario:
    """Caller turns from the (acoustic) VAD segments; each takes the finals that
    landed between its onset and 3 s after its stop, and those finals are
    re-emitted at their RECORDED times (Say.final_times), mid-speech or after.
    A segment with no final is an UNHEARD turn (finals=[""]).

    Replies: every LLM run the guard let through was recorded with its trigger
    (the last user text) and the model's raw reply, paired by order. The stub
    LLM answers each run with the recorded reply whose trigger best matches
    the run's own last user text — so a pipeline that now runs FEWER times
    (a held short answer, a swallowed re-ask) still gets the right lines, and
    a run that no longer happens simply leaves its reply unused."""
    finals = [(float(t), str(x)) for t, x in rec.get("finals", [])]
    used = set()
    says: List[Say] = []
    for start, stop in _segments(rec.get("vad", [])):
        mine = [(i, t, x) for i, (t, x) in enumerate(finals)
                if i not in used and start - 0.3 <= t <= stop + 3.0]
        for i, _, _ in mine:
            used.add(i)
        texts = [x for _, _, x in mine]
        if not texts and stop - start < 0.4:
            continue                                  # a VAD blip, nothing said
        secs = max(0.4, stop - start)
        if texts:
            says.append(Say(" ".join(texts), secs, at=round(start, 2), finals=texts,
                            final_times=[round(max(t, start + 0.1), 2) for _, t, _ in mine]))
        else:
            says.append(Say("(unheard)", secs, at=round(start, 2), finals=[""], stt_latency=0.4))
    # Finals never attributed to a VAD segment (VAD missed the voice): a short
    # turn at their own time.
    for i, (t, x) in enumerate(finals):
        if i not in used:
            says.append(Say(x, 0.8, at=max(0.0, round(t - 1.0, 2)), finals=[x], final_times=[round(t, 2)]))
    says.sort(key=lambda s: s.at)
    replies = [str(r) for _, r in rec.get("replies", [])]
    runs = [str(r) for _, r in rec.get("runs", [])]
    pairs = list(zip(runs, replies)) if runs else []
    ended = float(rec.get("ended") or 0.0)
    return Scenario(key, caller=says, replies=replies, checks=checks,
                    max_secs=max(20.0, min(ended + 6.0, 420.0)),
                    reply_for=_reply_matcher(pairs) if pairs else None,
                    note=f"replay of live call; {len(says)} caller turns, {len(replies)} replies")


def _reply_matcher(pairs):
    """Closure: best unconsumed recorded reply for a run's last user text."""
    import difflib
    from app.turntake import normalize_spoken
    left = [(normalize_spoken(trig), reply) for trig, reply in pairs]

    def pick(last_user: str):
        if not left:
            return None
        q = normalize_spoken(last_user or "")
        best, score = 0, -1.0
        for i, (trig, _) in enumerate(left):
            r = difflib.SequenceMatcher(None, trig[-200:], q[-200:]).ratio()
            if r > score:
                best, score = i, r
        if score < 0.45:
            best = 0                                  # nothing close: take the next in order
        return left.pop(best)[1]
    return pick


# ── invariants ─────────────────────────────────────────────────────────────

def _key(s: str) -> str:
    from app.turntake import spoken_key
    return spoken_key(s)


def _sentences(text: str) -> List[str]:
    import re
    return [p.strip() for p in re.split(r"(?<=[.!?।])\s+", text or "") if p.strip()]


def invariants(res: Dict[str, Any]) -> List[str]:
    """What must hold for ANY call, whatever its shape."""
    from app.turntake import caller_checking_presence, caller_asked_to_repeat
    f: List[str] = []
    tr = res.get("transcript", [])
    bot_texts = [t["text"] for t in tr if t["role"] == "assistant"]
    # 1. the opening is said once. After the person has spoken, its first
    #    words must not come back (screener flag, re-greet).
    if bot_texts:
        opening = " ".join(bot_texts[0].split()[:6])
        seen_user = False
        for t in tr[1:]:
            if (t["role"] == "user" and not caller_checking_presence(t["text"])
                    and not caller_asked_to_repeat(t["text"])):
                seen_user = True                      # a substantive turn: the person is here
            elif t["role"] == "assistant" and seen_user and opening and _key(opening) in _key(t["text"]):
                f.append(f"opening replayed mid-call: {opening!r}")
                break
    # 2. no sentence of 5+ words is played twice, unless the caller asked for
    #    it (hello? / say again) in between.
    said: Dict[str, int] = {}
    for idx, t in enumerate(tr):
        if t["role"] != "assistant":
            continue
        for s in _sentences(t["text"]):
            if len(s.split()) < 5:
                continue
            k = _key(s)
            if k in said:
                between = [u["text"] for u in tr[said[k] + 1:idx] if u["role"] == "user"]
                if not any(caller_checking_presence(u) or caller_asked_to_repeat(u) for u in between):
                    f.append(f"said twice: {s[:60]!r}")
            said[k] = idx
    # 3. nothing letterless reaches the TTS
    for s in res.get("tts_texts", []):
        if not any(ch.isalnum() for ch in s):
            f.append(f"letterless text sent to TTS: {s!r}")
    # 4. reply latency (caller stop → bot audio)
    lat = res.get("turn_latency", [])
    slow = [x for x in lat if x > 4.0]
    if slow:
        f.append(f"reply latency over 4 s: {slow}")
    # 5. talk-over: bot audio that STARTS inside a caller turn longer than 1 s
    for cs, ce in res.get("caller", []):
        if ce - cs <= 1.0:
            continue
        for bs, _ in res.get("bot", []):
            if cs + 0.4 < bs < ce - 0.3:
                f.append(f"bot started talking at {bs:.1f}s over the caller ({cs:.1f}–{ce:.1f}s)")
                break
    ended = res.get("ended_at")
    finals = res.get("finals", [])
    # 6. a backchannel must not cost a silence. Call 1e374b99 (2026-09-17):
    #    fifteen "हम्म" / "ठीक है" / "Okay"s each cut the reply and cost
    #    1.7-5.9 s of nothing while the model re-generated what was already
    #    written — and the re-generated sentence came back short.
    for cs, ce in res.get("caller", []):
        words = [x for t, x in finals if cs - 0.3 <= t <= ce + 3.0 and x.strip()]
        if not words or len(" ".join(words).split()) > 3:
            continue                                   # not a backchannel
        if ended is not None and ce > ended - 1.5:
            continue
        spoke_before = any(bs < cs < be + 0.5 for bs, be in res.get("bot", []))
        if not spoke_before:
            continue                                   # they were not talking over us
        nxt = [bs for bs, _ in res.get("bot", []) if bs >= ce - 0.2]
        gap = (nxt[0] - ce) if nxt else 99.0
        if gap > 2.0:
            f.append(f"backchannel {' '.join(words)[:20]!r} at {cs:.1f}s cost "
                     f"{gap:.1f}s of silence before the bot spoke again")
    # 7. every heard caller turn gets a reply (audio within 5 s), unless the call ended
    for cs, ce in res.get("caller", []):
        heard = any(cs <= t <= ce + 3.0 and x.strip() for t, x in finals)
        if not heard:
            continue
        if ended is not None and ce > ended - 1.0:
            continue
        if not any(cs <= bs <= ce + 5.0 for bs, _ in res.get("bot", [])):
            f.append(f"caller turn at {cs:.1f}s got no reply within 5 s")
    return f


# ── run ────────────────────────────────────────────────────────────────────

async def _context_for(corr: str | None, agent: str | None, ctx_file: str | None) -> Dict[str, Any]:
    if ctx_file:
        return json.loads(Path(ctx_file).read_text(encoding="utf-8"))
    if corr:
        try:
            from app.admin_core import get_call_context
            return await get_call_context(corr, agent or None)
        except Exception as e:  # noqa: BLE001
            print(f"context fetch failed ({type(e).__name__}: {str(e)[:80]}) — using the yoga fixture",
                  file=sys.stderr)
    return json.loads((T.FIXTURE_DIR / "yoga_agent_context.json").read_text(encoding="utf-8"))


async def replay_one(rec: Dict[str, Any], corr: str, ctx: Dict[str, Any], verbose: bool) -> Dict[str, Any]:
    sc = scenario_from_record(rec, f"replay-{corr[:8]}", invariants)
    res = await T.run_scenario(sc, ctx, verbose)
    res["caller_turns"] = len(sc.caller)
    res["replies"] = len(sc.replies)
    return res


async def main():
    import os, tempfile
    os.environ.setdefault("TTS_CACHE_DIR", tempfile.mkdtemp(prefix="sim-replay-cache-"))
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", help="one replay record (json)")
    ap.add_argument("--dir", help="folder of replay records (*.json), one run each")
    ap.add_argument("--corr", default="", help="call corr id — fetches the agent context from admin-core")
    ap.add_argument("--context", help="agent context json (offline alternative to --corr)")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--out", default="sim_replay.json")
    ap.add_argument("--ci", action="store_true")
    args = ap.parse_args()
    files = [Path(args.file)] if args.file else sorted(Path(args.dir).glob("*.json"))
    results = []
    for fp in files:
        rec = json.loads(fp.read_text(encoding="utf-8"))
        corr = args.corr or fp.stem.replace("replay_", "")
        ctx = await _context_for(corr if not args.context else None, rec.get("agent"), args.context)
        try:
            res = await replay_one(rec, corr, ctx, args.verbose)
        except Exception as e:  # noqa: BLE001
            res = {"key": corr, "fails": [f"run error: {type(e).__name__}: {str(e)[:160]}"]}
        res["corr"] = corr
        results.append(res)
        st = "FAIL" if res["fails"] else "ok  "
        print(f"{st} {corr[:8]} turns {res.get('caller_turns', '?')} replies {res.get('replies', '?')} "
              f"latency {res.get('turn_latency')} ended {res.get('ended_at')}")
        for x in res["fails"]:
            print(f"       ✗ {x}")
    Path(args.out).write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"report → {args.out}")
    if args.ci and any(r["fails"] for r in results):
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
