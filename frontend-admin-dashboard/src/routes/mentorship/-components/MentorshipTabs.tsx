import { Link, useLocation } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

/**
 * One header for the whole admin mentorship area.
 *
 * Overview, Mentors, Sessions and Requests are four views of the same thing, and
 * four sidebar entries made you decide where to go before you knew what you wanted.
 * They now live behind a single "Mentorship" entry with tabs here, which is both
 * fewer decisions and a clearer mental model: one area, four lenses.
 *
 * "My Mentorship" deliberately stays separate — it belongs to a different person
 * (the mentor looking at their own mentees), not the admin looking at everyone.
 */
const TABS = [
    { to: '/mentorship/dashboard', label: 'Overview' },
    { to: '/mentorship/mentors', label: 'Mentors' },
    { to: '/mentorship/sessions', label: 'Sessions' },
    { to: '/mentorship/requests', label: 'Requests' },
] as const;

export function MentorshipTabs({ badge }: { badge?: { requests?: number } }) {
    const { pathname } = useLocation();

    return (
        <nav className="flex flex-wrap gap-1 border-b border-neutral-200" aria-label="Mentorship">
            {TABS.map((tab) => {
                const active = pathname.startsWith(tab.to);
                const count = tab.to.endsWith('/requests') ? badge?.requests ?? 0 : 0;
                return (
                    <Link
                        key={tab.to}
                        to={tab.to}
                        className={cn(
                            '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-body transition-colors',
                            active
                                ? 'border-primary-500 font-medium text-primary-600'
                                : 'border-transparent text-neutral-500 hover:text-neutral-700'
                        )}
                    >
                        {tab.label}
                        {count > 0 && (
                            <span className="rounded-full bg-danger-100 px-1.5 py-0.5 text-caption font-medium text-danger-600">
                                {count}
                            </span>
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
