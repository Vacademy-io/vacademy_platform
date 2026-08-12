// Turns a missing /assets/* file into a real, uncacheable 404.
//
// WHY THIS EXISTS:
// Cloudflare Pages has no 404 for unmatched paths — it serves index.html with
// a 200. That applies to /assets/<name>-<hash>.js too, so a request for a chunk
// the serving edge cannot resolve comes back as HTML and the browser rejects it:
//
//   Failed to load module script: Expected a JavaScript-or-Wasm module script
//   but the server responded with a MIME type of "text/html".
//
// The app then never boots (white screen). Two things make it worse:
//
//   1. index.html is served `max-age=0, must-revalidate` (always fresh) while
//      assets get Pages' default `max-age=14400, must-revalidate`. During the
//      deploy-propagation window a browser can therefore hold the NEW index.html
//      while an edge still answers its assets with the SPA fallback.
//   2. That fallback HTML is cached for four hours under the .js URL — by the
//      browser and by the Cloudflare edge. A plain location.reload() reads the
//      poisoned body straight back out of cache, so the tab cannot self-heal
//      until the entry expires. That is the "it fixes itself after a while".
//
// Functions run before static assets on Pages, so this handler sits in front of
// every /assets/* request. context.next() serves the real file when it exists —
// untouched, with its normal headers — and anything that comes back as HTML
// means the file is missing, which we convert into a 404 that nothing is allowed
// to cache. A 404 also lets Vite's own vite:preloadError fire, so
// src/lib/chunk-reload.ts (and the inline pre-boot guard in index.html) can
// recover the tab instead of white-screening.
//
// Requires /assets/* NOT to be listed in public/_routes.json "exclude",
// otherwise Pages serves those paths statically and never invokes this.

export const onRequest = async (context) => {
    let response;
    try {
        response = await context.next();
    } catch {
        // Never let a broken chain turn every asset into a 404 — fall back to
        // the asset binding directly, and if that is unavailable too, rethrow.
        const assets = context.env.ASSETS;
        if (!assets) throw new Error('no ASSETS binding');
        response = await assets.fetch(context.request);
    }

    const contentType = response.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');

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
            'content-type': 'text/plain; charset=utf-8',
            // Must outlive nothing: a cached miss is exactly the bug being fixed.
            'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
            'cdn-cache-control': 'no-store',
            'x-vacademy-asset-miss': '1',
        },
    });
};
