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
        text: 'text-teal-600',
        bg: 'bg-teal-50',
        ring: 'ring-teal-200',
        hoverText: 'hover:text-teal-600',
        hoverBg: 'hover:bg-teal-50',
        railActiveBg: 'bg-teal-100',
        pillBg: 'bg-teal-100',
        pillText: 'text-teal-700',
        divider: 'border-teal-100',
        railIconActive: 'text-teal-600',
        railIconInactive: 'text-neutral-500',
    },
    LMS: {
        text: 'text-indigo-600',
        bg: 'bg-indigo-50',
        ring: 'ring-indigo-200',
        hoverText: 'hover:text-indigo-600',
        hoverBg: 'hover:bg-indigo-50',
        railActiveBg: 'bg-indigo-100',
        pillBg: 'bg-indigo-100',
        pillText: 'text-indigo-700',
        divider: 'border-indigo-100',
        railIconActive: 'text-indigo-600',
        railIconInactive: 'text-neutral-500',
    },
    AI: {
        text: 'text-rose-600',
        bg: 'bg-rose-50',
        ring: 'ring-rose-200',
        hoverText: 'hover:text-rose-600',
        hoverBg: 'hover:bg-rose-50',
        railActiveBg: 'bg-rose-100',
        pillBg: 'bg-rose-100',
        pillText: 'text-rose-700',
        divider: 'border-rose-100',
        railIconActive: 'text-rose-600',
        railIconInactive: 'text-neutral-500',
    },
};

/** Get colors for a category, defaulting to CRM */
export function getCategoryColors(category?: 'CRM' | 'LMS' | 'AI'): CategoryColors {
    return CATEGORY_COLORS[category || 'CRM'];
}
