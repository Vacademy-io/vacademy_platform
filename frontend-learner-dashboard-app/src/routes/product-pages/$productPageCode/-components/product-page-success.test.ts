import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (k: string, o?: Record<string, unknown>) =>
            k === 'success.access.oneYear' ? '1 year access'
            : k === 'success.youSaved' ? `You saved ${o?.amount}`
            : k === 'success.totalPaid' ? 'Total paid'
            : k,
    }),
}));
vi.mock('@/components/common/layout-container/sidebar/utils', () => ({
    getTerminology: () => 'Course', getTerminologyPlural: () => 'Courses',
}));
vi.mock('@/utils/ios-iap-compliance', () => ({ shouldHidePaidPurchaseUI: () => false }));
vi.mock('../-stores/product-page-store', () => ({
    useProductPageStore: () => ({
        selectedPsOptionIds: ['o0', 'o1', 'o2', 'o3'],
        utmParams: {},
        finalPrice: () => 899,
        totalPrice: () => 1396,
    }),
}));

const { ProductPageSuccess } = await import('./ProductPageSuccess');

// The four courses from the screenshot: Class 5 English, Maths, Science, G.K.
const SUBJECTS = [
    ['iThinkers Olympiad -ENGLISH', 'English - Class 5'],
    ['iThinkers Academy - MATHS', 'Mathematics - Class 5'],
    ['iThinkers Academy - SCIENCE', 'Science - Class 5'],
    ['iThinkers Academy - G.K.', 'G.K. - Class 5'],
];

/**
 * The receipt a parent is left holding. Every course on a basket-priced page
 * shares ONE payment plan ("Per Subject"), so a list built from the plan name
 * printed the same row four times — nothing on the page could be checked
 * against what was actually bought, or against the bank.
 */
describe('the enrolled-course list', () => {
    it('names each course instead of repeating the plan', () => {
        const pageData = {
            settings_json: null,
            currency: 'INR',
            mappings: SUBJECTS.map(([pkg, level], i) => ({
                ps_invite_payment_option_id: `o${i}`,
                package_name: pkg,
                level_name: level,
                session_name: '2026-27',
                payment_plan: { name: 'Per Subject', actual_price: 349, currency: 'INR', validity_in_days: 365 },
            })),
        };
        const html = renderToStaticMarkup(
            React.createElement(ProductPageSuccess, { pageData: pageData as never }),
        );
        const text = html.replace(/<[^>]+>/g, '\n').replace(/&#x20B9;/g, '₹')
            .split('\n').map((l) => l.trim()).filter(Boolean);
        expect(text).toContain('English - Class 5 · 2026-27 · 1 year access');

        for (const [pkg, level] of SUBJECTS) {
            expect(html).toContain(pkg);
            expect(html).toContain(level);
        }
        expect(html).not.toContain('Per Subject');
    });
});
