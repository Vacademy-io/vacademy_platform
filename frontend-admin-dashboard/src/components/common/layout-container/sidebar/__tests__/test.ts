import { describe, expect, it } from 'vitest';
import {
    isSidebarLinkActive,
    sidebarLinkSpecificity,
} from '@/components/common/layout-container/sidebar/helper';

// The Follow-ups sub-items all share one path and differ only by bucket.
const TODAY = '/audience-manager/follow-ups?bucket=today';
const ALL = '/audience-manager/follow-ups?bucket=all';
const BARE = '/audience-manager/follow-ups';

describe('isSidebarLinkActive', () => {
    it('matches the bucket the user is actually on, not its siblings', () => {
        const path = '/audience-manager/follow-ups';
        expect(isSidebarLinkActive(ALL, path, { bucket: 'all' })).toBe(true);
        expect(isSidebarLinkActive(TODAY, path, { bucket: 'all' })).toBe(false);
    });

    it('ignores extra params the page added', () => {
        // ?lock=bucket rides along on the pinned sub-tabs.
        expect(
            isSidebarLinkActive(ALL, '/audience-manager/follow-ups', {
                bucket: 'all',
                lock: 'bucket',
            })
        ).toBe(true);
    });

    it('a link with no params matches on path alone', () => {
        expect(isSidebarLinkActive(BARE, '/audience-manager/follow-ups', {})).toBe(true);
        expect(isSidebarLinkActive(BARE, '/audience-manager/follow-ups', { bucket: 'all' })).toBe(
            true
        );
    });

    it('still matches a nested route under the link', () => {
        expect(isSidebarLinkActive('/erp/people', '/erp/people/abc123', {})).toBe(true);
    });

    it('does not match a different path, or a sibling prefix', () => {
        expect(isSidebarLinkActive(BARE, '/audience-manager/recent-leads', {})).toBe(false);
        // "/erp/leave" must not light up on "/erp/leave-setup"
        expect(isSidebarLinkActive('/erp/leave', '/erp/leave-setup', {})).toBe(false);
    });

    it('is false for a missing link', () => {
        expect(isSidebarLinkActive(undefined, '/anything', {})).toBe(false);
    });
});

describe('sidebarLinkSpecificity', () => {
    it('ranks a link with params above the bare path it shares', () => {
        expect(sidebarLinkSpecificity(ALL)).toBeGreaterThan(sidebarLinkSpecificity(BARE));
    });

    it('ranks a longer path above a shorter one', () => {
        expect(sidebarLinkSpecificity('/erp/people/org')).toBeGreaterThan(
            sidebarLinkSpecificity('/erp/people')
        );
    });
});
