"""What does the live model say when the person comes back from putting us on hold?

Synthetic conversation shaped like call 6d81124d (names changed): the bot asked a
question, the person put the call on hold (the hold recording never reaches the
model), then came back. Pass = no re-introduction, a short acknowledgement AND the
conversation carried on in the same reply (an acknowledgement-only reply would make
the repeat guard ask for a second line — two replies for one moment).
"""
import asyncio
import json
import os
import re
import sys

sys.path.insert(0, os.getcwd())

from app.bot import HOLD_RESUME_CUE, build_system_prompt, _fill_placeholders  # noqa: E402
from sim.llm import make_chat  # noqa: E402

CTX = json.load(open("sim/fixtures/hindi_parent_agent_context.json"))
OPENING = _fill_placeholders(CTX["agent"]["openingLine"], CTX, full_name=True)
HISTORY = [
    {"role": "assistant", "content": OPENING},
    {"role": "user", "content": "मैं बच्चे का पिता बोल रहा हूँ बोलिए।"},
    {"role": "assistant", "content": "जी सर, धन्यवाद। क्या मैं बच्चे के बारे में थोड़ा जान सकती हूँ — "
                                     "नाम क्या है और अभी किस class में पढ़ रहा है?"},
    {"role": "user", "content": "नाम आरव है और वो seventh में है।"},
    {"role": "assistant", "content": "आरव अभी Class 7 में है। क्या मैं जान सकती हूँ कि आरव के previous "
                                     "class में कितने marks आए थे?"},
]
RETURNS = ["Hello.", "हाँ जी बताइए, अभी वापस आया।", "हाँ बोलिए।"]
REINTRO = re.compile(r"मैं श्रेया|श्रेया बोल|Shiksha Nation से|inquiry की थी|ICA से", re.I)
ACK_ONLY = re.compile(r"^\W*(जी|हाँ|हां|जी सर|हाँ जी|जी हाँ)?[\s,।.!]*(मैं यहीं हूँ|मैं यहीं हूं|मैं यहाँ हूँ)?[\s,।.!]*$")


async def main():
    system = build_system_prompt(CTX)
    chat = make_chat("vertex:gemini-2.5-flash")
    runs = int(os.environ.get("RUNS", "6"))
    fails = 0
    total = 0
    for ret in RETURNS:
        for i in range(runs):
            msgs = HISTORY + [{"role": "user", "content": ret}, {"role": "user", "content": HOLD_RESUME_CUE}]
            text, ttft = await chat(system, msgs, 300, 0.7)
            text = (text or "").strip()
            total += 1
            bad = []
            if REINTRO.search(text):
                bad.append("RE-INTRO")
            if ACK_ONLY.match(text):
                bad.append("ACK-ONLY")
            if "marks" not in text and "नंबर" not in text and "?" not in text and "?" not in text:
                bad.append("NO-CARRY-ON")
            fails += bool(bad)
            print(f"RESUME,{ret[:12]!r},{i},{'FAIL ' + '+'.join(bad) if bad else 'ok'},{text!r}")
    print(f"RESUME_DONE {total - fails}/{total} ok")


asyncio.run(main())
