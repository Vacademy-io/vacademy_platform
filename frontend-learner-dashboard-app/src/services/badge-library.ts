/**
 * Badge Library — "Playful" tiered achievement collection (v2, generated).
 *
 * Bright, chunky, Duolingo-style circular badges: a consistent themed emblem per
 * achievement, tier conveyed by a metallic ring (bronze → silver → gold → platinum →
 * diamond). PNGs are transparent-background so they sit on any card or dark surface.
 *
 * A ready-made set of tiered reward badges. Each badge has a stable `lib:` token
 * stored in a badge's `icon` field; BadgeVisual renders it from the bundled PNG in
 * `public/badge-library/`. Because it is token-addressed, award snapshots keep their
 * look forever and the set can grow without touching render or picker code.
 *
 * KEEP THIS FILE IDENTICAL between the admin and learner apps.
 */
export type BadgeTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface LibraryBadge {
    /** Stable icon token, e.g. "lib:streak-gold". Stored in a badge's `icon`. */
    token: string;
    /** Bundled asset path, served from /public. */
    url: string;
    /** Achievement key (groups the five tiers). */
    theme: string;
    /** Human label for the achievement. */
    themeLabel: string;
    tier: BadgeTier;
    /** Suggested unlock trigger for this achievement. */
    trigger: string;
    /** Short description shown on hover / in the picker. */
    description: string;
}

export const TIER_ORDER: BadgeTier[] = ["bronze", "silver", "gold", "platinum", "diamond"];

export const BADGE_LIBRARY: LibraryBadge[] = [
    { token: "lib:first_steps-bronze", url: "/badge-library/lib_first_steps_bronze.png", theme: "first_steps", themeLabel: "First Steps", tier: "bronze", trigger: "course_count", description: "Enrol in your first courses" },
    { token: "lib:first_steps-silver", url: "/badge-library/lib_first_steps_silver.png", theme: "first_steps", themeLabel: "First Steps", tier: "silver", trigger: "course_count", description: "Enrol in your first courses" },
    { token: "lib:first_steps-gold", url: "/badge-library/lib_first_steps_gold.png", theme: "first_steps", themeLabel: "First Steps", tier: "gold", trigger: "course_count", description: "Enrol in your first courses" },
    { token: "lib:first_steps-platinum", url: "/badge-library/lib_first_steps_platinum.png", theme: "first_steps", themeLabel: "First Steps", tier: "platinum", trigger: "course_count", description: "Enrol in your first courses" },
    { token: "lib:first_steps-diamond", url: "/badge-library/lib_first_steps_diamond.png", theme: "first_steps", themeLabel: "First Steps", tier: "diamond", trigger: "course_count", description: "Enrol in your first courses" },
    { token: "lib:streak-bronze", url: "/badge-library/lib_streak_bronze.png", theme: "streak", themeLabel: "On Fire", tier: "bronze", trigger: "streak", description: "Keep a daily learning streak" },
    { token: "lib:streak-silver", url: "/badge-library/lib_streak_silver.png", theme: "streak", themeLabel: "On Fire", tier: "silver", trigger: "streak", description: "Keep a daily learning streak" },
    { token: "lib:streak-gold", url: "/badge-library/lib_streak_gold.png", theme: "streak", themeLabel: "On Fire", tier: "gold", trigger: "streak", description: "Keep a daily learning streak" },
    { token: "lib:streak-platinum", url: "/badge-library/lib_streak_platinum.png", theme: "streak", themeLabel: "On Fire", tier: "platinum", trigger: "streak", description: "Keep a daily learning streak" },
    { token: "lib:streak-diamond", url: "/badge-library/lib_streak_diamond.png", theme: "streak", themeLabel: "On Fire", tier: "diamond", trigger: "streak", description: "Keep a daily learning streak" },
    { token: "lib:xp_master-bronze", url: "/badge-library/lib_xp_master_bronze.png", theme: "xp_master", themeLabel: "Star Scholar", tier: "bronze", trigger: "xp_total", description: "Earn experience points" },
    { token: "lib:xp_master-silver", url: "/badge-library/lib_xp_master_silver.png", theme: "xp_master", themeLabel: "Star Scholar", tier: "silver", trigger: "xp_total", description: "Earn experience points" },
    { token: "lib:xp_master-gold", url: "/badge-library/lib_xp_master_gold.png", theme: "xp_master", themeLabel: "Star Scholar", tier: "gold", trigger: "xp_total", description: "Earn experience points" },
    { token: "lib:xp_master-platinum", url: "/badge-library/lib_xp_master_platinum.png", theme: "xp_master", themeLabel: "Star Scholar", tier: "platinum", trigger: "xp_total", description: "Earn experience points" },
    { token: "lib:xp_master-diamond", url: "/badge-library/lib_xp_master_diamond.png", theme: "xp_master", themeLabel: "Star Scholar", tier: "diamond", trigger: "xp_total", description: "Earn experience points" },
    { token: "lib:completionist-bronze", url: "/badge-library/lib_completionist_bronze.png", theme: "completionist", themeLabel: "Completionist", tier: "bronze", trigger: "course_completion", description: "Finish courses to 100%" },
    { token: "lib:completionist-silver", url: "/badge-library/lib_completionist_silver.png", theme: "completionist", themeLabel: "Completionist", tier: "silver", trigger: "course_completion", description: "Finish courses to 100%" },
    { token: "lib:completionist-gold", url: "/badge-library/lib_completionist_gold.png", theme: "completionist", themeLabel: "Completionist", tier: "gold", trigger: "course_completion", description: "Finish courses to 100%" },
    { token: "lib:completionist-platinum", url: "/badge-library/lib_completionist_platinum.png", theme: "completionist", themeLabel: "Completionist", tier: "platinum", trigger: "course_completion", description: "Finish courses to 100%" },
    { token: "lib:completionist-diamond", url: "/badge-library/lib_completionist_diamond.png", theme: "completionist", themeLabel: "Completionist", tier: "diamond", trigger: "course_completion", description: "Finish courses to 100%" },
];

