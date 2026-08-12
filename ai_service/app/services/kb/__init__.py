"""Knowledge Base — a per-institute RAG corpus built from real documents.

Module map:
  repository.py     all SQL against the V435 tables (no ORM — same style as the
                    rest of ai_service's newer services)
  parsing.py        PDF/URL/YouTube → pages + figures. Routes each PDF page to
                    the free text-layer extractor or to paid OCR.
  chunking.py       page-aware chunker: every chunk knows its page range, which
                    is what makes citations possible
  summary_index.py  page → section → chapter → book summary tree
  ingest.py         the async job that ties the above together and meters it
  retrieval.py      vector search + grounded, cited answers
"""
