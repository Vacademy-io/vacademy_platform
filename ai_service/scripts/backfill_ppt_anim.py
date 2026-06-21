#!/usr/bin/env python3
"""
backfill_ppt_anim.py — replace an institute's old PPT->PDF document slides with
the new animated (PPT_ANIM) decks.

What it does
------------
1. Reads the original .pptx files for the institute from the MEDIA-service DB
   (file_metadata, source='PPT_TO_PDF', source_id=<institute>).
2. Reads the institute's PDF document slides from the ADMIN-core DB.
3. Matches pptx <-> slide by normalised title (filename minus extension,
   lowercased, spaces -> underscore).
4. DRY-RUN (default): prints the planned matches and flags anything ambiguous
   or unmatched. NO conversion, NO writes.
5. --apply: converts each matched .pptx to an animated deck via the ai-service
   (LibreOffice render worker), then UPDATEs the document_slide rows in place
   (type -> PPT_ANIM, data -> deck_base, published_data -> deck_base when the
   slide is published). Each slide commits on its own; a failure rolls back only
   that slide and the run continues.

The two services use SEPARATE databases, so each is read over its own DSN.
The original .pptx live in the PRIVATE bucket; the render worker pulls them by
key with its own credentials, so no presigning is needed here.

Requirements:  pip install psycopg2-binary       (HTTP uses the stdlib)

Examples
--------
# 1) Dry run — see exactly what WOULD change (safe, no network conversion):
python backfill_ppt_anim.py \
  --institute cdefa309-e567-46cd-ab30-9d964b8dc66e \
  --media-dsn "postgresql://USER:PASS@HOST:5432/media_service" \
  --admin-dsn "postgresql://USER:PASS@HOST:5432/admin_core_service"

# 2) Convert + replace just the first 2 (prove the pipeline end-to-end first):
python backfill_ppt_anim.py ... --apply --limit 2

# 3) Full run:
python backfill_ppt_anim.py ... --apply
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request

import psycopg2

DEFAULT_AI_BASE = "https://backend-stage.vacademy.io/ai-service"
DEFAULT_PRIVATE_BUCKET = "vacademy-media-storage"
POLL_INTERVAL_S = 3
POLL_MAX_TRIES = 200  # ~10 min/deck ceiling


def norm_title(name):
    """Normalise a deck name for matching: drop extension, lowercase, spaces->_."""
    if not name:
        return ""
    n = name.strip().lower()
    n = re.sub(r"\.(pptx|ppt|pdf)$", "", n)
    n = re.sub(r"\s+", "_", n)
    return n


# media-service: original .pptx files uploaded by the old PPT->PDF flow
MEDIA_SQL = """
SELECT id, file_name, "key"
FROM file_metadata
WHERE source = 'PPT_TO_PDF' AND source_id = %s
ORDER BY created_at DESC
"""

# admin-core: the institute's PDF document slides.
# NOTE: a slide references its content via slide.source_id == document_slide.id
# (NOT slide.id); chapter_to_slides.slide_id references slide.id. See
# SlideRepository: "LEFT JOIN document_slide ds ON ds.id = s.source_id".
ADMIN_SQL = """
SELECT ds.id,
       ds.title,
       bool_or(ds.published_data IS NOT NULL AND ds.published_data <> '') AS is_published,
       string_agg(DISTINCT pkg.package_name,  ' | ') AS courses,
       string_agg(DISTINCT subj.subject_name, ' | ') AS subjects,
       string_agg(DISTINCT m.module_name,     ' | ') AS modules,
       string_agg(DISTINCT ch.chapter_name,   ' | ') AS chapters
FROM slide s
JOIN document_slide ds ON ds.id = s.source_id
JOIN chapter_to_slides cts ON cts.slide_id = s.id AND cts.status <> 'DELETED'
JOIN chapter ch ON ch.id = cts.chapter_id
JOIN chapter_package_session_mapping cpsm ON cpsm.chapter_id = ch.id AND cpsm.status <> 'DELETED'
JOIN package_session ps ON ps.id = cpsm.package_session_id AND ps.status <> 'DELETED'
JOIN package pkg ON pkg.id = ps.package_id AND pkg.status <> 'DELETED'
JOIN package_institute pi ON pi.package_id = pkg.id
LEFT JOIN module_chapter_mapping mcm ON mcm.chapter_id = ch.id
LEFT JOIN modules m ON m.id = mcm.module_id AND m.status <> 'DELETED'
LEFT JOIN subject_module_mapping smm ON smm.module_id = m.id
LEFT JOIN subject subj ON subj.id = smm.subject_id AND subj.status <> 'DELETED'
WHERE s.source_type = 'DOCUMENT'
  AND ds.type = 'PDF'
  AND pi.institute_id = %s
  AND s.status <> 'DELETED'
GROUP BY ds.id, ds.title
"""

# Guarded UPDATE: only touches rows still of type PDF (idempotent / re-run safe).
UPDATE_SQL = """
UPDATE document_slide
SET type = 'PPT_ANIM',
    data = %(deck)s,
    published_data = CASE
        WHEN published_data IS NOT NULL AND published_data <> '' THEN %(deck)s
        ELSE published_data END,
    updated_at = now()
