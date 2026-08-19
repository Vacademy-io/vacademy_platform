import { createFileRoute } from '@tanstack/react-router';

import type { MentorDetailTab } from '../../-components/MentorDetailView';

const VALID_TABS: MentorDetailTab[] = [
    'overview',
    'students',
    'availability',
    'sessions',
    'feedback',
];

// Route definition only — the component is lazy loaded from index.lazy.tsx.
export const Route = createFileRoute('/mentorship/mentors/$mentorId/')({
    // ?tab=sessions deep-links straight to a tab, so a mentor's session history
    // is a shareable URL rather than something you have to click your way back to.
    validateSearch: (search: Record<string, unknown>): { tab?: MentorDetailTab } => {
        const tab = search.tab;
        return VALID_TABS.includes(tab as MentorDetailTab) ? { tab: tab as MentorDetailTab } : {};
    },
});
