/**
 * Prices a basket as a WHOLE, instead of adding up what each course costs.
 *
 * MIRROR OF THE SERVER. BasketPricingCalculator.java is authoritative — the
 * enrollment endpoint recomputes the total and overwrites whatever the client
 * sends. If these two disagree the visitor is shown one price and charged
 * another, so a rule change belongs in both files at once.
 *
 * Why it REPLACES the sum rather than discounting it: on a catalogue that sells
 * "any 3 subjects for ₹799" the courses carry no price of their own (iThinkers'
 * are all ₹0), so a percentage off the sum is a percentage of nothing.
 *
 * The rules, in full:
 *  - `pricingBasis` picks what the rules mean. FLAT (default) reads `ladder` as
 *    ABSOLUTE prices — the only thing that works when the courses are ₹0 and
 *    carry no price to discount. DISCOUNT reads `tiers` as a reduction off what
 *    the courses actually cost on their enroll invites, so the single-subject
 *    rate has ONE home: the payment plan. Under FLAT it is written down twice,
 *    here and on the plan, and the two drift apart;
 *  - the ladder gives a price for a basket of 1, 2, 3 … and `perExtra` for each
 *    course beyond the last listed price;
 *  - a tier is {minCourses, type: PERCENT|AMOUNT, value}. The highest
 *    minCourses the basket reaches wins, so a tier at 3 also covers 4, 5, … —
 *    which is the point of a percentage: it scales without a rung per count;
 *  - groups split the basket. `ladderScope: 'GROUP'` (default) runs the ladder
 *    inside each group, so a parent buying one subject each for two children
 *    pays two single-subject prices; `'BASKET'` runs it across everything, so
 *    those two reach the two-subject price. Which is right is a commercial
 *    decision, so it is a setting. Full packs and combos stay per-group either
 *    way — a "full grade pack" only means something within one grade;
 *  - a group whose selection covers EVERY level configured for it can take a
 *    `wholeGroupPrices` entry — the "full grade pack";
 *  - a combo is a set of package names at a fixed price, matched inside a
 *    group. Matched on package, not level, so ONE entry covers every class;
 *  - the LOWEST applicable price wins, so a bigger basket never costs more.
 *
 * Grouping uses admin-authored level lists, never a class parsed out of a level
 * name: the real names drift ("Cyber AI- Class 6", "Social Science Class - 5")
 * and some courses are filed under another subject's level entirely.
 */

export interface BasketPricingGroup {
    label: string;
    /** Level names belonging to this group. */
    levels: string[];
    /**
     * Price for taking EVERY level in this group — the "full grade pack".
     * Exact per group, so it keeps working when a class gains or loses a
     * subject; `wholeGroupPrices` is the fragile count-keyed fallback.
     */
    packPrice?: number;
}

export interface BasketPricingCombo {
    label: string;
    /** Package (course) names that must be selected EXACTLY, within one group. */
    packages: string[];
    price: number;
}

export interface BasketPricingTier {
    /** Applies once the basket reaches this many courses. */
    minCourses: number;
    type: 'PERCENT' | 'AMOUNT';
    /** Percent of the item total, or a flat currency amount. */
    value: number;
}

export interface BasketPricingSettings {
    enabled: boolean;
    /**
     * FLAT (default) prices by count via `ladder`. DISCOUNT reduces what the
     * courses cost on their enroll invites via `tiers`.
     */
    pricingBasis?: 'FLAT' | 'DISCOUNT';
    tiers?: BasketPricingTier[];
    ladder: {
        /** Price for a basket of 1, 2, 3 … in order. */
        prices: number[];
        /** Added for each course beyond the last listed price. */
        perExtra: number;
    };
    groups?: BasketPricingGroup[];
    /**
     * Where the ladder counts. GROUP (default) prices each group on its own;
     * BASKET counts every subject together, giving a parent buying for two
     * children the multi-subject rate.
     */
    ladderScope?: 'GROUP' | 'BASKET';
    /** Count → price, applied only when a group is fully covered. */
    wholeGroupPrices?: Record<string, number>;
    combos?: BasketPricingCombo[];
}

