"""Verify V421 landed, through the code path that actually consumes it.

A green deploy tick does not prove a migration ran (it shipped the wrong image once
today already). This asks admin_core for a real call context using the voice bot's
own credentials, so a pass proves: admin_core is serving, the ai_agent query works
with the new column, AND tts_model reaches the bot exactly as the pricing depends on.
"""
import asyncio, json, sys
sys.path.insert(0, "/srv")

from app.admin_core import get_call_context
from app.bot import _agent_tts_model, _agent_voice

async def main():
    # No agent id -> exercises defaultAgent(), which V421's commit also stamps.
    ctx = await get_call_context("verify-v421", None)
    if not ctx:
        print("FAIL: no call context returned (admin_core unreachable or rejecting us)")
        return 2
    agent = ctx.get("agent") or {}
    print("default persona:")
    print("  keys        :", sorted(agent.keys()))
    print("  tts_model   :", repr(agent.get("tts_model")))
    print("  voice       :", repr(agent.get("voice")))
    print("  resolved -> engine=%r voice=%r"
          % (_agent_tts_model(agent), _agent_voice(agent)))
    if "tts_model" not in agent:
        print("\nFAIL: admin_core did not emit tts_model — old image, or the key was dropped")
        return 2
    if _agent_tts_model(agent) != "sarvam":
        print("\nFAIL: the built-in persona must stay on sarvam (billing assumes it)")
        return 2
    print("\nOK: admin_core is serving the new contract and the bot resolves it")
    return 0

sys.exit(asyncio.run(main()))
