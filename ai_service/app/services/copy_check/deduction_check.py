"""Check every deduction against a picture of the student's actual answer.

The grader marks from a transcript, and on maths copies the transcript is
where marks get lost. Compared question by question with a teacher's marking
of a real copy, the AI cut marks for things the student never did:
  * "7/5 ... = 7/30" read as "1/5 ... = 1/30"   (handwritten 7 read as 1)
  * a⁻⁵ read as a⁻⁶, b⁻⁴ as b⁴, 25 as 26        ("wrong exponents")
  * 350 written over 360, read as 360           ("wrong final answer")
  * a boxed "x = 5" left out of the transcript  ("final value not stated")
The OCR splits a stacked fraction into a numerator row and a denominator row
and sometimes misses a line, so no amount of row-by-row re-reading fixes this
reliably. Looking at the answer does.

So after a question is graded, if marks were cut, the answer region (its rows
from first to last, the full width of the writing, across pages if it runs
on) is cropped from the page images and shown to the model with the verdict:
does each deduction hold for what is actually written? The check can only
RAISE a mark - never lower one - and only when the image shows the cut came
from a misreading. A real mistake stays cut.
"""
from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
import tempfile
from pathlib import Path
from typing import Any, Optional

from .mathpix_fallback import _download

logger = logging.getLogger(__name__)

# The page reader (GLM-5.3-flash) cannot tell a handwritten 7 from a 1 even on
# a close-up crop ("the image clearly shows 1/6 and 1/5"); Gemini 2.5 Flash
# read the same crop as "7/5 (-3/12 + 5/12) = 7/5 x 1/6 = 7/30". On a real
# copy's cut marks it raised the three misread ones and kept the three real
# ones. It is called only for written answers that lost marks.
MODEL = "google/gemini-2.5-flash"
# MCQs are settled by option_letter.py (letter or text), not by a picture.
SKIP_TYPES = {"MCQS", "MCQM", "MCQ", "TRUE_FALSE"}
MAX_CROPS = 3            # pages of one answer shown
MAX_EDGE = 1600          # px, long edge of each crop
PAD = 30                 # px around the answer rows
MAX_CHECKS_PER_COPY = 60

SYSTEM = (
    "You are a senior teacher re-checking marks another examiner gave from a machine "
    "transcript of a handwritten answer. The transcript can misread handwriting: 1 and 7, "
    "5 and 6, 8 and 9, minus signs, exponents, fractions written stacked, a number written "
    "over another one, an answer drawn inside a box. You see the student's actual writing in "
    "the image(s). Judge only from what is written there. Return strict JSON only."
)


def _rows_in_order(layout_map: dict[str, Any]) -> list[tuple[str, str, list]]:
    out = []
    for page in layout_map.get("pages") or []:
        for row in page.get("lines") or []:
            box = row.get("box")
            if isinstance(box, (list, tuple)) and len(box) == 4:
                out.append((str(row.get("line_id")), str(page.get("page_id")), [float(v) for v in box]))
    return out


def answer_regions(layout_map: dict[str, Any], answer_rows: list[str]) -> list[tuple[str, tuple[int, int, int, int]]]:
    """[(page_id, (left, top, right, bottom))] covering the answer's rows from
    its first to its last, one region per page, in page order."""
    if not answer_rows:
        return []
    rows = _rows_in_order(layout_map)
    ids = [r[0] for r in rows]
    first, last = str(answer_rows[0]), str(answer_rows[-1])
    if first not in ids or last not in ids:
        return []
    i, j = ids.index(first), ids.index(last)
    if j < i:
        i, j = j, i
    span = rows[i:j + 1]
    width_by_page: dict[str, tuple[float, float]] = {}
    for _, pid, box in rows:
        lo, hi = width_by_page.get(pid, (box[0], box[0] + box[2]))
        width_by_page[pid] = (min(lo, box[0]), max(hi, box[0] + box[2]))
    regions: dict[str, list[float]] = {}
    order: list[str] = []
    for _, pid, (x, y, w, h) in span:
        if pid not in regions:
            regions[pid] = [y, y + h]
            order.append(pid)
        else:
            regions[pid][0] = min(regions[pid][0], y)
            regions[pid][1] = max(regions[pid][1], y + h)
    out = []
    for pid in order[:MAX_CROPS]:
        left, right = width_by_page[pid]
        top, bottom = regions[pid]
        # Half a line more below the last row: the denominator of a stacked
        # final fraction, or a boxed answer, often sits under it.
        out.append((pid, (int(max(0, left - PAD)), int(max(0, top - PAD - 20)),
                          int(right + PAD), int(bottom + PAD + 40))))
    return out


