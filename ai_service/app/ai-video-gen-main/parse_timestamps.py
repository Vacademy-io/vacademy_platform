#!/usr/bin/env python3
import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Sequence

REPO_ROOT = Path(__file__).resolve().parent
LOCAL_DEPS_DIR = REPO_ROOT / ".deps"
if LOCAL_DEPS_DIR.exists() and str(LOCAL_DEPS_DIR) not in sys.path:
    sys.path.insert(0, str(LOCAL_DEPS_DIR))

PHONE_TOKEN_RE = re.compile(r"^[A-Z]{1,3}\d?$")
SILENCE_PHONE = "sil"


def is_word_char(ch: str) -> bool:
    return ch.isalnum() or ch in {"'", "-"}


def words_from_alignment(characters, starts: Sequence[float], ends: Sequence[float]) -> List[Dict[str, Any]]:
    # characters may be a string or an array of single-character strings
    if isinstance(characters, str):
        chars_list = list(characters)
    elif isinstance(characters, list):
        # Normalize to single-character strings
        chars_list = [(c if isinstance(c, str) and len(c) > 0 else " ") for c in characters]
    else:
        raise ValueError("alignment.characters must be a string or array of strings")

    if not (isinstance(starts, list) and isinstance(ends, list)):
        raise ValueError("alignment.character_*_times_seconds must be lists")
    if not (len(chars_list) == len(starts) == len(ends)):
        raise ValueError(
            f"Mismatched lengths: characters={len(chars_list)} starts={len(starts)} ends={len(ends)}"
        )

    words: List[Dict[str, Any]] = []
    current_chars: List[str] = []
    current_start = None
    current_end = None

    for idx, ch in enumerate(chars_list):
        ch_start = float(starts[idx])
        ch_end = float(ends[idx])
        if is_word_char(ch):
            if current_start is None:
                current_start = ch_start
            current_chars.append(ch)
            current_end = ch_end
        else:
            if current_chars:
                words.append(
                    {
                        "word": "".join(current_chars),
                        "start": float(current_start),
                        "end": float(current_end) if current_end is not None else float(current_start),
                    }
                )
                current_chars = []
                current_start = None
                current_end = None
            # skip separators

    if current_chars:
        words.append(
            {
                "word": "".join(current_chars),
                "start": float(current_start),
                "end": float(current_end) if current_end is not None else float(current_start),
            }
        )

    return words


def normalize_phone(phone: str) -> str:
    return re.sub(r"\d", "", phone).lower()


def build_phone_sequence(word: str, g2p) -> List[str]:
    tokens = g2p(word)
    phones: List[str] = []
    for token in tokens:
        token = token.strip()
        if not token or token == " ":
            continue
        if PHONE_TOKEN_RE.match(token):
            phones.append(normalize_phone(token))
    return [p for p in phones if p]


def attach_phonemes(words: List[Dict[str, Any]], g2p) -> None:
    for entry in words:
        word_text = entry.get("word", "")
        raw_phones = build_phone_sequence(word_text, g2p)
        phones = raw_phones if raw_phones else [SILENCE_PHONE]
        duration = max(0.0, float(entry.get("end", 0.0)) - float(entry.get("start", 0.0)))
        if duration <= 0.0:
            per_phone = 0.0
        else:
            per_phone = duration / len(phones)

        phone_entries: List[Dict[str, Any]] = []
        elapsed = 0.0
        for idx, phone_code in enumerate(phones):
            phone_duration = per_phone
            if idx == len(phones) - 1:
                phone_duration = max(0.0, duration - elapsed)
            phone_entries.append({"phone": phone_code, "duration": phone_duration})
            elapsed += phone_duration
        entry["phones"] = phone_entries


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Derive word/phoneme timings from character-level alignment JSON.")
    parser.add_argument("input", help="Input JSON containing alignment.characters and per-character timings")
    parser.add_argument("out_json", nargs="?", help="Output words JSON (default: <input>.words.json)")
    parser.add_argument("out_csv", nargs="?", help="Output CSV (default: <input>.words.csv)")
    parser.add_argument(
        "--with-phones",
        action="store_true",
        help="Augment each word with a phoneme sequence (requires g2p_en).",
    )
    parser.add_argument(
        "--alignment-json",
        default=None,
        help="Optional Matamata-style alignment JSON output path (only written when --with-phones).",
    )
    return parser.parse_args(list(argv))


