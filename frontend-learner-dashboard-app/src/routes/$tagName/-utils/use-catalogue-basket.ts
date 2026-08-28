import { useEffect, useState } from "react";

/**
 * Whether the visitor has a basket going on this catalogue.
 *
 * ProductPageOfferComponent keeps its cart in sessionStorage under
 * `catalogue-offer-cart:<productPageCode>` so it survives the trip to checkout
 * and back. The catalogue page itself needs the same answer — to know whether
 * the visitor is mid-purchase — without owning that cart or plumbing state up
 * through the section tree.
 *
 * Read on mount and on focus/storage changes rather than polled: the cart only
 * changes through this tab's own components (which re-render anyway) or
 * through the checkout tab, which fires `storage`.
 */
const KEY_PREFIX = "catalogue-offer-cart:";

const anyBasketFilled = (): boolean => {
    if (typeof window === "undefined") return false;
    try {
        for (let i = 0; i < window.sessionStorage.length; i++) {
            const key = window.sessionStorage.key(i);
            if (!key || !key.startsWith(KEY_PREFIX)) continue;
            const parsed = JSON.parse(window.sessionStorage.getItem(key) || "null");
            if (Array.isArray(parsed) && parsed.length > 0) return true;
        }
    } catch {
        // Private mode / storage disabled — treat as no basket, which is the
        // same as today's behaviour.
    }
    return false;
};

export const useCatalogueBasketActive = (): boolean => {
    const [active, setActive] = useState<boolean>(anyBasketFilled);

    useEffect(() => {
        const refresh = () => setActive(anyBasketFilled());
        // The cart is written by a sibling component in this same tab, which
        // does not fire `storage` — so re-check whenever the tab regains focus
        // or becomes visible, plus the cross-tab event for completeness.
        window.addEventListener("storage", refresh);
        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", refresh);
        const id = window.setInterval(refresh, 1000);
        return () => {
            window.removeEventListener("storage", refresh);
            window.removeEventListener("focus", refresh);
            document.removeEventListener("visibilitychange", refresh);
            window.clearInterval(id);
        };
    }, []);

    return active;
};
