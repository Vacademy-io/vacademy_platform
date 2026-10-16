"""Live model: does a non-education agent still invent an education product?

AAIBUZZ / IRPL calls c43e9ce7, e6cb5f47 (2026-10-16): a 512-char generic script and
~3,900 tokens of education-flavoured platform rules — the model invented "AI learning
programs for children" and booked a demo. Old vs new prompt (rendered from b33f3d8ce9
and the grounding fix), plus a well-scripted non-education control that must still
pitch its own product and offer its own site survey.
"""
import asyncio
import os
import re
import sys

sys.path.insert(0, os.getcwd())
from sim.llm import make_chat  # noqa: E402

D = os.path.join(os.path.dirname(__file__), "grounding")
P = {k: open(os.path.join(D, f"{k}.txt")).read() for k in ("old_aaibuzz", "new_aaibuzz", "new_solar")}
OPEN = {"aaibuzz": "Hello, is this Rahul Sharma? I am calling from AAIBUZZ.",
        "solar": "Hello, kya main Rahul Sharma se baat kar rahi hoon? Main SunRay Energy se bol rahi hoon."}
EDU = re.compile(r"\b(child|children|kids?|students?|schools?|class(es)?|courses?|learning|edtech|academic|tuition|"
                 r"exam|marks|syllabus|teacher)\b|बच्च|पढ़|क्लास|स्कूल|छात्र|एडटेक|कोर्स|लर्निंग|एकेडमिक|शिक्षा", re.I)
BOOK = re.compile(r"\b(book|booking|schedule|slot)\b|(?<!फेस)बुक|\b\d{1,2}\s*(am|pm)\b|five pm|eleven am|शाम|कल सुबह|आज शाम", re.I)
SOLAR = re.compile(r"solar|सोलर|rooftop|रूफटॉप|survey|सर्वे|subsidy|सब्सिडी|panel|पैनल|bill|बिल", re.I)
RUNS = int(os.environ.get("RUNS", "6"))


async def turn(chat, system, msgs):
    text, _ = await chat(system, msgs, 300, 0.7)
    return (text or "").strip().replace("\n", " ")


async def main():
    chat = make_chat("vertex:gemini-2.5-flash")
    stats = {}
    for prompt in ("old_aaibuzz", "new_aaibuzz", "new_solar"):
        kind = "solar" if "solar" in prompt else "aaibuzz"
        base = [{"role": "assistant", "content": OPEN[kind]}]
        scen = {
            "tell_me": ["Okay tell me."],
            "why_call": ["हाँ बताइए, आपने call क्यों किया?"],
            "what_offer": ["आप लोग exactly क्या offer करते हो?"],
        }
        for name, lines in scen.items():
            for i in range(RUNS):
                r = await turn(chat, P[prompt], base + [{"role": "user", "content": lines[0]}])
                edu, book = bool(EDU.search(r)), bool(BOOK.search(r))
                sol = bool(SOLAR.search(r))
                stats.setdefault((prompt, name), []).append((edu, book, sol))
                print(f"R,{prompt},{name},{i},edu={edu},book={book},solar={sol},{r[:220]!r}", flush=True)
        # Two turns: whatever it said first, then the caller asks for the next step.
        ask = "ठीक है, demo दिखा दो।" if kind == "aaibuzz" else "ठीक है, survey kab ho sakta hai?"
        for i in range(RUNS):
            m = base + [{"role": "user", "content": "Okay tell me."}]
            first = await turn(chat, P[prompt], m)
            r = await turn(chat, P[prompt], m + [{"role": "assistant", "content": first},
                                                  {"role": "user", "content": ask}])
            edu = bool(EDU.search(first) or EDU.search(r))
            book, sol = bool(BOOK.search(r)), bool(SOLAR.search(first + r))
            stats.setdefault((prompt, "next_step"), []).append((edu, book, sol))
            print(f"R,{prompt},next_step,{i},edu={edu},book={book},solar={sol},{first[:140]!r} || {r[:200]!r}", flush=True)
    print("SUMMARY prompt,scenario,runs,edu,book,solar")
    for (prompt, name), v in stats.items():
        print(f"SUMMARY,{prompt},{name},{len(v)},{sum(x[0] for x in v)},{sum(x[1] for x in v)},{sum(x[2] for x in v)}")


asyncio.run(main())
