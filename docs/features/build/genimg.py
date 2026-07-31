#!/usr/bin/env python3
"""Generate the admin-demo imagery via OpenRouter and write web-sized JPEGs.

Run from build/:  OPENROUTER_API_KEY=... python3 genimg.py
Images land in build/assets/ and are inlined as data URIs at build time.
"""
import base64, io, json, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

KEY = os.environ["OPENROUTER_API_KEY"]
OUT = "assets"
NEG = " Photographic, realistic, no text, no lettering, no signage, no watermarks, no logos, no people's faces."

SHOTS = [
    ("course-ai-ml", "Editorial photograph of a modern data-science workspace: an open laptop showing an abstract glowing neural-network node graph in orange and indigo, a notebook with handwritten equations beside it, soft daylight, shallow depth of field, clean minimal desk."),
    ("course-biology-med", "Editorial photograph of a medical anatomy study desk: a detailed anatomical model of a human heart, a stethoscope coiled beside it, thick reference books, soft clinical daylight, clean neutral background."),
    ("course-robotics", "Editorial photograph of a STEM robotics workbench: a small educational robot with a servo arm, a breadboard with colourful jumper wires and a microcontroller, bright natural daylight, clean minimal background."),
    ("course-genai", "Editorial photograph of a bright classroom desk: a tablet propped up displaying abstract flowing generative gradient art in warm orange tones, a teacher's notebook and a cup of coffee, warm daylight, minimal composition."),
    ("course-physiology", "Editorial photograph of a physiology lab bench: a monitor showing an abstract ECG waveform, a blood-pressure cuff and a microscope, cool clinical daylight, clean composition."),
    ("course-iot", "Editorial macro photograph of IoT electronics on a clean workbench: circuit boards, small sensors, a soldering iron and neat coils of wire, cool daylight, shallow depth of field."),
    ("copilot-before", "Editorial photograph of a teacher's desk before class: an open lesson-plan notebook, a fountain pen, a cup of coffee, a small potted plant and a closed laptop, warm morning light, minimal and tidy."),
    ("copilot-in", "Editorial photograph of a modern empty classroom seen from the back: a large glowing presentation screen at the front, tidy rows of desks, warm interior lighting, no people."),
    ("copilot-after", "Editorial photograph of a desk during a performance review: printed sheets with abstract bar and line charts, a magnifying glass and a pen resting on top, soft directional light."),
    ("product-ai", "Editorial photograph of a cosy evening study: a laptop on a warm wooden desk showing abstract flowing data visualisation in orange, a desk lamp glowing, books stacked nearby."),
    ("product-med", "Editorial photograph of a medical student's study table in a warm library: an open anatomy atlas, a small skeleton model, highlighters and a lamp, golden interior light."),
    ("product-robotics", "Editorial photograph of a bright children's robotics workshop table: colourful robot kits, plastic gears, small tools and building blocks neatly arranged, cheerful daylight, no people."),
    ("shot-gripper", "Editorial close-up photograph of a robotic gripper picking up a bright coloured wooden block on a workbench, crisp daylight, shallow depth of field."),
    ("shot-board", "Editorial macro photograph of a microcontroller board with glowing blue and orange LEDs and neat wiring, dark moody background, dramatic light."),
    ("shot-assembly", "Editorial top-down photograph of hands assembling a small robot chassis with a screwdriver, parts laid out neatly on a light workbench, bright even daylight."),
    ("shot-final", "Editorial studio photograph of a finished small line-following robot on a white table beside a black track line, bright soft studio lighting, clean background."),
    ("live-session", "Editorial photograph of an online teaching setup: a laptop on a desk with a ring light, a podcast microphone and a notebook, warm evening light, no people."),
]

def gen(item):
    name, prompt = item
    body = json.dumps({"model": "krea/krea-2-large", "prompt": prompt + NEG,
                       "resolution": "1K", "aspect_ratio": "16:9"}).encode()
    req = urllib.request.Request("https://openrouter.ai/api/v1/images", data=body,
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer " + KEY})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            data = json.load(r)
        raw = base64.b64decode(data["data"][0]["b64_json"])
    except Exception as e:
        print("FAIL", name, e); return None

    im = Image.open(io.BytesIO(raw)).convert("RGB")
    # card banners are 2:1 — centre-crop, then size for retina and compress hard
    w, h = im.size
    th = w / 2
    if th <= h:
        top = (h - th) / 2
        im = im.crop((0, int(top), w, int(top + th)))
    im = im.resize((640, 320), Image.LANCZOS)
    im.save(f"{OUT}/{name}.jpg", "JPEG", quality=72, optimize=True, progressive=True)
    print("ok", name, os.path.getsize(f"{OUT}/{name}.jpg") // 1024, "KB")
    return name

os.makedirs(OUT, exist_ok=True)
with ThreadPoolExecutor(max_workers=4) as ex:
    done = [x for x in ex.map(gen, SHOTS) if x]
print(f"\n{len(done)}/{len(SHOTS)} generated")
