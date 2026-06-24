// Cloudflare Pages middleware that injects per-institute Open Graph / favicon
// metadata for social-media link unfurlers (WhatsApp, Facebook, Twitter, Slack,
// Telegram, etc.).
//
// WHY THIS EXISTS:
// This admin dashboard is a client-side SPA. White-label branding (title, favicon,
// logo) is applied at runtime by JavaScript reading localStorage. A link-preview
// crawler never executes that JS — it only sees the static index.html, which
// hardcodes `<title>Admin Dashboard</title>` and the default Vacademy /favicon.ico
// and ships NO og:* tags. The result: every shared admin link previews as generic
// "Admin Dashboard" + Vacademy logo, even on a fully white-labelled domain.
//
// This middleware closes that gap at the edge: for crawler requests it resolves
// the institute branding for the request host via the domain-routing API and
// rewrites the served HTML head so the unfurl card shows the institute's name and
// logo. Real users are untouched — they fall through to the normal SPA, whose JS
// already handles white-labeling.
//
// This mirrors frontend-learner-dashboard-app/functions/_middleware.ts.

const CRAWLER_UA_REGEX =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|Googlebot|bingbot|Applebot|Pinterest|Viber|Skype/i;

// Domain-specific backend mappings (keep in sync with src/config/baseUrl.ts).
const DOMAIN_BACKEND_MAP = {
  "letstalkvet.com": "https://api.letstalkvet.com",
};

const DEFAULT_BACKEND_BASE = "https://backend-stage.vacademy.io";

function getBackendBase(hostname) {
  for (const [domain, backendUrl] of Object.entries(DOMAIN_BACKEND_MAP)) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return backendUrl;
    }
  }
  return DEFAULT_BACKEND_BASE;
}

function getMediaPublicUrl(backendBase) {
  return `${backendBase}/media-service/public/get-public-url`;
}

function getDomainRoutingUrl(backendBase) {
  return `${backendBase}/admin-core-service/public/domain-routing/v1/resolve`;
}

async function resolvePublicUrl(fileId, backendBase) {
  try {
    const url = `${getMediaPublicUrl(backendBase)}?fileId=${encodeURIComponent(
      fileId
    )}&expiryDays=7`;
    const res = await fetch(url);
    if (res.ok) {
      const text = await res.text();
      // The API may return a plain URL string or a JSON-wrapped string.
      const cleaned = text.replace(/^"|"$/g, "").trim();
      if (cleaned.startsWith("http")) return cleaned;
    }
  } catch {
    // fall through
  }
  return "";
}

async function fetchBranding(domain, subdomain, backendBase) {
  try {
    const url = `${getDomainRoutingUrl(backendBase)}?domain=${encodeURIComponent(
      domain
    )}&subdomain=${encodeURIComponent(subdomain)}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fall through
  }
  return null;
}

// e.g. admin.shikshanation.com -> domain=shikshanation.com, subdomain=admin
function parseDomainParts(hostname) {
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    return { subdomain: parts[0], domain: parts.slice(1).join(".") };
  }
  // Two-part domain like shikshanation.com -> no subdomain.
  return { domain: hostname, subdomain: "" };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const onRequest = async (context) => {
  const { request } = context;
  const ua = request.headers.get("user-agent") || "";

  // Only intercept for link-unfurl crawlers; real users fall through untouched.
  if (!CRAWLER_UA_REGEX.test(ua)) {
    return context.next();
  }

  // Only intercept HTML page requests, not static assets.
  const url = new URL(request.url);
  const ext = url.pathname.split(".").pop()?.toLowerCase();
  if (
    ext &&
    [
      "js", "css", "png", "jpg", "jpeg", "gif", "svg", "webp", "ico",
      "woff", "woff2", "ttf", "json", "webmanifest", "map", "txt",
    ].includes(ext)
  ) {
    return context.next();
  }

  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const hostname = url.hostname;
  const backendBase = getBackendBase(hostname);
  const { domain, subdomain } = parseDomainParts(hostname);

  const branding = await fetchBranding(domain, subdomain, backendBase);
  if (!branding) {
    // No white-label config for this host — leave the default HTML as-is.
    return response;
  }

  const title = escapeHtml(branding.tabText || branding.instituteName || "");
  const description = escapeHtml(branding.instituteName || "");

  // The big unfurl thumbnail uses the main institute logo; the favicon prefers
  // the dedicated tab icon. Resolve both (in parallel, deduped).
  const ogImageFileId =
    branding.instituteLogoFileId || branding.tabIconFileId || "";
  const faviconFileId =
    branding.tabIconFileId || branding.instituteLogoFileId || "";

  const [ogImage, faviconRaw] = await Promise.all([
    ogImageFileId ? resolvePublicUrl(ogImageFileId, backendBase) : "",
    faviconFileId === ogImageFileId
      ? Promise.resolve("")
      : faviconFileId
        ? resolvePublicUrl(faviconFileId, backendBase)
        : "",
  ]);
  const favicon = faviconRaw || ogImage;

  const ogTags = [
    `<meta name="description" content="${description}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${title}" />`,
    `<meta property="og:url" content="${escapeHtml(request.url)}" />`,
    ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />` : "",
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : "",
  ]
    .filter(Boolean)
    .join("\n    ");

  let html = await response.text();

  // Replace the hardcoded static <title> with the institute's name.
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);

  // Point the favicon at the institute icon so the crawler card stops showing
  // the default Vacademy mark.
  if (favicon) {
    const escapedFavicon = escapeHtml(favicon);
    html = html.replace(
      /<link\s+rel="(?:shortcut )?icon"[^>]*\/?>/gi,
      `<link rel="icon" href="${escapedFavicon}" />`
    );
    if (!/rel="icon"/i.test(html)) {
      html = html.replace(
        "</head>",
        `    <link rel="icon" href="${escapedFavicon}" />\n  </head>`
      );
    }
  }

  // Inject OG / Twitter tags before </head>.
  html = html.replace("</head>", `    ${ogTags}\n  </head>`);

  // Rebuild headers: the body length changed (and reading .text() may have
  // decompressed it), so a stale content-length/content-encoding would
  // truncate or corrupt the response. Let the runtime recompute them.
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
