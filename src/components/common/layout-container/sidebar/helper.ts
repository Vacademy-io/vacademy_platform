import { SidebarItemsType } from '@/types/layout-container/layout-container-types';
import { SubModuleType } from '@/schemas/student/student-list/institute-schema';
import { SUB_MODULE_SIDEBAR_MAPPING, controlledTabs, modules } from './constant';
import { getTokenFromCookie, getUserRoles } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

export function getModuleFlags(
    sub_modules:
        | { module: string; sub_module: string; sub_module_description: string }[]
        | undefined
) {
    const modules = Array.isArray(sub_modules) ? sub_modules : [];
    return {
        assess: modules.some((item) => item?.module === 'ASSESS'),
        lms: modules.some((item) => item?.module === 'ENGAGE'),
        volt: modules.some((item) => item?.module === 'VOLT'),
        vsmart_ai_tools: modules.some((item) => item?.module === 'VSMART_AI_TOOLS'),
    };
}

// Get allowed sidebar items based on sub-modules
export function getAllowedSidebarItems(subModules: SubModuleType[] | undefined): Set<string> {
    const allowedItems = new Set<string>();

    if (!Array.isArray(subModules)) return allowedItems;

    subModules.forEach((subModule) => {
        if (!subModule) return;
        const mapping = SUB_MODULE_SIDEBAR_MAPPING[subModule.sub_module];
        if (mapping) {
            // Handle both single object and array of mappings
            const mappings = Array.isArray(mapping) ? mapping : [mapping];

            mappings.forEach((map) => {
                if (map.itemId) {
                    allowedItems.add(map.itemId);
                } else if (map.itemIds) {
                    map.itemIds.forEach((id) => allowedItems.add(id));
                }
            });
        }
    });

    return allowedItems;
}

/**
 * Filters sidebar items based on user role
 * Removes admin-only items for non-admin users
 */
export function filterSidebarByRole(menuList: SidebarItemsType[]): SidebarItemsType[] {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const userRoles = getUserRoles(accessToken);
    const isAdmin = userRoles.includes('ADMIN');

    // If user is admin, return all items
    if (isAdmin) {
        return menuList;
    }

    // For non-admin users, filter out admin-only items and sub-items
    const adminOnlyIds = [
        'learner-insights', // Learner Live Activities
        'manage-institute', // Institute settings
        'settings', // Settings
    ];

    return menuList
        .filter((item) => !adminOnlyIds.includes(item.id))
        .map((item) => {
            if (item.subItems && item.subItems.length > 0) {
                const filteredSubItems = item.subItems.filter((sub) => !sub.adminOnly);
                return { ...item, subItems: filteredSubItems };
            }
            return item;
        });
}

export function filterMenuList(
    subModules: { assess: boolean | undefined; lms: boolean | undefined },
    menuList: SidebarItemsType[]
) {
    return menuList.filter((item) => {
        if (item.to === '/assessment' && !subModules.assess) return false;
        return true;
    });
}

// Get allowed sub-items for a specific sidebar item
export function getAllowedSubItems(
    subModules: SubModuleType[] | undefined,
    itemId: string
): Set<string> {
    const allowedSubItems = new Set<string>();

    if (!Array.isArray(subModules)) return allowedSubItems;

    subModules.forEach((subModule) => {
        if (!subModule) return;
        const mapping = SUB_MODULE_SIDEBAR_MAPPING[subModule.sub_module];
        if (mapping) {
            // Handle both single object and array of mappings
            const mappings = Array.isArray(mapping) ? mapping : [mapping];

            mappings.forEach((map) => {
                if (map.itemId && map.itemId === itemId) {
                    if (Array.isArray(map.subItemIds)) {
                        map.subItemIds.forEach((subItem: string) => allowedSubItems.add(subItem));
                    }
                } else if (map.itemIds && map.itemIds.includes(itemId)) {
                    if (Array.isArray(map.subItemIds)) {
                        map.subItemIds.forEach((subItem: string) => allowedSubItems.add(subItem));
                    }
                }
            });
        }
    });

    return allowedSubItems;
}

export function filterMenuListByModules(
    subModules: SubModuleType[] | undefined,
    menuList: SidebarItemsType[]
): SidebarItemsType[] {
    const allowedItems = getAllowedSidebarItems(subModules);

    return menuList
        .filter((item) => {
            // Always allow key tabs irrespective of module mapping
            if (
                item.id === 'dashboard' ||
                item.id === 'settings' ||
                item.id === 'announcement' ||
                item.id === 'user-tags' ||
                item.id === 'manage-campaigns' ||
                item.id === 'planning' ||
                item.id === 'membership-expiry' ||
                item.id === 'membership-stats' ||
                item.id === 'manage-contacts' ||
                item.id === 'ai-center' ||
                item.id === 'instructor-copilot' ||
                item.id === 'admissions'
            ) {
                return true;
            }

            // Check if the item is allowed based on sub-modules
            return allowedItems.has(item.id);
        })
        .map((item) => {
            // If item has sub-items, filter them based on allowed sub-items
            if (item.subItems) {
                const allowedSubItems = getAllowedSubItems(subModules, item.id);
                // If no explicit sub-item permissions found for this item, keep all sub-items
                if (allowedSubItems.size === 0) {
                    return item;
                }
                const filteredSubItems = item.subItems.filter((subItem) =>
                    allowedSubItems.has(subItem.subItemId || '')
                );
                return { ...item, subItems: filteredSubItems };
            }
            return item;
        });
}

export function filterMenuItems(
    menuList: SidebarItemsType[],
    instituteId: string | undefined,
    isTabVisible?: (tabId: string) => boolean,
    isSubItemVisible?: (parentTabId: string, subItemTabId: string) => boolean
) {
    // Define the tabs that should be controlled by tab settings
    let filteredList = filterSidebarByRole(menuList);

    // Apply tab settings filtering if functions are provided
    if (isTabVisible && isSubItemVisible) {
        filteredList = filteredList
            .filter((item) => {
                // show all tabs that are not controlled tabs
                if (!controlledTabs.includes(item.id)) {
                    return true; // show all tabs that are not controlled tabs
                }

                // in case of controlled tabs, return true if the tab is visible
                return isTabVisible(item.id);
            })
            .map((item) => {
                // Do the same for sub-items
                if (item.subItems) {
                    const filteredSubItems = item.subItems.filter((subItem) => {
                        // show all sub-items that are not controlled sub-items
                        if (!controlledTabs.includes(subItem.subItemId || '')) {
                            return true;
                        }

                        // in case of controlled sub-items, return true if the sub-item is visible
                        // Note: For controlled sub-items, we check their individual visibility
                        // regardless of whether the parent tab is controlled or not
                        return isSubItemVisible(item.id, subItem.subItemId || '');
                    });

                    // return the item with filtered sub-items
                    return { ...item, subItems: filteredSubItems };
                }
                return item;
            });
    }

    return filteredList;
}

export function getModules(subModules: SubModuleType[] | undefined) {
    const optionalModules: Set<string> = new Set();

    if (Array.isArray(subModules)) {
        subModules.forEach((subModule) => {
            if (subModule && modules.includes(subModule.module)) {
                optionalModules.add(subModule.module);
            }
        });
    }

    const result = Array.from(optionalModules);
    return result;
}
