import { useState, useEffect } from 'react';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '../NamingSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Eye, EyeOff, Settings } from 'lucide-react';
import { MyButton } from '@/components/design-system/button';
import useLocalStorage from '@/hooks/use-local-storage';
import { StorageKey } from '@/constants/storage/storage';

interface TabItem {
    name: string;
    tabId: string;
    module: string;
    isVisible: boolean;
    subItems?: TabItem[];
}

const optionalTab: TabItem[] = [
    {
        name: getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession),
        tabId: 'live-session',
        module: 'ENGAGE',
        isVisible: true,
    },
    {
        name: 'Reports',
        tabId: 'reports',
        module: 'ENGAGE',
        isVisible: true,
    },
    {
        name: 'Doubt Management',
        tabId: 'doubt-management',
        module: 'ENGAGE',
        isVisible: true,
    },
    {
        name: 'Evaluation Centre',
        tabId: 'evaluation-centre',
        module: 'ASSESS',
        isVisible: true,
        subItems: [
            {
                name: 'Evaluations',
                tabId: 'evaluations',
                module: 'ASSESS',
                isVisible: true,
            },
            {
                name: 'Evaluation tool',
                tabId: 'evaluation-tool',
                module: 'ASSESS',
                isVisible: true,
            },
        ],
    },
    {
        name: 'Community Centre',
        tabId: 'community-centre',
        module: 'ALL',
        isVisible: true,
    },
];

