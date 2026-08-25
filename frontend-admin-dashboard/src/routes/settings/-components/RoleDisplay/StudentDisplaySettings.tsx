import React, { useEffect, useRef, useState } from 'react';
import { UnsavedChangesBar } from '@/components/common/unsaved-changes-bar';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
    ArrowUp,
    ArrowDown,
    Check,
    CaretDown,
    CaretLeft,
    CaretRight,
    CircleNotch,
    FilePdf,
    SquaresFour,
    SignIn,
    GraduationCap,
    BellSimple,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { downloadTutorialGuidePdf } from '@/routes/settings/-utils/tutorial-guide';
import {
    SettingsPageShell,
    SettingsSectionsLayout,
    type SettingsSectionGroup,
} from '@/components/settings/shell';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    getLearnerTourOptions,
    LEARNER_TOUR_KEYS,
    type StudentDisplaySettingsData,
    type StudentCourseDetailsTabId,
    type StudentAllCoursesTabId,
    type OutlineMode,
    type StudentDefaultProvider,
    type UsernameStrategy,
    type PasswordStrategy,
    type PasswordDelivery,
    type StudentAuthPresentation,
    type StudentUiType,
    type SlidesSidebarNavigation,
    type ContentCardImageFit,
    type EnrolledCourseLayout,
    type FeedbackTrigger,
    type StudentDashboardWidgetConfig,
    RETIRED_WIDGET_IDS,
    WIDGET_LABELS,
} from '@/types/student-display-settings';
import { Checkbox } from '@/components/ui/checkbox';
import { getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import {
    getStudentDisplaySettings,
    saveStudentDisplaySettings,
} from '@/services/student-display-settings';
import MaxActiveSessionsSetting from './MaxActiveSessionsSetting';

/**
 * The widget rows this screen renders: retired ids filtered out (the learner
 * dashboard reads none of them, so their toggles did nothing), rest sorted by
 * order. Both the list and moveWidget go through here so the "move up/down"
 * indices always refer to the rows the admin can actually see.
 */
function widgetRows(widgets: StudentDashboardWidgetConfig[]): StudentDashboardWidgetConfig[] {
    return widgets
        .filter((w) => !RETIRED_WIDGET_IDS.has(w.id))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
}

const STUDENT_DISPLAY_SECTIONS: SettingsSectionGroup[] = [
    {
        sections: [
            { id: 'grp-layout', label: 'Layout & Navigation', icon: SquaresFour },
            { id: 'grp-account', label: 'Login & Account', icon: SignIn },
            { id: 'grp-learning', label: 'Learning Experience', icon: GraduationCap },
            {
                id: 'grp-notifications',
                label: 'Notifications & Redirect',
                icon: BellSimple,
            },
        ],
    },
];

export default function StudentDisplaySettings(): JSX.Element {
    const [settings, setSettings] = useState<StudentDisplaySettingsData | null>(null);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [downloadingGuide, setDownloadingGuide] = useState(false);

    // Snapshot of the last loaded/saved state for the Discard button in the
    // sticky unsaved-changes bar.
    const pristineSettingsRef = useRef<StudentDisplaySettingsData | null>(null);

    useEffect(() => {
        getStudentDisplaySettings()
            .then((s) => {
                setSettings(s);
                pristineSettingsRef.current = s;
            })
            .catch(() => setSettings(null));
    }, []);

    const update = <K extends keyof StudentDisplaySettingsData>(
        key: K,
        value: StudentDisplaySettingsData[K]
    ) => {
        setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
        setHasChanges(true);
    };

    const onSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await saveStudentDisplaySettings(settings);
            pristineSettingsRef.current = settings;
            setHasChanges(false);
        } finally {
            setSaving(false);
        }
    };

    const discardChanges = () => {
        if (!pristineSettingsRef.current) return;
        setSettings(pristineSettingsRef.current);
        setHasChanges(false);
    };

    // Helpers for custom tabs/sub-tabs and widgets
    const addCustomTab = () => {
        if (!settings) return;
        const nextOrder = (settings.sidebar.tabs?.length || 0) + 1;
        const newTab = {
            id: `custom-tab-${Date.now()}`,
            label: 'Custom Tab',
            route: '/',
            order: nextOrder,
            visible: true,
            isCustom: true,
            subTabs: [] as Array<{
                id: string;
                label?: string;
                route: string;
                order: number;
                visible: boolean;
            }>,
        };
        update('sidebar', { ...settings.sidebar, tabs: [...settings.sidebar.tabs, newTab] });
    };

    const removeTab = (tabId: string) => {
        if (!settings) return;
        const tab = settings.sidebar.tabs.find((t) => t.id === tabId);
        if (!tab?.isCustom) return; // Only allow removing custom tabs
        update('sidebar', {
            ...settings.sidebar,
            tabs: settings.sidebar.tabs.filter((t) => t.id !== tabId),
        });
    };

    const updateTabField = (
        tabId: string,
        field: 'label' | 'route' | 'order' | 'visible',
        value: string | number | boolean
    ) => {
        if (!settings) return;
        const tabs = settings.sidebar.tabs.map((t) =>
            t.id === tabId ? { ...t, [field]: value } : t
        );
        update('sidebar', { ...settings.sidebar, tabs });
    };

    const addSubTab = (tabId: string) => {
        if (!settings) return;
        const tabs = settings.sidebar.tabs.map((t) => {
            if (t.id !== tabId) return t;
            const nextOrder = ((t.subTabs?.length || 0) + 1) as number;
            const sub = {
                id: `custom-sub-${Date.now()}`,
                label: 'Custom Sub Tab',
                route: '/',
                order: nextOrder,
                visible: true,
            };
            return { ...t, subTabs: [...(t.subTabs || []), sub] };
        });
        update('sidebar', { ...settings.sidebar, tabs });
    };

    const removeSubTab = (tabId: string, subId: string) => {
        if (!settings) return;
        const tabs = settings.sidebar.tabs.map((t) => {
            if (t.id !== tabId) return t;
            // Allow removal for custom subs we created (id starts with custom-sub-)
            const filtered = (t.subTabs || []).filter(
                (s) => s.id !== subId || !s.id.startsWith('custom-sub-')
            );
            return { ...t, subTabs: filtered };
        });
        update('sidebar', { ...settings.sidebar, tabs });
    };

    const addCustomWidget = () => {
        if (!settings) return;
        const nextOrder = (settings.dashboard.widgets?.length || 0) + 1;
        const custom = {
            id: 'custom' as const,
            title: 'Custom Widget',
            subTitle: '',
            link: '/',
            order: nextOrder,
            visible: true,
            isCustom: true,
        };
        update('dashboard', { widgets: [...settings.dashboard.widgets, custom] });
    };

    const removeWidgetAt = (index: number) => {
        if (!settings) return;
        const list = [...settings.dashboard.widgets];
        const item = list[index];
        if (item?.id !== 'custom' && !item?.isCustom) return; // only custom widgets
        list.splice(index, 1);
        update('dashboard', { widgets: list });
    };

    // Move sidebar tab up/down
    const moveTab = (tabId: string, direction: 'up' | 'down') => {
        if (!settings) return;
        const sorted = [...settings.sidebar.tabs].sort((a, b) => (a.order || 0) - (b.order || 0));
        const idx = sorted.findIndex((t) => t.id === tabId);
        if (idx < 0) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;
        const current = sorted[idx]!;
        const swap = sorted[swapIdx]!;
        const tabs = settings.sidebar.tabs.map((t) => {
            if (t.id === current.id) return { ...t, order: swap.order };
            if (t.id === swap.id) return { ...t, order: current.order };
            return t;
        });
        update('sidebar', { ...settings.sidebar, tabs });
    };

    // Move sub-tab up/down
    const moveSubTab = (tabId: string, subId: string, direction: 'up' | 'down') => {
        if (!settings) return;
        const tabs = settings.sidebar.tabs.map((t) => {
            if (t.id !== tabId) return t;
            const sorted = [...(t.subTabs || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
            const idx = sorted.findIndex((s) => s.id === subId);
            if (idx < 0) return t;
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= sorted.length) return t;
            const current = sorted[idx]!;
            const swap = sorted[swapIdx]!;
            return {
                ...t,
                subTabs: (t.subTabs || []).map((s) => {
                    if (s.id === current.id) return { ...s, order: swap.order };
                    if (s.id === swap.id) return { ...s, order: current.order };
                    return s;
                }),
            };
        });
        update('sidebar', { ...settings.sidebar, tabs });
    };

    // Move widget up/down
    const moveWidget = (widgetIdx: number, direction: 'up' | 'down') => {
        if (!settings) return;
        // Same filtered+sorted list the UI renders, so the swap target is the
        // row directly above/below on screen — a hidden retired entry must not
        // silently absorb the move.
        const sorted = widgetRows(settings.dashboard.widgets);
        const swapIdx = direction === 'up' ? widgetIdx - 1 : widgetIdx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;
        const current = sorted[widgetIdx]!;
        const swap = sorted[swapIdx]!;
        // Identity match: two custom widgets share id 'custom', so matching on
        // id+order could swap the wrong pair.
        const widgets = settings.dashboard.widgets.map((w) => {
            if (w === current) return { ...w, order: swap.order };
            if (w === swap) return { ...w, order: current.order };
            return w;
        });
        update('dashboard', { widgets });
    };

    // Generic swap for simple tab arrays
    const swapTabOrder = <T extends { id: string; order: number }>(
        items: T[],
        targetId: string,
        direction: 'up' | 'down'
    ): T[] => {
        const sorted = [...items].sort((a, b) => (a.order || 0) - (b.order || 0));
        const idx = sorted.findIndex((t) => t.id === targetId);
        if (idx < 0) return items;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return items;
        const current = sorted[idx]!;
        const swap = sorted[swapIdx]!;
        return items.map((t) => {
            if (t.id === current.id) return { ...t, order: swap.order };
            if (t.id === swap.id) return { ...t, order: current.order };
            return t;
        });
    };

    if (!settings) return <div className="p-4 text-sm">Loading...</div>;

    return (
        <SettingsPageShell
            title="Student Display Settings"
            description="Control what learners see — sidebar, courses, login, certificates, notifications and more."
            maxWidth="max-w-7xl"
        >
            {/* Save is handled by the sticky UnsavedChangesBar at the bottom of
                the viewport, so the redundant top + bottom buttons that used
                to live here have been removed. */}
            <SettingsSectionsLayout groups={STUDENT_DISPLAY_SECTIONS}>
            <section id="grp-layout" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Sidebar</CardTitle>
                    <CardDescription>
                        Toggle entire sidebar and configure tabs, order and visibility
                    </CardDescription>
                </CardHeader>
                <div className="space-y-3 p-4 pt-0">
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.sidebar.visible}
                            onCheckedChange={(v) =>
                                update('sidebar', { ...settings.sidebar, visible: v })
                            }
                        />
                        <Label>Sidebar Visible</Label>
                    </div>
                    <div className="mb-3 flex items-center gap-2">
                        <Button type="button" onClick={addCustomTab} size="sm" variant="secondary">
                            Add Custom Tab
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {(() => {
                            const sortedTabs = settings.sidebar.tabs
                                .slice()
                                .sort((a, b) => (a.order || 0) - (b.order || 0));
                            return sortedTabs.map((t, tabIdx) => (
                                <div key={t.id} className="space-y-2 rounded border p-2">
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col items-center gap-0.5">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={tabIdx === 0} onClick={() => moveTab(t.id, 'up')}>
                                                <ArrowUp className="h-3 w-3" />
                                            </Button>
                                            <span className="text-xs text-muted-foreground">{tabIdx + 1}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={tabIdx === sortedTabs.length - 1} onClick={() => moveTab(t.id, 'down')}>
                                                <ArrowDown className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <div className="flex flex-1 flex-wrap items-center gap-2">
                                            <div className="grow text-xs font-medium">{t.id}</div>
                                            <Label className="text-xs">Label</Label>
                                            <Input className="h-8 w-40" value={t.label || ''} onChange={(e) => updateTabField(t.id, 'label', e.target.value)} />
                                            <Label className="text-xs">Route</Label>
                                            <Input className="h-8 w-56" value={t.route || ''} onChange={(e) => updateTabField(t.id, 'route', e.target.value)} />
                                            <Label className="text-xs">Visible</Label>
                                            <Switch checked={t.visible} onCheckedChange={(v) => updateTabField(t.id, 'visible', v)} />
                                            {t.isCustom && (
                                                <Button type="button" size="sm" variant="destructive" onClick={() => removeTab(t.id)}>
                                                    Remove Tab
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="ml-8 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-2xs font-medium text-neutral-600">Sub Tabs</div>
                                            <Button type="button" size="sm" variant="secondary" onClick={() => addSubTab(t.id)}>Add Sub Tab</Button>
                                        </div>
                                        {(() => {
                                            const sortedSubs = (t.subTabs || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
                                            return sortedSubs.map((s, subIdx) => (
                                                <div key={s.id} className="flex items-center gap-2 rounded border p-2">
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <Button variant="ghost" size="icon" className="h-5 w-5" disabled={subIdx === 0} onClick={() => moveSubTab(t.id, s.id, 'up')}>
                                                            <ArrowUp className="h-3 w-3" />
                                                        </Button>
                                                        <span className="text-2xs text-muted-foreground">{subIdx + 1}</span>
                                                        <Button variant="ghost" size="icon" className="h-5 w-5" disabled={subIdx === sortedSubs.length - 1} onClick={() => moveSubTab(t.id, s.id, 'down')}>
                                                            <ArrowDown className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                    <div className="flex flex-1 flex-wrap items-center gap-2">
                                                        <div className="grow text-2xs font-medium">{s.id}</div>
                                                        <Label className="text-xs">Label</Label>
                                                        <Input className="h-8 w-36" value={s.label || ''} onChange={(e) => {
                                                            const tabs = settings.sidebar.tabs.map((tab) => {
                                                                if (tab.id !== t.id) return tab;
                                                                const subTabs = (tab.subTabs || []).map((sub) => sub.id === s.id ? { ...sub, label: e.target.value } : sub);
                                                                return { ...tab, subTabs };
                                                            });
                                                            update('sidebar', { ...settings.sidebar, tabs });
                                                        }} />
                                                        <Label className="text-xs">Route</Label>
                                                        <Input className="h-8 w-56" value={s.route} onChange={(e) => {
                                                            const tabs = settings.sidebar.tabs.map((tab) => {
                                                                if (tab.id !== t.id) return tab;
                                                                const subTabs = (tab.subTabs || []).map((sub) => sub.id === s.id ? { ...sub, route: e.target.value } : sub);
                                                                return { ...tab, subTabs };
                                                            });
                                                            update('sidebar', { ...settings.sidebar, tabs });
                                                        }} />
                                                        <Label className="text-xs">Visible</Label>
                                                        <Switch checked={s.visible} onCheckedChange={(v) => {
                                                            const tabs = settings.sidebar.tabs.map((tab) => {
                                                                if (tab.id !== t.id) return tab;
                                                                const subTabs = (tab.subTabs || []).map((sub) => sub.id === s.id ? { ...sub, visible: v } : sub);
                                                                return { ...tab, subTabs };
                                                            });
                                                            update('sidebar', { ...settings.sidebar, tabs });
                                                        }} />
                                                        {s.id.startsWith('custom-sub-') && (
                                                            <Button type="button" size="sm" variant="destructive" onClick={() => removeSubTab(t.id, s.id)}>Remove</Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>UI</CardTitle>
                    <CardDescription>Select the visual theme for learner portal</CardDescription>
                </CardHeader>
                <div className="space-y-2 p-4 pt-0">
                    <div className="flex items-center gap-2">
                        <Label className="text-xs">Theme Skin</Label>
                        <Select
                            value={settings.ui.type}
                            onValueChange={(v) =>
                                update('ui', {
                                    type: v as StudentUiType,
                                })
                            }
                        >
                            <SelectTrigger className="h-8 w-48 text-xs">
                                <SelectValue placeholder="Select UI type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">default</SelectItem>
                                <SelectItem value="vibrant">vibrant</SelectItem>
                                <SelectItem value="play">play</SelectItem>
                                <SelectItem value="cleanerPlay">Cleaner Play</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Dashboard Widgets</CardTitle>
                    <CardDescription>Hide/Unhide, order and add custom widgets</CardDescription>
                </CardHeader>
                <div className="space-y-2 p-4 pt-0">
                    <div className="mb-3 flex items-center gap-2">
                        <Button
                            type="button"
                            onClick={addCustomWidget}
                            size="sm"
                            variant="secondary"
                        >
                            Add Custom Widget
                        </Button>
                    </div>
                    {(() => {
                        const sorted = widgetRows(settings.dashboard.widgets);
                        return sorted.map((w, idx) => {
                            // Find the original index in the unsorted array for updates
                            const origIdx = settings.dashboard.widgets.indexOf(w);
                            return (
                                <div
                                    key={`${w.id}-${w.title ?? ''}-${origIdx}`}
                                    className="flex items-center gap-2 rounded border p-2"
                                >
                                    <div className="flex flex-col items-center gap-0.5">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => moveWidget(idx, 'up')}>
                                            <ArrowUp className="h-3 w-3" />
                                        </Button>
                                        <span className="text-xs text-muted-foreground">{idx + 1}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === sorted.length - 1} onClick={() => moveWidget(idx, 'down')}>
                                            <ArrowDown className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <div className="flex flex-1 flex-wrap items-center gap-2">
                                        <div className="grow text-xs font-medium">
                                            {WIDGET_LABELS[w.id] ?? w.id}
                                            {w.isCustom && w.title ? `: ${w.title}` : ''}
                                        </div>
                                        {w.id === 'custom' && (
                                            <>
                                                <Label className="text-xs">Title</Label>
                                                <Input className="h-8 w-40" value={w.title || ''} onChange={(e) => {
                                                    const widgets = settings.dashboard.widgets.map((x, i) => i === origIdx ? { ...x, title: e.target.value } : x);
                                                    update('dashboard', { widgets });
                                                }} />
                                                <Label className="text-xs">Sub Title</Label>
                                                <Input className="h-8 w-48" value={w.subTitle || ''} onChange={(e) => {
                                                    const widgets = settings.dashboard.widgets.map((x, i) => i === origIdx ? { ...x, subTitle: e.target.value } : x);
                                                    update('dashboard', { widgets });
                                                }} />
                                                <Label className="text-xs">Link</Label>
                                                <Input className="h-8 w-56" placeholder="/route or https://..." value={w.link || ''} onChange={(e) => {
                                                    const widgets = settings.dashboard.widgets.map((x, i) => i === origIdx ? { ...x, link: e.target.value } : x);
                                                    update('dashboard', { widgets });
                                                }} />
                                            </>
                                        )}
                                        <Label className="text-xs">Visible</Label>
                                        <Switch
                                            checked={w.visible}
                                            onCheckedChange={(v) => {
                                                const widgets = settings.dashboard.widgets.map((x, i) => i === origIdx ? { ...x, visible: v } : x);
                                                update('dashboard', { widgets });
                                            }}
                                        />
                                        {(w.id === 'custom' || w.isCustom) && (
                                            <Button type="button" size="sm" variant="destructive" onClick={() => removeWidgetAt(origIdx)}>Remove</Button>
                                        )}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            </Card>
            </section>

            <section id="grp-account" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Login & Signup</CardTitle>
                    <CardDescription>Providers and defaults for student signup</CardDescription>
                </CardHeader>
                <div className="space-y-2 p-4 pt-0">
                    <div className="flex items-center gap-2 pb-2 border-b">
                        <Switch
                            checked={settings.signup.enabled ?? true}
                            onCheckedChange={(v) =>
                                update('signup', { ...settings.signup, enabled: v })
                            }
                        />
                        <Label className="text-xs font-semibold">Signup enabled</Label>
                        <span className="text-2xs text-muted-foreground">
                            Master toggle: when off, "Sign Up" links are hidden in the catalogue header.
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {(['google', 'github', 'usernamePassword', 'emailOtp'] as const).map(
                            (p) => (
                                <div key={p} className="flex items-center gap-2">
                                    <Switch
                                        checked={settings.signup.providers[p]}
                                        onCheckedChange={(v) =>
                                            update('signup', {
                                                ...settings.signup,
                                                providers: { ...settings.signup.providers, [p]: v },
                                            })
                                        }
                                    />
                                    <Label className="text-xs">{p}</Label>
                                </div>
                            )
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Label className="text-xs">Default Provider</Label>
                        <Select
                            value={settings.signup.providers.defaultProvider}
                            onValueChange={(v: string) =>
                                update('signup', {
                                    ...settings.signup,
                                    providers: {
                                        ...settings.signup.providers,
                                        defaultProvider: v as StudentDefaultProvider,
                                    },
                                })
                            }
                        >
                            <SelectTrigger className="h-8 w-40 text-xs">
                                <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="google">google</SelectItem>
                                <SelectItem value="github">github</SelectItem>
                                <SelectItem value="usernamePassword">usernamePassword</SelectItem>
                                <SelectItem value="emailOtp">emailOtp</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {/* Username / Password strategies */}
                    <div className="flex flex-wrap items-center gap-3">
                        <Label className="text-xs">Username Strategy</Label>
                        <Select
                            value={settings.signup.usernameStrategy}
                            onValueChange={(v) =>
                                update('signup', {
                                    ...settings.signup,
                                    usernameStrategy: v as UsernameStrategy,
                                })
                            }
                        >
                            <SelectTrigger className="h-8 w-48 text-xs">
                                <SelectValue placeholder="Select strategy" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="email">email</SelectItem>
                                <SelectItem value="random">random</SelectItem>
                                <SelectItem value="manual">manual</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Label className="text-xs">Password Strategy</Label>
                        <Select
                            value={settings.signup.passwordStrategy}
                            onValueChange={(v) =>
                                update('signup', {
                                    ...settings.signup,
                                    passwordStrategy: v as PasswordStrategy,
                                })
                            }
                        >
                            <SelectTrigger className="h-8 w-48 text-xs">
                                <SelectValue placeholder="Select strategy" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="manual">manual</SelectItem>
                                <SelectItem value="autoRandom">autoRandom</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Label className="text-xs">Password Delivery</Label>
                        <Select
                            value={settings.signup.passwordDelivery}
                            onValueChange={(v) =>
                                update('signup', {
                                    ...settings.signup,
                                    passwordDelivery: v as PasswordDelivery,
                                })
                            }
                        >
                            <SelectTrigger className="h-8 w-48 text-xs">
                                <SelectValue placeholder="Select delivery method" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="showOnScreen">showOnScreen</SelectItem>
                                <SelectItem value="sendEmail">sendEmail</SelectItem>
                                <SelectItem value="none">none</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Label className="text-xs">Catalogue Header Auth</Label>
                        <Select
                            value={settings.signup.presentation ?? 'page'}
                            onValueChange={(v) =>
                                update('signup', {
                                    ...settings.signup,
                                    presentation: v as StudentAuthPresentation,
                                })
                            }
                        >
                            <SelectTrigger className="h-8 w-48 text-xs">
                                <SelectValue placeholder="Select presentation" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="page">page (navigate to /login)</SelectItem>
                                <SelectItem value="modal">modal (open in-place)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Card>

            <MaxActiveSessionsSetting />
            </section>

            <section id="grp-learning" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Course Settings</CardTitle>
                    <CardDescription>Global course interactions</CardDescription>
                </CardHeader>
                <div className="space-y-3 p-4 pt-0">
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.courseSettings.quiz.moveOnlyOnCorrectAnswer}
                            onCheckedChange={(v) =>
                                update('courseSettings', {
                                    quiz: {
                                        ...settings.courseSettings.quiz,
                                        moveOnlyOnCorrectAnswer: v,
                                    },
                                })
                            }
                        />
                        <Label className="text-xs">Move only on correct answer</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.courseSettings.quiz.celebrateOnQuizComplete}
                            onCheckedChange={(v) =>
                                update('courseSettings', {
                                    quiz: {
                                        ...settings.courseSettings.quiz,
                                        celebrateOnQuizComplete: v,
                                    },
                                })
                            }
                        />
                        <Label className="text-xs">Celebrate on quiz complete</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.courseSettings.quiz.showReportAndCorrectAnswers}
                            onCheckedChange={(v) =>
                                update('courseSettings', {
                                    quiz: {
                                        ...settings.courseSettings.quiz,
                                        showReportAndCorrectAnswers: v,
                                    },
                                })
                            }
                        />
                        <Label className="text-xs">Show report &amp; correct answers</Label>
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Permissions</CardTitle>
                    <CardDescription>Profile permissions</CardDescription>
                </CardHeader>
                <div className="space-y-2 p-4 pt-0">
                    {(
                        [
                            'canViewProfile',
                            'canEditProfile',
                            'canDeleteProfile',
                            'canViewFiles',
                            'canViewReports',
                        ] as const
                    ).map((k) => (
                        <div key={k} className="flex items-center gap-2">
                            <Switch
                                checked={settings.permissions[k]}
                                onCheckedChange={(v) =>
                                    update('permissions', { ...settings.permissions, [k]: v })
                                }
                            />
                            <Label className="text-xs">{k}</Label>
                        </div>
                    ))}
                </div>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Profile Page</CardTitle>
                    <CardDescription>What learners see on their Profile tab</CardDescription>
                </CardHeader>
                <div className="space-y-2 p-4 pt-0">
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.profile.showMembershipStatus}
                            onCheckedChange={(v) =>
                                update('profile', {
                                    ...settings.profile,
                                    showMembershipStatus: v,
                                })
                            }
                        />
                        <Label className="text-xs">
                            Show Membership Status (Access Days &amp; expiry)
                        </Label>
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Course Details</CardTitle>
                    <CardDescription>Tabs, default tab and view preferences</CardDescription>
                </CardHeader>
                <div className="space-y-3 p-4 pt-0">
                    {/* Page layout for learners who already own the course. Sits
                        first because "Content structure only" overrides most of
                        what follows for those learners. */}
                    <EnrolledLayoutPicker
                        value={settings.courseDetails.enrolledLayout ?? 'full'}
                        onChange={(v) =>
                            update('courseDetails', {
                                ...settings.courseDetails,
                                enrolledLayout: v,
                            })
                        }
                    />

                    {/* Card artwork fit. Sits with the layout because it only
                        affects the Content Structure cards that layout shows. */}
                    <div className="space-y-1 pb-4 border-b">
                        <Label className="text-sm font-semibold">
                            Content Card Artwork
                        </Label>
                        <p className="max-w-prose text-xs text-muted-foreground">
                            How subject, module and chapter thumbnails fit their card.
                            Choose Fill for photos; choose Fit Whole Image when your
                            artwork has a title designed into it, which Fill crops off.
                        </p>
                        <Select
                            value={settings.courseDetails.contentCardImageFit ?? 'cover'}
                            onValueChange={(v) =>
                                update('courseDetails', {
                                    ...settings.courseDetails,
                                    contentCardImageFit: v as ContentCardImageFit,
                                })
                            }
                        >
                            <SelectTrigger className="mt-1 w-full max-w-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cover">
                                    Fill the card (crops to fit) — default
                                </SelectItem>
                                <SelectItem value="contain">
                                    Fit whole image (no cropping)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Tri-state in storage (unset = follow the page layout).
                        The switch shows the value in effect, so saving pins
                        whatever the admin can see. */}
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={
                                settings.courseDetails.chapterOpensFirstSlide ??
                                (settings.courseDetails.enrolledLayout ?? 'full') ===
                                    'contentOnly'
                            }
                            onCheckedChange={(v) =>
                                update('courseDetails', {
                                    ...settings.courseDetails,
                                    chapterOpensFirstSlide: v,
                                })
                            }
                        />
                        <Label className="text-xs">
                            Chapter Card Opens the First Slide Directly
                        </Label>
                    </div>

                    {/* Tabs visibility */}
                    <div className="space-y-2">
                        {(() => {
                            const sorted = settings.courseDetails.tabs.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
                            return sorted.map((t, idx) => (
                                <div key={t.id} className="flex items-center gap-2 rounded border p-2">
                                    <div className="flex flex-col items-center gap-0.5">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => update('courseDetails', { ...settings.courseDetails, tabs: swapTabOrder(settings.courseDetails.tabs, t.id, 'up') })}>
                                            <ArrowUp className="h-3 w-3" />
                                        </Button>
                                        <span className="text-xs text-muted-foreground">{idx + 1}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === sorted.length - 1} onClick={() => update('courseDetails', { ...settings.courseDetails, tabs: swapTabOrder(settings.courseDetails.tabs, t.id, 'down') })}>
                                            <ArrowDown className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <div className="grow text-xs font-medium">{t.id}</div>
                                    <Label className="text-xs">Visible</Label>
                                    <Switch checked={t.visible} onCheckedChange={(v) => {
                                        const tabs = settings.courseDetails.tabs.map((x) => x.id === t.id ? { ...x, visible: v } : x);
                                        update('courseDetails', { ...settings.courseDetails, tabs });
                                    }} />
                                </div>
                            ));
                        })()}
                    </div>

                    {/* Default tab select */}
                    <div className="flex items-center gap-2">
                        <Label className="text-xs">Default Tab</Label>
                        <Select
                            value={settings.courseDetails.defaultTab}
                            onValueChange={(v) =>
                                update('courseDetails', {
                                    ...settings.courseDetails,
                                    defaultTab: v as StudentCourseDetailsTabId,
                                })
                            }
                        >
                            <SelectTrigger className="h-8 w-48 text-xs">
                                <SelectValue placeholder="Select default tab" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="OUTLINE">OUTLINE</SelectItem>
                                <SelectItem value="CONTENT_STRUCTURE">CONTENT_STRUCTURE</SelectItem>
                                <SelectItem value="TEACHERS">TEACHERS</SelectItem>
                                <SelectItem value="ASSESSMENTS">ASSESSMENTS</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Outline mode select */}
                    <div className="flex items-center gap-2">
                        <Label className="text-xs">Outline Mode</Label>
                        <Select
                            value={settings.courseDetails.outlineMode}
                            onValueChange={(v) =>
                                update('courseDetails', {
                                    ...settings.courseDetails,
                                    outlineMode: v as OutlineMode,
                                })
                            }
                        >
                            <SelectTrigger className="h-8 w-48 text-xs">
                                <SelectValue placeholder="Select mode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="expanded">expanded</SelectItem>
                                <SelectItem value="collapsed">collapsed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Ratings & Reviews */}
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.courseDetails.ratingsAndReviewsVisible}
                            onCheckedChange={(v) =>
                                update('courseDetails', {
                                    ...settings.courseDetails,
                                    ratingsAndReviewsVisible: v,
                                })
                            }
                        />
                        <Label className="text-xs">Ratings & Reviews Visible</Label>
                    </div>

                    {/* Hide author name on the course-details Course Overview panel */}
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.courseDetails.hideAuthorName ?? false}
                            onCheckedChange={(v) =>
                                update('courseDetails', {
                                    ...settings.courseDetails,
                                    hideAuthorName: v,
                                })
                            }
                        />
                        <Label className="text-xs">Hide Author Name (Course Details Page)</Label>
                    </div>

                    {/* Show Teachers/Instructors section on the course-details page (default off = hidden) */}
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.courseDetails.showInstructors ?? false}
                            onCheckedChange={(v) =>
                                update('courseDetails', {
                                    ...settings.courseDetails,
                                    showInstructors: v,
                                })
                            }
                        />
                        <Label className="text-xs">Show Teachers (Course Details Page)</Label>
                    </div>

                    {/* General visibility toggles */}
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.courseDetails.showCourseConfiguration}
                            onCheckedChange={(v) =>
                                update('courseDetails', {
                                    ...settings.courseDetails,
                                    showCourseConfiguration: v,
                                })
                            }
                        />
                        <Label className="text-xs">Show Course Configuration</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.courseDetails.showCourseContentPrefixes}
                            onCheckedChange={(v) =>
                                update('courseDetails', {
                                    ...settings.courseDetails,
                                    showCourseContentPrefixes: v,
                                })
                            }
                        />
                        <Label className="text-xs">Show Course Content Prefixes</Label>
                    </div>

                    {/* Course Overview / Slides View */}
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={settings.courseDetails.courseOverview.visible}
                                onCheckedChange={(v) =>
                                    update('courseDetails', {
                                        ...settings.courseDetails,
                                        courseOverview: {
                                            ...settings.courseDetails.courseOverview,
                                            visible: v,
                                        },
                                    })
                                }
                            />
                            <Label className="text-xs">Course Overview Visible</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={settings.courseDetails.courseOverview.showSlidesData}
                                onCheckedChange={(v) =>
                                    update('courseDetails', {
                                        ...settings.courseDetails,
                                        courseOverview: {
                                            ...settings.courseDetails.courseOverview,
                                            showSlidesData: v,
                                        },
                                    })
                                }
                            />
                            <Label className="text-xs">Show Slides Data</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={settings.courseDetails.slidesView.showLearningPath}
                                onCheckedChange={(v) =>
                                    update('courseDetails', {
                                        ...settings.courseDetails,
                                        slidesView: {
                                            ...settings.courseDetails.slidesView,
                                            showLearningPath: v,
                                        },
                                    })
                                }
                            />
                            <Label className="text-xs">Show Learning Path</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={settings.courseDetails.slidesView.feedbackVisible}
                                onCheckedChange={(v) =>
                                    update('courseDetails', {
                                        ...settings.courseDetails,
                                        slidesView: {
                                            ...settings.courseDetails.slidesView,
                                            feedbackVisible: v,
                                        },
                                    })
                                }
                            />
                            <Label className="text-xs">Feedback Visible</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={
                                    settings.courseDetails.slidesView.chapterCompleteCta ??
                                    settings.courseDetails.slidesView.sidebarNavigation ===
                                        'hidden'
                                }
                                onCheckedChange={(v) =>
                                    update('courseDetails', {
                                        ...settings.courseDetails,
                                        slidesView: {
                                            ...settings.courseDetails.slidesView,
                                            chapterCompleteCta: v,
                                        },
                                    })
                                }
                            />
                            <Label className="text-xs">
                                &quot;Chapter Complete — Next Up&quot; Bar
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={
                                    settings.courseDetails.slidesView.feedbackInSlideNav ??
                                    settings.courseDetails.slidesView.sidebarNavigation !==
                                        'hidden'
                                }
                                onCheckedChange={(v) =>
                                    update('courseDetails', {
                                        ...settings.courseDetails,
                                        slidesView: {
                                            ...settings.courseDetails.slidesView,
                                            feedbackInSlideNav: v,
                                        },
                                    })
                                }
                            />
                            <Label className="text-xs">
                                Include Feedback in Previous/Next
                            </Label>
                        </div>
                        {/* Tri-state in storage (unset = follow the sidebar mode,
                            i.e. shown only in the sidebar-less viewer). The
                            switch renders the value actually in effect, so
                            saving pins whatever the admin can see. */}
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={
                                    settings.courseDetails.slidesView.manualCompletion ??
                                    settings.courseDetails.slidesView.sidebarNavigation ===
                                        'hidden'
                                }
                                onCheckedChange={(v) =>
                                    update('courseDetails', {
                                        ...settings.courseDetails,
                                        slidesView: {
                                            ...settings.courseDetails.slidesView,
                                            manualCompletion: v,
                                        },
                                    })
                                }
                            />
                            <Label className="text-xs">
                                &quot;Mark as Complete&quot; Button in Slide Viewer
                            </Label>
                        </div>
                        {/* Tri-state in storage (unset = follow the sidebar mode),
                            but a switch can only show two. It renders the value
                            that is actually in effect, so saving simply pins
                            whatever the admin can see. */}
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={
                                    settings.courseDetails.slidesView.collapseSidebarOnOpen ??
                                    settings.courseDetails.slidesView.sidebarNavigation ===
                                        'hidden'
                                }
                                onCheckedChange={(v) =>
                                    update('courseDetails', {
                                        ...settings.courseDetails,
                                        slidesView: {
                                            ...settings.courseDetails.slidesView,
                                            collapseSidebarOnOpen: v,
                                        },
                                    })
                                }
                            />
                            <Label className="text-xs">
                                Collapse App Sidebar in Slide Viewer
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={settings.courseDetails.slidesView.canAskDoubt}
                                onCheckedChange={(v) =>
                                    update('courseDetails', {
                                        ...settings.courseDetails,
                                        slidesView: {
                                            ...settings.courseDetails.slidesView,
                                            canAskDoubt: v,
                                        },
                                    })
                                }
                            />
                            <Label className="text-xs">Can Ask Doubt</Label>
                        </div>
                    </div>

                    {/* When the feedback slide is offered. Asking after every
                        chapter suits a short course and fatigues a long one, so
                        the cadence is the institute's call. */}
                    <div className="flex items-center gap-2">
                        <Label className="text-xs">Ask for Feedback After</Label>
                        <Select
                            value={settings.courseDetails.slidesView.feedbackTrigger ?? 'CHAPTER'}
                            onValueChange={(v) =>
                                update('courseDetails', {
                                    ...settings.courseDetails,
                                    slidesView: {
                                        ...settings.courseDetails.slidesView,
                                        feedbackTrigger: v as FeedbackTrigger,
                                    },
                                })
                            }
                        >
                            <SelectTrigger className="h-8 w-56 text-xs">
                                <SelectValue placeholder="Select when" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CHAPTER">Every chapter</SelectItem>
                                <SelectItem value="MODULE">Every module</SelectItem>
                                <SelectItem value="SUBJECT">Every subject</SelectItem>
                                <SelectItem value="COURSE">Course completion only</SelectItem>
                                <SelectItem value="NEVER">Never (button only)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* ── Sidebar content navigation picker ─────────────────
                        Two visual options for how the learner navigates inside
                        the slide viewer. The cards double as a live preview so
                        the admin can see at a glance what each mode looks like
                        without switching accounts to test. */}
                    <SidebarNavigationPicker
                        value={
                            settings.courseDetails.slidesView.sidebarNavigation ??
                            'breadcrumb'
                        }
                        onChange={(v) =>
                            update('courseDetails', {
                                ...settings.courseDetails,
                                slidesView: {
                                    ...settings.courseDetails.slidesView,
                                    sidebarNavigation: v,
                                },
                            })
                        }
                    />
                </div>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>All Courses Page</CardTitle>
                    <CardDescription>Tabs and default selection</CardDescription>
                </CardHeader>
                <div className="space-y-3 p-4 pt-0">
                    {/* Tabs visibility */}
                    <div className="space-y-2">
                        {(() => {
                            const sorted = settings.allCourses.tabs.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
                            return sorted.map((t, idx) => (
                                <div key={t.id} className="flex items-center gap-2 rounded border p-2">
                                    <div className="flex flex-col items-center gap-0.5">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => update('allCourses', { ...settings.allCourses, tabs: swapTabOrder(settings.allCourses.tabs, t.id, 'up') })}>
                                            <ArrowUp className="h-3 w-3" />
                                        </Button>
                                        <span className="text-xs text-muted-foreground">{idx + 1}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === sorted.length - 1} onClick={() => update('allCourses', { ...settings.allCourses, tabs: swapTabOrder(settings.allCourses.tabs, t.id, 'down') })}>
                                            <ArrowDown className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <div className="grow text-xs font-medium">{t.id}</div>
                                    <Label className="text-xs">Visible</Label>
                                    <Switch checked={t.visible} onCheckedChange={(v) => {
                                        const tabs = settings.allCourses.tabs.map((x) => x.id === t.id ? { ...x, visible: v } : x);
                                        update('allCourses', { ...settings.allCourses, tabs });
                                    }} />
                                </div>
                            ));
                        })()}
                    </div>

                    {/* Default tab select */}
                    <div className="flex items-center gap-2">
                        <Label className="text-xs">Default Tab</Label>
                        <Select
                            value={settings.allCourses.defaultTab}
                            onValueChange={(v) =>
                                update('allCourses', {
                                    ...settings.allCourses,
                                    defaultTab: v as StudentAllCoursesTabId,
                                })
                            }
                        >
                            <SelectTrigger className="h-8 w-48 text-xs">
                                <SelectValue placeholder="Select default tab" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="InProgress">InProgress</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                                <SelectItem value="AllCourses">AllCourses</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Hide instructor name on each course card in the list */}
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.allCourses.hideInstructorName ?? false}
                            onCheckedChange={(v) =>
                                update('allCourses', {
                                    ...settings.allCourses,
                                    hideInstructorName: v,
                                })
                            }
                        />
                        <Label className="text-xs">Hide Instructor Name (Course Cards)</Label>
                    </div>
                </div>
            </Card>

            {/* The Certificates card lived here as a second copy of the enable
                flag and completion threshold, editable on a different page from
                the certificate template. The two could disagree, and only this
                copy was honoured by the learner app. Certificate Settings is now
                the single source of truth — enablement, threshold, template and
                numbering, plus per-course overrides. */}

            <Card>
                <CardHeader>
                    <CardTitle>Live Classes</CardTitle>
                    <CardDescription>
                        What learners can see about past live sessions
                    </CardDescription>
                </CardHeader>
                <div className="space-y-2 p-4 pt-0">
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.liveClasses.showPastSessions}
                            onCheckedChange={(v) =>
                                update('liveClasses', {
                                    ...settings.liveClasses,
                                    showPastSessions: v,
                                })
                            }
                        />
                        <Label className="text-xs">Show Past Sessions</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.liveClasses.showRecordings}
                            disabled={!settings.liveClasses.showPastSessions}
                            onCheckedChange={(v) =>
                                update('liveClasses', {
                                    ...settings.liveClasses,
                                    showRecordings: v,
                                })
                            }
                        />
                        <Label className="text-xs">Show Recordings</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.liveClasses.showAttendance}
                            disabled={!settings.liveClasses.showPastSessions}
                            onCheckedChange={(v) =>
                                update('liveClasses', {
                                    ...settings.liveClasses,
                                    showAttendance: v,
                                })
                            }
                        />
                        <Label className="text-xs">Show Attendance</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.liveClasses.showActivityStats}
                            disabled={!settings.liveClasses.showPastSessions}
                            onCheckedChange={(v) =>
                                update('liveClasses', {
                                    ...settings.liveClasses,
                                    showActivityStats: v,
                                })
                            }
                        />
                        <Label className="text-xs">Show Activity Stats</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.liveClasses.showClassMaterials}
                            disabled={!settings.liveClasses.showPastSessions}
                            onCheckedChange={(v) =>
                                update('liveClasses', {
                                    ...settings.liveClasses,
                                    showClassMaterials: v,
                                })
                            }
                        />
                        <Label className="text-xs">Show Class Materials</Label>
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>App Tutorials</CardTitle>
                    <CardDescription>
                        Guided step-by-step tours{' '}
                        {getTerminologyPlural(RoleTerms.Learner, SystemTerms.Learner).toLowerCase()}{' '}
                        can replay from their Help menu
                    </CardDescription>
                </CardHeader>
                <div className="space-y-2 p-4 pt-0">
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.tutorials.enabled}
                            onCheckedChange={(v) =>
                                update('tutorials', {
                                    ...settings.tutorials,
                                    enabled: v,
                                })
                            }
                        />
                        <Label className="text-xs">Enable guided tutorials</Label>
                    </div>
                    {settings.tutorials.enabled && (
                        <div className="space-y-2 border-t pt-3">
                            <div className="text-xs font-medium text-muted-foreground">
                                Available tours
                            </div>
                            {getLearnerTourOptions().map((tour) => (
                                <div key={tour.key} className="flex items-start gap-2">
                                    <Checkbox
                                        id={`tour-${tour.key}`}
                                        checked={settings.tutorials.enabledTours.includes(tour.key)}
                                        onCheckedChange={(checked) => {
                                            const next = new Set(settings.tutorials.enabledTours);
                                            if (checked) next.add(tour.key);
                                            else next.delete(tour.key);
                                            update('tutorials', {
                                                ...settings.tutorials,
                                                // Keep canonical registry order regardless of click order
                                                enabledTours: LEARNER_TOUR_KEYS.filter((k) =>
                                                    next.has(k)
                                                ),
                                            });
                                        }}
                                    />
                                    <div className="grid gap-0.5">
                                        <Label
                                            htmlFor={`tour-${tour.key}`}
                                            className="text-xs font-medium"
                                        >
                                            {tour.label}
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            {tour.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {settings.tutorials.enabled && (
                        <div className="space-y-3 border-t pt-3">
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={settings.tutorials.pdfGuideEnabled}
                                    onCheckedChange={(v) =>
                                        update('tutorials', {
                                            ...settings.tutorials,
                                            pdfGuideEnabled: v,
                                        })
                                    }
                                />
                                <div className="grid gap-0.5">
                                    <Label className="text-xs">How-to guide (PDF)</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Let{' '}
                                        {getTerminologyPlural(
                                            RoleTerms.Learner,
                                            SystemTerms.Learner
                                        ).toLowerCase()}{' '}
                                        download a branded step-by-step PDF from their Help
                                        menu. Chapters follow the tours checked above.
                                    </p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={
                                    downloadingGuide ||
                                    settings.tutorials.enabledTours.length === 0
                                }
                                onClick={async () => {
                                    setDownloadingGuide(true);
                                    try {
                                        await downloadTutorialGuidePdf(
                                            settings.tutorials.enabledTours
                                        );
                                    } catch (error) {
                                        console.error(
                                            'Error downloading tutorial guide PDF:',
                                            error
                                        );
                                        toast.error(
                                            'Could not generate the guide PDF. Please try again.'
                                        );
                                    } finally {
                                        setDownloadingGuide(false);
                                    }
                                }}
                                className="gap-2"
                            >
                                {downloadingGuide ? (
                                    <CircleNotch className="size-4 animate-spin" />
                                ) : (
                                    <FilePdf className="size-4" />
                                )}
                                {downloadingGuide
                                    ? 'Generating...'
                                    : 'Download guide (PDF)'}
                            </Button>
                        </div>
                    )}
                </div>
            </Card>
            </section>

            <section id="grp-notifications" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Notifications</CardTitle>
                    <CardDescription>Student notifications preferences</CardDescription>
                </CardHeader>
                <div className="space-y-2 p-4 pt-0">
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.notifications.allowSystemAlerts}
                            onCheckedChange={(v) =>
                                update('notifications', {
                                    ...settings.notifications,
                                    allowSystemAlerts: v,
                                })
                            }
                        />
                        <Label className="text-xs">Allow System Alerts</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.notifications.allowDashboardPins}
                            onCheckedChange={(v) =>
                                update('notifications', {
                                    ...settings.notifications,
                                    allowDashboardPins: v,
                                })
                            }
                        />
                        <Label className="text-xs">Allow Dashboard Pins</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.notifications.allowBatchStream}
                            onCheckedChange={(v) =>
                                update('notifications', {
                                    ...settings.notifications,
                                    allowBatchStream: v,
                                })
                            }
                        />
                        <Label className="text-xs">Allow Batch Stream</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.notifications.allowAppOverlays}
                            onCheckedChange={(v) =>
                                update('notifications', {
                                    ...settings.notifications,
                                    allowAppOverlays: v,
                                })
                            }
                        />
                        <div>
                            <Label className="text-xs">Allow App Overlays</Label>
                            <p className="text-xs text-muted-foreground">
                                Full-screen announcements on app open
                            </p>
                        </div>
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Post-login Redirect</CardTitle>
                    <CardDescription>Route to redirect student after login</CardDescription>
                </CardHeader>
                <div className="space-y-2 p-4 pt-0">
                    <Input
                        className="h-8 w-80"
                        value={settings.postLoginRedirectRoute}
                        onChange={(e) => update('postLoginRedirectRoute', e.target.value)}
                    />
                </div>
            </Card>
            </section>
            </SettingsSectionsLayout>

            <UnsavedChangesBar
                dirty={hasChanges}
                saving={saving}
                onSave={onSave}
                onDiscard={discardChanges}
            />
        </SettingsPageShell>
    );
}

