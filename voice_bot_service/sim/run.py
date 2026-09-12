"""Run scripted callers against the real agent prompt + real LLM + real text gates.

    python -m sim.run                                  # prod model, all personas
    python -m sim.run --model vertex:gemini-2.5-flash --personas cut_the_call,greeter_echo
    python -m sim.run --model bedrock:qwen.qwen3-235b-a22b-2507-v1:0 --reps 3
    python -m sim.run --agent b6337c6e-...             # live agent context from admin-core
    python -m sim.run --ci                             # exit 1 on any hard fail

Cost: LLM tokens only (~₹0.5 per simulated call on Gemini Flash). No TTS, no STT.
Not covered: how the voice sounds, real line acoustics, STT mishearings."""
from __future__ import annotations

import argparse
import asyncio
import copy
import json
import os
import statistics
import sys
import time
from pathlib import Path

from app import bot as b
from app.turntake import caller_wants_to_end
from sim import gates as g
from sim.grader import grade, judge
from sim.llm import make_chat, spec_for_provider
from sim.personas import BY_KEY, PERSONAS

FIXTURE = Path(__file__).parent / "fixtures" / "yoga_agent_context.json"
CALLER_SPEC_DEFAULT = "vertex:gemini-2.5-flash"


async def load_context(agent_id: str | None):
    if agent_id:
        from app.admin_core import get_call_context
        return await get_call_context(f"sim-{int(time.time())}", agent_id)
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


async def simulate(persona, base_ctx, agent_chat, caller_chat, max_tokens=180):
    ctx = copy.deepcopy(base_ctx)
    ctx["leadName"] = persona.lead_name
    agent = ctx.get("agent") or {}
    system = b.build_system_prompt(ctx)
    opening = b._clean_opening(b._fill_placeholders((agent.get("openingLine") or "").strip(), ctx))
    gates = g.TextGates()
    convo, history = [], []
    ttfts = []
    if opening:
        sp = gates.pass_reply(opening)
        convo.append({"role": "assistant", "text": sp.text, "raw": opening, "ended": False})
        history.append({"role": "assistant", "content": opening})
    caller_hist = [{"role": "user", "content": f"The caller you are speaking to just said: {opening or 'Hello?'}"}]
    ended = False
    for turn in range(persona.max_turns):
        caller_text, _ = await caller_chat(persona.brief, caller_hist, 80, 0.8)
        caller_text = caller_text.strip().strip('"')
        hangup = "[HANGUP]" in caller_text
        caller_text = caller_text.replace("[HANGUP]", "").strip()
        if not caller_text:
            caller_text = "Hmm."
        convo.append({"role": "user", "text": caller_text})
        history.append({"role": "user", "content": caller_text})
        caller_hist.append({"role": "assistant", "content": caller_text})
        gates.note_user(caller_text)
        # Mirror the turn-gate's forced close (TranscriptCollector +
        # SentinelGate): the caller asked to stop, so the model is cued for one
        # goodbye line and the call ends after it whatever the model wrote.
        forced = caller_wants_to_end(caller_text)   # the opening has already been spoken
        if forced:
            history.append({"role": "user", "content":
                            "[The caller just asked to end this call. Reply with ONE short, polite "
                            "goodbye line — no question, no offer, no clarification, no pitch — and "
                            "append " + b.END_MARKER + ".]"})
        raw, ttft = await agent_chat(system, history, max_tokens, float(agent.get("temperature") or 0.6))
        ttfts.append(ttft)
        sp = gates.pass_reply(raw)
        if forced:
            sp.ended = True
        convo.append({"role": "assistant", "text": sp.text, "raw": raw, "ended": sp.ended,
                      "dropped": sp.dropped, "sends": sp.sends, "had_markup": sp.had_markup})
        history.append({"role": "assistant", "content": raw})
        caller_hist.append({"role": "user", "content": sp.text or "(silence)"})
        if sp.ended or sp.transfer or hangup:
            ended = True
            break
    return convo, ttfts, ended


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="prod", help="prod | vertex:… | sarvam:… | bedrock:… | openrouter:… | zai:…")
    ap.add_argument("--caller", default=CALLER_SPEC_DEFAULT)
    ap.add_argument("--judge", default=os.environ.get("SIM_JUDGE", "vertex:gemini-2.5-flash"))
    ap.add_argument("--personas", default="all")
    ap.add_argument("--reps", type=int, default=1)
    ap.add_argument("--agent", default=None, help="live agent id (fetches its context from admin-core)")
    ap.add_argument("--out", default=os.environ.get("SIM_OUT", "sim_report.json"))
    ap.add_argument("--ci", action="store_true", help="exit 1 if any persona has a hard fail")
    ap.add_argument("--min-judge", type=float, default=0.0)
    ap.add_argument("--soft-errors", action="store_true",
                    help="a run error (auth, network) is reported but does not fail --ci")
    args = ap.parse_args()

    spec = spec_for_provider() if args.model == "prod" else args.model
    agent_chat, caller_chat, judge_chat = make_chat(spec), make_chat(args.caller), make_chat(args.judge)
    base_ctx = await load_context(args.agent)
    keys = [p.key for p in PERSONAS] if args.personas == "all" else args.personas.split(",")
    print(f"model {spec} | caller {args.caller} | judge {args.judge} | agent {(base_ctx.get('agent') or {}).get('name')} | reps {args.reps}\n")
    report = {"model": spec, "runs": []}
    any_fail = False
    for key in keys:
        persona = BY_KEY[key]
        for rep in range(args.reps):
            try:
                convo, ttfts, ended = await simulate(persona, base_ctx, agent_chat, caller_chat)
                res = grade(persona, convo, persona.lead_name)
                jd = await judge(judge_chat, convo)
            except Exception as e:  # noqa: BLE001
                convo, ttfts, ended = [], [], False
                res, jd = {"fails": [f"run error: {type(e).__name__}: {str(e)[:120]}"], "warns": []}, {"score": -1, "problems": []}
            hard = [f for f in res["fails"] if not (args.soft_errors and f.startswith("run error"))]
            fail = bool(hard) or bool(args.min_judge and 0 <= jd["score"] < args.min_judge)
            any_fail |= fail
            status = "FAIL" if fail else "ok  "
            ttft = f"{statistics.median(ttfts)*1000:4.0f}ms" if ttfts else "  n/a"
            print(f"{status} {key:26s} judge {jd['score']:>2}/10  ttft {ttft}  turns {sum(1 for t in convo if t['role']=='assistant')}"
                  f"{'  ended' if ended else ''}")
            for f_ in res["fails"]:
                print(f"       ✗ {f_}")
            for w in res["warns"]:
                print(f"       ~ {w}")
            for p in jd["problems"][:3]:
                print(f"       · {p}")
            report["runs"].append({"persona": key, "rep": rep, "fails": res["fails"], "warns": res["warns"],
                                   "judge": jd, "ttft_ms": [round(t * 1000) for t in ttfts], "ended": ended,
                                   "transcript": convo})
    scores = [r["judge"]["score"] for r in report["runs"] if r["judge"]["score"] >= 0]
    fails = sum(1 for r in report["runs"] if r["fails"])
    print(f"\n{len(report['runs'])} runs · {fails} with hard fails · judge mean {statistics.mean(scores):.1f}/10" if scores else "")
    Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"report → {args.out}")
    if args.ci and any_fail:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
