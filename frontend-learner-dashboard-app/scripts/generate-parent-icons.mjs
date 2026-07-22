#!/usr/bin/env node
/**
 * One-off generator for the parent-portal icons + the assistant "teacher" frames.
 * Style-matches the existing felted-clay set. Mirrors ai_service/app/services/image_service.py.
 *
 *   OPENROUTER_API_KEY=sk-... node scripts/generate-parent-icons.mjs
 *   OPENROUTER_API_KEY=sk-... node scripts/generate-parent-icons.mjs --only=chat-teacher --force
 *
 * IMPORTANT — the assistant teacher frames render on the LIGHT "playful-clean"
 * theme (pure-white app background). Gemini image gen does NOT emit real alpha —
 * asking for a "transparent background" makes it paint a literal CHECKERBOARD.
 * So we render on a SOLID WHITE background, which blends invisibly on the white
 * assistant screen (no visible box). The mouth-open / thinking frames are made by
 * IMAGE EDITING the base frame (`from`) so it stays the exact same character.
 *
 * Commits ONLY the optimised .webp (raw PNGs are ~1MB each) — raw/ is gitignored.
 * sharp is optional: if absent, raw PNGs are written and you optimise before committing.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "src", "assets", "parent-icons");
const RAW = join(OUT, "raw");
const MODEL = "google/gemini-3.1-flash-image";
const URL = "https://openrouter.ai/api/v1/chat/completions";

const STYLE =
  "Matte felted-clay / soft plasticine texture with visible fibre grain. One centred object, " +
  "chunky rounded friendly shapes, no sharp edges. Soft warm palette: peach, terracotta, cream, " +
  "warm off-white. Soft diffused studio lighting from upper left, gentle contact shadow. Fully " +
  "transparent background. No text, no letters, no numbers, no UI, no hands, no people. Isolated " +
  "app-icon style, generous even padding, square 1:1 composition. Cheerful, warm, approachable — " +
  "legible at 56 pixels.";

// For the friendly CHARACTER mascot frames (people allowed) — rendered on SOLID
// WHITE so they blend on the light playful-clean assistant screen (no checkerboard,
// no visible box). NEVER ask for transparency here — the model paints a checkerboard.
const CHARACTER_STYLE =
  "Matte felted-clay / soft plasticine texture with visible fibre grain, chunky rounded friendly " +
  "shapes. Soft warm palette: peach, terracotta, cream, sage, warm off-white. Soft diffused studio " +
  "lighting from upper left. Solid pure white background (#FFFFFF) — no checkerboard, no transparency, " +
  "no border, no shadow cast onto the background. Character shown from the chest up, centred, generous " +
  "even padding, square 1:1 composition. Cheerful, warm, approachable, legible at 56 pixels. No text, " +
  "no letters, no numbers, no UI.";

// A fixed identity so the three frames read as the SAME teacher.
const TEACHER_IDENTITY =
  "a friendly female cartoon teacher with short auburn bob hair, rosy cheeks, wearing a sage-green " +
  "cardigan over a cream top";

// Each: { subject, character?, from? }. character:true → CHARACTER_STYLE (people allowed).
// from:"<key>" → edit that already-generated frame instead of generating from scratch,
// so the variant keeps the identical character (only the mouth / pose changes).
const ICONS = {
  payments: { subject: "a small stack of coins beside a paid receipt with a checkmark" },
  attention: { subject: "a soft rounded bell with a gentle glow" },
  // Base frame — mouth closed, waving hello.
  "chat-teacher": {
    subject: `${TEACHER_IDENTITY}, warm welcoming closed-mouth smile, one hand raised waving hello, holding a small book`,
    character: true,
  },
  // Speaking frame — identical character, ONLY the mouth opens.
  "chat-teacher-talk": {
    from: "chat-teacher",
    subject:
      "the exact same teacher character, identical auburn bob hair, identical sage-green cardigan, " +
      "identical pose, framing, lighting and colours — change ONLY the mouth to open in a friendly " +
      "mid-speech expression (a warm open smile as if talking)",
    character: true,
  },
  // Thinking frame — identical character, hand on chin, eyes up.
  "chat-teacher-think": {
    from: "chat-teacher",
    subject:
      "the exact same teacher character, identical auburn bob hair, identical sage-green cardigan, " +
      "identical framing, lighting and colours — change the pose to thinking: one hand resting on the " +
      "chin, eyes looking gently upward, a curious closed-mouth expression",
    character: true,
  },
};

function prompt(entry) {
  const style = entry.character ? CHARACTER_STYLE : STYLE;
  if (entry.from) {
    return `Using the provided reference image, generate ${entry.subject}. Keep the identical felted-clay art style. ${style}`;
  }
  return `A single 3D rendered icon of ${entry.subject}. ${style}`;
}

// Build the chat "content": text-only, or text + the reference image for editing.
function buildContent(entry) {
  const text = prompt(entry);
  if (!entry.from) return text;
  const refPath = join(RAW, `${entry.from}.png`);
  if (!existsSync(refPath)) {
    throw new Error(`edit base ${entry.from}.png not found — generate ${entry.from} first (run without --only)`);
  }
  const b64 = readFileSync(refPath).toString("base64");
  return [
    { type: "text", text },
    { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
  ];
}

async function main() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error("ERROR: OPENROUTER_API_KEY is not set. Aborting (no placeholder key is used).");
    process.exit(1);
  }
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.split("=")[1] : null;
  const force = process.argv.includes("--force");

  mkdirSync(RAW, { recursive: true });

  let sharp = null;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.warn("sharp not installed — raw PNGs will be written; run the optimize step before committing.");
  }

  for (const [key_, entry] of Object.entries(ICONS)) {
    if (only && key_ !== only) continue;
    const webpPath = join(OUT, `${key_}.webp`);
    if (existsSync(webpPath) && !force) {
      console.log(`skip ${key_} (exists; use --force to regenerate)`);
      continue;
    }
    console.log(`generating ${key_}${entry.from ? ` (edit of ${entry.from})` : ""}...`);
    const res = await fetch(URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: buildContent(entry) }],
        modalities: ["image"],
        image_config: { aspect_ratio: "1:1" },
      }),
    });
    if (!res.ok) {
      console.error(`  API error ${res.status}: ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    const data = await res.json();
    let b64 = null;
    for (const choice of data.choices ?? []) {
      for (const img of choice.message?.images ?? []) {
        const url = img.image_url?.url ?? "";
        if (url) {
          b64 = url.includes(",") ? url.split(",", 2)[1] : url;
          break;
        }
      }
      if (b64) break;
    }
    if (!b64) {
      console.error(`  no image in response for ${key_}`);
      continue;
    }
    const buf = Buffer.from(b64, "base64");
    const rawPath = join(RAW, `${key_}.png`);
    writeFileSync(rawPath, buf);
    if (sharp) {
      // Character frames flatten onto white (they render on the white assistant screen);
      // the abstract icons keep transparency.
      const bg = entry.character ? "#ffffff" : { r: 0, g: 0, b: 0, alpha: 0 };
      let pipe = sharp(buf).resize(256, 256, { fit: "contain", background: bg });
      if (entry.character) pipe = pipe.flatten({ background: "#ffffff" });
      await pipe.webp({ quality: 90 }).toFile(webpPath);
      console.log(`  wrote ${webpPath}`);
    } else {
      console.log(`  wrote ${rawPath} (optimize to ${key_}.webp before committing)`);
    }
  }
  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
