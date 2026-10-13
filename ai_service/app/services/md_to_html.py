"""Markdown→HTML converter — port of media_service util MdToHtmlConverter.

Converts MathPix OCR-style Markdown (with LaTeX) into an HTML document with a
MathJax head. Deliberately a simple line-by-line converter (NOT a generic
markdown library), matching the Java behavior exactly: headers, $$ blocks,
numbered "question" lines, and paragraphs; inline image + bold handling; $ math
left untouched for MathJax.
"""
from __future__ import annotations

import re

_HEAD = (
    '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
    '<meta charset="UTF-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    "<title>Converted Document</title>\n"
    "<style>\n"
    "  body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 20px auto; padding: 20px; color: #333; }\n"
    "  img { max-width: 100%; height: auto; display: block; margin: 20px auto; border: 1px solid #ddd; }\n"
    "  h2 { border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 30px; }\n"
    "  .question { margin-bottom: 15px; }\n"
    "  .math-block { overflow-x: auto; margin: 10px 0; }\n"
    "</style>\n"
    "<script>\n"
    "  window.MathJax = {\n"
    "    tex: {\n"
    "      inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],\n"
    "      displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]\n"
    "    }\n"
    "  };\n"
    "</script>\n"
    '<script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>\n'
    "</head>\n<body>\n\n"
)

_NUMBERED_RE = re.compile(r"^\d+\..*")
# MathPix joins a Word heading's lines with a literal "<br>" ("TEST - 03 <br>
# SECTION A: …"); each line is a heading of its own, or the section heading
# hides behind the paper's title. A bare label line ("Section A <br>
# THERMODYNAMICS") is joined to the name under it instead.
_HEADING_BREAK_RE = re.compile(r"\s*<br\s*/?>\s*", re.I)
_BARE_LABEL_RE = re.compile(r"^(?:section|part|unit)\s*[-–:]?\s*[A-Za-z0-9]{1,4}\s*[:.\-–]?$", re.I)


def _heading_lines(title: str) -> list[str]:
    lines: list[str] = []
    for part in _HEADING_BREAK_RE.split(title):
        if not part:
            continue
        if lines and _BARE_LABEL_RE.match(lines[-1]):
            lines[-1] = f"{lines[-1].rstrip(' :.-–')}: {part}"
        else:
            lines.append(part)
    return lines


_IMG_RE = re.compile(r"!\s?\[(.*?)\]\((.*?)\)")
_BOLD_RE = re.compile(r"\*\*(.*?)\*\*")


def _escape_html(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _parse_inline(text: str) -> str:
    text = _IMG_RE.sub(r'<img src="\2" alt="\1" />', text)
    text = _BOLD_RE.sub(r"<strong>\1</strong>", text)
    return text


def convert_markdown_to_html(markdown_text: str | None) -> str:
    if markdown_text is None:
        return ""
    html = [_HEAD]
    for raw_line in markdown_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("##"):
            title = re.sub(r"^#+\s*", "", line)
            for part in _heading_lines(title):
                html.append(f"<h2>{_escape_html(part)}</h2>\n")
        elif line.startswith("$$"):
            html.append(f'<div class="math-block">{line}</div>\n')
        elif _NUMBERED_RE.match(line):
            html.append(f'<div class="question">{_parse_inline(line)}</div>\n')
        else:
            html.append(f"<p>{_parse_inline(line)}</p>\n")
    html.append("\n</body>\n</html>")
    return "".join(html)
