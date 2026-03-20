import { useState, useEffect } from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
import { StorageKey } from '@/constants/storage/storage';

interface TabItem {
    name: string;
    tabId: string;
    module: string;
    isVisible: boolean;
    subItems?: TabItem[];
}

export const useTabSettings = () => {
    const { getValue } = useLocalStorage<TabItem[]>(StorageKey.TAB_SETTINGS, []);
    const [tabSettings, setTabSettings] = useState<TabItem[]>([]);

    useEffect(() => {
        const settings = getValue();
        setTabSettings(settings);
    }, []); // Remove getValue from dependencies to prevent infinite re-renders

    const isTabVisible = (tabId: string): boolean => {
        const tab = tabSettings.find((t) => t.tabId === tabId);
        return tab?.isVisible ?? true; // Default to visible if not found
    };

    const isSubItemVisible = (parentTabId: string, subItemTabId: string): boolean => {
        // First check if the sub-item is directly controlled in the tab settings
        const parentTab = tabSettings.find((t) => t.tabId === parentTabId);

        // If parent tab is controlled and hidden, hide all its sub-items
        if (parentTab && !parentTab.isVisible) {
            return false;
        }

        // If parent tab exists and has sub-items, check the specific sub-item
        if (parentTab?.subItems) {
            const subItem = parentTab.subItems.find((s) => s.tabId === subItemTabId);
            if (subItem) {
                return subItem.isVisible;
            }
        }

        // If sub-item is not found in parent's sub-items, check if it's a top-level controlled item
        // This handles cases where sub-items are defined as top-level items in optionalTab
        const topLevelItem = tabSettings.find((t) => t.tabId === subItemTabId);
        if (topLevelItem) {
            return topLevelItem.isVisible;
        }

        // If not found anywhere, default to visible
        return true;
    };

    return {
        tabSettings,
        isTabVisible,
        isSubItemVisible,
    };
};
