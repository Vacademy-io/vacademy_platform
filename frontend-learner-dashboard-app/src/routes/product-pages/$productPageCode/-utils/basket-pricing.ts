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
 *  - the ladder gives a price for a basket of 1, 2, 3 … and `perExtra` for each
 *    course beyond the last listed price;
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
}

export interface BasketPricingCombo {
    label: string;
    /** Package (course) names that must be selected EXACTLY, within one group. */
    packages: string[];
    price: number;
}

export interface BasketPricingSettings {
    enabled: boolean;
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
}

export interface BasketQuoteLine {
    label: string;
    amount: number;
    /** How this group's price was reached, shown in the summary. */
    how: string;
    count: number;
}

export interface BasketQuote {
    total: number;
    lines: BasketQuoteLine[];
}

const key = (v?: string | null) => (v ?? '').trim().toLowerCase();

export const parseBasketPricing = (
    settingsJson?: string | null
): BasketPricingSettings | undefined => {
    if (!settingsJson) return undefined;
    try {
        const cfg = JSON.parse(settingsJson)?.basketPricing as BasketPricingSettings | undefined;
        // A ladder with no prices cannot price anything; treat it as not
        // configured so the page falls back to item prices instead of free.
        return cfg?.enabled && cfg.ladder?.prices?.length ? cfg : undefined;
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
        let best = ladderPrice(prices, perExtra, count);
        let how = `${count} subject${count === 1 ? '' : 's'}`;

        // Full pack — every level configured for this group is in the basket.
        const configured = (settings.groups ?? [])
            .filter((g) => g.label === label)
            .flatMap((g) => g.levels ?? [])
            .map(key);
        if (label && configured.length > 0) {
            const pickedLevels = new Set(picked.map((p) => key(p.levelName)));
            const packPrice = settings.wholeGroupPrices?.[String(count)];
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

        lines.push({ label: label || 'Your selection', amount: best, how, count });
    }

    const grouped = Math.round(lines.reduce((sum, l) => sum + l.amount, 0));

    if (settings.ladderScope === 'BASKET') {
        // One ladder over the whole basket. Never worse than pricing the groups
        // apart — a full pack or combo inside one group can still beat it.
        const whole = ladderPrice(prices, perExtra, items.length);
        if (whole < grouped) {
            return {
                total: Math.max(0, Math.round(whole)),
                lines: [
                    {
                        label: 'Your selection',
                        amount: whole,
                        how: `${items.length} subject${items.length === 1 ? '' : 's'}`,
                        count: items.length,
                    },
                ],
            };
        }
    }

    return { total: Math.max(0, grouped), lines };
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
    const single = settings.ladder.prices[0] ?? 0;
    if (single <= 0) return 0;
    const asSingles = quote.lines.reduce((sum, line) => sum + line.count * single, 0);
    return Math.max(0, Math.round(asSingles - quote.total));
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
