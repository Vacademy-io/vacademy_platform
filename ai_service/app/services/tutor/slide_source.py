"""Load what the compiler needs to know about one slide, straight from the
admin_core tables ai_service already shares (V494 lives next to them).

Kinds:
  document   HTML body (copilot documents; type HTML/DOC with inline data)
  quiz       structured questions (compiled deterministically)
  video      YouTube / uploaded video, taught as a MEDIA TASK from a description
  pdf        uploaded PDF, taught as a MEDIA TASK from a description
  other      assignments, code, presentations… — not compiled in phase 1
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

MAX_SOURCE_CHARS = 40_000
_UUID_RE = re.compile(r"^[0-9a-fA-F-]{32,36}$")


@dataclass
class QuizQuestion:
    id: str
    order: int
    question_type: str
    stem: str
    options: List[Dict[str, str]] = field(default_factory=list)   # [{id, text}]
    correct_option_ids: List[str] = field(default_factory=list)
    correct_texts: List[str] = field(default_factory=list)
    explanation: Optional[str] = None


@dataclass
class SlideSource:
    slide_id: str
    title: str
    source_type: str
    source_id: Optional[str]
    kind: str                       # document | quiz | video | pdf | other
    text: str = ""
    questions: List[QuizQuestion] = field(default_factory=list)
    media_url: Optional[str] = None
    media_file_id: Optional[str] = None
    chapter_id: Optional[str] = None
    chapter_name: Optional[str] = None
    course_name: Optional[str] = None
    package_id: Optional[str] = None
    content_hash: str = ""


# ── HTML → teaching text ─────────────────────────────────────────────────────

def html_to_text(html_body: str) -> str:
    """Plain text that keeps the slide's structure legible: headings on their
    own line, list items as '- ', table cells separated by ' | ', image alt as
    '[image: …]'. Scripts and styles dropped."""
    if not html_body:
        return ""
    try:
        from bs4 import BeautifulSoup  # type: ignore
    except Exception:  # noqa: BLE001
        return re.sub(r"<[^>]+>", " ", html_body)[:MAX_SOURCE_CHARS]
    soup = BeautifulSoup(html_body, "html.parser")
    for tag in soup(["script", "style", "noscript", "iframe"]):
        tag.decompose()
    for img in soup.find_all("img"):
        alt = (img.get("alt") or "").strip()
        img.replace_with(f"[image: {alt}]" if alt else "")
    for li in soup.find_all("li"):
        li.insert(0, "- ")
    for h in soup.find_all(re.compile(r"^h[1-6]$")):
        h.insert(0, "\n## ")
        h.append("\n")
    for cell in soup.find_all(["td", "th"]):
        cell.append(" | ")
    for br in soup.find_all(["br", "p", "div", "tr", "li", "section", "article", "blockquote", "pre"]):
        br.append("\n")
    out = soup.get_text()
    out = re.sub(r"[ \t]+", " ", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()[:MAX_SOURCE_CHARS]


def _hash(*parts: Any) -> str:
    h = hashlib.sha256()
    for p in parts:
        h.update(json.dumps(p, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8"))
        h.update(b"\x1f")
    return "sha256:" + h.hexdigest()


# ── Ownership ────────────────────────────────────────────────────────────────

_OWNERSHIP_SQL = text("""
    SELECT 1
    FROM slide sl
    JOIN chapter_to_slides cts ON cts.slide_id = sl.id AND cts.status <> 'DELETED'
    JOIN chapter_package_session_mapping cpsm ON cpsm.chapter_id = cts.chapter_id AND cpsm.status <> 'DELETED'
    JOIN package_session ps ON ps.id = cpsm.package_session_id
    JOIN package_institute pi ON pi.package_id = ps.package_id
    WHERE sl.id = :slide_id AND pi.institute_id = :institute_id
    LIMIT 1
""")


def slide_belongs_to_institute(db: Session, slide_id: str, institute_id: str) -> bool:
    return db.execute(_OWNERSHIP_SQL, {"slide_id": slide_id, "institute_id": institute_id}).first() is not None


def package_belongs_to_institute(db: Session, package_id: str, institute_id: str) -> bool:
    row = db.execute(
        text("SELECT 1 FROM package_institute WHERE package_id = :p AND institute_id = :i LIMIT 1"),
        {"p": package_id, "i": institute_id},
    ).first()
    return row is not None


# ── Listing ──────────────────────────────────────────────────────────────────

_PACKAGE_SLIDES_SQL = text("""
    SELECT DISTINCT ON (sl.id)
           sl.id, sl.title, sl.source_type, c.id AS chapter_id, c.chapter_name,
           cpsm.chapter_order, cts.slide_order
    FROM package_session ps
    JOIN chapter_package_session_mapping cpsm ON cpsm.package_session_id = ps.id AND cpsm.status = 'ACTIVE'
    JOIN chapter c ON c.id = cpsm.chapter_id AND c.status <> 'DELETED'
    JOIN chapter_to_slides cts ON cts.chapter_id = c.id AND cts.status <> 'DELETED'
    JOIN slide sl ON sl.id = cts.slide_id AND sl.status IN ('PUBLISHED', 'UNSYNC')
    WHERE ps.package_id = :package_id AND ps.status <> 'DELETED'
    ORDER BY sl.id, cpsm.chapter_order NULLS LAST, cts.slide_order NULLS LAST
