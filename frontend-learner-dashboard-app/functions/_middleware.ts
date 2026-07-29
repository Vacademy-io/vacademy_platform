// Cloudflare Pages middleware that injects Open Graph meta tags
// for social media crawlers (WhatsApp, Facebook, Twitter, etc.)
// by fetching institute branding from the domain-routing API.

const CRAWLER_UA_REGEX =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|Googlebot|bingbot|Applebot|Pinterest|Viber|Skype/i;

// Domain-specific backend mappings (same as src/config/baseUrl.ts)
const DOMAIN_BACKEND_MAP: Record<string, string> = {
  "letstalkvet.com": "https://api.letstalkvet.com",
};

const DEFAULT_BACKEND_BASE = "https://backend-stage.vacademy.io";

function getBackendBase(hostname: string): string {
  for (const [domain, backendUrl] of Object.entries(DOMAIN_BACKEND_MAP)) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return backendUrl;
    }
  }
  return DEFAULT_BACKEND_BASE;
}

function getMediaPublicUrl(backendBase: string): string {
  return `${backendBase}/media-service/public/get-public-url`;
}

function getDomainRoutingUrl(backendBase: string): string {
  return `${backendBase}/admin-core-service/public/domain-routing/v1/resolve`;
}

interface DomainRoutingResponse {
  instituteId: string;
  instituteName: string;
  instituteLogoFileId: string;
  instituteThemeCode: string;
  tabText?: string | null;
  tabIconFileId?: string | null;
}

async function resolveLogoUrl(fileId: string, backendBase: string): Promise<string> {
  try {
    const url = `${getMediaPublicUrl(backendBase)}?fileId=${encodeURIComponent(fileId)}&expiryDays=7`;
    const res = await fetch(url);
    if (res.ok) {
      const text = await res.text();
      // The API may return a plain URL string or JSON-wrapped string
      const cleaned = text.replace(/^"|"$/g, "").trim();
      if (cleaned.startsWith("http")) return cleaned;
    }
  } catch {
    // fall through
  }
  return "";
}

async function fetchBranding(
  domain: string,
  subdomain: string,
  backendBase: string
): Promise<DomainRoutingResponse | null> {
  try {
    const url = `${getDomainRoutingUrl(backendBase)}?domain=${encodeURIComponent(domain)}&subdomain=${encodeURIComponent(subdomain)}`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      return (await res.json()) as DomainRoutingResponse;
    }
  } catch {
    // fall through
  }
  return null;
}

interface PageSeo {
  title?: string;
  description?: string;
  ogImage?: string;
}

/**
 * Per-page SEO. The page editor collects seo.metaTitle / metaDescription /
 * ogImage on every catalogue page — but until now crawlers only ever saw
 * institute-level branding, so every page shared and ranked as the same
 * generic card. Resolve the catalogue JSON for /{tag} and /{tag}/{page}
 * routes and let the page speak for itself; anything missing falls back to
 * branding exactly as before.
 */
async function fetchPageSeo(
  backendBase: string,
  instituteId: string,
  tagName: string,
  pageSlug: string | undefined
): Promise<PageSeo | null> {
  try {
    const url =
      `${backendBase}/admin-core-service/public/course-catalogue/v1/institute/get/by-tag` +
      `?instituteId=${encodeURIComponent(instituteId)}&tagName=${encodeURIComponent(tagName)}`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      // Edge-cache the catalogue JSON briefly: crawlers arrive in bursts
      // (WhatsApp fetches per recipient) and the JSON changes rarely.
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit);
    if (!res.ok) return null;
    const data = (await res.json()) as { catalogue_json?: string };
    if (!data?.catalogue_json) return null;
    const cfg = JSON.parse(data.catalogue_json) as {
      pages?: Array<{
        id?: string;
        route?: string;
        title?: string;
        seo?: { metaTitle?: string; metaDescription?: string; ogImage?: string };
      }>;
    };
    const pages = cfg?.pages || [];
    const norm = (r?: string) => (r || "").replace(/^\//, "").toLowerCase();
    const page = pageSlug
      ? pages.find((p) => norm(p.route) === norm(pageSlug))
      : pages.find(
          (p) =>
            p.id === "home" ||
            ["", "/", "home", "homepage"].includes(norm(p.route))
        ) || pages[0];
    if (!page) return null;
    return {
      title: page.seo?.metaTitle || page.title || undefined,
      description: page.seo?.metaDescription || undefined,
      ogImage: page.seo?.ogImage || undefined,
    };
  } catch {
    return null;
  }
}

