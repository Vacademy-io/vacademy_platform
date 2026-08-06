import axios from "axios";
import { urlInstituteDetails } from "@/constants/urls";

// Public, read-only institute details (details-non-batches). Several screens
// fetch this on mount with plain axios; within one SPA session that repeats
// the same GET on every navigation. Memoize per institute with a short TTL —
// long enough to absorb route churn, short enough that admin-side edits
// (naming, batches) still show up within a minute.
const TTL_MS = 60_000;

interface MemoEntry {
  ts: number;
  promise: Promise<unknown>;
}

const memo = new Map<string, MemoEntry>();

export function fetchInstituteDetailsCached<T = unknown>(
  instituteId: string,
): Promise<T> {
  const hit = memo.get(instituteId);
  if (hit && Date.now() - hit.ts <= TTL_MS) {
    return hit.promise as Promise<T>;
  }
  const promise = axios
    .get(`${urlInstituteDetails}/${instituteId}`)
    .then((response) => response.data as unknown);
  memo.set(instituteId, { ts: Date.now(), promise });
  // Never memoize failures — the next caller should retry the network.
  promise.catch(() => {
    if (memo.get(instituteId)?.promise === promise) memo.delete(instituteId);
  });
  return promise as Promise<T>;
}