// ── Enrolled course-details layout picker ───────────────────────────────────
// What a learner sees on their own course page (the /study-library one they
// land on after enrolling). The catalogue and the shopper-facing course page
// are separate screens this never touches, so a buyer still gets the
// description and price they need to decide.
function EnrolledLayoutPicker({
    value,
    onChange,
}: {
    value: EnrolledCourseLayout;
    onChange: (v: EnrolledCourseLayout) => void;
}): JSX.Element {
    return (
        <div className="pb-4 border-b">
            <div className="text-sm font-semibold">Page Layout (After Enrollment)</div>
            <p className="text-xs text-muted-foreground max-w-prose">
                Applies to the learner&apos;s own course page — the one they open
                from their courses after enrolling. The public catalogue always
                shows the full page.
            </p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <NavOptionCard
                    selected={value === 'full'}
                    onSelect={() => onChange('full')}
                    title="Full course page"
                    badge="Default"
                    description={
                        <>
                            Banner, description and tags, course highlights, the
                            enrollment/configuration block and the right-hand
                            overview card (author, duration, counts) — plus every
                            tab you have made visible below.
                        </>
                    }
                    preview={<FullLayoutPreview />}
                />
                <NavOptionCard
                    selected={value === 'contentOnly'}
                    onSelect={() => onChange('contentOnly')}
                    title="Content structure only"
                    badge="Focused"
                    description={
                        <>
                            Just the title and the <strong>Content Structure</strong> card.
                            No description, tags, banner, highlights or right-hand
                            card. Opening the card drills{' '}
                            <strong>Subject → Module → Chapter</strong> as large cards,
                            then the slides open in the viewer. The tab, outline and
                            overview settings below stop applying to enrolled learners.
                        </>
                    }
                    preview={<ContentOnlyLayoutPreview />}
                />
            </div>
        </div>
    );
}

