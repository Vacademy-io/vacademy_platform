#!/usr/bin/env python3
"""Generate preview samples for every Google Cloud TTS voice in _GOOGLE_VOICES.

Usage:
    # Dry run — prints cost estimate, synth count, does not spend credits
    python scripts/generate_google_tts_samples.py --dry-run

    # Real run — requires GOOGLE_APPLICATION_CREDENTIALS_JSON + AWS creds in env
    python scripts/generate_google_tts_samples.py

    # Only regenerate one language
    python scripts/generate_google_tts_samples.py --languages "afrikaans,korean"

    # Skip voices already in an existing _GOOGLE_SAMPLE_URLS dict (idempotent reruns)
    python scripts/generate_google_tts_samples.py --skip-existing path/to/existing.py

The script:
  1. Loads the Google TTS voice catalog defined in external_video_generation.py.
  2. Calls Google's voices.list() to verify each voice id is actually offered
     (prevents synthesis failures on hand-typed ids like `xx-YY-Wavenet-Z`).
  3. Synthesizes a ~6s sample per voice in the voice's native language.
  4. Uploads each mp3 to s3://<bucket>/<prefix>/<uuid>-<voice_id>.mp3.
  5. Writes the resulting {voice_id: url} dict as valid Python source to
     stdout (and optionally to --output). Paste it into the
     `_GOOGLE_SAMPLE_URLS` block in external_video_generation.py.

Cost: roughly $0.005 per voice (mix of Chirp3/Neural2/WaveNet, ~120 chars each).
For the full ~300-voice catalog, expect $1-2 of Google TTS spend.
"""
from __future__ import annotations

import argparse
import ast
import json
import os
import sys
import types
import uuid
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
ROUTER_PATH = REPO_ROOT / "app" / "routers" / "external_video_generation.py"

