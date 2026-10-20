/*! Vacademy Site Assistant loader. data-key, data-site, [data-position, data-api-base].
 * Session made from this page; its token reaches the iframe only via postMessage to its exact origin. */
(function () {
"use strict";
var NS = "vacademy-site-assistant", w = window, d = document, L = location, ls = "localStorage", ss = "sessionStorage";
if (w.__vacademySiteAssistant) return;
var sc = d.currentScript || [].slice.call(d.querySelectorAll('script[data-key][src*="site-assistant.js"]')).pop();
if (!sc) return;
w.__vacademySiteAssistant = true;
var at = function (n) { return sc.getAttribute("data-" + n) || ""; };
var key = at("key"), site = at("site"), pos = /left/.test(at("position")) ? "left" : "right", origin, api;
if (!key || !site) return warn("data-key and data-site required");
try {
  origin = new URL(sc.src, L.href).origin;
  var b = new URL(at("api-base") || "https://backend-stage.vacademy.io");
  if (b.protocol !== "https:" && b.hostname !== "localhost") return warn("data-api-base must be https");
  api = b.origin + b.pathname.replace(/\/+$/, "") + "/ai-service/site-assistant/v1/sessions";
} catch (e) { return warn("bad URL"); }

var SKEY = "vsa:session:" + site, RKEY = "vsa:reopen:" + site;
var session = null, frame = null, open = false, href = L.href, overflow = null;

function warn(m) { if (w.console) console.warn("[site-assistant] " + m); }
function fail(err) { warn(err.message); }
function get(s, k) { try { return w[s].getItem(k); } catch (e) { return null; } }
function set(s, k, v) { try { v === null ? w[s].removeItem(k) : w[s].setItem(k, v); } catch (e) { /* blocked */ } }
function visitor() {
  var v = get(ls, "vsa:visitor");
  if (!/^[A-Za-z0-9-]{8,64}$/.test(v || "")) {
    try { v = crypto.randomUUID(); } catch (e) { v = "v" + Date.now().toString(36) + Math.random().toString(36).slice(2); }
    set(ls, "vsa:visitor", v);
  }
  return v;
}
function resumeId() {
  try {
    var s = JSON.parse(get(ls, SKEY) || "null");
    return s && typeof s.id === "string" && Date.now() - s.at < 432e5 ? s.id : null;
  } catch (e) { return null; }
}
function page() { return { url: L.href.slice(0, 2000), route: L.pathname, title: (d.title || "").slice(0, 300) }; }
function lang() { return (d.documentElement.lang || "").slice(0, 16); }

function create(resume) {
  var body = { site_tag: site, page: page(), visitor_id: visitor() }, r = resume && resumeId(), utm = {}, any;
  try {
    new URLSearchParams(L.search).forEach(function (v, k) { if (/^utm_[a-z]+$/.test(k) && v) utm[k] = any = v.slice(0, 200); });
  } catch (e) { /* old browser */ }
  if (any) body.utm = utm;
  if (lang()) body.locale = lang();
  if (r) body.resume_session_id = r;
  return fetch(api, {
    method: "POST", credentials: "omit", body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", "X-API-Key": key }
  }).then(function (res) {
    if (res.ok) return res.json();
    // stale resume id: start fresh
    if (r && res.status >= 400 && res.status < 500 && [401, 403, 429].indexOf(res.status) < 0) return create(false);
    throw new Error("session " + res.status);
  }).then(function (s) {
    if (!s || !s.session_id || !s.token) throw new Error("bad session");
    session = s;
    set(ls, SKEY, JSON.stringify({ id: s.session_id, at: Date.now() }));
  });
}

function post(m) {
  if (!frame || !frame.contentWindow) return;
  m.ns = NS;
  frame.contentWindow.postMessage(m, origin);
}
function init() {
  if (session) post({ type: "init", sid: session.session_id, token: session.token, expires_at: session.expires_at,
    assistant: session.assistant, history: session.history, page: page() });
}
function layout(o) {
  open = o;
  var full = o && w.innerWidth < 640, st = frame.style, rs = d.documentElement.style;
  st.display = "block";
  st.top = st.left = st.right = st.bottom = "auto";
  if (full) { st.top = st.left = "0"; st.width = st.height = "100%"; }
  else { st.bottom = st[pos] = "12px"; st.width = (o ? 400 : 80) + "px"; st.height = (o ? Math.min(680, w.innerHeight - 24) : 80) + "px"; }
  // phone sheet: lock page scroll
  if (full && overflow === null) { overflow = rs.overflow; rs.overflow = "hidden"; }
  if (!full && overflow !== null) { rs.overflow = overflow; overflow = null; }
  post({ type: "layout", fullscreen: full });
}
function navigate(url) {
  try {
    var u = new URL(url, L.href);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || u.origin !== L.origin) return;
    if (w.innerWidth >= 640) set(ss, RKEY, "1"); // reopen chat after
    L.href = u.href;
  } catch (e) { /* ignore */ }
}
function mount() {
  var q = "sid=" + encodeURIComponent(session.session_id) + "&pos=" + pos;
  if (lang()) q += "&lang=" + encodeURIComponent(lang());
  if (get(ss, RKEY) === "1") { q += "&open=1"; set(ss, RKEY, null); }
  frame = d.createElement("iframe");
  frame.src = origin + "/site-assistant-embed?" + q;
  frame.title = (session.assistant && session.assistant.name) || "Chat";
  frame.setAttribute("referrerpolicy", "strict-origin");
  frame.style.cssText = "position:fixed;display:none;border:0;margin:0;padding:0;background:transparent;" +
    "color-scheme:normal;z-index:2147483000;max-width:100%;max-height:100%";
  d.body.appendChild(frame);
}
function changed() {
  if (L.href !== href) post({ type: "page", page: page() });
  href = L.href;
}

w.addEventListener("message", function (e) {
  var m = e.data;
  if (!frame || e.origin !== origin || e.source !== frame.contentWindow || !m || m.ns !== NS) return;
  if (m.type === "ready") init();
  else if (m.type === "resize") layout(m.open === true);
  else if (m.type === "navigate" && typeof m.url === "string") navigate(m.url);
  else if (m.type === "expired") create(false).then(init, fail);
});
w.addEventListener("resize", function () { if (frame && open) layout(true); });
w.addEventListener("popstate", changed);
w.addEventListener("hashchange", changed);
setInterval(changed, 1500); // SPA navigation

function start() { create(true).then(mount, fail); }
if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", start);
else start();
})();
