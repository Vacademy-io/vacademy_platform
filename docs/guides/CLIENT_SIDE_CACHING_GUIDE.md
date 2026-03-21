## Client-side caching integration guide

This guide explains how the frontend should cache GET API responses safely using HTTP headers we now send from the server. Implementing this will reduce latency and API load.

### What the server sends
- **Cache-Control**: Specifies whether a response can be cached and for how long.
  - Example values: `public, max-age=600`, `private, max-age=60`, `no-store`
- **Vary**: Declares request headers that influence the cache key. This prevents serving the wrong user/institute data from cache.
  - We commonly vary on: `Authorization`, `X-Institute-Id`, `X-User-Id`, `X-Package-Session-Id`.

You do NOT need to hardcode TTLs in the client. Respect the headers and use them as the source of truth.

### Your cache key
For client caches (Memory, Service Worker, IndexedDB):
- Include the full URL (including query params) AND any Vary headers present on the request.
- Minimum recommended key parts:
  - HTTP method + full URL
  - `Authorization` (if present)
  - `X-Institute-Id` (if present)
  - `X-User-Id` (if present)
  - `X-Package-Session-Id` (if present)

Pseudo-key: `GET {url}?{query} :: auth={...} :: inst={...} :: user={...} :: pkgSess={...}`

### Endpoints and typical TTLs
The server controls TTL via headers, but for reference:
- Domain routing resolve: public, ~10 minutes
- Institute info: public, ~10 minutes
- Tag lists and stats: private, ~5 minutes (varies by institute)
- Learner course content (subjects/modules/slides): private, ~60 seconds (varies by user and package session)
- Live sessions lists and details: private, ~30–60 seconds (varies by user and institute)

Always obey server headers rather than assuming these defaults.

### Implementation examples

#### Fetch wrapper with in-memory cache (TypeScript)
```ts
type CacheEntry = { body: any; expiresAt: number; varyHeaders: string[] };
const memoryCache = new Map<string, CacheEntry>();

function buildCacheKey(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers as HeadersInit);
  const auth = headers.get('Authorization') || '';
  const inst = headers.get('X-Institute-Id') || '';
  const user = headers.get('X-User-Id') || '';
  const pkg = headers.get('X-Package-Session-Id') || '';
  return `GET ${url} :: auth=${auth} :: inst=${inst} :: user=${user} :: pkg=${pkg}`;
}

function parseMaxAge(cacheControl: string | null): number | null {
  if (!cacheControl) return null;
  const m = cacheControl.match(/max-age=(\d+)/i);
  return m ? Number(m[1]) : null;
}

export async function cachedGet(url: string, init?: RequestInit) {
  const key = buildCacheKey(url, init);
  const now = Date.now();
  const existing = memoryCache.get(key);
  if (existing && existing.expiresAt > now) {
    return structuredClone(existing.body);
  }

  const resp = await fetch(url, { ...init, method: 'GET' });
  const cc = resp.headers.get('Cache-Control');
  const vary = (resp.headers.get('Vary') || '').split(',').map(v => v.trim()).filter(Boolean);
  const maxAge = parseMaxAge(cc);
  const data = await resp.clone().json().catch(() => resp.text());

  if (maxAge && maxAge > 0 && resp.ok) {
    memoryCache.set(key, {
      body: data,
      expiresAt: now + maxAge * 1000,
      varyHeaders: vary,
    });
  }
  return data;
}
```

#### Axios interceptor sketch
```ts
import axios from 'axios';

const cache = new Map<string, { data: any; expiresAt: number }>();

function keyFromConfig(config: any) {
  const url = config.url;
  const auth = config.headers?.Authorization || '';
  const inst = config.headers?.['X-Institute-Id'] || '';
  const user = config.headers?.['X-User-Id'] || '';
  const pkg = config.headers?.['X-Package-Session-Id'] || '';
  return `GET ${url} :: auth=${auth} :: inst=${inst} :: user=${user} :: pkg=${pkg}`;
}

axios.interceptors.request.use(cfg => {
  if (cfg.method?.toUpperCase() === 'GET') {
    const key = keyFromConfig(cfg);
    const entry = cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      // @ts-ignore
      cfg.adapter = async () => ({
        data: entry.data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: cfg,
        request: {}
      });
    }
  }
  return cfg;
});

axios.interceptors.response.use(resp => {
  if (resp.config.method?.toUpperCase() === 'GET') {
    const cc = String(resp.headers['cache-control'] || '');
    const m = cc.match(/max-age=(\d+)/i);
    const maxAge = m ? Number(m[1]) : 0;
    if (maxAge > 0) {
      const key = keyFromConfig(resp.config);
      cache.set(key, { data: resp.data, expiresAt: Date.now() + maxAge * 1000 });
    }
  }
  return resp;
});
```

### When to bypass cache
- On critical updates where fresh data is required, add `Cache-Control: no-cache` to the request to force revalidation, or append a cache-busting query param.
- When the server responds with `no-store`, do not cache at all.

### Required request headers
Ensure your client consistently sends these when applicable so the cache key is correct and Vary is effective:
- `Authorization: Bearer <token>` (if authenticated)
- `X-Institute-Id: <instituteId>`
- `X-User-Id: <userId>` (if acting on a specific user)
- `X-Package-Session-Id: <packageSessionId>` (for learner content)

### QA checklist
- Verify responses include expected Cache-Control and Vary headers.
- Confirm different users/institutes do not cross-pollinate cached content.
- Validate cache expiration times align with server max-age.
- Confirm updates appear after TTL or when forcing revalidation.

### Questions?
If you need example integrations for React Query, SWR, or Service Worker Cache API, let us know and we’ll provide snippets.