def _encode(img: Any) -> str:
    longest = max(img.width, img.height)
    if longest > MAX_EDGE:
        s = MAX_EDGE / float(longest)
        img = img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))))
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def build_prompt(question: dict[str, Any], rubric: dict[str, Any], verdict: dict[str, Any]) -> str:
    deductions = [c for c in verdict.get("criteria_breakdown") or []
                  if c.get("max_marks") is None or float(c.get("marks") or 0) < float(c.get("max_marks") or 0)]
    notes = [a.get("text") for a in verdict.get("annotations") or [] if a.get("style") == "margin_note" and a.get("text")]
    return f"""Question {question.get('paper_label') or question.get('question_number') or ''} ({question.get('max_marks')} marks):
{question.get('question_text')}
{('Correct answer (key): ' + str(question.get('correct_answer'))) if question.get('correct_answer') else ''}

Marking scheme (JSON): {json.dumps(rubric.get('rubric') if isinstance(rubric, dict) else rubric)[:3000]}

The examiner read the answer as:
{str(verdict.get('extracted_answer') or '')[:2500]}

and awarded {verdict.get('marks_awarded')} / {verdict.get('max_marks')}, cutting marks for:
{json.dumps([{'criterion': c.get('criteria_name'), 'marks': c.get('marks'), 'max': c.get('max_marks'), 'reason': c.get('reason')} for c in deductions])[:2500]}
Notes written on the copy: {json.dumps(notes)[:800]}

Look at the image(s) of what the student actually wrote. For EACH cut, decide:
 - "misread": the image shows the student did NOT make this mistake (the examiner's reading was wrong), or
 - "real": the student really made this mistake or really left this out.
Then give the marks the answer deserves under the same scheme. Only raise a mark for a "misread" cut;
keep every "real" cut. Never go above {verdict.get('max_marks')}, never below {verdict.get('marks_awarded')}.

Return ONLY:
{{"what_the_student_wrote": "<the key working and final answer as written, e.g. 7/5 x 1/6 = 7/30>",
  "cuts": [{{"reason": "<the examiner's reason>", "finding": "misread" | "real", "why": "<what the image shows>"}}],
  "marks_awarded": <number, in steps of 0.5>,
  "note": "<if marks are still cut: ONE short reason for the student, else empty>"}}"""


def apply_check(verdict: dict[str, Any], result: dict[str, Any]) -> bool:
    """Raise `verdict` to the checked mark. Mutates; True when it changed."""
    try:
        new = float(result.get("marks_awarded"))
    except (TypeError, ValueError):
        return False
    old = float(verdict.get("marks_awarded") or 0)
    mx = float(verdict.get("max_marks") or 0)
    misread = [c for c in result.get("cuts") or [] if str(c.get("finding")).lower() == "misread"]
    new = round(min(mx, max(old, new)) * 2) / 2
    if new <= old or not misread:
        return False
    verdict["marks_awarded"] = new
    verdict["deduction_check"] = {"from": old, "to": new, "student_wrote": str(result.get("what_the_student_wrote") or "")[:400],
                                  "misread": [str(c.get("why") or c.get("reason") or "")[:200] for c in misread]}
    # The check's own reading stays in deduction_check only. It decides
    # whether a cut was a misreading; it is not a better transcript - on one
    # answer it raised the mark rightly while copying the exponents wrong.
    # Re-spread the breakdown so it sums to the new mark.
    items = verdict.get("criteria_breakdown") or []
    gap = new - old
    for item in items:
        cmax = item.get("max_marks")
        if gap <= 0 or cmax is None:
            continue
        room = float(cmax) - float(item.get("marks") or 0)
        give = min(room, gap)
        if give > 0:
            item["marks"] = float(item.get("marks") or 0) + give
            item["reason"] = "Re-checked against the handwriting: " + (misread[0].get("why") or "the cut came from a misreading.")
            gap -= give
    if gap > 1e-6 and items:
        # Criteria without a stated maximum: put the rest on the last one so
        # the breakdown still adds up to the mark the teacher sees.
        items[-1]["marks"] = float(items[-1].get("marks") or 0) + gap
    note = str(result.get("note") or "").strip()
    anns = []
    for a in verdict.get("annotations") or []:
        a = dict(a)
        style = a.get("style")
        if style == "score":
            a["text"] = f"{new:g}/{mx:g}"
        elif style == "margin_note":
            if new >= mx or not note:
                continue
            a["text"] = note[:200]
        elif style == "cross" and new >= mx:
            a["style"] = "tick"
        anns.append(a)
    verdict["annotations"] = anns
    if new >= mx:
        verdict["feedback"] = "Correct - full marks after checking the handwriting."
    elif note:
        verdict["feedback"] = note
    return True