function parseDomainParts(hostname: string): {
  domain: string;
  subdomain: string;
} {
  // e.g. learner.shikshanation.com → domain=shikshanation.com, subdomain=learner
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    return {
      subdomain: parts[0],
      domain: parts.slice(1).join("."),
    };
  }
  // Two-part domain like shikshanation.com — no subdomain
  return { domain: hostname, subdomain: "" };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;
  const ua = request.headers.get("user-agent") || "";

  // Only intercept for crawlers
  if (!CRAWLER_UA_REGEX.test(ua)) {
    return context.next();
  }

  // Only intercept HTML page requests, not assets
  const url = new URL(request.url);
  const ext = url.pathname.split(".").pop()?.toLowerCase();
  if (
    ext &&
    ["js", "css", "png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "woff", "woff2", "ttf", "json", "webmanifest"].includes(ext)
  ) {
    return context.next();
  }

  // Get the original HTML response
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const hostname = url.hostname;
  const backendBase = getBackendBase(hostname);
  const { domain, subdomain } = parseDomainParts(hostname);

  // Fetch branding from domain-routing API
  const branding = await fetchBranding(domain, subdomain, backendBase);
  if (!branding) {
    return response;
  }

  // Try page-level SEO for catalogue routes (/{tag} or /{tag}/{page}); every
  // other route — and any failure — keeps the branding fallback.
  const segs = url.pathname.split("/").filter(Boolean);
  const looksLikeCatalogue =
    segs.length >= 1 &&
    segs.length <= 2 &&
    !["login", "signup", "register", "product-pages", "audience-response", "enquiry-response", "study-library", "assessment", "booking-response"].includes(segs[0]);
  const pageSeo = looksLikeCatalogue
    ? await fetchPageSeo(backendBase, branding.instituteId, segs[0], segs[1])
    : null;

  const title = escapeHtml(
    pageSeo?.title || branding.tabText || branding.instituteName || ""
  );
  const description = escapeHtml(
    pageSeo?.description || `${branding.instituteName}`
  );

  // The big unfurl thumbnail uses the main institute logo; the favicon /
  // apple-touch-icon prefer the dedicated tab icon. Resolve both (deduped).
  const ogImageFileId =
    branding.instituteLogoFileId || branding.tabIconFileId || "";
  const faviconFileId =
    branding.tabIconFileId || branding.instituteLogoFileId || "";
  const [ogImage, faviconResolved] = await Promise.all([
    ogImageFileId ? resolveLogoUrl(ogImageFileId, backendBase) : Promise.resolve(""),
    faviconFileId === ogImageFileId
      ? Promise.resolve("")
      : faviconFileId
        ? resolveLogoUrl(faviconFileId, backendBase)
        : Promise.resolve(""),
  ]);
  const favicon = faviconResolved || ogImage;

  // The S3 objects are served with a wrong content-type, which makes crawlers
  // refuse to render them. Route og:image through our same-origin proxy, which
  // re-serves the bytes with a correct image/* content-type.
  // Page-level OG image (stored as a full public URL) wins over the logo;
  // both go through the same-origin proxy for the content-type fix.
  const ogImageSource = pageSeo?.ogImage || ogImage;
  const ogImageProxied = ogImageSource
    ? `${url.origin}/branding-image?u=${encodeURIComponent(ogImageSource)}`
    : "";

  // Build OG meta tags
  const ogTags = [
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeHtml(request.url)}" />`,
    ogImageProxied ? `<meta property="og:image" content="${escapeHtml(ogImageProxied)}" />` : "",
    // Twitter card
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    ogImageProxied ? `<meta name="twitter:image" content="${escapeHtml(ogImageProxied)}" />` : "",
  ]
    .filter(Boolean)
    .join("\n    ");

  let html = await response.text();

  // Replace the static description with institute-specific one
  html = html.replace(
    /<meta name="description" content="Learning Platform" \/>/,
    `<meta name="description" content="${description}" />`
  );

  // Replace the static title (matches both empty and "Course Catalogue").
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);

  // Inject OG tags before </head>
  html = html.replace("</head>", `    ${ogTags}\n  </head>`);

  // Replace existing apple-touch-icon and favicon with the institute icon for crawlers
  if (favicon) {
    const escapedLogo = escapeHtml(favicon);
    // Replace apple-touch-icon href
    html = html.replace(
      /<link\s+rel="apple-touch-icon"[^>]*\/>/,
      `<link rel="apple-touch-icon" href="${escapedLogo}" />`
    );
    // Replace any existing shortcut icon / icon links
    html = html.replace(
      /<link\s+rel="(?:shortcut )?icon"[^>]*\/>/g,
      `<link rel="icon" href="${escapedLogo}" />`
    );
    // Also add a favicon link if none existed
    if (!html.includes('rel="icon"')) {
      html = html.replace(
        "</head>",
        `    <link rel="icon" href="${escapedLogo}" />\n  </head>`
      );
    }
  }

  // Strip the manifest link for crawlers — it references default Vacademy icons
  html = html.replace(/<link\s+rel="manifest"[^>]*\/?>/, "");

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
