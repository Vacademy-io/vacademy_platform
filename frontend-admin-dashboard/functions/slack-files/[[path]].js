// Cloudflare Pages Function: forwards /slack-files/* to https://files.slack.com/*.
// Slack's files.getUploadURLExternal returns a pre-signed URL on files.slack.com
// that carries its own auth. We proxy only to bypass browser CORS — no token here.

export async function onRequest(context) {
  const { request, params } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const segments = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const inUrl = new URL(request.url);
  const targetUrl = `https://files.slack.com/${segments.join("/")}${inUrl.search}`;

  const headers = new Headers(request.headers);
  headers.delete("authorization");
  headers.delete("cookie");
  headers.delete("host");

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
