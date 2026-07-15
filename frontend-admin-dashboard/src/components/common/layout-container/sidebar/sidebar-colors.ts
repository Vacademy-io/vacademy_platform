/**
 * Sidebar Category Color Definitions
 *
 * Each category gets a vibrant, maximally-distinct color:
 * - CRM  → Teal   (business/professional)
 * - LMS  → Indigo (educational/knowledge)
 * - AI   → Rose   (tech/futuristic)
 */

export interface CategoryColors {
    /** Text color class for active/hovered state */
    text: string;
    /** Light background class for active/hovered state */
    bg: string;
    /** Ring/border class */
    ring: string;
    /** Hover text class */
    hoverText: string;
    /** Hover bg class */
    hoverBg: string;
    /** Darker bg for the rail active indicator */
    railActiveBg: string;
    /** Pill active background */
    pillBg: string;
    /** Pill active text */
    pillText: string;
    /** Divider color */
    divider: string;
    /** Rail icon active color (filled) */
    railIconActive: string;
    /** Rail icon inactive color */
    railIconInactive: string;
}

export const CATEGORY_COLORS: Record<'CRM' | 'LMS' | 'AI', CategoryColors> = {
    CRM: {
        text: 'text-teal-700',
        bg: 'bg-teal-500',
        ring: 'ring-teal-200',
        hoverText: 'hover:text-teal-700',
        hoverBg: 'hover:bg-teal-50',
        // Rail active-pill stays neutral (bg-white / neutral-900 icon) rather
        // than category-tinted — it sits directly on the institute's brand
        // color (see --nav-surface in category-rail.tsx), so a third color in
        // that small area would clash more than help. The category color
        // shows up where it actually distinguishes something: the panel.
        railActiveBg: 'bg-white',
        pillBg: 'bg-teal-500',
        pillText: 'text-white',
        divider: 'border-teal-100',
        railIconActive: 'text-neutral-900',
        railIconInactive: 'text-white/70',
    },
    LMS: {
        text: 'text-indigo-700',
        bg: 'bg-indigo-500',
        ring: 'ring-indigo-200',
        hoverText: 'hover:text-indigo-700',
        hoverBg: 'hover:bg-indigo-50',
        railActiveBg: 'bg-white',
        pillBg: 'bg-indigo-500',
        pillText: 'text-white',
        divider: 'border-indigo-100',
        railIconActive: 'text-neutral-900',
        railIconInactive: 'text-white/70',
    },
    AI: {
        text: 'text-rose-700',
        bg: 'bg-rose-500',
        ring: 'ring-rose-200',
        hoverText: 'hover:text-rose-700',
        hoverBg: 'hover:bg-rose-50',
        railActiveBg: 'bg-white',
        pillBg: 'bg-rose-500',
        pillText: 'text-white',
        divider: 'border-rose-100',
        railIconActive: 'text-neutral-900',
        railIconInactive: 'text-white/70',
    },
};

/** Get colors for a category, defaulting to CRM */
export function getCategoryColors(category?: 'CRM' | 'LMS' | 'AI'): CategoryColors {
    return CATEGORY_COLORS[category || 'CRM'];
}
