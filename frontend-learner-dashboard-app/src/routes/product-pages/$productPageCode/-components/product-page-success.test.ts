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

/**
 * "Redirect Path" in the product page's Post Enrollment Configuration. The
 * setting has been offered in the admin UI ("the user will be instantly
 * redirected to this path after successful enrollment") while the learner app
 * only read it into a variable it never used, so every institute that set one
 * still got the built-in receipt.
 */
describe('the after-payment redirect', () => {
    const render = (afterPaymentRedirectUrl: string) => {
        const pageData = {
            settings_json: JSON.stringify({ afterPaymentRedirectUrl }),
            currency: 'INR',
            mappings: [
                {
                    ps_invite_payment_option_id: 'o0',
                    package_name: 'UnlockX Scholarship Test',
                    level_name: 'Class 10',
                    session_name: '2026-27',
                    payment_plan: { name: 'Registration', actual_price: 349, currency: 'INR' },
                },
            ],
        };
        return renderToStaticMarkup(
            React.createElement(ProductPageSuccess, { pageData: pageData as never }),
        );
    };

    it('hands the buyer over to the configured page instead of the receipt', () => {
        const html = render('https://shikshanation.com/thank-you');
        expect(html).toContain('href="https://shikshanation.com/thank-you"');
        expect(html).toContain('success.redirecting');
        // The receipt is skipped — it would only flash past before the handover.
        expect(html).not.toContain('success.goToMyCourses');
    });

    it('keeps the receipt when the configured value is not a usable destination', () => {
        // A `javascript:` URL, and a bare host the browser would resolve as a
        // relative path off /product-pages/ — both are institute typos, and
        // neither may replace a working receipt with a dead end.
        for (const bad of ['javascript:alert(1)', 'shikshanation.com/thank-you', '']) {
            const html = render(bad);
            expect(html).toContain('success.goToMyCourses');
            expect(html).not.toContain('success.redirecting');
        }
    });
});
