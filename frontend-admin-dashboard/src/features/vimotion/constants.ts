import type { CompanySize, VimotionAccountType } from './api/types';

export const COMPANY_SIZE_OPTIONS: { value: CompanySize; label: string }[] = [
    { value: '1-10', label: '1–10 people' },
    { value: '11-50', label: '11–50 people' },
    { value: '51-200', label: '51–200 people' },
    { value: '201+', label: '201+ people' },
];

export const ACCOUNT_TYPE_OPTIONS: {
    value: VimotionAccountType;
    title: string;
    description: string;
}[] = [
    {
        value: 'individual',
        title: 'Individual creator',
        description: 'I make AI content on my own.',
    },
    {
        value: 'studio',
        title: 'Studio',
        description: 'A team producing AI content together.',
    },
    {
        value: 'agency',
        title: 'Agency',
        description: 'We create AI content for multiple clients.',
    },
];

export const VIMOTION_HOST_HINTS = ['vimotion'];

export function isVimotionHost(): boolean {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname.toLowerCase();
    return VIMOTION_HOST_HINTS.some((h) => host.includes(h));
}
