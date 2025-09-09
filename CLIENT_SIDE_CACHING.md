### Client-side caching guide for Media Service

This guide explains how to leverage HTTP caching for Media Service endpoints so your client can reduce latency and bandwidth using Cache-Control and ETag.

### What the server sends

- **ETag**: Weak ETag that changes when the requested key changes.
  - For single URLs/details: `W/"<fileId>:<expiryDays>"`
  - For multiple IDs: `W/"<fileIds>:<expiryDays>"`
  - For `source` lookups: `W/"<source>:<sourceId>:<expiryDays>"`
- **Cache-Control**
  - URL responses: `public, max-age=3600, stale-while-revalidate=60`
  - Details/list responses: `public, max-age=300, stale-while-revalidate=60`
- **304 Not Modified**: Returned when the client revalidates using `If-None-Match` and the resource didn’t change.

### Endpoints covered

- Public (no auth):
  - `GET /media-service/public/get-public-url?fileId=<id>&expiryDays=<days>`
- Authenticated:
  - `GET /media-service/get-public-url?fileId=<id>&expiryDays=<days>`
  - `GET /media-service/get-details/ids?fileIds=<id1,id2,...>&expiryDays=<days>`
- Internal:
  - `GET /media-service/internal/get-url/id?fileId=<id>&expiryDays=<days>`
  - `GET /media-service/internal/get-details/id?fileId=<id>&expiryDays=<days>`
  - `GET /media-service/internal/get-details/ids?fileIds=<id1,id2,...>&expiryDays=<days>`
  - `GET /media-service/internal/get-url/id/many?fileIds=<id1,id2,...>&expiryDays=<days>`
  - `GET /media-service/internal/get-public-url/id/many?fileIds=<id1,id2,...>`
  - `GET /media-service/internal/get-public-url/source?source=<src>&sourceId=<id>&expiryDays=<days>`

### Quick start: rely on browser caching

- Use normal GET requests. Do not force `no-store`/`no-cache` in your HTTP library.
- Browsers will store responses per `Cache-Control` and send `If-None-Match` automatically on revalidation.

Example with fetch (default cache policy):

```ts
const res = await fetch(`/media-service/get-public-url?fileId=${fileId}&expiryDays=7`, {
  credentials: 'include' // if your app uses cookies
});
// If fresh: 200 OK with body
// If revalidated and unchanged: 304 Not Modified
```

Note: Some SPA setups or proxies disable caching. Ensure you do NOT set headers like `Cache-Control: no-store` on requests or responses.

### Robust SPA pattern: ETag-aware axios wrapper

If you want explicit control (e.g., to return cached JSON on 304), use an axios wrapper that stores data keyed by ETag per request key.

```ts
import axios from 'axios';

type CacheEntry<T> = { etag: string; data: T; timestamp: number };
const cache: Record<string, CacheEntry<any>> = {};

function makeKey(url: string, params?: any) {
  const p = params ? JSON.stringify(params) : '';
  return `${url}|${p}`;
}

export async function getWithETag<T>(url: string, params?: any, withCredentials = true): Promise<T> {
  const key = makeKey(url, params);
  const headers: Record<string, string> = {};
  if (cache[key]?.etag) headers['If-None-Match'] = cache[key].etag;

  try {
    const res = await axios.get<T>(url, { params, headers, withCredentials, validateStatus: () => true });

    if (res.status === 304 && cache[key]) {
      return cache[key].data as T;
    }

    if (res.status >= 200 && res.status < 300) {
      const etag = res.headers['etag'] as string | undefined;
      if (etag) cache[key] = { etag, data: res.data, timestamp: Date.now() };
      return res.data;
    }

    throw new Error(`Request failed: ${res.status}`);
  } catch (err) {
    if (cache[key]) return cache[key].data as T; // optional fallback
    throw err;
  }
}

// Usage examples
// Single URL
await getWithETag<string>('/media-service/public/get-public-url', { fileId, expiryDays: 7 }, false);
// Multiple details
await getWithETag('/media-service/get-details/ids', { fileIds: ids.join(','), expiryDays: 7 });
```

### React Query / TanStack Query

- Set `staleTime` to align with server max-age (e.g., 60 min for URL; 5 min for details).
- Use `queryKey` including `fileId` and `expiryDays`.
- The network layer can be the ETag-aware wrapper above; React Query will then serve cached data on 304 seamlessly.

```ts
useQuery({
  queryKey: ['file-url', fileId, expiryDays],
  queryFn: () => getWithETag<string>('/media-service/public/get-public-url', { fileId, expiryDays }, false),
  staleTime: 60 * 60 * 1000
});
```

### Service Worker (optional)

- You can implement a SWR strategy with Workbox: cache-first with revalidate for URL endpoints, and shorter TTL for details endpoints.
- Add `If-None-Match` on revalidation and return cached body when the network responds 304.

### Testing revalidation

```bash
# 1) Initial request
curl -i "<BASE>/media-service/public/get-public-url?fileId=<ID>&expiryDays=7"

# 2) Repeat with ETag from the response
curl -i -H "If-None-Match: W\"<fileId>:7\"" "<BASE>/media-service/public/get-public-url?fileId=<ID>&expiryDays=7"
# Expect: 304 Not Modified
```

### Practical tips

- **Keep `expiryDays` stable** in your client for a given view; changing it changes the ETag and forces a refresh.
- **Images/links**: If you render the returned URL in `<img>`/`<a>` tags, browsers will also cache those requests normally.
- **Logout**: Clear your app’s client cache (if you built a custom one) on user logout.
- **Multi-tenant**: Include tenant context in your request keys if relevant.

### Questions?

If you need a framework-specific example (Next.js, Vue, Angular, React Native), let us know and we’ll provide a tailored snippet.