// Mock of today's page: two columns, marketing copy left, stats card right.
function FullLayoutPreview(): JSX.Element {
    return (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 overflow-hidden p-2">
            <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                    <div className="flex gap-1">
                        <span className="h-2 w-6 rounded-full bg-primary-200" />
                        <span className="h-2 w-8 rounded-full bg-primary-200" />
                    </div>
                    <div className="h-2.5 w-4/5 rounded bg-neutral-300" />
                    <div className="h-1.5 w-full rounded bg-neutral-200" />
                    <div className="h-1.5 w-3/4 rounded bg-neutral-200" />
                    <div className="mt-2 h-10 rounded border border-neutral-200 bg-white" />
                </div>
                <div className="space-y-1 rounded border border-neutral-200 bg-white p-1.5">
                    <div className="h-1.5 w-full rounded bg-neutral-200" />
                    <div className="h-1.5 w-2/3 rounded bg-neutral-200" />
                    <div className="h-1.5 w-3/4 rounded bg-neutral-200" />
                    <div className="h-1.5 w-1/2 rounded bg-neutral-200" />
                </div>
            </div>
        </div>
    );
}

// Mock of the focused page: title + a single card of large content tiles.
function ContentOnlyLayoutPreview(): JSX.Element {
    return (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 overflow-hidden p-2">
            <div className="h-2.5 w-1/2 rounded bg-neutral-300" />
            <div className="mt-2 rounded border border-neutral-200 bg-white p-1.5">
                <div className="mb-1.5 h-1.5 w-1/3 rounded bg-neutral-300" />
                <div className="grid grid-cols-3 gap-1.5">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="space-y-1 rounded border border-neutral-200 p-1"
                        >
                            <div className="h-6 rounded bg-neutral-100" />
                            <div className="h-1.5 w-4/5 rounded bg-neutral-200" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Sidebar content navigation picker ───────────────────────────────────────
// Two mutually-exclusive modes for the slide viewer sidebar. Rendered as a
// pair of radio-style cards, each containing a tiny live mock of how the
// learner's sidebar will look. The mocks are pure markup (no data fetches)
// so the admin sees the outcome before saving.
function SidebarNavigationPicker({
    value,
    onChange,
}: {
    value: SlidesSidebarNavigation;
    onChange: (v: SlidesSidebarNavigation) => void;
}): JSX.Element {
    return (
        <div className="mt-4 border-t pt-4">
            <div className="mb-1 flex items-baseline justify-between gap-2">
                <div>
                    <div className="text-sm font-semibold">Sidebar Navigation</div>
                    <p className="max-w-prose text-xs text-muted-foreground">
                        Controls how the learner moves across subjects, modules and chapters from
                        the slide viewer. Each option changes what the left sidebar shows — pick
                        whichever fits your learners&apos; mental model.
                    </p>
                </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <NavOptionCard
                    selected={value === 'breadcrumb'}
                    onSelect={() => onChange('breadcrumb')}
                    title="Breadcrumb dropdowns"
                    badge="Compact"
                    description={
                        <>
                            Sidebar lists <strong>only the current chapter&apos;s slides</strong>.
                            To jump to another module or subject, the learner taps the breadcrumb at
                            the top and picks from a dropdown. Best when courses are small or you
                            want learners focused on the current chapter.
                        </>
                    }
                    preview={<BreadcrumbModePreview />}
                />
                <NavOptionCard
                    selected={value === 'ancestors'}
                    onSelect={() => onChange('ancestors')}
                    title="Full course tree"
                    badge="Richer"
                    description={
                        <>
                            Sidebar shows the{' '}
                            <strong>entire Subject → Module → Chapter → Slide tree</strong>.
                            Learners can scan, expand and jump to any slide without leaving the
                            viewer. The breadcrumb becomes a passive label. Best for longer courses
                            where side-by-side discovery matters.
                        </>
                    }
                    preview={<TreeModePreview />}
                />
                <NavOptionCard
                    selected={value === 'lessons'}
                    onSelect={() => onChange('lessons')}
                    title="Lesson list"
                    badge="Media-rich"
                    description={
                        <>
                            The whole course as a <strong>flat list of lessons</strong>, each with a
                            thumbnail, a full two-line title and its length. Chapters become
                            headings rather than toggles, so nothing has to be expanded, and a
                            course-wide progress bar sits at the top. Best for courses learners work
                            through in order.
                        </>
                    }
                    preview={<LessonListModePreview />}
                />
                <NavOptionCard
                    selected={value === 'hidden'}
                    onSelect={() => onChange('hidden')}
                    title="No sidebar"
                    badge="Focused"
                    description={
                        <>
                            The viewer shows <strong>only the slide</strong>. Learners move with the{' '}
                            <strong>Previous / Next</strong> buttons above the content, which roll
                            over into the next or previous chapter at the edges. Best when you want
                            a single, guided path with nothing to browse past.
                        </>
                    }
                    preview={<NoSidebarModePreview />}
                />
            </div>
        </div>
    );
}
function NavOptionCard({
    selected,
    onSelect,
    title,
    badge,
    description,
    preview,
}: {
    selected: boolean;
    onSelect: () => void;
    title: string;
    badge?: string;
    description: React.ReactNode;
    preview: React.ReactNode;
}): JSX.Element {
    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={`relative text-left rounded-lg border-2 p-3 transition-all focus:outline-none focus:ring-2 focus:ring-primary-300 ${
                selected
                    ? 'border-primary-400 bg-primary-50/50 shadow-sm'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
            }`}
        >
            {selected && (
                <span className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-white shadow-sm">
                    <Check className="h-3 w-3" />
                </span>
            )}
            <div className="flex items-center gap-2">
                <div className="text-sm font-semibold">{title}</div>
                {badge && (
                    <span className="text-2xs font-medium uppercase tracking-wider text-primary-600 bg-primary-100 rounded-full px-1.5 py-0.5">
                        {badge}
                    </span>
                )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {description}
            </p>
            <div className="mt-3">{preview}</div>
        </button>
    );
}

// Mock of the legacy view: breadcrumb with a dropdown arrow + a flat slide list.
function BreadcrumbModePreview(): JSX.Element {
    return (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-neutral-200 text-2xs text-neutral-600 bg-white">
                <span className="flex items-center gap-0.5 rounded px-1 py-0.5 bg-neutral-100">
                    S1 <CaretDown className="h-2.5 w-2.5" />
                </span>
                <CaretRight className="h-2.5 w-2.5 text-neutral-400" />
                <span className="flex items-center gap-0.5 rounded px-1 py-0.5 bg-neutral-100">
                    M1 <CaretDown className="h-2.5 w-2.5" />
                </span>
                <CaretRight className="h-2.5 w-2.5 text-neutral-400" />
                <span className="font-semibold text-neutral-800">C1</span>
            </div>
            <div className="p-2 space-y-1">
                <MockSlideRow label="Intro video" active />
                <MockSlideRow label="Reading note" />
                <MockSlideRow label="Practice quiz" />
            </div>
        </div>
    );
}

// Mock of the sidebar-less view: just the slide, with Prev/Next above it.
function NoSidebarModePreview(): JSX.Element {
    return (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-neutral-200 bg-white">
                <span className="truncate text-2xs font-semibold text-neutral-800">
                    Integer line
                </span>
                <span className="ms-auto flex items-center gap-1">
                    <span className="flex items-center gap-0.5 rounded border border-neutral-200 px-1 py-0.5 text-2xs text-neutral-600">
                        <CaretLeft className="h-2 w-2" /> Prev
                    </span>
                    <span className="text-2xs text-neutral-400">2 / 6</span>
                    <span className="flex items-center gap-0.5 rounded border border-neutral-200 px-1 py-0.5 text-2xs text-neutral-600">
                        Next <CaretRight className="h-2 w-2" />
                    </span>
                </span>
            </div>
            <div className="space-y-1 p-2">
                <div className="h-8 rounded bg-neutral-200/70" />
                <div className="h-1.5 w-4/5 rounded bg-neutral-200" />
                <div className="h-1.5 w-3/5 rounded bg-neutral-200" />
            </div>
        </div>
    );
}

// Mock of the tree view: nested subjects/modules/chapters/slides with chevrons.
function TreeModePreview(): JSX.Element {
    return (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 overflow-hidden">
            <div className="px-2 py-1.5 border-b border-neutral-200 text-2xs text-neutral-500 bg-white font-medium tracking-wide uppercase">
                Course content
            </div>
            <div className="py-1">
                <MockTreeRow indent={0} chevron="down" label="S1 · Algebra" bold />
                <MockTreeRow indent={1} chevron="down" label="M1 · Numbers" />
                <MockTreeRow indent={2} chevron="right" label="C1 · Basics" />
                <MockTreeRow indent={2} chevron="down" label="C2 · Integers" activeAncestor />
                <MockSlideRow label="Integer line" depth={3} />
                <MockSlideRow label="Practice set" depth={3} active />
                <MockTreeRow indent={1} chevron="right" label="M2 · Fractions" muted />
                <MockTreeRow indent={0} chevron="right" label="S2 · Geometry" muted />
            </div>
        </div>
    );
}

// Mock of the lesson list: a progress line, chapter headings and thumbnail rows.
function LessonListModePreview(): JSX.Element {
    return (
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
            <div className="border-b border-neutral-200 bg-white px-2 py-1.5">
                <div className="text-2xs font-medium text-neutral-600">3 / 24 completed</div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-200">
                    <div className="h-full w-1/6 rounded-full bg-primary-400" />
                </div>
            </div>
            <div className="py-1">
                <div className="px-2 pb-0.5 pt-1.5 text-2xs font-semibold text-neutral-800">
                    C1 · Basics
                </div>
                <MockLessonRow label="Welcome to the course" meta="9m" tone="bg-blue-100" done />
                <MockLessonRow label="How numbers behave" meta="4m" tone="bg-amber-100" />
                <div className="px-2 pb-0.5 pt-2 text-2xs font-semibold text-neutral-800">
                    C2 · Integers
                </div>
                <MockLessonRow label="The integer line" meta="12m" tone="bg-blue-100" active />
                <MockLessonRow label="Practice set" meta="6 questions" tone="bg-teal-100" />
            </div>
        </div>
    );
}

function MockLessonRow({
    label,
    meta,
    tone,
    active,
    done,
}: {
    label: string;
    meta: string;
    tone: string;
    active?: boolean;
    done?: boolean;
}): JSX.Element {
    return (
        <div
            className={`flex items-center gap-1.5 border-s-2 px-2 py-1 ${
                active ? 'border-primary-500 bg-primary-50' : 'border-transparent'
            }`}
        >
            <span className={`h-4 w-6 shrink-0 rounded-sm ${done ? 'bg-success-200' : tone}`} />
            <span className="min-w-0 flex-1">
                <span
                    className={`block truncate text-2xs ${
                        active
                            ? 'font-semibold text-primary-700'
                            : done
                              ? 'text-neutral-400'
                              : 'text-neutral-700'
                    }`}
                >
                    {label}
                </span>
                <span className="block text-2xs text-neutral-400">{meta}</span>
            </span>
        </div>
    );
}
function MockSlideRow({
    label,
    active,
    depth = 0,
}: {
    label: string;
    active?: boolean;
    depth?: number;
}): JSX.Element {
    return (
        <div
            style={{ paddingLeft: `${depth * 10 + 8}px` }}
            className={`flex items-center gap-1.5 px-2 py-1 text-2xs rounded ${
                active
                    ? 'bg-primary-100 text-primary-700 font-semibold'
                    : 'text-neutral-600'
            }`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${
                    active ? 'bg-primary-500' : 'bg-neutral-300'
                }`}
            />
            <span className="truncate">{label}</span>
        </div>
    );
}

function MockTreeRow({
    indent,
    chevron,
    label,
    bold,
    muted,
    activeAncestor,
}: {
    indent: number;
    chevron: 'down' | 'right';
    label: string;
    bold?: boolean;
    muted?: boolean;
    activeAncestor?: boolean;
}): JSX.Element {
    const Icon = chevron === 'down' ? CaretDown : CaretRight;
    return (
        <div
            style={{ paddingLeft: `${indent * 10 + 4}px` }}
            className={`flex items-center gap-1 px-2 py-1 text-2xs ${
                muted
                    ? 'text-neutral-400'
                    : activeAncestor
                    ? 'text-primary-700 bg-primary-50/60 font-semibold'
                    : bold
                    ? 'text-neutral-800 font-semibold'
                    : 'text-neutral-700'
            }`}
        >
            <Icon className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">{label}</span>
        </div>
    );
}
