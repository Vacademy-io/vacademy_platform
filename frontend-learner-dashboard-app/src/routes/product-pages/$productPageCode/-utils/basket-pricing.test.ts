import { describe, expect, it } from 'vitest';
import {
    nextTier,
    quoteBasket,
    savingsPercent,
    tierDiscount,
    type BasketPricingSettings,
} from './basket-pricing';

/**
 * The engine that decides what a parent is charged. BasketPricingCalculator.java
 * is the authority; these cases are the shared contract, so a change that breaks
 * one of them must be made in both files or not at all.
 */

const PRICE = 349; // what one subject costs on its enroll invite
const items = (n: number, price = PRICE) =>
    Array.from({ length: n }, (_, i) => ({
        levelName: 'Class 5',
        packageName: `Subject ${i}`,
        price,
    }));

const GROUPS = [{ label: 'Class 5', levels: ['Class 5'] }];

/** The iThinkers B2C price card, as absolute prices per count. */
const FLAT: BasketPricingSettings = {
    enabled: true,
    ladder: { prices: [349, 599, 799], perExtra: 150 },
    groups: GROUPS,
};

/** The same card, as discounts off what the courses cost on their invites. */
const DISCOUNT: BasketPricingSettings = {
    enabled: true,
    pricingBasis: 'DISCOUNT',
    ladder: { prices: [], perExtra: 0 },
    tiers: [
        { minCourses: 2, type: 'AMOUNT', value: 99 },
        { minCourses: 3, type: 'AMOUNT', value: 248 },
        { minCourses: 4, type: 'AMOUNT', value: 447 },
        { minCourses: 5, type: 'AMOUNT', value: 646 },
    ],
    groups: GROUPS,
};

const CARD: Record<number, number> = { 1: 349, 2: 599, 3: 799, 4: 949, 5: 1099 };

describe('the published price card', () => {
    it.each([1, 2, 3, 4, 5])('charges the card price for %i subject(s) on a FLAT page', (n) => {
        expect(quoteBasket(FLAT, items(n))!.total).toBe(CARD[n]);
    });

    it.each([1, 2, 3, 4, 5])('charges the same on a DISCOUNT page for %i subject(s)', (n) => {
        expect(quoteBasket(DISCOUNT, items(n))!.total).toBe(CARD[n]);
    });

    it('reports what the courses cost apart, so the saving can be shown', () => {
        const quote = quoteBasket(DISCOUNT, items(3))!;
        expect(quote.itemTotal).toBe(1047);
        expect(quote.total).toBe(799);
        expect(savingsPercent(quote)).toBe(24);
    });
});

describe('percentage tiers', () => {
    const PCT: BasketPricingSettings = {
        enabled: true,
        pricingBasis: 'DISCOUNT',
        ladder: { prices: [], perExtra: 0 },
        tiers: [
            { minCourses: 2, type: 'PERCENT', value: 15 },
            { minCourses: 4, type: 'PERCENT', value: 25 },
        ],
        groups: GROUPS,
    };

    it('keeps scaling past the last rung, which a flat ladder cannot', () => {
        expect(quoteBasket(PCT, items(2))!.total).toBe(593); // 698 − 15%
        expect(quoteBasket(PCT, items(6))!.total).toBe(1571); // 2094 − 25%
    });

    it('follows the courses when the invite reprices them', () => {
        // The whole point: nothing in the page settings says 349.
        expect(quoteBasket(PCT, items(2, 500))!.total).toBe(850);
    });

    it('names how far the next tier is, in courses rather than rupees', () => {
        expect(nextTier(PCT, 1)).toEqual({
            coursesAway: 1,
            label: '15% off',
            offer: { type: 'PERCENT', value: 15, incremental: false },
        });
        expect(nextTier(PCT, 3)).toEqual({
            coursesAway: 1,
            label: '25% off',
            offer: { type: 'PERCENT', value: 25, incremental: false },
        });
        expect(nextTier(PCT, 4)).toBeNull();
    });

    it('quotes the EXTRA saving, not the new total, once a tier already applies', () => {
        // 2 subjects already carry ₹99 off; a third takes the discount to ₹248,
        // which is ₹149 MORE — promising ₹248 would overstate the gain.
        expect(nextTier(DISCOUNT, 2, 698)).toEqual({
            coursesAway: 1,
            label: '₹149 more off',
            offer: { type: 'AMOUNT', value: 149, incremental: true },
        });
        // Nothing applied yet, so the tier's own figure is the honest one.
        expect(nextTier(DISCOUNT, 1, 349)).toEqual({
            coursesAway: 1,
            label: '₹99 off',
            offer: { type: 'AMOUNT', value: 99, incremental: false },
        });
    });

    it('carries the offer as data so a translated surface can phrase it', () => {
        // The bar renders in four locales; a baked English label would strand
        // ar / fr / hi on "₹149 more off".
        const ahead = nextTier(PCT, 1)!;
        expect(ahead.offer.type).toBe('PERCENT');
        expect(ahead.offer.incremental).toBe(false);
    });
});

describe('guardrails', () => {
    it('never discounts below zero', () => {
        expect(tierDiscount({ ...DISCOUNT, tiers: [{ minCourses: 1, type: 'AMOUNT', value: 99999 }] }, 349, 1)).toBe(349);
    });

    it('leaves a free course free under DISCOUNT', () => {
        expect(quoteBasket(DISCOUNT, items(1, 0))!.total).toBe(0);
    });

    it('leaves FLAT pages with free courses exactly as they were', () => {
        expect(quoteBasket(FLAT, items(2, 0))!.total).toBe(599);
        expect(quoteBasket(FLAT, items(5, 0))!.total).toBe(1099);
    });

    it('does not let a DISCOUNT tier charge more than the courses cost apart', () => {
        const bad: BasketPricingSettings = {
            ...DISCOUNT,
            tiers: [{ minCourses: 1, type: 'AMOUNT', value: -500 }],
        };
        expect(quoteBasket(bad, items(1))!.total).toBe(349);
    });

    it('never takes a discount away for adding another subject', () => {
        // A tier list whose later rung is worth less would, under a
        // highest-threshold rule, punish the parent for a fifth subject.
        const backwards: BasketPricingSettings = {
            ...DISCOUNT,
            tiers: [
                { minCourses: 2, type: 'AMOUNT', value: 500 },
                { minCourses: 5, type: 'AMOUNT', value: 100 },
            ],
        };
        expect(tierDiscount(backwards, 698, 2)).toBe(500);
        expect(tierDiscount(backwards, 1745, 5)).toBe(500);
    });

    it('still prefers a full pack or combo when one is cheaper', () => {
        const withPack: BasketPricingSettings = {
            ...DISCOUNT,
            groups: [{ label: 'Class 5', levels: ['Class 5'], packPrice: 499 }],
        };
        expect(quoteBasket(withPack, items(3))!.total).toBe(499);
    });
});
