/**
 * Opening the site cart drawer from anywhere on the page.
 *
 * The drawer belongs to the header's cart button. Other sections (a learning
 * path's "Add whole path to cart", a course card) open it with
 * `window.dispatchEvent(new CustomEvent('siteCartOpen'))` or openSiteCartDrawer().
 *
 * Exactly one drawer opens per request even when the header renders more than
 * one cart button (desktop + mobile bars): a single window listener hands the
 * request to the most recently mounted button.
 */

export const SITE_CART_OPEN_EVENT = "siteCartOpen";

type Opener = () => void;

const openers: Opener[] = [];
let listening = false;

const handleOpenRequest = () => {
  openers[openers.length - 1]?.();
};

/** A cart button registers how to open its drawer; returns the unregister function. */
export const registerSiteCartOpener = (open: Opener): (() => void) => {
  openers.push(open);
  if (!listening && typeof window !== "undefined") {
    window.addEventListener(SITE_CART_OPEN_EVENT, handleOpenRequest);
    listening = true;
  }
  return () => {
    const index = openers.lastIndexOf(open);
    if (index >= 0) openers.splice(index, 1);
    if (!openers.length && listening && typeof window !== "undefined") {
      window.removeEventListener(SITE_CART_OPEN_EVENT, handleOpenRequest);
      listening = false;
    }
  };
};

/** True when some cart button on the page can open the drawer. */
export const hasSiteCartOpener = (): boolean => openers.length > 0;

/**
 * Opens the header's cart drawer. Returns false when no cart button is
 * mounted (a page without the site header), so the caller can show its own.
 */
export const openSiteCartDrawer = (): boolean => {
  if (!openers.length || typeof window === "undefined") return false;
  window.dispatchEvent(new CustomEvent(SITE_CART_OPEN_EVENT));
  return true;
};
