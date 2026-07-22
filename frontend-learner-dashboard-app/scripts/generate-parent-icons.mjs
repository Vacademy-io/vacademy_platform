#!/usr/bin/env node
/**
 * One-off generator for the parent-portal icons that don't already exist in
 * src/assets/cleaner-play/ (five of six modules are already covered). Style-matches
 * the existing felted-clay set. Mirrors ai_service/app/services/image_service.py.
 *
 *   OPENROUTER_API_KEY=sk-... node scripts/generate-parent-icons.mjs
 *   OPENROUTER_API_KEY=sk-... node scripts/generate-parent-icons.mjs --only=payments --force
 *
 * Commits ONLY the optimised .webp (raw PNGs are ~1MB each and would bloat every
 * OTA bundle) — the raw/ dir is gitignored. sharp is optional: if absent, raw
 * PNGs are written and you optimise before committing.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
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

// For friendly CHARACTER mascots (people allowed) — matches the hero-greeting mascot.
const CHARACTER_STYLE =
  "Matte felted-clay / soft plasticine texture with visible fibre grain, chunky rounded friendly " +
  "shapes, big warm smile. Soft warm palette: peach, terracotta, cream, sage, warm off-white. Soft " +
  "diffused studio lighting from upper left, gentle contact shadow. Fully transparent background. " +
  "No text, no letters, no numbers, no UI. Isolated app-icon style, centred, generous even padding, " +
  "square 1:1 composition. Cheerful, warm, approachable — legible at 56 pixels.";

// Each: { subject, character? }. character:true uses CHARACTER_STYLE (people allowed).
const ICONS = {
  payments: { subject: "a small stack of coins beside a paid receipt with a checkmark" },
  attention: { subject: "a soft rounded bell with a gentle glow" },
  "chat-teacher": {
    subject:
      "a friendly cartoon teacher character shown from the chest up, warm welcoming smile, one hand " +
      "raised waving hello, holding a small book, wearing simple smart clothes",
    character: true,
  },
};

function prompt(entry) {
  return `A single 3D rendered icon of ${entry.subject}. ${entry.character ? CHARACTER_STYLE : STYLE}`;
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
    console.log(`generating ${key_}...`);
    const res = await fetch(URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt(entry) }],
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
      await sharp(buf).resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 90 }).toFile(webpPath);
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