def load_alignment_payload(path: Path) -> Dict[str, Any]:
    """
    Load alignment data from JSON file. Supports two formats:
    1. Character-level (Edge TTS): {"alignment": {"characters": [...], "character_start_times_seconds": [...]}}
    2. Word-level (Whisper/Google TTS): [{"word": "...", "start": 0.0, "end": 0.5}, ...]
    """
    data = json.loads(path.read_text())
    
    # Check if it's already word-level format (array of word objects)
    if isinstance(data, list):
        # Validate it's word-level format
        if data and isinstance(data[0], dict) and "word" in data[0] and "start" in data[0]:
            return {"format": "word_level", "words": data}
        else:
            raise ValueError("Input JSON is an array but doesn't contain word objects with 'word', 'start', 'end' keys")
    
    # Check for character-level format
    if "alignment" in data and isinstance(data["alignment"], dict):
        alignment = data["alignment"]
        characters = alignment.get("characters")
        starts = alignment.get("character_start_times_seconds")
        ends = alignment.get("character_end_times_seconds")

        if characters is None or starts is None or ends is None:
            raise ValueError("Alignment missing one of: characters, character_start_times_seconds, character_end_times_seconds")

        return {
            "format": "character_level",
            "characters": characters,
            "starts": starts,
            "ends": ends,
        }
    
    raise ValueError("Input JSON must be either character-level alignment or word-level word list")


def main(argv: Sequence[str] = None) -> None:
    args = parse_args(argv or sys.argv[1:])

    input_path = Path(args.input).expanduser()
    if not input_path.exists():
        print(f"Input file not found: {input_path}")
        sys.exit(1)

    base = input_path.with_suffix("")
    out_json = Path(args.out_json).expanduser() if args.out_json else Path(str(base) + ".words.json")
    out_csv = Path(args.out_csv).expanduser() if args.out_csv else Path(str(base) + ".words.csv")
    alignment_json = (
        Path(args.alignment_json).expanduser()
        if args.alignment_json
        else Path(str(base) + ".alignment.json") if args.with_phones else None
    )

    try:
        payload = load_alignment_payload(input_path)
    except ValueError as exc:
        print(exc)
        sys.exit(1)

    # Handle both character-level and word-level formats
    if payload.get("format") == "word_level":
        # Already word-level, just use directly
        words = payload["words"]
        print(f"Loaded {len(words)} words from word-level format (Whisper/Google TTS)")
    else:
        # Character-level format, convert to words
        words = words_from_alignment(payload["characters"], payload["starts"], payload["ends"])
        print(f"Parsed {len(words)} words from character-level format (Edge TTS)")

    if args.with_phones:
        try:
            from g2p_en import G2p  # type: ignore
        except ImportError as exc:
            print("Error: --with-phones requires the 'g2p_en' package. Install it via 'pip install g2p_en'.")
            raise SystemExit(1) from exc
        g2p = G2p()
        attach_phonemes(words, g2p)

    # Write JSON
    out_json.write_text(json.dumps(words, indent=2))

    # Write CSV
    with out_csv.open("w", encoding="utf-8") as f:
        f.write("index,word,start,end\n")
        for i, item in enumerate(words):
            word = str(item.get("word", "")).replace('"', '""')
            start = float(item.get("start", 0.0))
            end = float(item.get("end", start))
            f.write(f"{i},\"{word}\",{start:.6f},{end:.6f}\n")

    print(f"Wrote {len(words)} words to:\n  JSON: {out_json}\n  CSV:  {out_csv}")

    if args.with_phones and alignment_json:
        alignment_payload = {"words": words}
        alignment_json.write_text(json.dumps(alignment_payload, indent=2))
        print(f"Alignment JSON (with phones) written to: {alignment_json}")


if __name__ == "__main__":
    main()