export default function TabSettings({ isTab = false }: { isTab: boolean }) {
    const [tabSettings, setTabSettings] = useState<TabItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const { setValue, getValue } = useLocalStorage<TabItem[]>(StorageKey.TAB_SETTINGS, []);

    useEffect(() => {
        initializeTabSettings();
    }, []);

    const initializeTabSettings = () => {
        const savedSettings = getValue();

        // If no saved settings exist, use the default optionalTab
        if (!savedSettings || savedSettings.length === 0) {
            setTabSettings(optionalTab);
            setValue(optionalTab); // Save default settings to localStorage
        } else {
            setTabSettings(savedSettings);
        }
    };

    const handleTabToggle = (tabId: string, isVisible: boolean) => {
        setTabSettings((prev) => {
            const updated = prev.map((tab) => {
                if (tab.tabId === tabId) {
                    // If hiding a tab with sub-items, hide all sub-items
                    if (!isVisible && tab.subItems && tab.subItems.length > 0) {
                        return {
                            ...tab,
                            isVisible,
                            subItems: tab.subItems.map((sub) => ({
                                ...sub,
                                isVisible: false, // Hide all sub-items when parent is hidden
                            })),
                        };
                    }
                    // If showing a tab with sub-items, show all sub-items
                    if (isVisible && tab.subItems && tab.subItems.length > 0) {
                        return {
                            ...tab,
                            isVisible,
                            subItems: tab.subItems.map((sub) => ({
                                ...sub,
                                isVisible: true, // Show all sub-items when parent is visible
                            })),
                        };
                    }
                    return { ...tab, isVisible };
                }
                return tab;
            });
            setValue(updated); // Save to localStorage immediately
            return updated;
        });
    };

    const handleSubItemToggle = (parentTabId: string, subItemTabId: string, isVisible: boolean) => {
        // Check if parent tab is visible
        const parentTab = tabSettings.find((tab) => tab.tabId === parentTabId);
        if (!parentTab?.isVisible) {
            setError('Parent tab must be visible to toggle sub-items');
            setTimeout(() => setError(null), 3000);
            return;
        }

        setTabSettings((prev) => {
            const updated = prev.map((tab) => {
                if (tab.tabId === parentTabId && tab.subItems) {
                    const updatedSubItems = tab.subItems.map((sub) => {
                        if (sub.tabId === subItemTabId) {
                            return { ...sub, isVisible };
                        }
                        return sub;
                    });

                    // If hiding the last visible sub-item, prevent it
                    const visibleSubItems = updatedSubItems.filter((sub) => sub.isVisible);
                    if (visibleSubItems.length === 0) {
                        setError('At least one sub-item must remain visible');
                        setTimeout(() => setError(null), 3000);
                        return tab; // Return unchanged
                    }

                    return { ...tab, subItems: updatedSubItems };
                }
                return tab;
            });
            setValue(updated); // Save to localStorage immediately
            return updated;
        });
    };

    const handleSaveSettings = () => {
        try {
            setValue(tabSettings);
            setSuccess('Tab settings saved successfully!');
            window.location.reload();
            setTimeout(() => setSuccess(null), 2000);
        } catch (error) {
            setError('Failed to save tab settings');
            setTimeout(() => setError(null), 2000);
        }
    };

    const getTabSetting = (tabId: string) => {
        return tabSettings.find((tab) => tab.tabId === tabId);
    };

    const getSubItemSetting = (parentTabId: string, subItemTabId: string) => {
        const parentTab = tabSettings.find((tab) => tab.tabId === parentTabId);
        return parentTab?.subItems?.find((sub) => sub.tabId === subItemTabId);
    };

    const handleResetToDefaults = () => {
        setValue(optionalTab);
        setTabSettings(optionalTab); // Update the state immediately
        setSuccess('Settings reset to defaults');
        setTimeout(() => setSuccess(null), 3000);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            {isTab && (
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold ">Tab Settings</h2>
                        <p className="text-sm text-gray-600">
                            Configure which tabs are visible in your dashboard
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <MyButton buttonType="secondary" onClick={handleResetToDefaults}>
                            Reset
                        </MyButton>
                        <MyButton buttonType="primary" onClick={handleSaveSettings}>
                            Save Settings
                        </MyButton>
                    </div>
                </div>
            )}

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Success Alert */}
            {success && (
                <Alert variant="default" className="border-green-200 bg-green-50 text-green-800">
                    <Settings className="size-4" />
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            {/* Tab Settings */}
            <div className="grid gap-4">
                {optionalTab.map((tab) => {
                    // Show all tabs regardless of module - removed sub_modules dependency
                    const tabSetting = getTabSetting(tab.tabId);
                    const isVisible = tabSetting?.isVisible ?? true;

                    return (
                        <Card key={tab.tabId} className="rounded-lg border-gray-200">
                            <CardHeader className="py-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {isVisible ? (
                                            <Eye className="size-5 text-green-600" />
                                        ) : (
                                            <EyeOff className="size-5 text-gray-400" />
                                        )}
                                        <CardTitle className="text-base">{tab.name}</CardTitle>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            checked={isVisible}
                                            onCheckedChange={(checked) => {
                                                console.log(tab.tabId, checked),
                                                    handleTabToggle(tab.tabId, checked);
                                            }}
                                        />
                                        <Label className="text-sm">
                                            {isVisible ? 'Visible' : 'Hidden'}
                                        </Label>
                                    </div>
                                </div>
                            </CardHeader>

                            {/* Sub-items */}
                            {tab.subItems && tab.subItems.length > 0 && (
                                <CardContent className="pt-0">
                                    <div className="ml-8 space-y-3">
                                        <div className="mb-2 text-sm font-medium text-gray-700">
                                            Sub-items:
                                        </div>
                                        {tab.subItems.map((subItem) => {
                                            const subItemSetting = getSubItemSetting(
                                                tab.tabId,
                                                subItem.tabId
                                            );
                                            const subItemVisible =
                                                subItemSetting?.isVisible ?? true;
                                            const isParentVisible = isVisible;
                                            const isSubItemDisabled = !isParentVisible;

                                            return (
                                                <div
                                                    key={subItem.tabId}
                                                    className={`flex items-center justify-between rounded-lg border p-3 ${
                                                        isSubItemDisabled
                                                            ? 'border-gray-200 bg-gray-100 opacity-60'
                                                            : subItemVisible
                                                              ? 'border-green-200 bg-green-50'
                                                              : 'border-gray-200 bg-gray-50'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {isSubItemDisabled ? (
                                                            <EyeOff className="size-4 text-gray-400" />
                                                        ) : subItemVisible ? (
                                                            <Eye className="size-4 text-green-600" />
                                                        ) : (
                                                            <EyeOff className="size-4 text-gray-400" />
                                                        )}
                                                        <span
                                                            className={`text-sm font-medium ${
                                                                isSubItemDisabled
                                                                    ? 'text-gray-500'
                                                                    : ''
                                                            }`}
                                                        >
                                                            {subItem.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <Switch
                                                            checked={subItemVisible}
                                                            disabled={isSubItemDisabled}
                                                            onCheckedChange={(checked) =>
                                                                handleSubItemToggle(
                                                                    tab.tabId,
                                                                    subItem.tabId,
                                                                    checked
                                                                )
                                                            }
                                                        />
                                                        <Label
                                                            className={`text-xs ${
                                                                isSubItemDisabled
                                                                    ? 'text-gray-400'
                                                                    : ''
                                                            }`}
                                                        >
                                                            {isSubItemDisabled
                                                                ? 'Disabled'
                                                                : subItemVisible
                                                                  ? 'Visible'
                                                                  : 'Hidden'}
                                                        </Label>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div className="mt-2 text-xs text-gray-500">
                                            {isVisible
                                                ? 'At least one sub-item must remain visible'
                                                : 'Sub-items are disabled when parent tab is hidden'}
                                        </div>
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
            </div>
            {!isTab && (
                <div className="flex items-center justify-end gap-2">
                    <MyButton buttonType="secondary" scale="small" onClick={handleResetToDefaults}>
                        Reset
                    </MyButton>
                    <MyButton buttonType="primary" scale="small" onClick={handleSaveSettings}>
                        Save
                    </MyButton>
                </div>
            )}
        </div>
    );
}
