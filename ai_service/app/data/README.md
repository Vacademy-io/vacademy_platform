# Vacademy Assistant — help corpus

`help_knowledge.jsonl` is the **source of truth** for the Assistant's how-to
answers (the `search_help_knowledge` tool). One JSON entry per line:

```json
{"id":"create-a-new-course","task":"Create a new course","role":"any","route_path":"/study-library/courses","keywords":["create course","new course"],"content_text":"… numbered steps …"}
```

| field | meaning |
|---|---|
| `id` | stable kebab-case slug (used as the row's `source_id`) |
| `task` | the how-to title |
| `role` | who may see it: `any`, or a JWT role name (`ADMIN`, `TEACHER`, `EVALUATOR`, `CONTENT CREATOR`, `ASSESSMENT CREATOR`). `any` = visible to all non-learner roles; a role-scoped entry is hidden from callers without that role |
| `route_path` | the in-app route the answer points to |
| `keywords` | search hints |
| `content_text` | one-line intro + numbered steps (reference real button/menu labels) |

## The pipeline (how updates reach production)

**Edit the JSONL → commit → deploy. That's it.**

On every `ai_service` startup, [`help_corpus_sync.py`](../services/help_corpus_sync.py)
hashes this file and compares it to what's ingested. If it changed (or is empty),
it re-embeds the corpus into pgvector under the product-wide sentinel institute
`__global_help__` — one copy serves every institute. Unchanged ⇒ no-op (one cheap
query, no embedding cost). The Assistant's help tool searches that sentinel corpus
**and** the caller's institute, so retrieval is robust.

- **Force an immediate re-ingest** (no restart): `python scripts/ingest_help_knowledge.py`
- **Re-draft entries from the live UI** (as the product changes): re-run the
  corpus-drafting workflow, which reads the real admin routes/components and emits
  fresh entries; review the diff, then commit.

## Authoring rules

- Ground steps in the **actual UI** — never invent button/menu names.
- Default `role` to `any`; restrict to `ADMIN` only for genuinely admin-only config.
- Keep `content_text` tight: intro + numbered steps.
- Don't reuse an `id` for a different task (it's the upsert key).