/** One selected course, reduced to what pricing cares about. */
export interface BasketItem {
    levelName?: string | null;
    packageName?: string | null;
    /** What its payment plan charges on the enroll invite. */
    price?: number | null;
}

export interface BasketQuoteLine {
    label: string;
    amount: number;
    /**
     * What this group's courses cost bought separately. The checkout needs it to
     * say "₹1,047 → ₹799, save ₹248" instead of quoting a bare ₹799 the parent
     * has no way to judge.
     */
    baseAmount: number;
    /** How this group's price was reached, shown in the summary. */
    how: string;
    count: number;
}

export interface BasketQuote {
    total: number;
    /** Sum of every line's baseAmount. */
    itemTotal: number;
    lines: BasketQuoteLine[];
}

const key = (v?: string | null) => (v ?? '').trim().toLowerCase();

export const parseBasketPricing = (
    settingsJson?: string | null
): BasketPricingSettings | undefined => {
    if (!settingsJson) return undefined;
    try {
        const cfg = JSON.parse(settingsJson)?.basketPricing as BasketPricingSettings | undefined;
        if (!cfg?.enabled) return undefined;
        // A DISCOUNT page needs no ladder at all — its base comes from the
        // courses. A FLAT page with no prices cannot price anything, so treat it
        // as unconfigured and fall back to item prices rather than to free.
        if (cfg.pricingBasis === 'DISCOUNT') return cfg;
        return cfg.ladder?.prices?.length ? cfg : undefined;
    } catch {
        return undefined;
    }
};

/** prices[n-1] while the list lasts, then the last price plus perExtra each. */
export const ladderPrice = (prices: number[], perExtra: number, count: number): number => {
    if (count <= 0) return 0;
    if (count <= prices.length) return prices[count - 1] ?? 0;
    return (prices[prices.length - 1] ?? 0) + perExtra * (count - prices.length);
};

const isDiscountBasis = (settings: BasketPricingSettings): boolean =>
    settings.pricingBasis === 'DISCOUNT';

/**
 * What a set of courses costs on its own.
 *
 * Falls back to the ladder's single-subject rate when the courses are ₹0 — a
 * FLAT page with free courses still needs something to measure the saving
 * against, and the one-subject rung is the figure its price card advertises.
 */
const baseFor = (settings: BasketPricingSettings, picked: BasketItem[]): number => {
    const sum = picked.reduce((total, item) => total + (item.price ?? 0), 0);
    if (sum > 0) return sum;
    return (settings.ladder?.prices?.[0] ?? 0) * picked.length;
};

/**
 * The discount for a basket of this size: the BEST of every tier the count
 * qualifies for. A PERCENT tier keeps scaling as the basket grows, which is why
 * it needs no rung per count; an AMOUNT tier stays flat.
 *
 * Best, not highest-threshold: a tier list where a later rung happens to be
 * worth less ("2+ → ₹500 off, 5+ → 10% off") would otherwise take the discount
 * AWAY from a parent for adding a fifth subject. Identical for the normal
 * increasing ladder.
 */
export const tierDiscount = (
    settings: BasketPricingSettings,
    base: number,
    count: number
): number => {
    let best = 0;
    for (const tier of settings.tiers ?? []) {
        const min = tier.minCourses ?? 0;
        if (min <= 0 || count < min) continue;
        const amount = tier.type === 'AMOUNT' ? tier.value : (base * tier.value) / 100;
        best = Math.max(best, amount);
    }
    return Math.min(Math.max(0, best), base);
};

const groupBasket = (
    settings: BasketPricingSettings,
    items: BasketItem[]
): Map<string, BasketItem[]> => {
    const levelToGroup = new Map<string, string>();
    for (const group of settings.groups ?? []) {
        for (const level of group.levels ?? []) levelToGroup.set(key(level), group.label);
    }
    const out = new Map<string, BasketItem[]>();
    for (const item of items) {
        const label = levelToGroup.get(key(item.levelName)) ?? '';
        out.set(label, [...(out.get(label) ?? []), item]);
    }
    return out;
};