""")

# Statuses learners can see; DRAFT bodies are never compiled or taught
# (UNSYNC = published once, edited since: its published_data still serves).
VISIBLE_SLIDE_STATUSES = ("PUBLISHED", "UNSYNC")

_SLIDE_IN_BATCH_SQL = text("""
    SELECT 1
    FROM chapter_package_session_mapping cpsm
    JOIN chapter_to_slides cts ON cts.chapter_id = cpsm.chapter_id AND cts.status <> 'DELETED'
    JOIN slide sl ON sl.id = cts.slide_id AND sl.status IN ('PUBLISHED', 'UNSYNC')
    WHERE cpsm.package_session_id = :ps AND cpsm.status = 'ACTIVE' AND sl.id = :slide_id
    LIMIT 1
""")


def slide_in_package_session(db: Session, slide_id: str, package_session_id: str) -> bool:
    """The slide is a visible member of this batch's content (design §6.1:
    a session teaches only what the batch exposes)."""
    if not slide_id or not package_session_id:
        return False
    return db.execute(_SLIDE_IN_BATCH_SQL, {"ps": package_session_id, "slide_id": slide_id}).first() is not None


def package_of_slide(db: Session, slide_id: str) -> Optional[str]:
    row = db.execute(text("""
        SELECT ps.package_id
        FROM chapter_to_slides cts
        JOIN chapter_package_session_mapping cpsm ON cpsm.chapter_id = cts.chapter_id AND cpsm.status <> 'DELETED'
        JOIN package_session ps ON ps.id = cpsm.package_session_id
        WHERE cts.slide_id = :s AND cts.status <> 'DELETED'
        LIMIT 1
    """), {"s": slide_id}).first()
    return row[0] if row else None


def list_package_slides(db: Session, package_id: str) -> List[Dict[str, Any]]:
    rows = db.execute(_PACKAGE_SLIDES_SQL, {"package_id": package_id}).fetchall()
    items = [
        {"slide_id": r[0], "title": r[1], "source_type": r[2], "chapter_id": r[3],
         "chapter_name": r[4], "chapter_order": r[5], "slide_order": r[6]}
        for r in rows
    ]
    items.sort(key=lambda x: ((x["chapter_order"] if x["chapter_order"] is not None else 1e9),
                              (x["slide_order"] if x["slide_order"] is not None else 1e9), x["title"] or ""))
    return items


# ── Loading one slide ────────────────────────────────────────────────────────

_SLIDE_SQL = text("""
    SELECT sl.id, sl.title, sl.source_type, sl.source_id, sl.status,
           c.id AS chapter_id, c.chapter_name, p.id AS package_id, p.package_name
    FROM slide sl
    LEFT JOIN chapter_to_slides cts ON cts.slide_id = sl.id AND cts.status <> 'DELETED'
    LEFT JOIN chapter c ON c.id = cts.chapter_id
    LEFT JOIN chapter_package_session_mapping cpsm ON cpsm.chapter_id = c.id AND cpsm.status = 'ACTIVE'
    LEFT JOIN package_session ps ON ps.id = cpsm.package_session_id AND ps.status <> 'DELETED'
    LEFT JOIN package p ON p.id = ps.package_id
    WHERE sl.id = :slide_id
    LIMIT 1
