/**
 * Per-shot export helpers.
 *
 * `downloadShotHtml` takes the same processed HTML the editor's iframe shows
 * and saves it as a self-contained `.html` file the user can open locally,
 * embed elsewhere, or send for review. It includes the common library
 * scripts (gsap/anime/etc) baked in by `processHtmlContent`, so the file
 * runs anywhere with a network connection.
 */
import { processHtmlContent } from '@/components/ai-video-player/html-processor';
import type { Entry, ContentType, TimelineMeta } from '@/components/ai-video-player/types';

export function buildStandaloneShotDocument(
    entry: Entry,
    meta: TimelineMeta,
    isOverlay: boolean
): string {
    const contentType: ContentType = meta.content_type ?? 'VIDEO';
    const inner = processHtmlContent(entry.html, contentType, isOverlay, meta.palette);
    const w = meta.dimensions?.width ?? 1920;
    const h = meta.dimensions?.height ?? 1080;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(entry.id)}</title>
<style>
  html, body { margin: 0; padding: 0; background: ${meta.palette?.background ?? '#000'}; }
  /* Aspect-correct centered viewport so the shot displays at its native
     1920x1080 (or whatever the meta says) regardless of browser size. */
  .vx-shot-stage {
    position: fixed; inset: 0;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .vx-shot-canvas {
    width: ${w}px; height: ${h}px; position: relative;
    transform-origin: center center;
  }
  @media (max-aspect-ratio: ${w}/${h}) {
    .vx-shot-canvas { transform: scale(calc(100vw / ${w})); }
  }
  @media (min-aspect-ratio: ${w}/${h}) {
    .vx-shot-canvas { transform: scale(calc(100vh / ${h})); }
  }
</style>
</head>
<body>
<div class="vx-shot-stage"><div class="vx-shot-canvas">${inner}</div></div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function downloadShotHtml(entry: Entry, meta: TimelineMeta, isOverlay: boolean) {
    const doc = buildStandaloneShotDocument(entry, meta, isOverlay);
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeId = entry.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    a.href = url;
    a.download = `${safeId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Defer revoke so the browser has time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
