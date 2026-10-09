// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// React 19 requires this before act(); the repo has no shared test setup file.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));
vi.mock('@tanstack/react-query', () => ({
    useMutation: () => ({ mutate: () => undefined, isPending: false }),
}));
vi.mock('../-services/product-page-service', () => ({ validateCoupon: async () => ({}) }));
vi.mock('@/components/common/enroll-by-invite/-utils/gtm', () => ({
    pushCartViewed: () => undefined,
    pushCouponApplied: () => undefined,
}));
vi.mock('@/components/common/coupon/use-coupons-enabled', () => ({ useCouponsEnabled: () => true }));
vi.mock('@/routes/$tagName/-utils/catalogue-naming', () => ({
    useCourseTerms: () => ({ course: 'Course', courses: 'Courses' }),
}));
vi.mock('./PlanTiles', () => ({ PlanTiles: () => null }));
vi.mock('./CartItemList', () => ({ CartItemList: () => null }));
vi.mock('./OffersStrip', () => ({ OffersStrip: () => null }));
vi.mock('./MobileCheckoutBar', () => ({ MobileCheckoutBar: () => null }));

import { CartStep } from './CartStep';
import { useProductPageStore } from '../-stores/product-page-store';
import type { ProductPageData, ProductPageSettings } from '../-types/product-page-types';

const settings = {
    defaultStep: 'CART',
    allowCourseDeselection: true,
    tnc: { enabled: false, content: '', externalUrl: '' },
    invoice: { enabled: false, channels: [] },
    coupon: { enabled: true },
} as ProductPageSettings;

const page = (price: number): ProductPageData =>
    ({
        id: 'store-1',
        name: 'Store',
        code: 'STORE',
        institute_id: 'inst-1',
        status: 'ACTIVE',
        page_json: null,
        settings_json: JSON.stringify(settings),
        short_url: null,
        mappings: [
            {
                id: 'm-a',
                ps_invite_payment_option_id: 'opt-a',
                package_session_id: 'ps-a',
                payment_plan_id: `plan-${price}`,
                payment_plan: { id: `plan-${price}`, name: 'Plan', actual_price: price, currency: 'INR' },
                status: 'ACTIVE',
            },
        ],
        aggregated_custom_fields: [],
        vendor: 'RAZORPAY',
        currency: 'INR',
        gtm_container_id: null,
    }) as unknown as ProductPageData;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const mountWithCoupon = () => {
    const store = useProductPageStore.getState();
    store.setPageData(page(1000));
    store.setSelection(['opt-a']);
    store.applyCoupon('coupon-1', 'applied-1', 100);
    store.setCouponCode('SAVE10');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
        root!.render(
            React.createElement(CartStep, {
                pageData: page(1000),
                settings,
                onBack: () => undefined,
                onNext: () => undefined,
            })
        )
    );
};

const text = () => container!.textContent ?? '';
const couponInput = () => container!.querySelector('input[aria-label="cartStep.couponCard.title"]') as HTMLInputElement | null;

beforeEach(() => useProductPageStore.getState().reset());
afterEach(() => {
    if (root) act(() => root!.unmount());
    container?.remove();
    root = null;
    container = null;
});

describe('the cart coupon box', () => {
    it('shows an applied coupon as applied', () => {
        mountWithCoupon();
        expect(text()).toContain('SAVE10');
        expect(couponInput()).toBeNull();
    });

    it('stops showing a coupon as applied once the page reprices the basket', () => {
        mountWithCoupon();

        // The page arrives again with a new price (see syncPageData).
        act(() => useProductPageStore.getState().syncPageData(page(1500)));

        expect(text()).not.toContain('cartStep.couponCard.discountOff');
        expect(couponInput()?.value).toBe('SAVE10');
        expect(text()).toContain('cartStep.couponChanged');
    });

    it('says nothing when the learner removes the coupon themselves', () => {
        mountWithCoupon();
        const remove = container!.querySelector('button[aria-label="cartStep.item.removeTooltip"]') as HTMLButtonElement;

        act(() => remove.click());

        expect(couponInput()?.value).toBe('');
        expect(text()).not.toContain('cartStep.couponChanged');
    });
});
