// Static catalog of fal.ai built-in avatars exposed via Vimotion.
//
// Argil ids are the human-readable strings the API expects verbatim
// (e.g. "Mia outdoor (UGC)") — see https://fal.ai/models/argil/avatars/audio-to-video
// VEED ids are snake_case enum values (e.g. "emily_vertical_primary") —
// see https://fal.ai/models/veed/avatars/audio-to-video
//
// Thumbnails are deliberately omitted in v1; the FE renders initials.
// When we self-host preview frames (one-time fal pre-gen + S3 upload),
// drop the URLs into `previewImageUrl`.

export type AvatarProvider = 'custom' | 'argil' | 'veed';

export interface CatalogEntry {
    /** Display name shown in the picker. */
    name: string;
    /** Exact id the fal.ai endpoint expects in its enum. Persisted as external_avatar_id. */
    externalAvatarId: string;
    provider: Exclude<AvatarProvider, 'custom'>;
    /** Loose categorization used for grouping/filter chips. */
    category?: string;
    /** Self-hosted thumbnail url; null in v1. */
    previewImageUrl?: string;
}

// ─── Argil (28) ─────────────────────────────────────────────────────────────
// Names embed their category in parens; preserved verbatim because the
// API enum requires the exact string.
const ARGIL: CatalogEntry[] = (
    [
        ['Mia outdoor (UGC)', 'UGC'],
        ['Lara (Masterclass)', 'Masterclass'],
        ['Ines (UGC)', 'UGC'],
        ['Maria (Masterclass)', 'Masterclass'],
        ['Emma (UGC)', 'UGC'],
        ['Sienna (Masterclass)', 'Masterclass'],
        ['Elena (UGC)', 'UGC'],
        ['Jasmine (Masterclass)', 'Masterclass'],
        ['Amara (Masterclass)', 'Masterclass'],
        ['Ryan podcast (UGC)', 'UGC'],
        ['Tyler (Masterclass)', 'Masterclass'],
        ['Jayse (Masterclass)', 'Masterclass'],
        ['Paul (Masterclass)', 'Masterclass'],
        ['Matteo (UGC)', 'UGC'],
        ['Daniel car (UGC)', 'UGC'],
        ['Dario (Masterclass)', 'Masterclass'],
        ['Viva (Masterclass)', 'Masterclass'],
        ['Chen (Masterclass)', 'Masterclass'],
        ['Alex (Masterclass)', 'Masterclass'],
        ['Vanessa (UGC)', 'UGC'],
        ['Laurent (UGC)', 'UGC'],
        ['Noemie car (UGC)', 'UGC'],
        ['Brandon (UGC)', 'UGC'],
        ['Byron (Masterclass)', 'Masterclass'],
        ['Calista (Masterclass)', 'Masterclass'],
        ['Milo (Masterclass)', 'Masterclass'],
        ['Fabien (Masterclass)', 'Masterclass'],
        ['Rose (UGC)', 'UGC'],
    ] as const
).map(([id, category]) => ({
    name: id.replace(/\s*\((UGC|Masterclass)\)$/, ''),
    externalAvatarId: id,
    provider: 'argil' as const,
    category,
}));

// ─── VEED (28) ──────────────────────────────────────────────────────────────
// Snake_case ids. Display name is the leading proper noun; the framing variant
// (vertical primary, side, walking, etc.) is exposed as the category.
const VEED: CatalogEntry[] = (
    [
        ['emily_vertical_primary', 'Emily', 'Vertical primary'],
        ['emily_vertical_secondary', 'Emily', 'Vertical secondary'],
        ['emily_primary', 'Emily', 'Primary'],
        ['emily_side', 'Emily', 'Side'],
        ['marcus_vertical_primary', 'Marcus', 'Vertical primary'],
        ['marcus_vertical_secondary', 'Marcus', 'Vertical secondary'],
        ['marcus_primary', 'Marcus', 'Primary'],
        ['marcus_side', 'Marcus', 'Side'],
        ['mira_vertical_primary', 'Mira', 'Vertical primary'],
        ['mira_vertical_secondary', 'Mira', 'Vertical secondary'],
        ['jasmine_vertical_primary', 'Jasmine', 'Vertical primary'],
        ['jasmine_vertical_secondary', 'Jasmine', 'Vertical secondary'],
        ['jasmine_vertical_walking', 'Jasmine', 'Vertical walking'],
        ['aisha_vertical_walking', 'Aisha', 'Vertical walking'],
        ['aisha_walking', 'Aisha', 'Walking'],
        ['elena_vertical_primary', 'Elena', 'Vertical primary'],
        ['elena_vertical_secondary', 'Elena', 'Vertical secondary'],
        ['elena_primary', 'Elena', 'Primary'],
        ['elena_side', 'Elena', 'Side'],
        ['any_male_vertical_primary', 'Any Male', 'Vertical primary'],
        ['any_male_vertical_secondary', 'Any Male', 'Vertical secondary'],
        ['any_male_primary', 'Any Male', 'Primary'],
        ['any_male_side', 'Any Male', 'Side'],
        ['any_female_vertical_primary', 'Any Female', 'Vertical primary'],
        ['any_female_vertical_secondary', 'Any Female', 'Vertical secondary'],
        ['any_female_vertical_walking', 'Any Female', 'Vertical walking'],
        ['any_female_primary', 'Any Female', 'Primary'],
        ['any_female_side', 'Any Female', 'Side'],
    ] as const
).map(([id, name, category]) => ({
    name,
    externalAvatarId: id,
    provider: 'veed' as const,
    category,
}));

export const AVATAR_CATALOG: CatalogEntry[] = [...ARGIL, ...VEED];

export function findCatalogEntry(
    provider: AvatarProvider,
    externalAvatarId: string | null | undefined
): CatalogEntry | undefined {
    if (!externalAvatarId) return undefined;
    if (provider === 'custom') return undefined;
    return AVATAR_CATALOG.find(
        (e) => e.provider === provider && e.externalAvatarId === externalAvatarId
    );
}

export function getInitials(displayName: string): string {
    const trimmed = displayName.trim();
    if (!trimmed) return '?';
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/**
 * Deterministic neutral background color for an initials card. Hashes the
 * display name into one of a small palette so the same avatar always renders
 * with the same accent.
 */
export function colorForInitials(displayName: string): string {
    const palette = [
        '#E5E7EB', // neutral-200
        '#FEF3C7', // amber-100
        '#DBEAFE', // blue-100
        '#FCE7F3', // pink-100
        '#D1FAE5', // emerald-100
        '#EDE9FE', // violet-100
    ];
    let h = 0;
    for (let i = 0; i < displayName.length; i++) h = (h * 31 + displayName.charCodeAt(i)) | 0;
    return palette[Math.abs(h) % palette.length]!;
}
