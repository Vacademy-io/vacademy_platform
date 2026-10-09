import type { ProductPageData } from '../-types/product-page-types';

type PageIdentity = Pick<ProductPageData, 'id' | 'code'>;

/**
 * Is `next` a different product page from the one the (module-level) store
 * last served? Then its coupon, discount, learner and CPO state must not carry
 * over. Nothing served yet, or the same page again, is not a switch.
 */
export const isDifferentProductPage = (
    previous: PageIdentity | null | undefined,
    next: PageIdentity
): boolean => {
    if (!previous) return false;
    const key = (p: PageIdentity) => (p.id || p.code || '').trim();
    return key(previous) !== key(next);
};
