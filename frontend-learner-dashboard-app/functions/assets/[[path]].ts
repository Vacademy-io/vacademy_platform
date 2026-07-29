// Turns a missing /assets/* file into a real, uncacheable 404.
//
// Why this exists:
// Cloudflare Pages has no 404 for unmatched paths — it serves index.html with
// a 200. That applies to /assets/<name>-<hash>-<sha>.js too, so a request for
// a chunk this deployment cannot resolve comes back as HTML and the browser
// rejects it:
//
//   Failed to load module script: Expected a JavaScript-or-Wasm module script
//   but the server responded with a MIME type of "text/html".
//
// The app then never boots. Worse, public/_headers matches on the *request*
// path rather than the file actually served, so that HTML body inherits the
// /*.js caching rule — the wrong answer gets cached by the browser and by the
// Cloudflare edge (verified: cf-cache-status goes MISS then HIT), and a plain
// location.reload() reads it straight back out of cache.
//
// Functions run before static assets on Pages, so this handler sits in front
// of every /assets/* request. context.next() serves the real file when it
// exists — untouched, with its normal headers — and anything that comes back
// as HTML means the file is gone, which we convert into a 404 that nothing is
// allowed to cache. A 404 also lets Vite's own vite:preloadError fire, so
// src/lib/chunk-reload.ts can recover the tab instead of white-screening.
//
// Requires /assets/* NOT to be listed in public/_routes.json "exclude",
// otherwise Pages serves those paths statically and never invokes this.

interface AssetsBinding {
  fetch: (request: Request) => Promise<Response>;
}

export const onRequest: PagesFunction = async (context) => {
  let response: Response;
  try {
    response = await context.next();
  } catch {
    // Never let a broken chain turn every asset into a 404 — fall back to the
    // asset binding directly, and if that is unavailable too, rethrow.
    const assets = (context.env as { ASSETS?: AssetsBinding }).ASSETS;
    if (!assets) throw new Error("no ASSETS binding");
    response = await assets.fetch(context.request);
  }

  const contentType = response.headers.get("content-type") || "";
  const isHtml = contentType.includes("text/html");

  // Real assets are js/css/images/fonts — never HTML. The only HTML that can
  // appear under /assets/ is the SPA fallback standing in for a missing file.
  // Everything else (200, 206 range, 304 not-modified) passes through
  // untouched, headers included.
  if (!isHtml && response.status < 400) {
    return response;
  }

  const pathname = new URL(context.request.url).pathname;

  return new Response(`Not found: ${pathname}\n`, {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Must outlive nothing: a cached miss is exactly the bug being fixed.
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      "cdn-cache-control": "no-store",
      "x-vacademy-asset-miss": "1",
    },
  });
};
