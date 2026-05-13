// Cloudflare Pages Function: server-side proxy to https://slack.com/api.
// Injects the Slack bot token from `context.env.SLACK_BOT_TOKEN`.
// Configure SLACK_BOT_TOKEN as an ENCRYPTED env var in:
//   Cloudflare Pages → Settings → Environment variables
// The token is NEVER sent to the browser.

const ALLOWED_METHODS = new Set(["GET", "POST", "OPTIONS"]);

// Restrict which Slack API methods are reachable through this proxy.
// Add more if the dialog needs them.
const ALLOWED_SLACK_METHODS = new Set([
  "chat.postMessage",
  "files.getUploadURLExternal",
  "files.completeUploadExternal",
]);

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (!ALLOWED_METHODS.has(request.method)) {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const token = env.SLACK_BOT_TOKEN;
  if (!token) {
    return new Response("SLACK_BOT_TOKEN not configured", { status: 500 });
  }

  const segments = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const slackMethod = segments.join("/");

  if (!ALLOWED_SLACK_METHODS.has(slackMethod)) {
    return new Response(`Slack method not allowed: ${slackMethod}`, { status: 403 });
  }

  const inUrl = new URL(request.url);
  const targetUrl = `https://slack.com/api/${slackMethod}${inUrl.search}`;

  const headers = new Headers(request.headers);
  headers.delete("authorization");
  headers.delete("cookie");
  headers.delete("host");
  headers.set("Authorization", `Bearer ${token}`);

  const slackRes = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" ? undefined : request.body,
  });

  return new Response(slackRes.body, {
    status: slackRes.status,
    headers: slackRes.headers,
  });
}
