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
            html.append(f"<h2>{_escape_html(title)}</h2>\n")
        elif line.startswith("$$"):
            html.append(f'<div class="math-block">{line}</div>\n')
        elif _NUMBERED_RE.match(line):
            html.append(f'<div class="question">{_parse_inline(line)}</div>\n')
        else:
            html.append(f"<p>{_parse_inline(line)}</p>\n")
    html.append("\n</body>\n</html>")
    return "".join(html)
