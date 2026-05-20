"""One-shot embedder for sounds_metadata.json.

Reads ai_service/sounds_metadata.json, computes an embedding for each
sound's `(file_name + category + description)` text, and writes a sidecar
file `sound_embeddings.npz` plus an index `sound_embeddings_index.json`
that the runtime catalog loads at startup.

Provider is auto-detected from env:
  - GEMINI_API_KEY  → Google text-embedding-004 (768 dim, free-tier-friendly)
  - OPENAI_API_KEY  → OpenAI text-embedding-3-small (1536 dim, ~$0.40 once)

The provider+model are recorded in sound_embeddings_index.json so the
runtime catalog uses the SAME provider at query time (mixing breaks
cosine similarity because the vector spaces don't align).

Run:
    cd ai_service/app/ai-video-gen-main
    GEMINI_API_KEY=... python3 embed_sounds_catalog.py
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import List, Tuple

import re
from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx
import numpy as np

_REDACT_RE = re.compile(
    r"(?i)(\bkey=|\bauthorization:\s*(?:bearer|key)\s+)[^\s&\"']+",
)


def _redact(s: object) -> str:
    """Mask API keys from any string we're about to print."""
    try:
        return _REDACT_RE.sub(r"\1***", str(s))
    except Exception:
        return "<unprintable>"

# Provider config — populated by _resolve_provider() at startup.
PROVIDER = ""            # "gemini" | "openai"
EMBEDDING_MODEL = ""
EMBEDDING_DIM = 0
_API_KEY = ""

OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings"
GEMINI_EMBED_URL_TMPL = (
    "https://generativelanguage.googleapis.com/v1beta/"
    "models/{model}:embedContent?key={key}"
)

BATCH_SIZE = 100
GEMINI_CONCURRENCY = 8   # parallel single-embed calls (Gemini has no batch on this model)
REQUEST_TIMEOUT_S = 60.0


def _resolve_provider() -> None:
    """Pick the provider based on which API key env var is set."""
    global PROVIDER, EMBEDDING_MODEL, EMBEDDING_DIM, _API_KEY
    gem = os.environ.get("GEMINI_API_KEY")
    oa = os.environ.get("OPENAI_API_KEY")
    if gem:
        PROVIDER = "gemini"
        EMBEDDING_MODEL = "gemini-embedding-001"
        EMBEDDING_DIM = 1536  # gemini-embedding-001 supports {128,256,512,768,1536,3072}
        _API_KEY = gem
    elif oa:
        PROVIDER = "openai"
        EMBEDDING_MODEL = "text-embedding-3-small"
        EMBEDDING_DIM = 1536
        _API_KEY = oa
    else:
        raise SystemExit(
            "ERROR: Set GEMINI_API_KEY (preferred) or OPENAI_API_KEY."
        )


def _build_text(entry: dict) -> str:
    """Build the text we embed for one sound entry.

    Order matters slightly — filename first (often the most descriptive),
    then category, then description. Truncate to keep token use bounded.
    """
    file_name = str(entry.get("file_name") or "").strip()
    category = str(entry.get("category") or "").strip()
    description = str(entry.get("description") or "").strip()
    parts = [p for p in (file_name, category, description) if p]
    text = " | ".join(parts)
    # Hard cap (text-embedding-3-small accepts 8191 tokens; we never need
    # more than a handful, but truncate to keep cost predictable).
    return text[:600]


def _embed_batch_openai(texts: List[str]) -> np.ndarray:
    resp = httpx.post(
        OPENAI_EMBEDDINGS_URL,
        headers={
            "Authorization": f"Bearer {_API_KEY}",
            "Content-Type": "application/json",
        },
        json={"model": EMBEDDING_MODEL, "input": texts},
        timeout=REQUEST_TIMEOUT_S,
    )
    resp.raise_for_status()
    data = resp.json()["data"]
    return np.array([row["embedding"] for row in data], dtype=np.float32)


def _embed_one_gemini(client: httpx.Client, text: str) -> List[float]:
    """One synchronous embedContent call. Returns the raw vector."""
    url = GEMINI_EMBED_URL_TMPL.format(model=EMBEDDING_MODEL, key=_API_KEY)
    body = {
        "model": f"models/{EMBEDDING_MODEL}",
        "content": {"parts": [{"text": text}]},
        "outputDimensionality": EMBEDDING_DIM,
    }
    resp = client.post(url, headers={"Content-Type": "application/json"}, json=body)
    resp.raise_for_status()
    return resp.json()["embedding"]["values"]