""")


def _document(db: Session, src: SlideSource, source_id: str) -> None:
    row = db.execute(
        text("SELECT type, data, published_data FROM document_slide WHERE id = :id"), {"id": source_id}
    ).first()
    if not row:
        src.kind = "other"
        return
    dtype, data, published = row[0] or "", row[1] or "", row[2] or ""
    body = published or data
    if dtype.upper() in ("HTML", "DOC") and body and not _UUID_RE.match(body.strip()):
        src.kind = "document"
        src.text = html_to_text(body)
        src.content_hash = _hash("document", src.title, src.text)
    elif dtype.upper() in ("PDF", "DOC") or _UUID_RE.match(body.strip() or ""):
        src.kind = "pdf"
        src.media_file_id = body.strip() or None
        src.content_hash = _hash("pdf", src.title, src.media_file_id)
    else:
        src.kind = "other"


def _video(db: Session, src: SlideSource, source_id: str, html_video: bool) -> None:
    if html_video:
        row = db.execute(
            text("SELECT url, ai_gen_video_id FROM html_video_slide WHERE id = :id"), {"id": source_id}
        ).first()
        url = (row[0] if row else None) or None
    else:
        row = db.execute(
            text("SELECT url, published_url FROM video WHERE id = :id"), {"id": source_id}
        ).first()
        url = ((row[1] or row[0]) if row else None) or None
    src.kind = "video"
    # Uploaded videos store the media file id in `url` (source_type FILE_ID);
    # only real https links are media urls. The learner app resolves file ids
    # to signed public urls itself.
    if url and _UUID_RE.match(url.strip()):
        src.media_file_id = url.strip()
    else:
        src.media_url = url
    src.content_hash = _hash("video", src.title, url)


def _quiz(db: Session, src: SlideSource, source_id: str) -> None:
    rows = db.execute(text("""
        SELECT q.id, q.question_order, q.question_type, q.auto_evaluation_json,
               rt.content AS stem, ex.content AS explanation
        FROM quiz_slide_question q
        LEFT JOIN rich_text_data rt ON rt.id = q.text_id
        LEFT JOIN rich_text_data ex ON ex.id = q.explanation_text_id
        WHERE q.quiz_slide_id = :id AND COALESCE(q.status, 'ACTIVE') <> 'DELETED'
        ORDER BY q.question_order NULLS LAST, q.created_at
    """), {"id": source_id}).fetchall()
    questions: List[QuizQuestion] = []
    for i, r in enumerate(rows, start=1):
        qid, order, qtype, auto_json, stem_html, expl_html = r
        opts = db.execute(text("""
            SELECT o.id, rt.content
            FROM quiz_slide_question_options o
            LEFT JOIN rich_text_data rt ON rt.id = o.text_id
            WHERE o.quiz_slide_question_id = :qid
            ORDER BY o.created_on, o.id
        """), {"qid": qid}).fetchall()
        options = [{"id": o[0], "text": html_to_text(o[1] or "")} for o in opts]
        correct_ids = _correct_option_ids(auto_json, options)
        q = QuizQuestion(
            id=qid, order=order or i, question_type=(qtype or "MCQS").upper(),
            stem=html_to_text(stem_html or ""), options=options,
            correct_option_ids=correct_ids,
            correct_texts=[o["text"] for o in options if o["id"] in correct_ids],
            explanation=html_to_text(expl_html or "") or None,
        )
        questions.append(q)
    src.kind = "quiz"
    src.questions = questions
    src.content_hash = _hash("quiz", src.title, [
        (q.stem, [o["text"] for o in q.options], q.correct_texts) for q in questions
    ])


def _correct_option_ids(auto_json: Optional[str], options: List[Dict[str, str]]) -> List[str]:
    """auto_evaluation_json has taken several shapes over time:
    {"correctAnswers":[ids|indices]}, {"data":{"correctOptionIds":[...]}},
    {"correctOptionIds":[...]}, {"validAnswers":[...]}. Indices may be 0-based
    ints or 1-based strings; resolve everything to option ids."""
    if not auto_json:
        return []
    try:
        data = json.loads(auto_json) if isinstance(auto_json, str) else dict(auto_json)
    except Exception:  # noqa: BLE001
        return []
    cand: Any = None
    for key in ("correctAnswers", "correctOptionIds", "validAnswers"):
        if key in data:
            cand = data[key]
            break
    if cand is None and isinstance(data.get("data"), dict):
        for key in ("correctOptionIds", "correctAnswers", "validAnswers"):
            if key in data["data"]:
                cand = data["data"][key]
                break
    if not isinstance(cand, list):
        return []
    ids = {o["id"] for o in options}
    out: List[str] = []
    for v in cand:
        if isinstance(v, str) and v in ids:
            out.append(v)
        elif isinstance(v, int) and 0 <= v < len(options):
            out.append(options[v]["id"])
        elif isinstance(v, str) and v.isdigit():
            n = int(v)
            if 0 <= n < len(options):
                out.append(options[n]["id"])
            elif 1 <= n <= len(options):
                out.append(options[n - 1]["id"])
    return out


def load_slide_source(db: Session, slide_id: str) -> Optional[SlideSource]:
    row = db.execute(_SLIDE_SQL, {"slide_id": slide_id}).first()
    if not row or (row[4] or "").upper() not in VISIBLE_SLIDE_STATUSES:
        return None
    src = SlideSource(
        slide_id=row[0], title=row[1] or "", source_type=(row[2] or "").upper(), source_id=row[3],
        kind="other", chapter_id=row[5], chapter_name=row[6], package_id=row[7], course_name=row[8],
    )
    st, sid = src.source_type, src.source_id or ""
    try:
        if st == "DOCUMENT" and sid:
            _document(db, src, sid)
        elif st == "QUIZ" and sid:
            _quiz(db, src, sid)
        elif st == "VIDEO" and sid:
            _video(db, src, sid, html_video=False)
        elif st == "HTML_VIDEO" and sid:
            _video(db, src, sid, html_video=True)
    except Exception:  # noqa: BLE001
        logger.warning("Could not load slide %s body", slide_id, exc_info=True)
        src.kind = "other"
    if not src.content_hash:
        src.content_hash = _hash(src.kind, src.title, src.source_type, sid)
    return src