# ---------------------------------------------------------------------------
# Per-language greeting phrases (native language, ~6 seconds of narration).
# Deliberately neutral — sounds like generic narration rather than a greeting
# when auditioned in a dropdown.
# ---------------------------------------------------------------------------
SAMPLE_PHRASES: Dict[str, str] = {
    "english (us)": "Hi, this is a preview of how I sound. I can narrate lessons, stories, and explanations in a clear, natural voice.",
    "english (uk)": "Hello, this is a preview of how I sound. I can narrate lessons, stories, and explanations in a clear, natural voice.",
    "english (australia)": "Hi, this is a preview of how I sound. I can narrate lessons, stories, and explanations in a clear, natural voice.",
    "english (india)": "Hello, this is a preview of how I sound. I can narrate lessons, stories, and explanations in a clear, natural voice.",
    "spanish": "Hola, esta es una muestra de mi voz. Puedo narrar lecciones, historias y explicaciones con claridad.",
    "spanish (us)": "Hola, esta es una muestra de mi voz. Puedo narrar lecciones, historias y explicaciones con claridad.",
    "portuguese (brazil)": "Olá, esta é uma amostra da minha voz. Posso narrar aulas, histórias e explicações com clareza.",
    "portuguese (portugal)": "Olá, esta é uma amostra da minha voz. Posso narrar aulas, histórias e explicações com clareza.",
    "french": "Bonjour, ceci est un aperçu de ma voix. Je peux narrer des leçons, des histoires et des explications avec clarté.",
    "french (canada)": "Bonjour, ceci est un aperçu de ma voix. Je peux narrer des leçons, des histoires et des explications avec clarté.",
    "german": "Hallo, dies ist eine Hörprobe meiner Stimme. Ich kann Lektionen, Geschichten und Erklärungen klar erzählen.",
    "italian": "Ciao, questa è un'anteprima della mia voce. Posso narrare lezioni, storie e spiegazioni in modo chiaro.",
    "dutch": "Hallo, dit is een voorbeeld van mijn stem. Ik kan lessen, verhalen en uitleg duidelijk vertellen.",
    "dutch (belgium)": "Hallo, dit is een voorbeeld van mijn stem. Ik kan lessen, verhalen en uitleg duidelijk vertellen.",
    "danish": "Hej, dette er en prøve på min stemme. Jeg kan fortælle lektioner, historier og forklaringer tydeligt.",
    "finnish": "Hei, tämä on näyte ääneni kuulostamisesta. Voin kertoa oppitunteja, tarinoita ja selityksiä selkeästi.",
    "norwegian": "Hei, dette er en prøve på stemmen min. Jeg kan fortelle leksjoner, historier og forklaringer tydelig.",
    "swedish": "Hej, det här är ett prov på min röst. Jag kan berätta lektioner, berättelser och förklaringar tydligt.",
    "icelandic": "Halló, þetta er sýnishorn af röddinni minni. Ég get sagt frá kennslustundum, sögum og skýringum.",
    "polish": "Cześć, to jest próbka mojego głosu. Mogę opowiadać lekcje, historie i wyjaśnienia w sposób jasny.",
    "russian": "Привет, это образец моего голоса. Я могу читать уроки, истории и объяснения ясным, естественным голосом.",
    "ukrainian": "Привіт, це зразок мого голосу. Я можу розповідати уроки, історії та пояснення чітким голосом.",
    "czech": "Ahoj, toto je ukázka mého hlasu. Mohu vyprávět lekce, příběhy a vysvětlení jasným tónem.",
    "slovak": "Ahoj, toto je ukážka môjho hlasu. Môžem rozprávať lekcie, príbehy a vysvetlenia jasným tónom.",
    "hungarian": "Szia, ez egy minta a hangomról. Világosan és természetesen tudok leckéket, történeteket és magyarázatokat mesélni.",
    "romanian": "Salut, aceasta este o mostră a vocii mele. Pot nara lecții, povești și explicații cu claritate.",
    "bulgarian": "Здравейте, това е проба от моя глас. Мога да разказвам уроци, истории и обяснения ясно.",
    "greek": "Γεια, αυτό είναι ένα δείγμα της φωνής μου. Μπορώ να αφηγούμαι μαθήματα, ιστορίες και εξηγήσεις με σαφήνεια.",
    "arabic": "مرحبًا، هذه عينة من صوتي. يمكنني سرد الدروس والقصص والشروحات بصوت واضح وطبيعي.",
    "hebrew": "שלום, זו דוגמה לקול שלי. אני יכול לספר שיעורים, סיפורים והסברים בצורה ברורה וטבעית.",
    "turkish": "Merhaba, bu sesimin bir örneğidir. Dersleri, hikayeleri ve açıklamaları açık bir sesle anlatabilirim.",
    "afrikaans": "Hallo, dit is 'n voorbeeld van hoe ek klink. Ek kan lesse, stories en verduidelikings duidelik vertel.",
    "catalan": "Hola, aquesta és una mostra de la meva veu. Puc narrar lliçons, històries i explicacions amb claredat.",
    "indonesian": "Halo, ini adalah contoh suara saya. Saya dapat menarasikan pelajaran, cerita, dan penjelasan dengan jelas.",
    "malay": "Helo, ini adalah contoh suara saya. Saya boleh menceritakan pelajaran, cerita, dan penjelasan dengan jelas.",
    "filipino": "Kumusta, ito ay halimbawa ng aking boses. Maaari kong salaysayin ang mga aralin, kuwento, at paliwanag nang malinaw.",
    "vietnamese": "Xin chào, đây là một bản xem trước về giọng nói của tôi. Tôi có thể tường thuật bài học, câu chuyện và lời giải thích rõ ràng.",
    "thai": "สวัสดี นี่คือตัวอย่างเสียงของฉัน ฉันสามารถเล่าบทเรียน เรื่องราว และคำอธิบายได้อย่างชัดเจน",
    "urdu": "ہیلو، یہ میری آواز کا ایک نمونہ ہے۔ میں اسباق، کہانیاں اور وضاحتیں واضح آواز میں بیان کر سکتا ہوں۔",
    "japanese": "こんにちは、これは私の声のサンプルです。レッスンや物語、説明を自然な声でお伝えできます。",
    "korean": "안녕하세요, 이것은 제 목소리의 샘플입니다. 수업과 이야기, 설명을 명확한 목소리로 들려드릴 수 있습니다.",
    "chinese": "你好，这是我的声音样本。我可以用清晰自然的声音讲述课程、故事和讲解。",
    "chinese (taiwan)": "你好，這是我的聲音樣本。我可以用清晰自然的聲音講述課程、故事和講解。",
}


