import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    filterSidebarByRole,
    isSidebarLinkActive,
    sidebarLinkSpecificity,
} from '@/components/common/layout-container/sidebar/helper';
import type { SidebarItemsType } from '@/types/layout-container/layout-container-types';
import type { DisplaySettingsData } from '@/types/display-settings';

const auth = vi.hoisted(() => ({ roles: [] as string[], subOrgGranted: false }));
vi.mock('@/lib/auth/sessionUtility', () => ({
    getTokenFromCookie: () => 'token',
    getUserRoles: () => auth.roles,
}));
vi.mock('@/lib/display-settings/sub-org-module', () => ({
    SUB_ORG_MODULE_TAB_ID: 'manage-institute',
    SUB_ORG_MODULE_SUB_ITEM_ID: 'manage-institute-suborgs',
    canAccessSubOrgModule: () => auth.subOrgGranted,
}));

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

const icon = (() => null) as unknown as SidebarItemsType['icon'];
const MENU: SidebarItemsType[] = [
    { icon, title: 'Dashboard', id: 'dashboard', to: '/dashboard' },
    {
        icon,
        title: 'Manage Institute',
        id: 'manage-institute',
        subItems: [
            { subItem: 'Batches', subItemLink: '/manage-institute/batches', subItemId: 'batches' },
            { subItem: 'Teams', subItemLink: '/manage-institute/teams', subItemId: 'teams' },
            {
                subItem: 'Sub-Orgs',
                subItemLink: '/manage-custom-teams',
                subItemId: 'manage-institute-suborgs',
            },
            {
                subItem: 'Packages',
                subItemLink: '/admin-package-management',
                subItemId: 'manage-packages',
                adminOnly: true,
            },
        ],
    },
    {
        icon,
        title: 'Payroll',
        id: 'erp-payroll',
        subItems: [
            {
                subItem: 'Runs',
                subItemLink: '/erp/payroll',
                subItemId: 'erp-payroll-runs',
                adminOnly: true,
            },
        ],
    },
    { icon, title: 'Settings', id: 'settings', to: '/settings' },
    {
        icon,
        title: 'Engagement',
        id: 'engagement-engines',
        subItems: [
            {
                subItem: 'Engines',
                subItemLink: '/engagement-engines',
                subItemId: 'engagement-engines-list',
                adminOnly: true,
            },
        ],
    },
    { icon, title: 'Logs', id: 'admin-activity-logs', to: '/admin-activity-logs' },
];

type Tab = DisplaySettingsData['sidebar'][number];
const tab = (id: string, visible: boolean, subs: Record<string, boolean> = {}): Tab => ({
    id,
    order: 1,
    visible,
    subTabs: Object.entries(subs).map(([sid, v], i) => ({
        id: sid,
        route: '#',
        order: i + 1,
        visible: v,
    })),
});
const settings = (...sidebar: Tab[]) => ({ sidebar }) as DisplaySettingsData;
const ids = (items: SidebarItemsType[]) => items.map((i) => i.id);
const subIds = (items: SidebarItemsType[], id: string) =>
    items.find((i) => i.id === id)?.subItems?.map((s) => s.subItemId);

describe('filterSidebarByRole', () => {
    beforeEach(() => {
        auth.roles = ['Operations'];
        auth.subOrgGranted = false;
    });

    it('gives an admin everything', () => {
        auth.roles = ['ADMIN'];
        expect(filterSidebarByRole(MENU, null)).toEqual(MENU);
    });

    it('hides admin-only tabs and sub-items when the role has no settings', () => {
        const out = filterSidebarByRole(MENU, null);
        expect(ids(out)).toEqual(['dashboard', 'erp-payroll', 'engagement-engines']);
        expect(subIds(out, 'erp-payroll')).toEqual([]);
    });

    it('shows Manage Institute to a custom role whose settings turn it on', () => {
        const out = filterSidebarByRole(
            MENU,
            settings(tab('manage-institute', true, { batches: true, teams: true }))
        );
        expect(subIds(out, 'manage-institute')).toEqual(['batches', 'teams']);
    });

    it('shows an adminOnly sub-item only when the settings explicitly turn it on', () => {
        const off = filterSidebarByRole(MENU, settings(tab('erp-payroll', true)));
        expect(subIds(off, 'erp-payroll')).toEqual([]);

        const on = filterSidebarByRole(
            MENU,
            settings(
                tab('erp-payroll', true, { 'erp-payroll-runs': true }),
                tab('manage-institute', true, { 'manage-packages': true })
            )
        );
        expect(subIds(on, 'erp-payroll')).toEqual(['erp-payroll-runs']);
        expect(subIds(on, 'manage-institute')).toContain('manage-packages');
    });

    it('ignores an adminOnly sub-item switched on under a hidden tab', () => {
        const out = filterSidebarByRole(
            MENU,
            settings(tab('manage-institute', false, { 'manage-packages': true }))
        );
        expect(ids(out)).not.toContain('manage-institute');
    });

    it('never shows Settings or Engagement Engines to a non-admin', () => {
        const out = filterSidebarByRole(
            MENU,
            settings(
                tab('settings', true),
                tab('engagement-engines', true, { 'engagement-engines-list': true })
            )
        );
        expect(ids(out)).not.toContain('settings');
        // The tab itself stays as before; only its admin-only entries can't be opted in.
        expect(subIds(out, 'engagement-engines')).toEqual([]);
    });

    it('never shows admin activity logs to a non-admin, even when switched on', () => {
        const out = filterSidebarByRole(MENU, settings(tab('admin-activity-logs', true)));
        expect(ids(out)).not.toContain('admin-activity-logs');
    });

    it('keeps the sub-orgs entry behind its own module grant', () => {
        const optedIn = settings(
            tab('manage-institute', true, { batches: true, 'manage-institute-suborgs': true })
        );
        expect(subIds(filterSidebarByRole(MENU, optedIn), 'manage-institute')).toEqual([
            'batches',
            'teams',
        ]);

        auth.subOrgGranted = true;
        expect(subIds(filterSidebarByRole(MENU, null), 'manage-institute')).toEqual([
            'manage-institute-suborgs',
        ]);
        expect(subIds(filterSidebarByRole(MENU, optedIn), 'manage-institute')).toEqual([
            'batches',
            'teams',
            'manage-institute-suborgs',
        ]);
    });
});