class DeductionChecker:
    """One per copy. The PDF is fetched once, on the first check; each check
    renders only the page(s) it crops, so a long copy's page images are never
    all held in memory while the rest of the paper is graded."""

    def __init__(self, pdf_url: str, layout_map: dict[str, Any], llm: Any,
                 institute_id: Optional[str] = None, token_sink: Optional[Any] = None):
        self.pdf_url = pdf_url
        self.layout_map = layout_map
        self.llm = llm
        self.institute_id = institute_id
        self.token_sink = token_sink
        self._pdf: Optional[bytes] = None
        self.checked = 0
        self.raised = 0

    async def _pdf_bytes(self) -> bytes:
        if self._pdf is None:
            with tempfile.TemporaryDirectory(prefix="copycheck-dedcheck-") as tmp:
                pdf_path = Path(tmp) / "input.pdf"
                await _download(self.pdf_url, pdf_path)
                self._pdf = pdf_path.read_bytes()
        return self._pdf

    def _render(self, pdf: bytes, page_id: str) -> Any:
        """One page at the layout's 200 DPI, so OCR boxes line up with it."""
        import fitz  # PyMuPDF
        from PIL import Image

        doc = fitz.open(stream=pdf, filetype="pdf")
        try:
            index = int(str(page_id).lstrip("p")) - 1
            if index < 0 or index >= doc.page_count:
                return None
            pix = doc[index].get_pixmap(matrix=fitz.Matrix(200 / 72.0, 200 / 72.0), alpha=False)
            if pix.n != 3:
                pix = fitz.Pixmap(fitz.csRGB, pix)
            return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        finally:
            doc.close()

    async def check(self, verdict: dict[str, Any], question: dict[str, Any], rubric: dict[str, Any]) -> bool:
        """Re-check a verdict that cut marks. Best effort; True when raised."""
        try:
            mx = float(verdict.get("max_marks") or 0)
            if str(question.get("question_type") or "").upper() in SKIP_TYPES:
                return False
            if (self.checked >= MAX_CHECKS_PER_COPY or str(verdict.get("status") or "").upper() == "FAILED"
                    or float(verdict.get("marks_awarded") or 0) >= mx or not verdict.get("extracted_answer")):
                return False
            regions = answer_regions(self.layout_map, verdict.get("answer_rows") or [])
            if not regions:
                return False
            pdf = await self._pdf_bytes()
            crops = []
            for pid, box in regions:
                img = await asyncio.get_event_loop().run_in_executor(None, self._render, pdf, pid)
                if img is not None:
                    crops.append(_encode(img.crop((box[0], box[1], min(img.width, box[2]), min(img.height, box[3])))))
                    del img
            if not crops:
                return False
            self.checked += 1
            response = await self.llm.chat_completion(
                messages=[{"role": "system", "content": SYSTEM},
                          {"role": "user", "content": build_prompt(question, rubric, verdict),
                           "attachments": [{"type": "image", "url": f"data:image/jpeg;base64,{b}"} for b in crops]}],
                temperature=0.0, max_tokens=1500, institute_id=self.institute_id, model=MODEL,
            )
            if self.token_sink is not None:
                try:
                    self.token_sink.add_usage(response.get("usage"))
                except Exception:
                    pass
            content = (response.get("content") or "").strip()
            start, end = content.find("{"), content.rfind("}")
            if start == -1 or end <= start:
                return False
            raised = apply_check(verdict, json.loads(content[start:end + 1]))
            if raised:
                self.raised += 1
                logger.info("Deduction check raised Q%s: %s", question.get("question_id"), verdict.get("deduction_check"))
            return raised
        except Exception as e:
            logger.warning("Deduction check failed for Q%s: %s", question.get("question_id"), e)
            return False


__all__ = ["DeductionChecker", "answer_regions", "apply_check", "build_prompt"]