export const quoteBasket = (
    settings: BasketPricingSettings | undefined,
    items: BasketItem[]
): BasketQuote | null => {
    if (!settings || items.length === 0) return null;

    const { prices, perExtra } = settings.ladder;
    const lines: BasketQuoteLine[] = [];

    for (const [label, picked] of groupBasket(settings, items)) {
        const count = picked.length;
        const base = baseFor(settings, picked);
        let best = isDiscountBasis(settings)
            ? base - tierDiscount(settings, base, count)
            : ladderPrice(prices, perExtra, count);
        let how = `${count} subject${count === 1 ? '' : 's'}`;

        // Full pack — every level configured for this group is in the basket.
        const configured = (settings.groups ?? [])
            .filter((g) => g.label === label)
            .flatMap((g) => g.levels ?? [])
            .map(key);
        if (label && configured.length > 0) {
            const pickedLevels = new Set(picked.map((p) => key(p.levelName)));
            const ownPack = (settings.groups ?? []).find((g) => g.label === label)?.packPrice;
            const packPrice =
                typeof ownPack === 'number' && ownPack > 0
                    ? ownPack
                    : settings.wholeGroupPrices?.[String(count)];
            if (
                configured.every((l) => pickedLevels.has(l)) &&
                typeof packPrice === 'number' &&
                packPrice < best
            ) {
                best = packPrice;
                how = 'full pack';
            }
        }

        // Combo — the group's packages are exactly a combo's set.
        const pickedPackages = new Set(picked.map((p) => key(p.packageName)));
        for (const combo of settings.combos ?? []) {
            const comboPackages = (combo.packages ?? []).map(key);
            if (
                comboPackages.length > 0 &&
                comboPackages.length === pickedPackages.size &&
                comboPackages.every((p) => pickedPackages.has(p)) &&
                combo.price < best
            ) {
                best = combo.price;
                how = combo.label;
            }
        }

        // Under DISCOUNT the base IS the starting point, so a misconfigured tier
        // must never push the basket above it. Under FLAT the ladder deliberately
        // REPLACES the item sum in both directions — capping there would silently
        // reprice every existing page whose courses undercut its own ladder.
        if (isDiscountBasis(settings) && base > 0) best = Math.min(best, base);

        lines.push({ label: label || 'Your selection', amount: best, baseAmount: base, how, count });
    }

    const grouped = Math.round(lines.reduce((sum, l) => sum + l.amount, 0));
    const itemTotal = Math.round(lines.reduce((sum, l) => sum + l.baseAmount, 0));

    if (settings.ladderScope === 'BASKET') {
        // One ladder over the whole basket. Never worse than pricing the groups
        // apart — a full pack or combo inside one group can still beat it.
        const whole = isDiscountBasis(settings)
            ? itemTotal - tierDiscount(settings, itemTotal, items.length)
            : ladderPrice(prices, perExtra, items.length);
        if (whole < grouped) {
            return {
                total: Math.max(0, Math.round(whole)),
                itemTotal,
                lines: [
                    {
                        label: 'Your selection',
                        amount: whole,
                        baseAmount: itemTotal,
                        how: `${items.length} subject${items.length === 1 ? '' : 's'}`,
                        count: items.length,
                    },
                ],
            };
        }
    }

    return { total: Math.max(0, grouped), itemTotal, lines };
};

/**
 * What the basket saves against buying each course on its own.
 *
 * This is the number the price card advertises ("Save ₹248 vs 3×singles"), and
 * it is the only saving worth showing under basket pricing: the courses have no
 * individual price to discount, so the comparison is against the ladder's own
 * one-subject rate.
 */
export const savingsVsSingles = (
    settings: BasketPricingSettings | undefined,
    quote: BasketQuote | null
): number => {
    if (!settings || !quote) return 0;
    return Math.max(0, Math.round(quote.itemTotal - quote.total));
};

/**
 * The next discount tier the basket has not reached, and how far away it is.
 *
 * This is the nudge a DISCOUNT page can make honestly: the threshold is a
 * course count, so "add 1 more subject for 25% off" is exact, where quoting a
 * rupee figure would depend on which course gets picked.
 *
 * `base` lets the label quote the EXTRA saving rather than the new total. A
 * basket already holding ₹99 off does not gain ₹248 by adding one more — it
 * gains ₹149, and promising the larger number is the kind of thing a parent
 * notices at the payment screen.
 */
