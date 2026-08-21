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
  playStoreAppLink?: string | null;
  appStoreAppLink?: string | null;
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

async function fetchBrandingOnce(
  domain: string,
  subdomain: string,
  backendBase: string
): Promise<DomainRoutingResponse | null> {
  try {
    const url = `${getDomainRoutingUrl(backendBase)}?domain=${encodeURIComponent(domain)}&subdomain=${encodeURIComponent(subdomain)}`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      // Edge-cache the resolve: crawlers arrive in bursts and every manifest
      // request now goes through here too. Branding changes rarely.
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit);
    if (res.ok) {
      return (await res.json()) as DomainRoutingResponse;
    }
  } catch {
    // fall through
  }
  return null;
}

async function fetchBranding(
  domain: string,
  subdomain: string,
  backendBase: string
): Promise<DomainRoutingResponse | null> {
  const direct = await fetchBrandingOnce(domain, subdomain, backendBase);
  if (direct) return direct;
  // Apex domains (no subdomain) are stored with the wildcard subdomain "*" —
  // that is what the app itself sends (see getCurrentDomainInfo). Without this
  // retry, every two-part white-label host resolved to nothing and fell back to
  // Vacademy branding.
  if (!subdomain) {
    return await fetchBrandingOnce(domain, "*", backendBase);
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

function isVacademyHost(hostname: string): boolean {
  return (
    /(^|\.)vacademy\.io$/.test(hostname) ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  );
}

/** Play Store links carry the package id in ?id=; related_applications wants it. */
function playPackageId(link: string): string {
  try {
    return new URL(link).searchParams.get("id") || "";
  } catch {
    return "";
  }
}

const nonEmpty = (v: string | null | undefined): string =>
  typeof v === "string" && v.trim() ? v.trim() : "";

/**
 * instituteThemeCode is not always a colour — plenty of institutes store a
 * theme *name* ("amber", "blue") that the app maps through theme.json. A
 * manifest theme_color must be a CSS colour, so only pass hex through and let
 * the browser pick its own default otherwise.
 */
const hexColor = (v: string | null | undefined): string => {
  const value = nonEmpty(v);
  return /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : "";
};

/**
 * Per-institute PWA manifest.
 *
 * The static public/manifest.webmanifest is hardcoded to name "Vacademy" with
 * Vacademy icons, and it was served verbatim on every white-labelled domain —
 * so Chrome's install prompt read "Install Vacademy" with the Vacademy mark on
 * e.g. students.zoeedtech.com. Resolve the institute from the hostname and
 * answer with its own name, icon and theme colour instead.
 *
 * When the institute ships a real native app we go further: `related_applications`
 * + `prefer_related_applications` tells Chrome to stop offering the PWA at all,
 * so the only thing a learner is nudged towards is that institute's own store
 * listing (the in-app <GetAppBanner /> does the actual suggesting).
 */
async function serveManifest(
  context: Parameters<PagesFunction>[0],
  url: URL
): Promise<Response> {
  const hostname = url.hostname;
  const backendBase = getBackendBase(hostname);
  const { domain, subdomain } = parseDomainParts(hostname);
  const branding = await fetchBranding(domain, subdomain, backendBase);

  const json = (body: unknown) =>
    new Response(JSON.stringify(body, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/manifest+json; charset=utf-8",
        "cache-control": "public, max-age=300, must-revalidate",
      },
    });

  if (!branding) {
    // Vacademy's own hosts legitimately want the Vacademy manifest.
    if (isVacademyHost(hostname)) return context.next();
    // On an unresolved white-label host, an install prompt is better suppressed
    // than mis-branded: no icons => Chrome treats the app as not installable,
    // so nobody is offered "Install Vacademy" under someone else's domain.
    return json({
      name: hostname,
      short_name: hostname,
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#ffffff",
    });
  }

  const name = nonEmpty(branding.tabText) || nonEmpty(branding.instituteName) || hostname;

  // Prefer the dedicated tab icon: it is the square-ish mark, whereas the main
  // institute logo is often a wide lockup that would be squashed into the
  // launcher's square icon slot.
  const iconFileId =
    nonEmpty(branding.tabIconFileId) || nonEmpty(branding.instituteLogoFileId);
  const iconSource = iconFileId ? await resolveLogoUrl(iconFileId, backendBase) : "";
  // Same-origin proxy: guarantees an image/* content-type (S3 objects are stored
  // with the wrong one) and keeps the icon on our own cache-control.
  const iconUrl = iconSource
    ? `${url.origin}/branding-image?u=${encodeURIComponent(iconSource)}`
    : "";

  // Declared sizes are what Chrome's installability check reads; it only requires
  // the fetched bitmap to decode. "any" purpose (not "maskable") on purpose — an
  // arbitrary institute logo has no safe zone and would be cropped into a circle.
  const icons = iconUrl
    ? ["96x96", "128x128", "192x192", "256x256", "512x512"].map((sizes) => ({
        src: iconUrl,
        sizes,
        purpose: "any",
      }))
    : [];

  const play = nonEmpty(branding.playStoreAppLink);
  const itunes = nonEmpty(branding.appStoreAppLink);
  const relatedApplications = [
    ...(play
      ? [{ platform: "play", url: play, ...(playPackageId(play) ? { id: playPackageId(play) } : {}) }]
      : []),
    ...(itunes ? [{ platform: "itunes", url: itunes }] : []),
  ];

  return json({
    name,
    short_name: name,
    description: nonEmpty(branding.instituteName) || name,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    ...(hexColor(branding.instituteThemeCode)
      ? { theme_color: hexColor(branding.instituteThemeCode) }
      : {}),
    orientation: "portrait-primary",
    categories: ["education", "productivity"],
    lang: "en-US",
    icons,
    ...(relatedApplications.length
      ? {
          related_applications: relatedApplications,
          // The institute has its own app — don't compete with it.
          prefer_related_applications: true,
        }
      : {}),
  });
}

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;
  const ua = request.headers.get("user-agent") || "";
  const url = new URL(request.url);

  // Per-institute PWA manifest. Handled before the crawler check because this
  // one is for real browsers, not bots.
  if (url.pathname === "/manifest.webmanifest") {
    return serveManifest(context, url);
  }

  // Only intercept for crawlers
  if (!CRAWLER_UA_REGEX.test(ua)) {
    return context.next();
  }

  // Only intercept HTML page requests, not assets
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
