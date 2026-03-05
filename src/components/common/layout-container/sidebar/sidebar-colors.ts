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
        text: 'text-neutral-900',
        bg: 'bg-primary-500',
        ring: 'ring-primary-200',
        hoverText: 'hover:text-neutral-900',
        hoverBg: 'hover:bg-neutral-100',
        railActiveBg: 'bg-white',
        pillBg: 'bg-primary-500',
        pillText: 'text-white',
        divider: 'border-primary-100',
        railIconActive: 'text-neutral-900',
        railIconInactive: 'text-white/70',
    },
    LMS: {
        text: 'text-neutral-900',
        bg: 'bg-primary-500',
        ring: 'ring-primary-200',
        hoverText: 'hover:text-neutral-900',
        hoverBg: 'hover:bg-neutral-100',
        railActiveBg: 'bg-white',
        pillBg: 'bg-primary-500',
        pillText: 'text-white',
        divider: 'border-primary-100',
        railIconActive: 'text-neutral-900',
        railIconInactive: 'text-white/70',
    },
    AI: {
        text: 'text-neutral-900',
        bg: 'bg-primary-500',
        ring: 'ring-primary-200',
        hoverText: 'hover:text-neutral-900',
        hoverBg: 'hover:bg-neutral-100',
        railActiveBg: 'bg-white',
        pillBg: 'bg-primary-500',
        pillText: 'text-white',
        divider: 'border-primary-100',
        railIconActive: 'text-neutral-900',
        railIconInactive: 'text-white/70',
    },
};

/** Get colors for a category, defaulting to CRM */
export function getCategoryColors(category?: 'CRM' | 'LMS' | 'AI'): CategoryColors {
    return CATEGORY_COLORS[category || 'CRM'];
}
