/**
 * Whiteboard ops → HTML (learner side). Mirrors the server materializer
 * (ai_service/app/services/tutor/board_ops.py): same class names, same
 * data-op-id attributes, so the stored board_html and the live-rendered
 * board never disagree. Text is escaped; SVG bodies arrive sanitized from the
 * server and pass through DOMPurify again before insertion.
 *
 * Two things only the live board does after insertion (`enhance`): formulas
 * are typeset with KaTeX, and media tasks get a real player — a YouTube
 * embed, a <video>, or the PDF in an iframe (file ids resolved to signed
 * public urls).
 */
import DOMPurify from "dompurify";
import katex from "katex";
import "katex/dist/katex.min.css";

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
      return `<div${attrs.replace('class="', 'class="tb-media-task ')} data-kind="${esc(op.kind)}" data-src="${esc(url)}" data-file-id="${esc(op.file_id ?? "")}"><p>${esc(op.description)}</p><div class="tb-media-embed" hidden></div></div>`;
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

// ── post-insertion enhancement ───────────────────────────────────────────────

const YOUTUBE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i;
const VIMEO = /vimeo\.com\/(?:video\/)?(\d+)/i;

/** Typeset every formula inside `root` that has not been typeset yet. */
export function typesetFormulas(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(".tb-latex:not([data-typeset])").forEach((el) => {
    const latex = el.dataset.latex || el.textContent || "";
    el.dataset.typeset = "1";
    try {
      katex.render(latex, el, { throwOnError: false, displayMode: true, output: "html" });
    } catch {
      /* leave the raw source visible */
    }
  });
}

/**
 * Put a real player into a media-task box. `resolveFileId` turns a media
 * file id into a signed https url (the learner's normal getPublicUrl).
 */
export async function mountMediaTask(el: HTMLElement, resolveFileId: (fileId: string) => Promise<string>): Promise<void> {
  const slot = el.querySelector<HTMLElement>(".tb-media-embed");
  if (!slot || slot.dataset.mounted) return;
  slot.dataset.mounted = "1";
  const kind = el.dataset.kind || "video";
  let src = el.dataset.src || "";
  const fileId = el.dataset.fileId || "";
  if (!src && fileId) {
    try {
      src = await resolveFileId(fileId);
    } catch {
      src = "";
    }
  }
  if (!safeUrl(src)) return;
  slot.hidden = false;
  const yt = src.match(YOUTUBE);
  const vm = src.match(VIMEO);
  if (yt) {
    const f = document.createElement("iframe");
    f.src = `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`;
    f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    f.allowFullscreen = true;
    f.title = "Video";
    slot.appendChild(f);
  } else if (vm) {
    const f = document.createElement("iframe");
    f.src = `https://player.vimeo.com/video/${vm[1]}`;
    f.allow = "autoplay; fullscreen; picture-in-picture";
    f.allowFullscreen = true;
    f.title = "Video";
    slot.appendChild(f);
  } else if (kind === "pdf" || /\.pdf(\?|#|$)/i.test(src)) {
    const f = document.createElement("iframe");
    f.className = "tb-pdf";
    f.src = src;
    f.title = "Document";
    slot.appendChild(f);
    const a = document.createElement("a");
    a.className = "tb-media-link";
    a.href = src;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Open the document in a new tab";
    el.appendChild(a);
  } else {
    const v = document.createElement("video");
    v.src = src;
    v.controls = true;
    v.playsInline = true;
    v.preload = "metadata";
    slot.appendChild(v);
  }
}
