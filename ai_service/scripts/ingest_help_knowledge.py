"""
Force a re-ingest of the Vacademy Assistant help corpus (app/data/help_knowledge.jsonl)
into pgvector, under the product-wide sentinel institute.

You normally DON'T need this — the corpus auto-syncs on ai_service startup
(see app/services/help_corpus_sync.py), so committing a new seed and deploying
is enough. Use this only to force an immediate re-ingest without a restart.

Run from the ai_service directory, with the app's DB env configured (or inside
the ai-service pod):

    python scripts/ingest_help_knowledge.py
"""
from __future__ import annotations

import asyncio
import os
import sys

# Make the `app` package importable when run as a plain script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.help_corpus_sync import sync_help_corpus  # noqa: E402


if __name__ == "__main__":
    asyncio.run(sync_help_corpus(force=True))
