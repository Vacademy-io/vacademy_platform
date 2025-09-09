import axios, { AxiosInstance, AxiosResponse } from "axios";

type CacheEntry<T> = { etag: string; data: T; timestamp: number };
const etagCache: Record<string, CacheEntry<any>> = {};

function makeKey(url: string, params?: any) {
  const p = params ? JSON.stringify(params) : "";
  return `${url}|${p}`;
}

export async function getWithETag<T>(
  instance: AxiosInstance | undefined,
  url: string,
  params?: Record<string, any>,
  config?: { withCredentials?: boolean }
): Promise<T> {
  const key = makeKey(url, params);
  const headers: Record<string, string> = {};
  if (etagCache[key]?.etag) headers["If-None-Match"] = etagCache[key].etag;

  const http = instance ?? axios;

  let res: AxiosResponse<T>;
  try {
    res = await http.get<T>(url, {
      params,
      headers,
      withCredentials: config?.withCredentials,
      validateStatus: () => true,
    });

    if (res.status === 304 && etagCache[key]) {
      return etagCache[key].data as T;
    }

    if (res.status >= 200 && res.status < 300) {
      const etagHeader = (res.headers as any)["etag"] as string | undefined;
      if (etagHeader) {
        etagCache[key] = { etag: etagHeader, data: res.data, timestamp: Date.now() };
      }
      return res.data;
    }

    throw new Error(`Request failed: ${res.status}`);
  } catch (error) {
    if (etagCache[key]) return etagCache[key].data as T;
    throw error;
  }
}

export function clearEtagCache() {
  for (const k of Object.keys(etagCache)) delete etagCache[k];
}


