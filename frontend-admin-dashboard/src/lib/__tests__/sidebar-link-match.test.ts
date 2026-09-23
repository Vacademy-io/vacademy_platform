import { describe, expect, it } from 'vitest';
import {
    parseSidebarLink,
    sidebarLinkMatchesLocation,
} from '@/components/common/layout-container/sidebar/helper';

describe('parseSidebarLink', () => {
    it('splits the path from the query, leaving non-JSON values as strings', () => {
        expect(
            parseSidebarLink('/audience-manager/recent-leads?range=ALL&called=NOT_CALLED')
        ).toEqual({
            to: '/audience-manager/recent-leads',
            search: { range: 'ALL', called: 'NOT_CALLED' },
        });
    });

    it('returns the bare path when there is no query', () => {
        expect(parseSidebarLink('/audience-manager/follow-ups')).toEqual({
            to: '/audience-manager/follow-ups',
        });
    });
});

describe('sidebarLinkMatchesLocation', () => {
    const leads = '/audience-manager/recent-leads';

    it('matches a plain link on its own path or a child path', () => {
        expect(sidebarLinkMatchesLocation(leads, leads)).toBe(true);
        expect(sidebarLinkMatchesLocation(leads, `${leads}/abc`)).toBe(true);
        expect(sidebarLinkMatchesLocation(leads, '/audience-manager/recent-leadsx')).toBe(false);
        expect(sidebarLinkMatchesLocation(leads, '/audience-manager')).toBe(false);
    });

    it('keeps sibling filter tabs apart', () => {
        const untouched = `${leads}?range=ALL&called=NOT_CALLED`;
        const touched = `${leads}?range=ALL&called=CALLED`;
        const onUntouched = { range: 'ALL', called: 'NOT_CALLED' };

        expect(sidebarLinkMatchesLocation(untouched, leads, onUntouched)).toBe(true);
        expect(sidebarLinkMatchesLocation(touched, leads, onUntouched)).toBe(false);
        // the unfiltered "All Leads" tab still matches — its params are a subset
        expect(sidebarLinkMatchesLocation(`${leads}?range=ALL`, leads, onUntouched)).toBe(true);
    });

    it('does not match when a link param is missing from the location', () => {
        const link = `${leads}?range=ALL&called=NOT_CALLED`;
        expect(sidebarLinkMatchesLocation(link, leads, { range: 'ALL' })).toBe(false);
        expect(sidebarLinkMatchesLocation(link, leads)).toBe(false);
    });

    it('compares values as strings, since the router parses primitives', () => {
        expect(
            sidebarLinkMatchesLocation(
                '/audience-manager/follow-ups?bucket=overdue',
                '/audience-manager/follow-ups',
                {
                    bucket: 'overdue',
                }
            )
        ).toBe(true);
        expect(sidebarLinkMatchesLocation(`${leads}?range=30`, leads, { range: 30 })).toBe(true);
        expect(sidebarLinkMatchesLocation(`${leads}?flag=true`, leads, { flag: true })).toBe(true);
    });

    it('never matches an empty link', () => {
        expect(sidebarLinkMatchesLocation(undefined, leads)).toBe(false);
        expect(sidebarLinkMatchesLocation('', leads)).toBe(false);
        expect(sidebarLinkMatchesLocation('?range=ALL', leads)).toBe(false);
    });
});
