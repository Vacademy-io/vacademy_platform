// Edge image proxy: re-serves an institute branding image (logo/icon) with a
// correct image/* Content-Type for social-media crawlers.
//
// WHY: media-service stores uploaded objects in S3 with a wrong content-type
// (application/x-www-form-urlencoded) because the presigned PUT URL doesn't pin
// one. Facebook/WhatsApp validate the og:image content-type and refuse to render
// a non-image/* response, so link previews show no logo. We fetch the (public,
// allowlisted) S3 object, sniff the real type from its magic bytes, and re-serve
// it with the right header. Used by _middleware.js for og:image / twitter:image.
//
// Reached as: /branding-image?u=<url-encoded https S3 url>

const MAX_BYTES = 10 * 1024 * 1024; // 10MB guard against abuse / huge files

// SSRF guard: only proxy https objects from AWS S3 (the media bucket lives
// there). Blocks internal/metadata targets (those are IPs, not *.amazonaws.com).
function isAllowed(target) {
  return target.protocol === "https:" && target.hostname.endsWith(".amazonaws.com");
}

function sniffImageType(bytes) {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38)
    return "image/gif";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return "image/webp";
  return "";
}

function typeFromExtension(pathname) {
  const p = pathname.toLowerCase();
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".svg")) return "image/svg+xml";
  return "";
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const src = url.searchParams.get("u");
  if (!src) return new Response("missing u", { status: 400 });

  let target;
  try {
    target = new URL(src);
  } catch {
    return new Response("bad u", { status: 400 });
  }
  if (!isAllowed(target)) return new Response("forbidden", { status: 403 });

  let upstream;
  try {
    upstream = await fetch(target.toString());
  } catch {
    return new Response("upstream error", { status: 502 });
  }
  if (!upstream.ok) return new Response("upstream error", { status: upstream.status });

  const len = Number(upstream.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return new Response("too large", { status: 413 });

  const buf = await upstream.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return new Response("too large", { status: 413 });

  const sniffed = sniffImageType(new Uint8Array(buf.slice(0, 16)));
  const contentType = sniffed || typeFromExtension(target.pathname) || "application/octet-stream";

  return new Response(buf, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=86400",
      "access-control-allow-origin": "*",
    },
  });
}
