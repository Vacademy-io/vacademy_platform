import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type {
    StudentDisplaySettingsData,
    StudentCourseDetailsTabId,
    StudentAllCoursesTabId,
    OutlineMode,
    StudentDefaultProvider,
    UsernameStrategy,
    PasswordStrategy,
    PasswordDelivery,
    StudentUiType,
} from '@/types/student-display-settings';
import {
    getStudentDisplaySettings,
    saveStudentDisplaySettings,
} from '@/services/student-display-settings';

export default function StudentDisplaySettings(): JSX.Element {
    const [settings, setSettings] = useState<StudentDisplaySettingsData | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getStudentDisplaySettings()
            .then(setSettings)
            .catch(() => setSettings(null));
    }, []);

    const update = <K extends keyof StudentDisplaySettingsData>(
        key: K,
        value: StudentDisplaySettingsData[K]
    ) => {
        setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    };

    const onSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await saveStudentDisplaySettings(settings);
        } finally {
            setSaving(false);
        }
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

    if (!settings) return <div className="p-4 text-sm">Loading...</div>;

    return (
        <div className="space-y-4 p-2">
            {/* Save at top */}
            <div className="flex justify-end">
                <Button disabled={saving} onClick={onSave}>
                    {saving ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>
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
                        {settings.sidebar.tabs
                            .slice()
                            .sort((a, b) => (a.order || 0) - (b.order || 0))
                            .map((t) => (
                                <div key={t.id} className="space-y-2 rounded border p-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="grow text-xs font-medium">{t.id}</div>
                                        <Label className="text-xs">Label</Label>
                                        <Input
                                            className="h-8 w-40"
                                            value={t.label || ''}
                                            onChange={(e) =>
                                                updateTabField(t.id, 'label', e.target.value)
                                            }
                                        />
                                        <Label className="text-xs">Route</Label>
                                        <Input
                                            className="h-8 w-56"
                                            value={t.route || ''}
                                            onChange={(e) =>
                                                updateTabField(t.id, 'route', e.target.value)
                                            }
                                        />
                                        <Label className="text-xs">Order</Label>
                                        <Input
                                            className="h-8 w-16"
                                            type="number"
                                            value={t.order}
                                            onChange={(e) =>
                                                updateTabField(
                                                    t.id,
                                                    'order',
                                                    Number(e.target.value) || 0
                                                )
                                            }
                                        />
                                        <Label className="text-xs">Visible</Label>
                                        <Switch
                                            checked={t.visible}
                                            onCheckedChange={(v) =>
                                                updateTabField(t.id, 'visible', v)
                                            }
                                        />
                                        {t.isCustom && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => removeTab(t.id)}
                                            >
                                                Remove Tab
                                            </Button>
                                        )}
                                    </div>
                                    <div className="ml-2 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-[11px] font-medium text-neutral-600">
                                                Sub Tabs
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => addSubTab(t.id)}
                                            >
                                                Add Sub Tab
                                            </Button>
                                        </div>
                                        {(t.subTabs || [])
                                            .slice()
                                            .sort((a, b) => (a.order || 0) - (b.order || 0))
                                            .map((s) => (
                                                <div
                                                    key={s.id}
                                                    className="flex flex-wrap items-center gap-2 rounded border p-2"
                                                >
                                                    <div className="grow text-[11px] font-medium">
                                                        {s.id}
                                                    </div>
                                                    <Label className="text-xs">Label</Label>
                                                    <Input
                                                        className="h-8 w-36"
                                                        value={s.label || ''}
                                                        onChange={(e) => {
                                                            const tabs = settings.sidebar.tabs.map(
                                                                (tab) => {
                                                                    if (tab.id !== t.id) return tab;
                                                                    const subTabs = (
                                                                        tab.subTabs || []
                                                                    ).map((sub) =>
                                                                        sub.id === s.id
                                                                            ? {
                                                                                  ...sub,
                                                                                  label: e.target
                                                                                      .value,
                                                                              }
                                                                            : sub
                                                                    );
                                                                    return { ...tab, subTabs };
                                                                }
                                                            );
                                                            update('sidebar', {
                                                                ...settings.sidebar,
                                                                tabs,
                                                            });
                                                        }}
                                                    />
                                                    <Label className="text-xs">Route</Label>
                                                    <Input
                                                        className="h-8 w-56"
                                                        value={s.route}
                                                        onChange={(e) => {
                                                            const tabs = settings.sidebar.tabs.map(
                                                                (tab) => {
                                                                    if (tab.id !== t.id) return tab;
                                                                    const subTabs = (
                                                                        tab.subTabs || []
                                                                    ).map((sub) =>
                                                                        sub.id === s.id
                                                                            ? {
                                                                                  ...sub,
                                                                                  route: e.target
                                                                                      .value,
                                                                              }
                                                                            : sub
                                                                    );
                                                                    return { ...tab, subTabs };
                                                                }
                                                            );
                                                            update('sidebar', {
                                                                ...settings.sidebar,
                                                                tabs,
                                                            });
                                                        }}
                                                    />
                                                    <Label className="text-xs">Order</Label>
                                                    <Input
                                                        className="h-8 w-16"
                                                        type="number"
                                                        value={s.order}
                                                        onChange={(e) => {
                                                            const order =
                                                                Number(e.target.value) || 0;
                                                            const tabs = settings.sidebar.tabs.map(
                                                                (tab) => {
                                                                    if (tab.id !== t.id) return tab;
                                                                    const subTabs = (
                                                                        tab.subTabs || []
                                                                    ).map((sub) =>
                                                                        sub.id === s.id
                                                                            ? { ...sub, order }
                                                                            : sub
                                                                    );
                                                                    return { ...tab, subTabs };
                                                                }
                                                            );
                                                            update('sidebar', {
                                                                ...settings.sidebar,
                                                                tabs,
                                                            });
                                                        }}
                                                    />
                                                    <Label className="text-xs">Visible</Label>
                                                    <Switch
                                                        checked={s.visible}
                                                        onCheckedChange={(v) => {
                                                            const tabs = settings.sidebar.tabs.map(
                                                                (tab) => {
                                                                    if (tab.id !== t.id) return tab;
                                                                    const subTabs = (
                                                                        tab.subTabs || []
                                                                    ).map((sub) =>
                                                                        sub.id === s.id
                                                                            ? { ...sub, visible: v }
                                                                            : sub
                                                                    );
                                                                    return { ...tab, subTabs };
                                                                }
                                                            );
                                                            update('sidebar', {
                                                                ...settings.sidebar,
                                                                tabs,
                                                            });
                                                        }}
                                                    />
                                                    {s.id.startsWith('custom-sub-') && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => removeSubTab(t.id, s.id)}
                                                        >
                                                            Remove
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            ))}
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
                    {settings.dashboard.widgets
                        .slice()
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map((w, idx) => (
                            <div
                                key={`${w.id}-${w.title ?? ''}`}
                                className="flex flex-wrap items-center gap-2 rounded border p-2"
                            >
                                <div className="grow text-xs font-medium">
                                    {w.id}
                                    {w.isCustom && w.title ? `: ${w.title}` : ''}
                                </div>
                                {w.id === 'custom' && (
                                    <>
                                        <Label className="text-xs">Title</Label>
                                        <Input
                                            className="h-8 w-40"
                                            value={w.title || ''}
                                            onChange={(e) => {
                                                const widgets = settings.dashboard.widgets.map(
                                                    (x, i) =>
                                                        i === idx
                                                            ? { ...x, title: e.target.value }
                                                            : x
                                                );
                                                update('dashboard', { widgets });
                                            }}
                                        />
                                        <Label className="text-xs">Sub Title</Label>
                                        <Input
                                            className="h-8 w-48"
                                            value={w.subTitle || ''}
                                            onChange={(e) => {
                                                const widgets = settings.dashboard.widgets.map(
                                                    (x, i) =>
                                                        i === idx
                                                            ? { ...x, subTitle: e.target.value }
                                                            : x
                                                );
                                                update('dashboard', { widgets });
                                            }}
                                        />
                                        <Label className="text-xs">Link</Label>
                                        <Input
                                            className="h-8 w-56"
                                            placeholder="/route or https://..."
                                            value={w.link || ''}
                                            onChange={(e) => {
                                                const widgets = settings.dashboard.widgets.map(
                                                    (x, i) =>
                                                        i === idx
                                                            ? { ...x, link: e.target.value }
                                                            : x
                                                );
                                                update('dashboard', { widgets });
                                            }}
                                        />
                                    </>
                                )}
                                <Label className="text-xs">Order</Label>
                                <Input
                                    className="h-8 w-16"
                                    type="number"
                                    value={w.order}
                                    onChange={(e) => {
                                        const order = Number(e.target.value) || 0;
                                        const widgets = settings.dashboard.widgets.map((x, i) =>
                                            i === idx ? { ...x, order } : x
                                        );
                                        update('dashboard', { widgets });
                                    }}
                                />
                                <Label className="text-xs">Visible</Label>
                                <Switch
                                    checked={w.visible}
                                    onCheckedChange={(v) => {
                                        const widgets = settings.dashboard.widgets.map((x, i) =>
                                            i === idx ? { ...x, visible: v } : x
                                        );
                                        update('dashboard', { widgets });
                                    }}
                                />
                                {(w.id === 'custom' || w.isCustom) && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => removeWidgetAt(idx)}
                                    >
                                        Remove
                                    </Button>
                                )}
                            </div>
                        ))}
                </div>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Login & Signup</CardTitle>
                    <CardDescription>Providers and defaults for student signup</CardDescription>
                </CardHeader>
                <div className="space-y-2 p-4 pt-0">
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
                </div>
            </Card>

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
                    <CardTitle>Course Details</CardTitle>
                    <CardDescription>Tabs, default tab and view preferences</CardDescription>
                </CardHeader>
                <div className="space-y-3 p-4 pt-0">
                    {/* Tabs visibility */}
                    <div className="space-y-2">
                        {settings.courseDetails.tabs
                            .slice()
                            .sort((a, b) => (a.order || 0) - (b.order || 0))
                            .map((t) => (
                                <div
                                    key={t.id}
                                    className="flex flex-wrap items-center gap-2 rounded border p-2"
                                >
                                    <div className="grow text-xs font-medium">{t.id}</div>
                                    <Label className="text-xs">Order</Label>
                                    <Input
                                        className="h-8 w-16"
                                        type="number"
                                        value={t.order}
                                        onChange={(e) => {
                                            const order = Number(e.target.value) || 0;
                                            const tabs = settings.courseDetails.tabs.map((x) =>
                                                x.id === t.id ? { ...x, order } : x
                                            );
                                            update('courseDetails', {
                                                ...settings.courseDetails,
                                                tabs,
                                            });
                                        }}
                                    />
                                    <Label className="text-xs">Visible</Label>
                                    <Switch
                                        checked={t.visible}
                                        onCheckedChange={(v) => {
                                            const tabs = settings.courseDetails.tabs.map((x) =>
                                                x.id === t.id ? { ...x, visible: v } : x
                                            );
                                            update('courseDetails', {
                                                ...settings.courseDetails,
                                                tabs,
                                            });
                                        }}
                                    />
                                </div>
                            ))}
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
                        {settings.allCourses.tabs
                            .slice()
                            .sort((a, b) => (a.order || 0) - (b.order || 0))
                            .map((t) => (
                                <div
                                    key={t.id}
                                    className="flex flex-wrap items-center gap-2 rounded border p-2"
                                >
                                    <div className="grow text-xs font-medium">{t.id}</div>
                                    <Label className="text-xs">Order</Label>
                                    <Input
                                        className="h-8 w-16"
                                        type="number"
                                        value={t.order}
                                        onChange={(e) => {
                                            const order = Number(e.target.value) || 0;
                                            const tabs = settings.allCourses.tabs.map((x) =>
                                                x.id === t.id ? { ...x, order } : x
                                            );
                                            update('allCourses', { ...settings.allCourses, tabs });
                                        }}
                                    />
                                    <Label className="text-xs">Visible</Label>
                                    <Switch
                                        checked={t.visible}
                                        onCheckedChange={(v) => {
                                            const tabs = settings.allCourses.tabs.map((x) =>
                                                x.id === t.id ? { ...x, visible: v } : x
                                            );
                                            update('allCourses', { ...settings.allCourses, tabs });
                                        }}
                                    />
                                </div>
                            ))}
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
                </div>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Certificates</CardTitle>
                    <CardDescription>Control when certificates can be generated</CardDescription>
                </CardHeader>
                <div className="space-y-2 p-4 pt-0">
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.certificates.enabled}
                            onCheckedChange={(v) =>
                                update('certificates', {
                                    ...settings.certificates,
                                    enabled: v,
                                })
                            }
                        />
                        <Label className="text-xs">Certificates Enabled</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label className="text-xs">Generation Threshold (%)</Label>
                        <Input
                            className="h-8 w-24"
                            type="number"
                            min={0}
                            max={100}
                            value={settings.certificates.generationThresholdPercent}
                            onChange={(e) => {
                                const value = Math.max(
                                    0,
                                    Math.min(100, Number(e.target.value) || 0)
                                );
                                update('certificates', {
                                    ...settings.certificates,
                                    generationThresholdPercent: value,
                                });
                            }}
                        />
                    </div>
                </div>
            </Card>

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

            <div className="flex justify-end">
                <Button disabled={saving} onClick={onSave}>
                    {saving ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>
        </div>
    );
}
