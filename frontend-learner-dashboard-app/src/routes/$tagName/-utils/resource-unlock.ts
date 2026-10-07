import { useEffect, useState } from "react";

/**
 * "Email once, download everything" for gated resource cards.
 *
 * A featureGrid in `resource` style can bind an Audience list
 * (`gateAudienceId`) and flag individual card links as `gated`. The first time
 * a visitor opens a gated link they get that list's form in the
 * AudienceFormModal; once it is submitted, the list id is remembered in
 * localStorage so every gated card bound to the same list opens directly —
 * on this page and on every other page of the site, in this browser.
 *
 * This is lead capture, not access control: the files themselves stay public.
 */

const STORAGE_PREFIX = "catalogue-resource-unlock:";
const UNLOCK_EVENT = "catalogueResourceUnlocked";

export const isResourceUnlocked = (audienceId: string): boolean => {
  if (!audienceId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + audienceId) === "1";
  } catch {
    // Private mode / storage disabled — the visitor just sees the form again.
    return false;
  }
};

export const markResourceUnlocked = (audienceId: string): void => {
  if (!audienceId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + audienceId, "1");
  } catch {
    // Ignore — the unlock still holds for this modal session.
  }
  window.dispatchEvent(new CustomEvent(UNLOCK_EVENT, { detail: { audienceId } }));
};

/**
 * Live unlock state for one list. Starts locked on the server render and
 * resolves from storage after mount, then flips when any modal on the page
 * reports a submission for the same list.
 */
export const useResourceUnlocked = (audienceId: string): boolean => {
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    if (!audienceId) return;
    setUnlocked(isResourceUnlocked(audienceId));
    const onUnlock = (e: Event) => {
      if ((e as CustomEvent).detail?.audienceId === audienceId) setUnlocked(true);
    };
    window.addEventListener(UNLOCK_EVENT, onUnlock);
    return () => window.removeEventListener(UNLOCK_EVENT, onUnlock);
  }, [audienceId]);
  return unlocked;
};