def _load_voice_catalog() -> types.SimpleNamespace:
    """Extract _GOOGLE_VOICES and _GOOGLE_LANG_CODES from the router source
    without importing FastAPI. We parse the file, select only the assignments
    and helper functions that build the voice catalog, and exec that slice.
    """
    source = ROUTER_PATH.read_text()
    tree = ast.parse(source)

    wanted_names = {
        "_CHIRP3_FEMALE", "_CHIRP3_MALE",
        "_chirp3_voices", "_neural2", "_wavenet", "_standard", "_news",
        "_GOOGLE_VOICES", "_GOOGLE_LANG_CODES",
    }

    selected: List[ast.stmt] = []
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name in wanted_names:
            selected.append(node)
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.target.id in wanted_names:
            selected.append(node)
        elif isinstance(node, ast.Assign) and any(
            isinstance(t, ast.Name) and t.id in wanted_names for t in node.targets
        ):
            selected.append(node)

    module_ast = ast.Module(body=selected, type_ignores=[])
    ast.fix_missing_locations(module_ast)
    namespace: Dict[str, object] = {"Dict": Dict, "List": List}
    exec(compile(module_ast, filename=str(ROUTER_PATH), mode="exec"), namespace)

    missing = [n for n in ("_GOOGLE_VOICES", "_GOOGLE_LANG_CODES") if n not in namespace]
    if missing:
        raise RuntimeError(f"Could not extract from router: {missing}")
    return types.SimpleNamespace(
        _GOOGLE_VOICES=namespace["_GOOGLE_VOICES"],
        _GOOGLE_LANG_CODES=namespace["_GOOGLE_LANG_CODES"],
    )


def _google_credentials():
    from google.oauth2 import service_account

    path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if path and Path(path).exists():
        return service_account.Credentials.from_service_account_file(
            path, scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
    raw = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if raw:
        info = json.loads(raw)
        return service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
    raise RuntimeError(
        "Set GOOGLE_APPLICATION_CREDENTIALS (file path) or "
        "GOOGLE_APPLICATION_CREDENTIALS_JSON (inline JSON)."
    )


def _all_google_voice_ids(client) -> set[str]:
    """Fetch every voice Google currently exposes. Used to filter dead ids."""
    result = client.list_voices()
    return {v.name for v in result.voices}


def _iter_voices(
    google_voices: Dict[str, Dict[str, List[Dict[str, str]]]],
    lang_codes: Dict[str, str],
    lang_filter: set[str] | None,
) -> Iterable[Tuple[str, str, str]]:
    """Yield (language_key, voice_id, locale) for every voice to synthesize."""
    for lang_key, gender_map in google_voices.items():
        if lang_filter and lang_key not in lang_filter:
            continue
        locale = lang_codes.get(lang_key)
        if not locale:
            print(f"  ⚠️  no locale mapping for '{lang_key}', skipping", file=sys.stderr)
            continue
        seen: set[str] = set()
        for _gender, voices in gender_map.items():
            for v in voices:
                vid = v["id"]
                if vid in seen:
                    continue
                seen.add(vid)
                yield lang_key, vid, locale


def _synthesize(client, text: str, voice_id: str, locale: str) -> bytes:
    from google.cloud import texttospeech

    synthesis_input = texttospeech.SynthesisInput(text=text)
    voice = texttospeech.VoiceSelectionParams(language_code=locale, name=voice_id)
    audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)
    resp = client.synthesize_speech(input=synthesis_input, voice=voice, audio_config=audio_config)
    return resp.audio_content


def _upload_to_s3(audio: bytes, bucket: str, key: str) -> str:
    import boto3

    s3 = boto3.client("s3")
    s3.put_object(Bucket=bucket, Key=key, Body=audio, ContentType="audio/mpeg")
    return f"https://{bucket}.s3.amazonaws.com/{key}"


