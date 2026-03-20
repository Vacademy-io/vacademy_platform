import type { ComponentType } from 'react';

export interface FeatureLandingDefinition {
    id: string;
    keyword: string;
    match: (hostname: string) => boolean;
    title: string;
    description: string;
    signupPath: string;
    load: () => Promise<{ default: ComponentType }>;
}

function hostMatchesKeyword(hostname: string, keyword: string): boolean {
    const host = hostname.toLowerCase();
    const firstLabel = host.split('.')[0] || '';
    return firstLabel === keyword || firstLabel.startsWith(`${keyword}-`);
}

export const FEATURE_LANDINGS: FeatureLandingDefinition[] = [
    {
        id: 'explore',
        keyword: 'explore',
        match: (hostname) => hostMatchesKeyword(hostname, 'explore'),
        title: 'AI Content & Course Creation',
        description: 'Create educational content with AI — Videos, Quizzes, Storybooks, and more.',
        signupPath: '/signup/onboarding',
        load: () => import('./pages/ExploreLandingPage'),
    },
];

export function resolveFeatureLanding(
    hostname: string = window.location.hostname
): FeatureLandingDefinition | null {
    return FEATURE_LANDINGS.find((d) => d.match(hostname)) ?? null;
}
