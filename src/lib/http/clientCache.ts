import axios from "axios";
import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig, AxiosRequestHeaders, AxiosAdapter } from "axios";

type CacheEntry = {
  data: unknown;
  expiresAt: number;
  // Stored for potential debugging/inspection; not used for keying
  varyHeaders?: string[];
};

const memoryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<AxiosResponse>>();

function getHeaderValue(headers: AxiosRequestHeaders | Record<string, unknown> | undefined, name: string): string {
  if (!headers) return "";
  const direct = (headers as Record<string, unknown>)[name];
  if (typeof direct === "string") return direct;
  const lower = (headers as Record<string, unknown>)[name.toLowerCase()];
  if (typeof lower === "string") return lower;
  return "";
}

function stableStringify(value: unknown): string {
  try {
    if (typeof value === "string") return value;
    if (value === undefined || value === null) return "";
    if (typeof value !== "object") return String(value);
    const seen = new WeakSet<object>();
    const normalize = (obj: unknown): unknown => {
      if (obj && typeof obj === "object") {
        if (seen.has(obj as object)) return undefined;
        seen.add(obj as object);
        if (Array.isArray(obj)) return obj.map((v) => normalize(v));
        const keys = Object.keys(obj as Record<string, unknown>).sort();
        const out: Record<string, unknown> = {};
        for (const k of keys) out[k] = normalize((obj as Record<string, unknown>)[k]);
        return out;
      }
      return obj;
    };
    return JSON.stringify(normalize(value));
  } catch {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}

function serializeParams(params: Record<string, unknown> | URLSearchParams | undefined): string {
  if (!params) return "";
  try {
    const usp = new URLSearchParams();
    if (params instanceof URLSearchParams) {
      params.forEach((value, key) => usp.append(key, value));
    } else {
      Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (Array.isArray(v)) {
          v.forEach((item) => usp.append(k, String(item)));
        } else if (typeof v === "object") {
          usp.append(k, JSON.stringify(v));
        } else {
          usp.append(k, String(v));
        }
      });
    }
    const s = usp.toString();
    return s ? `?${s}` : "";
  } catch {
    return "";
  }
}

export function buildKeyFromAxiosConfig(config: AxiosRequestConfig): string {
  const method = (config.method || "GET").toUpperCase();
  const base = config.baseURL || "";
  const rawUrl = (config.url || "").startsWith("http") ? (config.url as string) : `${base}${config.url || ""}`;
  const paramString = serializeParams((config as unknown as { params?: Record<string, unknown> | URLSearchParams }).params);
  const url = `${rawUrl}${paramString}`;
  const headers = (config.headers || {}) as AxiosRequestHeaders | Record<string, unknown>;

  const auth = getHeaderValue(headers, "Authorization");
  const inst = getHeaderValue(headers, "X-Institute-Id");
  const user = getHeaderValue(headers, "X-User-Id");
  const pkg = getHeaderValue(headers, "X-Package-Session-Id");

  const includeBody = isCacheableByMethodAndUrl({ method, url: rawUrl });
  let bodySegment = "";
  if (includeBody) {
    const rawData = (config as unknown as { data?: unknown }).data;
    let bodyVal: unknown = rawData;
    if (typeof rawData === "string") {
      try {
        bodyVal = JSON.parse(rawData);
      } catch {
        // keep as string if not JSON
      }
    }
    bodySegment = ` :: body=${stableStringify(bodyVal)}`;
  }
  return `${method} ${url} :: auth=${auth} :: inst=${inst} :: user=${user} :: pkgSess=${pkg}${bodySegment}`;
}

export function buildKeyFromFetch(url: string, init?: RequestInit): string {
  const headers = new Headers(init?.headers as HeadersInit);
  const auth = headers.get("Authorization") || "";
  const inst = headers.get("X-Institute-Id") || "";
  const user = headers.get("X-User-Id") || "";
  const pkg = headers.get("X-Package-Session-Id") || "";
  const method = (init?.method || "GET").toUpperCase();
  return `${method} ${url} :: auth=${auth} :: inst=${inst} :: user=${user} :: pkgSess=${pkg}`;
}