def _parse_existing(path: str) -> Dict[str, str]:
    """Extract the dict literal from a Python file or JSON file."""
    text = Path(path).read_text()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    namespace: Dict[str, object] = {}
    exec(text, namespace)  # noqa: S102 — trusted dev input
    for v in namespace.values():
        if isinstance(v, dict) and v and all(isinstance(k, str) for k in v):
            return v  # type: ignore[return-value]
    return {}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Don't synthesize or upload — just report count + cost.")
    parser.add_argument("--languages", default="", help="Comma-separated language keys to limit to (lowercase, e.g. 'afrikaans,korean').")
    parser.add_argument("--bucket", default="vacademy-media-storage", help="S3 bucket for samples.")
    parser.add_argument("--prefix", default="TTS_SAMPLES/GOOGLE", help="Key prefix within the bucket.")
    parser.add_argument("--skip-existing", default="", help="Path to a Python or JSON file containing an existing {voice_id: url} map; those voices are skipped.")
    parser.add_argument("--output", default="", help="Write the emitted dict to this file instead of stdout.")
    parser.add_argument("--prune-catalog", default="", help="Write a cleaned _GOOGLE_VOICES dict (only voices Google actually offers) to this file, then exit. No synthesis or uploads.")
    args = parser.parse_args()

    catalog = _load_voice_catalog()
    google_voices = catalog._GOOGLE_VOICES
    lang_codes = catalog._GOOGLE_LANG_CODES

    if args.prune_catalog:
        from google.cloud import texttospeech  # noqa: F401 — fail fast if missing

        credentials = _google_credentials()
        client = texttospeech.TextToSpeechClient(credentials=credentials)
        available_ids = _all_google_voice_ids(client)

        pruned: Dict[str, Dict[str, List[Dict[str, str]]]] = {}
        dropped: List[str] = []
        for lang_key, gender_map in google_voices.items():
            new_gender_map: Dict[str, List[Dict[str, str]]] = {}
            for gender, voices in gender_map.items():
                kept = [v for v in voices if v["id"] in available_ids]
                dropped.extend(v["id"] for v in voices if v["id"] not in available_ids)
                new_gender_map[gender] = kept
            pruned[lang_key] = new_gender_map

        lines = ["_GOOGLE_VOICES: Dict[str, Dict[str, List[Dict[str, str]]]] = {"]
        for lang_key in sorted(pruned):
            lines.append(f'    "{lang_key}": {{')
            for gender in ("female", "male"):
                voices = pruned[lang_key].get(gender, [])
                if not voices:
                    lines.append(f'        "{gender}": [],')
                    continue
                lines.append(f'        "{gender}": [')
                for v in voices:
                    lines.append(f'            {{"id": "{v["id"]}", "name": "{v["name"]}"}},')
                lines.append("        ],")
            lines.append("    },")
        lines.append("}")
        Path(args.prune_catalog).write_text("\n".join(lines) + "\n")
        print(f"Pruned {len(dropped)} voices that Google doesn't offer. Wrote cleaned catalog to {args.prune_catalog}.")
        if dropped:
            print("Dropped voice ids:")
            for vid in sorted(set(dropped)):
                print(f"    - {vid}")
        return 0

    lang_filter = {s.strip().lower() for s in args.languages.split(",") if s.strip()} or None
    existing = _parse_existing(args.skip_existing) if args.skip_existing else {}

    all_jobs = list(_iter_voices(google_voices, lang_codes, lang_filter))
    pending = [job for job in all_jobs if job[1] not in existing]
    print(f"Catalog has {len(all_jobs)} unique voices; {len(pending)} to generate ({len(existing)} already exist).")

    if args.dry_run:
        # Back-of-envelope: assume avg 120 chars; mix of classes averages ~$0.008/voice.
        est = len(pending) * 0.008
        print(f"Dry run — estimated Google TTS spend: ~${est:.2f}")
        return 0

    from google.cloud import texttospeech  # noqa: F401 — fail fast if missing

    credentials = _google_credentials()
    client = texttospeech.TextToSpeechClient(credentials=credentials)

    available_ids = _all_google_voice_ids(client)
    skipped_missing = [vid for _, vid, _ in pending if vid not in available_ids]
    if skipped_missing:
        print(f"⚠️  {len(skipped_missing)} voices in catalog are NOT offered by Google — will be skipped:")
        for vid in skipped_missing[:20]:
            print(f"    - {vid}")
        if len(skipped_missing) > 20:
            print(f"    ... and {len(skipped_missing) - 20} more")

    results: Dict[str, str] = dict(existing)
    fallback_phrase = SAMPLE_PHRASES["english (us)"]

    for i, (lang_key, voice_id, locale) in enumerate(pending, 1):
        if voice_id not in available_ids:
            continue
        phrase = SAMPLE_PHRASES.get(lang_key, fallback_phrase)
        try:
            audio = _synthesize(client, phrase, voice_id, locale)
        except Exception as e:
            print(f"  [{i}/{len(pending)}] ❌ {voice_id}: synth failed: {e}", file=sys.stderr)
            continue
        key = f"{args.prefix}/{uuid.uuid4()}-{voice_id}.mp3"
        try:
            url = _upload_to_s3(audio, args.bucket, key)
        except Exception as e:
            print(f"  [{i}/{len(pending)}] ❌ {voice_id}: upload failed: {e}", file=sys.stderr)
            continue
        results[voice_id] = url
        print(f"  [{i}/{len(pending)}] ✅ {voice_id}")

    # Emit as pastable Python source, sorted for stable diffs.
    lines = ["_GOOGLE_SAMPLE_URLS: Dict[str, str] = {"]
    for vid in sorted(results):
        lines.append(f'    "{vid}": "{results[vid]}",')
    lines.append("}")
    output = "\n".join(lines) + "\n"

    if args.output:
        Path(args.output).write_text(output)
        print(f"\nWrote {len(results)} entries to {args.output}")
    else:
        print("\n" + output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
