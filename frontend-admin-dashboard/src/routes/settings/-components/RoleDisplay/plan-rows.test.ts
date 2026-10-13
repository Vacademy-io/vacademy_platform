import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
    // Node's unconfigured Web Storage global shadows happy-dom's here.
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
        value: {
            getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
            setItem: (k: string, v: string) => void store.set(k, String(v)),
            removeItem: (k: string) => void store.delete(k),
            clear: () => store.clear(),
        },
        configurable: true,
        writable: true,
    });
});

import { getSidebarItemsData } from '@/components/common/layout-container/sidebar/utils';
import { createEntitlement, FULL_ENTITLEMENT } from '@/lib/capabilities/entitlement';
import { canForModules, CRM_ONLY_MODULES, loadRealCatalog } from '@/lib/capabilities/test-support';
import { createPlanRowFilter } from './plan-rows';

const catalog = loadRealCatalog();
const staticItems = getSidebarItemsData();
const roleTabs = staticItems.map((i) => ({ id: i.id, category: i.category }));

describe('Display Settings plan rows', () => {
    it('LEGACY shows every row and no note', () => {
        const rows = createPlanRowFilter(FULL_ENTITLEMENT, staticItems);
        expect(rows.managed).toBe(false);
        expect(rows.hidesSomething).toBe(false);
        staticItems.forEach((i) => {
            expect(rows.tab(i.id)).toBe(true);
            i.subItems?.forEach((s) => expect(rows.subTab(i.id, s.subItemId)).toBe(true));
        });
        ['CRM', 'LMS', 'AI', 'ERP'].forEach((c) => expect(rows.category(c, roleTabs)).toBe(true));
        expect(rows.widget('learningCenter')).toBe(true);
    });

    it('MANAGED with everything on hides nothing', () => {
        const rows = createPlanRowFilter(
            createEntitlement({ catalog, can: () => true, staticItems }),
            staticItems
        );
        expect(rows.managed).toBe(true);
        expect(rows.hidesSomething).toBe(false);
    });

    it('MANAGED CRM-only hides LMS/AI/ERP rows, keeps custom ones', () => {
        const rows = createPlanRowFilter(
            createEntitlement({
                catalog,
                can: canForModules(catalog, CRM_ONLY_MODULES),
                staticItems,
            }),
            staticItems
        );
        expect(rows.hidesSomething).toBe(true);
        expect(rows.tab('courses')).toBe(false);
        expect(rows.tab('leads')).toBe(true);
        expect(rows.tab('custom-123')).toBe(true);
        expect(rows.subTab('manage-institute', 'batches')).toBe(false);
        expect(rows.subTab('manage-institute', 'teams')).toBe(true);
        expect(rows.subTab('leads', 'custom-sub-1')).toBe(true);
        expect(rows.category('CRM', roleTabs)).toBe(true);
        expect(rows.category('LMS', roleTabs)).toBe(false);
        expect(rows.category('AI', roleTabs)).toBe(false);
        expect(rows.category('ERP', roleTabs)).toBe(false);
        // the admin's own custom tab keeps its category row
        expect(
            rows.category('LMS', [...roleTabs, { id: 'custom-9', category: 'LMS', isCustom: true }])
        ).toBe(true);
        expect(rows.widget('learningCenter')).toBe(false);
        expect(rows.widget('financeSummary')).toBe(true);
        expect(rows.widget('pendingActions')).toBe(true);
    });
});
