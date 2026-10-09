import { create } from "zustand";
import { preferencesGet, preferencesSet } from "../../../utils/preferences-storage";
import {
  removeCartItems,
  siteCartStorageKey,
  upsertCartItem,
  upsertCartItems,
  type SiteCartItem,
} from "../-utils/site-cart";

/**
 * The site-wide course cart (see -utils/site-cart.ts for the model). One cart
 * per institute, persisted through preferences storage (localStorage on the
 * web, Capacitor Preferences in the app — same as the book cart). Every
 * mutation writes through; `hydrate` must run once per institute before the
 * cart is read (SiteCartProvider / the first consumer does it).
 */

interface SiteCartState {
  instituteId: string | null;
  items: SiteCartItem[];
  hydrated: boolean;
  /** Bumped on every successful add, so a cart button can animate. */
  lastAddedAt: number;
  hydrate: (instituteId: string) => Promise<void>;
  add: (item: SiteCartItem) => void;
  addMany: (items: SiteCartItem[]) => void;
  remove: (packageSessionId: string) => void;
  removeMany: (packageSessionIds: string[]) => void;
  clear: () => void;
  has: (packageSessionId: string) => boolean;
  hasCourse: (courseId: string) => boolean;
}

const persist = (instituteId: string | null, items: SiteCartItem[]) => {
  if (!instituteId) return;
  preferencesSet(siteCartStorageKey(instituteId), JSON.stringify(items)).catch(() => {
    // Storage unavailable (private mode): the in-memory cart still works for this visit.
  });
};

const parse = (raw: string | null): SiteCartItem[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((i) => i && typeof i.packageSessionId === "string" && typeof i.courseId === "string")
      : [];
  } catch {
    return [];
  }
};

export const useSiteCartStore = create<SiteCartState>((set, get) => ({
  instituteId: null,
  items: [],
  hydrated: false,
  lastAddedAt: 0,

  hydrate: async (instituteId) => {
    if (!instituteId) return;
    if (get().instituteId === instituteId && get().hydrated) return;
    set({ instituteId, hydrated: false });
    const stored = await preferencesGet(siteCartStorageKey(instituteId)).catch(() => ({ value: null }));
    // A different institute may have been hydrated while we waited.
    if (get().instituteId !== instituteId) return;
    set({ items: parse(stored.value), hydrated: true });
  },

  add: (item) => {
    const next = upsertCartItem(get().items, { ...item, addedAt: Date.now() });
    if (next === get().items) return;
    set({ items: next, lastAddedAt: Date.now() });
    persist(get().instituteId, next);
  },

  addMany: (items) => {
    const stamped = items.map((i, n) => ({ ...i, addedAt: Date.now() + n }));
    const next = upsertCartItems(get().items, stamped);
    if (next === get().items) return;
    set({ items: next, lastAddedAt: Date.now() });
    persist(get().instituteId, next);
  },

  remove: (packageSessionId) => get().removeMany([packageSessionId]),

  removeMany: (packageSessionIds) => {
    const next = removeCartItems(get().items, packageSessionIds);
    if (next.length === get().items.length) return;
    set({ items: next });
    persist(get().instituteId, next);
  },

  clear: () => {
    set({ items: [] });
    persist(get().instituteId, []);
  },

  has: (packageSessionId) => get().items.some((i) => i.packageSessionId === packageSessionId),
  hasCourse: (courseId) => get().items.some((i) => i.courseId === courseId),
}));

/**
 * Removes purchased courses from the stored cart without needing the store to
 * be mounted — for the product-page checkout's success path, which runs on a
 * different route. Safe to call when no site cart exists.
 */
export const removePurchasedFromSiteCart = async (instituteId: string | null | undefined, packageSessionIds: string[]) => {
  if (!instituteId || !packageSessionIds.length) return;
  try {
    const state = useSiteCartStore.getState();
    if (state.instituteId === instituteId) {
      state.removeMany(packageSessionIds);
      return;
    }
    const key = siteCartStorageKey(instituteId);
    const stored = await preferencesGet(key);
    const items = parse(stored.value);
    const next = removeCartItems(items, packageSessionIds);
    if (next.length !== items.length) await preferencesSet(key, JSON.stringify(next));
  } catch {
    // Never let cart housekeeping interfere with a completed payment.
  }
};