WHERE id = %(id)s AND type = 'PDF'
"""


def _http_json(url, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers,
                                 method="POST" if data is not None else "GET")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def convert_pptx(ai_base, pptx_url, dpi):
    """Submit a deck to the animator and poll until done. Returns deck_base."""
    sub = _http_json(f"{ai_base}/ai/presentation/animate-pptx",
                     {"pptx_url": pptx_url, "dpi": dpi})
    job_id = sub.get("job_id")
    if not job_id:
        raise RuntimeError(f"no job_id from submit: {sub}")
    unreachable = 0
    for _ in range(POLL_MAX_TRIES):
        time.sleep(POLL_INTERVAL_S)
        try:
            job = _http_json(f"{ai_base}/ai/presentation/animate-pptx/{job_id}")
        except Exception:
            unreachable += 1
            if unreachable >= 5:
                raise RuntimeError("lost contact with ai-service")
            continue
        unreachable = 0
        st = job.get("status")
        if st == "completed":
            deck = (job.get("result") or {}).get("deck_base")
            if not deck:
                raise RuntimeError("completed but no deck_base")
            return deck
        if st == "failed":
            raise RuntimeError(job.get("error") or "conversion failed")
    raise RuntimeError("conversion timed out")


def main():
    ap = argparse.ArgumentParser(description="Backfill an institute's PDF slides to animated PPT decks.")
    ap.add_argument("--institute", required=True)
    ap.add_argument("--media-dsn", required=True, help="media-service Postgres DSN")
    ap.add_argument("--admin-dsn", required=True, help="admin-core Postgres DSN")
    ap.add_argument("--ai-base", default=DEFAULT_AI_BASE)
    ap.add_argument("--private-bucket", default=DEFAULT_PRIVATE_BUCKET)
    ap.add_argument("--dpi", type=int, default=110)
    ap.add_argument("--limit", type=int, default=0, help="cap slides processed (0 = all)")
    ap.add_argument("--apply", action="store_true", help="convert + write (default: dry run)")
    ap.add_argument("--yes", action="store_true", help="skip the --apply confirmation prompt")
    args = ap.parse_args()

    # ---- read both sides ----
    with psycopg2.connect(args.media_dsn) as mconn, mconn.cursor() as mc:
        mc.execute(MEDIA_SQL, (args.institute,))
        pptx_rows = mc.fetchall()  # (id, file_name, key)
    with psycopg2.connect(args.admin_dsn) as aconn, aconn.cursor() as ac:
        ac.execute(ADMIN_SQL, (args.institute,))
        slide_rows = ac.fetchall()  # (id, title, status, is_published)

    slides = {}
    for sid, title, is_pub, courses, subjects, modules, chapters in slide_rows:
        loc = f"{courses or '?'} > {subjects or '?'} > {modules or '?'} > {chapters or '?'}"
        slides[sid] = {"title": title, "is_pub": bool(is_pub), "loc": loc}

    pptx_by_title = {}
    for fid, fname, key in pptx_rows:
        pptx_by_title.setdefault(norm_title(fname), []).append((fid, fname, key))

    print(f"institute       : {args.institute}")
    print(f"old .pptx files : {len(pptx_rows)}")
    print(f"PDF doc slides  : {len(slides)}")
    print()

    # ---- match by normalised title ----
    plan, unmatched = [], []
    for sid, info in slides.items():
        nt = norm_title(info["title"])
        cand = pptx_by_title.get(nt)
        if cand:
            plan.append({"id": sid, "title": info["title"], "is_pub": info["is_pub"],
                         "loc": info["loc"], "nt": nt, "key": cand[0][2], "ncand": len(cand)})
        else:
            unmatched.append((sid, info["title"], info["loc"]))

    print("PLANNED REPLACEMENTS (PDF -> PPT_ANIM)  [Course > Subject > Module > Chapter]:")
    for p in plan:
        flag = "   [!] multiple .pptx share this title" if p["ncand"] > 1 else ""
        print(f"  - {p['loc']}")
        print(f"      slide {p['id']}  published={p['is_pub']}  '{p['title']}'{flag}")
    print(f"\n  matched: {len(plan)}    unmatched: {len(unmatched)}")
    if unmatched:
        print("\nUNMATCHED PDF slides (no .pptx with a matching title — left as PDF):")
        for sid, title, loc in unmatched:
            print(f"  - {loc}")
            print(f"      slide {sid}  '{title}'")
    used = {p["nt"] for p in plan}
    orphans = sorted(t for t in pptx_by_title if t not in used)
    if orphans:
        shown = ", ".join(orphans[:10]) + (" ..." if len(orphans) > 10 else "")
        print(f"\n.pptx with no matching PDF slide ({len(orphans)}): {shown}")

    if not args.apply:
        print("\nDRY RUN — nothing converted or written. Re-run with --apply to execute.")
        return

    targets = plan[: args.limit] if args.limit else plan
    print(f"\n--apply: will convert + REPLACE {len(targets)} slide(s) in place.")
    if not args.yes and input("Type 'yes' to proceed: ").strip().lower() != "yes":
        print("aborted.")
        return

    # ---- convert (cache per deck) + update ----
    deck_cache, ok, fail = {}, 0, 0
    with psycopg2.connect(args.admin_dsn) as aconn:
        for p in targets:
            try:
                if p["nt"] not in deck_cache:
                    pptx_url = f"https://{args.private_bucket}.s3.amazonaws.com/{p['key']}"
                    print(f"converting '{p['title']}' ...", flush=True)
                    deck_cache[p["nt"]] = convert_pptx(args.ai_base, pptx_url, args.dpi)
                deck = deck_cache[p["nt"]]
                with aconn.cursor() as ac:
                    ac.execute(UPDATE_SQL, {"deck": deck, "id": p["id"]})
                    rows = ac.rowcount
                aconn.commit()
                print(f"  -> slide {p['id']} updated (rows={rows})  deck={deck}")
                ok += 1
            except Exception as e:  # noqa: BLE001
                aconn.rollback()
                print(f"  !! slide {p['id']} FAILED: {e}", file=sys.stderr)
                fail += 1

    print(f"\nDONE. updated={ok}  failed={fail}")


if __name__ == "__main__":
    main()
