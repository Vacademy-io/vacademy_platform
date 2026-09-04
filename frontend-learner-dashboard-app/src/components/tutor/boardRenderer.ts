/**
 * Whiteboard ops → HTML (learner side). Mirrors the server materializer
 * (ai_service/app/services/tutor/board_ops.py): same class names, same
 * data-op-id attributes, so the stored board_html and the live-rendered
 * board never disagree. Text is escaped; SVG bodies arrive sanitized from the
 * server and pass through DOMPurify again before insertion.
 */
import DOMPurify from "dompurify";

export type BoardOp = Record<string, unknown> & { op: string; id?: string; target?: string };

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

const safeUrl = (u: unknown): string | null => {
  const s = String(u ?? "").trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : null;
};

const ANIM = new Set(["write", "fade", "pop"]);

export function renderOp(op: BoardOp): string {
  const id = esc(op.id ?? "");
  const anim = ANIM.has(String(op.anim)) ? String(op.anim) : "write";
  const attrs = ` data-op-id="${id}" class="tb-op tb-anim-${anim}"`;
  switch (op.op) {
    case "heading": {
      const level = Math.max(1, Math.min(4, Number(op.level) || 2));
      return `<h${level}${attrs.replace('class="', 'class="tb-heading ')}>${esc(op.text)}</h${level}>`;
    }
    case "text":
      return `<p${attrs.replace('class="', 'class="tb-text ')}>${esc(op.text)}</p>`;
    case "bullet": {
      const items = ((op.items as unknown[]) || []).map((i) => `<li>${esc(i)}</li>`).join("");
      return `<ul${attrs.replace('class="', 'class="tb-bullets ')}>${items}</ul>`;
    }
    case "formula": {
      const cap = op.caption ? `<figcaption>${esc(op.caption)}</figcaption>` : "";
      return `<figure${attrs.replace('class="', 'class="tb-formula ')}><span class="tb-latex" data-latex="${esc(op.latex)}">${esc(op.latex)}</span>${cap}</figure>`;
    }
    case "svg": {
      const body = DOMPurify.sanitize(String(op.svg ?? ""), { USE_PROFILES: { svg: true, svgFilters: false }, FORBID_ATTR: ["style"] });
      if (!body.includes("<svg")) return "";
      return `<figure${attrs.replace('class="', 'class="tb-svg ')} aria-label="${esc(op.description)}">${body}<figcaption class="tb-visually-hidden">${esc(op.description)}</figcaption></figure>`;
    }
    case "image": {
      const url = safeUrl(op.url);
      if (!url) return "";
      const cap = op.caption ? `<figcaption>${esc(op.caption)}</figcaption>` : "";
      return `<figure${attrs.replace('class="', 'class="tb-image ')}><img src="${esc(url)}" alt="${esc(op.description)}" loading="lazy">${cap}</figure>`;
    }
    case "video": {
      const url = safeUrl(op.url);
      if (!url) return "";
      return `<figure${attrs.replace('class="', 'class="tb-video ')}><video src="${esc(url)}" controls playsinline ${op.muted === false ? "" : "muted"}></video><figcaption>${esc(op.description)}</figcaption></figure>`;
    }
    case "media_task": {
      const url = safeUrl(op.url) || "";
      return `<div${attrs.replace('class="', 'class="tb-media-task ')} data-kind="${esc(op.kind)}" data-src="${esc(url)}" data-file-id="${esc(op.file_id ?? "")}"><p>${esc(op.description)}</p></div>`;
    }
    case "table": {
      const rows = (op.rows as unknown[][]) || [];
      if (!rows.length) return "";
      const head = (rows[0] || []).map((c) => `<th>${esc(c)}</th>`).join("");
      const body = rows.slice(1).map((r) => `<tr>${(r || []).map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
      return `<table${attrs.replace('class="', 'class="tb-table ')}><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    }
    case "callout":
      return `<aside${attrs.replace('class="', `class="tb-callout tb-callout-${esc(op.kind || "tip")} `)}>${esc(op.text)}</aside>`;
    case "annotate":
      return `<span${attrs.replace('class="', `class="tb-annotation tb-annotation-${esc(op.position || "right")} `)} data-target="${esc(op.target)}">${esc(op.text)}</span>`;
    case "arrow":
      return `<span${attrs.replace('class="', 'class="tb-arrow ')} data-from="${esc(op.from)}" data-to="${esc(op.to)}">${esc(op.text ?? "")}</span>`;
    default:
      return "";
  }
}

/** Ops that change the board's DOM (as opposed to highlight/clear). */
export const isElementOp = (op: BoardOp): boolean =>
  !["highlight", "unhighlight", "reveal", "clear"].includes(op.op);