export function parseMaxAge(cacheControl: string | null | undefined): number | null {
  if (!cacheControl) return null;
  const match = cacheControl.match(/max-age=(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function hasNoStore(cacheControl: string | null | undefined): boolean {
  if (!cacheControl) return false;
  return /\bno-store\b/i.test(cacheControl);
}

export function hasNoCache(cacheControl: string | null | undefined): boolean {
  if (!cacheControl) return false;
  return /\bno-cache\b/i.test(cacheControl);
}

export function getCachedData<T = unknown>(key: string): T | null {
  const now = Date.now();
  const entry = memoryCache.get(key);
  if (entry && entry.expiresAt > now) {
    return structuredClone(entry.data) as T;
  }
  if (entry && entry.expiresAt <= now) {
    memoryCache.delete(key);
  }
  return null;
}

export function setCacheData(key: string, data: unknown, maxAgeSeconds: number, vary?: string[]): void {
  const now = Date.now();
  memoryCache.set(key, {
    data,
    expiresAt: now + maxAgeSeconds * 1000,
    varyHeaders: vary,
  });
}

export function shouldBypassCache(headers?: AxiosRequestHeaders | Record<string, unknown>): boolean {
  if (!headers) return false;
  const cc = getHeaderValue(headers, "Cache-Control");
  if (cc && /\bno-cache\b/i.test(cc)) return true;
  return false;
}

// Axios helpers
export function maybeServeFromCache(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const method = (config.method || "GET").toUpperCase();
  const rawUrl = (config.url || "") as string;
  if (!isCacheableByMethodAndUrl({ method, url: rawUrl })) return config;
  if (shouldBypassCache(config.headers)) return config;

  const key = buildKeyFromAxiosConfig(config);
  const cached = getCachedData<unknown>(key);
  if (!cached) {
    // De-duplicate concurrent identical requests
    const pending = inFlightRequests.get(key);
    if (pending) {
      config.adapter = async () => {
        const resp = await pending;
        return resp;
      };
      return config;
    }

    const cfgAdapterUnknown = (config as unknown as { adapter?: unknown }).adapter as unknown;
    const defaultsAdapterUnknown = axios.defaults.adapter as unknown;

    let selectedAdapter: AxiosAdapter | undefined;
    if (typeof cfgAdapterUnknown === "function") {
      selectedAdapter = cfgAdapterUnknown as AxiosAdapter;
    } else if (Array.isArray(defaultsAdapterUnknown)) {
      selectedAdapter = (defaultsAdapterUnknown.find((a) => typeof a === "function") as AxiosAdapter | undefined);
    } else if (typeof defaultsAdapterUnknown === "function") {
      selectedAdapter = defaultsAdapterUnknown as AxiosAdapter;
    }

    if (selectedAdapter) {
      config.adapter = async (cfg) => {
        const p = selectedAdapter!(cfg as InternalAxiosRequestConfig);
        inFlightRequests.set(key, p);
        try {
          const resp = await p;
          return resp;
        } finally {
          inFlightRequests.delete(key);
        }
      };
    }
    return config;
  }

  try {
    if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).__CACHE_DEBUG__) {
      console.log(`[client-cache] HIT`, { key, url: config.url, method: config.method });
    }
  } catch { /* ignore */ }

  const adapter: AxiosAdapter = async () => {
    const resp: AxiosResponse = {
      data: cached,
      status: 200,
      statusText: "OK",
      headers: {
        "x-cache": "HIT",
        "x-cache-key": key,
      },
      config,
      request: {},
    };
    return resp;
  };
  config.adapter = adapter;
  return config;
}

export function maybeStoreInCache(response: AxiosResponse): AxiosResponse {
  const method = (response.config.method || "GET").toUpperCase();
  const rawUrl = (response.config.url || "") as string;
  if (!isCacheableByMethodAndUrl({ method, url: rawUrl })) return response;
  if (shouldBypassCache(response.config.headers as AxiosRequestHeaders)) return response;

  const cacheControl = String((response.headers as Record<string, unknown>)?.["cache-control"] || "");
  if (!cacheControl || hasNoStore(cacheControl)) return response;
  const maxAge = parseMaxAge(cacheControl) || 0;
  if (maxAge <= 0) return response;

  const varyHeader = String((response.headers as Record<string, unknown>)?.["vary"] || "");
  const vary = varyHeader
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const key = buildKeyFromAxiosConfig(response.config);
  setCacheData(key, response.data, maxAge, vary);
  try {
    // Mark the live response as a cacheable MISS for debugging visibility
    (response.headers as Record<string, unknown>)["x-cache"] = "MISS";
    (response.headers as Record<string, unknown>)["x-cache-key"] = key;
    if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).__CACHE_DEBUG__) {
      console.log(`[client-cache] MISS → stored`, { key, url: response.config.url, method: response.config.method, maxAge });
    }
  } catch { /* ignore */ }
  return response;
}

export function getClientCacheInfo(): { size: number; keys: string[] } {
  return {
    size: memoryCache.size,
    keys: Array.from(memoryCache.keys()),
  };
}

// Allow-list of non-GET endpoints that are safe to cache client-side
const CACHEABLE_MUTATING_ENDPOINTS = [
  "/admin-core-service/learner-packages/v1/search",
];

function isCacheableByMethodAndUrl({ method, url }: { method: string; url: string }): boolean {
  if (method === "GET") return true;
  if (method === "POST") {
    try {
      const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://local");
      const path = u.pathname;
      return CACHEABLE_MUTATING_ENDPOINTS.some((p) => path.endsWith(p));
    } catch {
      return CACHEABLE_MUTATING_ENDPOINTS.some((p) => url.includes(p));
    }
  }
  return false;
}

// Minimal fetch helper using the same cache
export async function cachedGet<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  if (method !== "GET") {
    return fetch(url, init).then((r) => r.json() as Promise<T>);
  }

  const key = buildKeyFromFetch(url, init);
  const headers = new Headers(init?.headers as HeadersInit);
  const ccReq = headers.get("Cache-Control");
  if (ccReq && /\bno-cache\b/i.test(ccReq)) {
    const resp = await fetch(url, { ...init, method: "GET" });
    return resp.json();
  }

  const cached = getCachedData<T>(key);
  if (cached) return cached;

  const resp = await fetch(url, { ...init, method: "GET" });
  const ccResp = resp.headers.get("Cache-Control");
  const varyHeader = resp.headers.get("Vary") || "";
  const vary = varyHeader
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const maxAge = parseMaxAge(ccResp) || 0;
  const data = await resp.clone().json().catch(() => resp.text()) as T;
  if (ccResp && !hasNoStore(ccResp) && maxAge > 0 && resp.ok) {
    setCacheData(key, data, maxAge, vary);
  }
  return data;
}

export function clearClientCache(): void {
  memoryCache.clear();
}