def _embed_batch_gemini(texts: List[str]) -> np.ndarray:
    """Gemini has no batchEmbedContents on this model — fan out single
    embedContent calls in a thread pool. GEMINI_CONCURRENCY workers."""
    results: List[List[float]] = [None] * len(texts)  # type: ignore[list-item]
    with httpx.Client(timeout=REQUEST_TIMEOUT_S, limits=httpx.Limits(
        max_keepalive_connections=GEMINI_CONCURRENCY,
        max_connections=GEMINI_CONCURRENCY,
    )) as client:
        with ThreadPoolExecutor(max_workers=GEMINI_CONCURRENCY) as pool:
            futures = {
                pool.submit(_embed_one_gemini, client, t): i
                for i, t in enumerate(texts)
            }
            for fut in as_completed(futures):
                i = futures[fut]
                results[i] = fut.result()
    return np.array(results, dtype=np.float32)


def _embed_batch(texts: List[str]) -> np.ndarray:
    """Call the configured provider for one batch. Returns (len(texts), DIM)."""
    if PROVIDER == "gemini":
        vecs = _embed_batch_gemini(texts)
    else:
        vecs = _embed_batch_openai(texts)
    # L2-normalize so cosine similarity = dot product at query time.
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return vecs / norms


def _resolve_paths() -> Tuple[Path, Path, Path]:
    here = Path(__file__).resolve().parent
    metadata = here.parent.parent / "sounds_metadata.json"
    if not metadata.exists():
        # Fallback search
        for cand in (here / "sounds_metadata.json", here.parent / "sounds_metadata.json"):
            if cand.exists():
                metadata = cand
                break
    out_npz = metadata.parent / "sound_embeddings.npz"
    out_index = metadata.parent / "sound_embeddings_index.json"
    return metadata, out_npz, out_index


def main() -> int:
    _resolve_provider()
    print(f"Provider: {PROVIDER} model={EMBEDDING_MODEL} dim={EMBEDDING_DIM}")

    metadata_path, out_npz, out_index = _resolve_paths()
    if not metadata_path.exists():
        print(f"ERROR: sounds_metadata.json not found at {metadata_path}", file=sys.stderr)
        return 2

    print(f"Reading {metadata_path}")
    with open(metadata_path, "r", encoding="utf-8") as f:
        entries = json.load(f)
    if not isinstance(entries, list):
        print(f"ERROR: expected a list at root, got {type(entries).__name__}", file=sys.stderr)
        return 2

    # Only embed entries that have something useful to search on AND
    # a public_url (entries without a URL can't be played anyway).
    embeddable = []
    for entry in entries:
        if not entry.get("public_url"):
            continue
        text = _build_text(entry)
        if not text:
            continue
        embeddable.append((entry, text))
    print(f"Embedding {len(embeddable)} entries (of {len(entries)} total) "
          f"with {EMBEDDING_MODEL}")

    all_vecs: List[np.ndarray] = []
    file_ids: List[str] = []
    t_start = time.time()
    for batch_start in range(0, len(embeddable), BATCH_SIZE):
        batch = embeddable[batch_start:batch_start + BATCH_SIZE]
        texts = [t for _, t in batch]
        for attempt in range(3):
            try:
                vecs = _embed_batch(texts)
                break
            except httpx.HTTPError as e:
                wait = 2 ** attempt
                print(f"  batch {batch_start}: error ({_redact(e)}), retrying in {wait}s")
                time.sleep(wait)
        else:
            print(f"ERROR: batch {batch_start} failed after 3 retries", file=sys.stderr)
            return 1
        all_vecs.append(vecs)
        file_ids.extend(e.get("file_id") or e.get("file_name") for e, _ in batch)
        done = batch_start + len(batch)
        elapsed = time.time() - t_start
        rate = done / elapsed if elapsed > 0 else 0
        eta = (len(embeddable) - done) / rate if rate > 0 else 0
        print(f"  {done}/{len(embeddable)} ({rate:.1f}/s, ETA {eta:.0f}s)")

    matrix = np.vstack(all_vecs).astype(np.float32)
    assert matrix.shape == (len(file_ids), EMBEDDING_DIM), (
        f"shape mismatch: {matrix.shape}"
    )

    np.savez_compressed(out_npz, embeddings=matrix)
    with open(out_index, "w", encoding="utf-8") as f:
        json.dump(
            {
                "provider": PROVIDER,
                "model": EMBEDDING_MODEL,
                "dim": EMBEDDING_DIM,
                "count": len(file_ids),
                "file_ids": file_ids,
            },
            f,
        )
    print(f"Wrote {out_npz} ({matrix.nbytes / 1024 / 1024:.1f} MiB)")
    print(f"Wrote {out_index}")
    print(f"Done in {time.time() - t_start:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
