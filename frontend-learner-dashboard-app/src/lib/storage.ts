export function safeParse<T>(value: string | null | undefined, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error("safeParse: failed to parse stored value", error);
    return fallback;
  }
}