export const nextTier = (
    settings: BasketPricingSettings | undefined,
    count: number,
    base = 0
): {
    coursesAway: number;
    /** English, for the surfaces that are not translated yet. */
    label: string;
    /** The same fact as data, so a translated surface can phrase it itself. */
    offer: { type: 'PERCENT' | 'AMOUNT'; value: number; incremental: boolean };
} | null => {
    if (!settings || !isDiscountBasis(settings)) return null;
    const ahead = (settings.tiers ?? [])
        .filter((t) => (t.minCourses ?? 0) > count)
        .sort((a, b) => a.minCourses - b.minCourses);
    const next = ahead[0];
    if (!next) return null;

    const alreadyOff = base > 0 ? tierDiscount(settings, base, count) : 0;
    let label: string;
    let offer: { type: 'PERCENT' | 'AMOUNT'; value: number; incremental: boolean };
    if (next.type === 'AMOUNT') {
        const extra = Math.round(next.value - alreadyOff);
        const incremental = alreadyOff > 0 && extra > 0;
        offer = { type: 'AMOUNT', value: incremental ? extra : next.value, incremental };
        label = incremental ? `₹${extra} more off` : `₹${next.value} off`;
    } else {
        offer = { type: 'PERCENT', value: next.value, incremental: false };
        label = `${next.value}% off`;
    }
    return { coursesAway: next.minCourses - count, label, offer };
};

/** The saving as a percentage of what the courses cost apart. 0 when there is none. */
export const savingsPercent = (quote: BasketQuote | null): number => {
    if (!quote || quote.itemTotal <= 0) return 0;
    return Math.max(0, Math.round(((quote.itemTotal - quote.total) / quote.itemTotal) * 100));
};

/**
 * What ONE more course would actually add, and where.
 *
 * Derived from the QUOTE, not from the basket's total count — under GROUP scope
 * the ladder runs inside each group, so a basket of two subjects in two
 * different classes is at step 1 twice, not at step 2. Reading the total count
 * there promised "₹200 for the next one" while the engine would have charged
 * ₹250 to add it to a class.
 *
 * Returns the cheapest option: extending an existing group, or starting a new
 * one at the first-subject price.
 */
export const nextCourseCost = (
    settings: BasketPricingSettings | undefined,
    quote: BasketQuote | null
): { amount: number; group: string | null } | null => {
    if (!settings || !quote) return null;
    // Under DISCOUNT the next course's cost depends on ITS price, which is not
    // known until it is picked. Quoting a number here would be a guess; the
    // honest nudge there is the next tier — see nextTier below.
    if (isDiscountBasis(settings)) return null;
    const { prices, perExtra } = settings.ladder;

    if (settings.ladderScope === 'BASKET') {
        const total = quote.lines.reduce((sum, l) => sum + l.count, 0);
        return {
            amount: ladderPrice(prices, perExtra, total + 1) - ladderPrice(prices, perExtra, total),
            group: null,
        };
    }

    let best: { amount: number; group: string | null } | null = null;
    for (const line of quote.lines) {
        const amount =
            ladderPrice(prices, perExtra, line.count + 1) - ladderPrice(prices, perExtra, line.count);
        if (best === null || amount < best.amount) best = { amount, group: line.label };
    }
    // Starting a fresh group costs the first-subject price — sometimes cheaper
    // than extending a group that is already deep into the ladder.
    const fresh = ladderPrice(prices, perExtra, 1);
    if (best === null || fresh < best.amount) best = { amount: fresh, group: null };
    return best;
};

/**
 * Which pricing group a course falls in, or '' when it belongs to none.
 *
 * Exported so the cart can group what it SHOWS exactly the way the engine
 * groups what it CHARGES. Two different groupings on one screen is how "why is
 * this one ₹250 and that one ₹349" starts.
 */
export const groupLabelFor = (
    settings: BasketPricingSettings | undefined,
    item: BasketItem
): string => {
    for (const group of settings?.groups ?? []) {
        if ((group.levels ?? []).some((l) => key(l) === key(item.levelName))) return group.label;
    }
    return '';
};
