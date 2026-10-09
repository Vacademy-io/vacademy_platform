import { beforeEach, describe, expect, it } from 'vitest';
import { isDifferentProductPage } from './page-switch';
import { useProductPageStore } from '../-stores/product-page-store';

describe('isDifferentProductPage', () => {
    it('is a switch only when another page was served before', () => {
        expect(isDifferentProductPage(null, { id: 'a', code: 'A' })).toBe(false);
        expect(isDifferentProductPage({ id: 'a', code: 'A' }, { id: 'a', code: 'A' })).toBe(false);
        expect(isDifferentProductPage({ id: 'a', code: 'A' }, { id: 'b', code: 'B' })).toBe(true);
    });

    it('falls back to the code when an id is missing', () => {
        expect(isDifferentProductPage({ id: '', code: 'A' }, { id: '', code: 'A' })).toBe(false);
        expect(isDifferentProductPage({ id: '', code: 'A' }, { id: '', code: 'B' })).toBe(true);
    });
});

describe('switching pages clears what must not carry over', () => {
    beforeEach(() => useProductPageStore.getState().reset());

    it('a reset on switch drops the previous page coupon and learner', () => {
        const store = useProductPageStore.getState();
        store.setPageData({ id: 'a', code: 'A', mappings: [] } as never);
        store.applyCoupon('coupon-1', 'applied-1', 100);
        store.setFormSubmitResult('user-1', ['cart-1']);

        const next = { id: 'b', code: 'B' };
        if (isDifferentProductPage(useProductPageStore.getState().pageData, next)) {
            useProductPageStore.getState().reset();
        }
        const after = useProductPageStore.getState();
        expect(after.couponId).toBe('');
        expect(after.discountAmount).toBe(0);
        expect(after.userId).toBeNull();
    });
});