const LIBRARY_BY_TOKEN: Record<string, LibraryBadge> = BADGE_LIBRARY.reduce(
    (acc, b) => {
        acc[b.token] = b;
        return acc;
    },
    {} as Record<string, LibraryBadge>
);

/** True when an icon value references a library badge (vs a Phosphor name or uploaded file id). */
export function isLibraryToken(icon?: string | null): boolean {
    return !!icon && icon.startsWith("lib:");
}

export function getLibraryBadge(token?: string | null): LibraryBadge | undefined {
    return token ? LIBRARY_BY_TOKEN[token] : undefined;
}

/** Bundled asset URL for a library token, or undefined if the token is unknown. */
export function getLibraryUrl(token?: string | null): string | undefined {
    return getLibraryBadge(token)?.url;
}

/**
 * Maps an unlock trigger to the library achievement whose artwork best fits it.
 * Lets every badge adopt ready-made art from its trigger alone (no per-badge wiring).
 */
export const TRIGGER_TO_LIBRARY_THEME: Record<string, string> = {
    course_count: "first_steps",
    slide_count: "first_steps",
    streak: "streak",
    live_session_streak: "streak",
    xp_total: "xp_master",
    assessment_score: "xp_master",
    course_completion: "completionist",
    live_session_count: "completionist",
};

export function libraryThemeForTrigger(trigger: string): string | undefined {
    return TRIGGER_TO_LIBRARY_THEME[trigger];
}

/** Build a library token for a theme + tier, or undefined when no such asset exists. */
export function buildLibraryToken(theme: string, tier: BadgeTier): string | undefined {
    const token = `lib:${theme}-${tier}`;
    return getLibraryBadge(token) ? token : undefined;
}

/** Library badges grouped by achievement, tiers in bronze→diamond order — for the picker grid. */
export function getLibraryByTheme(): { theme: string; themeLabel: string; badges: LibraryBadge[] }[] {
    const groups: { theme: string; themeLabel: string; badges: LibraryBadge[] }[] = [];
    for (const b of BADGE_LIBRARY) {
        let g = groups.find((x) => x.theme === b.theme);
        if (!g) {
            g = { theme: b.theme, themeLabel: b.themeLabel, badges: [] };
            groups.push(g);
        }
        g.badges.push(b);
    }
    for (const g of groups) {
        g.badges.sort((a, z) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(z.tier));
    }
    return groups;
}
