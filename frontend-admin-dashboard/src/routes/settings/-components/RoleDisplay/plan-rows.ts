import { useMemo } from 'react';
import type { Entitlement } from '@/lib/capabilities/entitlement';
import { useEntitlement } from '@/lib/capabilities/use-entitlement';
import { getSidebarItemsData } from '@/components/common/layout-container/sidebar/utils';
import type { SidebarItemsType } from '@/types/layout-container/layout-container-types';

/**
 * Which Display Settings rows the editor SHOWS for the institute's plan
 * (INSTITUTE_MODULES_AND_CONFIG_SPEC.md §3, §9: entitlement is a ceiling the
 * institute admin cannot raise).
 *
 * Only rendering is filtered. A row that is not shown keeps its stored values —
 * save writes the whole blob back unchanged for it — and the move buttons skip
 * it, so not even its `order` is touched. LEGACY: every row is shown.
 */
export interface PlanRowFilter {
    /** True when rows may be hidden (MANAGED + catalogue loaded). */
    managed: boolean;
    /** Some built-in tab or sub-tab is outside the plan → show the editor note. */
    hidesSomething: boolean;
    tab: (tabId: string) => boolean;
    subTab: (tabId: string, subId: string) => boolean;
    /**
     * A rail category is shown when at least one of the role's tabs in it is
     * (custom tabs count — they are the admin's own).
     */
    category: (
        categoryId: string,
        tabs: ReadonlyArray<{ id: string; category?: string; isCustom?: boolean }>
    ) => boolean;
    widget: (widgetId: string) => boolean;
}

const SHOW_ALL: PlanRowFilter = Object.freeze({
    managed: false,
    hidesSomething: false,
    tab: () => true,
    subTab: () => true,
    category: () => true,
    widget: () => true,
});

export function createPlanRowFilter(
    entitlement: Entitlement,
    staticItems: SidebarItemsType[]
): PlanRowFilter {
    if (!entitlement.managed) return SHOW_ALL;
    const categoryOf = new Map(staticItems.map((i) => [i.id, i.category || 'CRM']));
    const tab = (tabId: string) => !categoryOf.has(tabId) || entitlement.isNavItemEntitled(tabId);
    const hidesSomething = staticItems.some(
        (i) =>
            !entitlement.isNavItemEntitled(i.id) ||
            (i.subItems || []).some((s) => !entitlement.isNavItemEntitled(i.id, s.subItemId))
    );
    return {
        managed: true,
        hidesSomething,
        tab,
        subTab: (tabId, subId) => entitlement.isNavItemEntitled(tabId, subId),
        category: (categoryId, tabs) =>
            tabs.some(
                (t) => (categoryOf.get(t.id) || t.category || 'CRM') === categoryId && tab(t.id)
            ),
        widget: (widgetId) => entitlement.isWidgetEntitled(widgetId),
    };
}

export function usePlanRowFilter(): PlanRowFilter {
    const entitlement = useEntitlement();
    return useMemo(
        () =>
            entitlement.managed
                ? createPlanRowFilter(entitlement, getSidebarItemsData())
                : SHOW_ALL,
        [entitlement]
    );
}
