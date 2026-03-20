// Cloudflare Pages middleware that injects Open Graph meta tags
// for social media crawlers (WhatsApp, Facebook, Twitter, etc.)
// by fetching institute branding from the domain-routing API.

const CRAWLER_UA_REGEX =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|Googlebot|bingbot|Applebot|Pinterest|Viber|Skype/i;

const BACKEND_BASE =
  "https://backend-stage.vacademy.io";

const MEDIA_PUBLIC_URL =
  `${BACKEND_BASE}/media-service/public/get-public-url`;

const DOMAIN_ROUTING_URL =
  `${BACKEND_BASE}/admin-core-service/public/domain-routing/v1/resolve`;

interface DomainRoutingResponse {
  instituteId: string;
  instituteName: string;
  instituteLogoFileId: string;
  instituteThemeCode: string;
  tabText?: string | null;
  tabIconFileId?: string | null;
}

async function resolveLogoUrl(fileId: string): Promise<string> {
  try {
    const url = `${MEDIA_PUBLIC_URL}?fileId=${encodeURIComponent(fileId)}&expiryDays=7`;
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
  subdomain: string
): Promise<DomainRoutingResponse | null> {
  try {
    const url = `${DOMAIN_ROUTING_URL}?domain=${encodeURIComponent(domain)}&subdomain=${encodeURIComponent(subdomain)}`;
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
  const { domain, subdomain } = parseDomainParts(hostname);

  // Fetch branding from domain-routing API
  const branding = await fetchBranding(domain, subdomain);
  if (!branding) {
    return response;
  }

  const title = escapeHtml(branding.tabText || branding.instituteName || "");
  const description = escapeHtml(
    `${branding.instituteName} — Learning Platform`
  );

  // Resolve logo URL from fileId
  const logoFileId =
    branding.tabIconFileId || branding.instituteLogoFileId || "";
  let ogImage = "";
  if (logoFileId) {
    ogImage = await resolveLogoUrl(logoFileId);
  }

  // Build OG meta tags
  const ogTags = [
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeHtml(request.url)}" />`,
    ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />` : "",
    // Twitter card
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : "",
  ]
    .filter(Boolean)
    .join("\n    ");

  let html = await response.text();

  // Replace the static description with institute-specific one
  html = html.replace(
    /<meta name="description" content="Learning Platform" \/>/,
    `<meta name="description" content="${description}" />`
  );

  // Replace empty title
  html = html.replace(/<title><\/title>/, `<title>${title}</title>`);

  // Inject OG tags before </head>
  html = html.replace("</head>", `    ${ogTags}\n  </head>`);

  // If there's a logo URL, also inject a favicon link for crawlers
  if (ogImage) {
    html = html.replace(
      "</head>",
      `    <link rel="icon" href="${escapeHtml(ogImage)}" />\n  </head>`
    );
  }

  return new Response(html, {
    status: response.status,
    headers: response.headers,
  });
};
