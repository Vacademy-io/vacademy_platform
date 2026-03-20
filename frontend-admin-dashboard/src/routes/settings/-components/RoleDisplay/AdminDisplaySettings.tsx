import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SidebarItemsData } from '@/components/common/layout-container/sidebar/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MyButton } from '@/components/design-system/button';
import {
    ADMIN_DISPLAY_SETTINGS_KEY,
    type DisplaySettingsData,
    type SidebarTabConfig,
    type CourseListTabId,
    type CourseDetailsTabId,
    type CourseContentTypeSettings,
    type CourseCreationSettings,
    type StudentSideViewSettings,
    type LearnerManagementSettings,
} from '@/types/display-settings';
import { getDisplaySettingsWithFallback, saveDisplaySettings } from '@/services/display-settings';
import { DEFAULT_ADMIN_DISPLAY_SETTINGS } from '@/constants/display-settings/admin-defaults';
import { toast } from 'sonner';

const COURSE_CREATION_DEFAULTS: CourseCreationSettings = {
    showCreateCourseWithAI: false,
    requirePackageSelectionForNewChapter: true,
    showAdvancedSettings: true,
    limitToSingleLevel: false,
};

const STUDENT_SIDE_VIEW_DEFAULTS: StudentSideViewSettings = {
    overviewTab: true,
    testTab: true,
    progressTab: true,
    coursesTab: true,
    notificationTab: false,
    membershipTab: false,
    paymentHistoryTab: true,
    userTaggingTab: false,
    fileTab: false,
    portalAccessTab: false,
    reportsTab: false,
    enrollDerollTab: false,
    enquiryTab: false,
    applicationTab: false,
};

const STUDENT_SIDE_VIEW_OPTIONS: Array<{
    key: keyof StudentSideViewSettings;
    label: string;
    defaultValue: boolean;
}> = [
    {
        key: 'overviewTab',
        label: 'Overview Tab',
        defaultValue: STUDENT_SIDE_VIEW_DEFAULTS.overviewTab,
    },
    { key: 'testTab', label: 'Test Tab', defaultValue: STUDENT_SIDE_VIEW_DEFAULTS.testTab },
    {
        key: 'progressTab',
        label: 'Progress Tab',
        defaultValue: STUDENT_SIDE_VIEW_DEFAULTS.progressTab,
    },
    {
        key: 'notificationTab',
        label: 'Notification Tab',
        defaultValue: STUDENT_SIDE_VIEW_DEFAULTS.notificationTab,
    },
    {
        key: 'membershipTab',
        label: 'Membership Tab',
        defaultValue: STUDENT_SIDE_VIEW_DEFAULTS.membershipTab,
    },
    {
        key: 'paymentHistoryTab',
        label: 'Payment History Tab',
        defaultValue: STUDENT_SIDE_VIEW_DEFAULTS.paymentHistoryTab,
    },
    {
        key: 'userTaggingTab',
        label: 'User Tagging Tab',
        defaultValue: STUDENT_SIDE_VIEW_DEFAULTS.userTaggingTab,
    },
    { key: 'fileTab', label: 'File Tab', defaultValue: STUDENT_SIDE_VIEW_DEFAULTS.fileTab },
    {
        key: 'portalAccessTab',
        label: 'Portal Access Tab',
        defaultValue: STUDENT_SIDE_VIEW_DEFAULTS.portalAccessTab,
    },
    {
        key: 'reportsTab',
        label: 'Reports Tab',
        defaultValue: STUDENT_SIDE_VIEW_DEFAULTS.reportsTab,
    },
    {
        key: 'enrollDerollTab',
        label: 'Enroll/Deroll Tab',
        defaultValue: STUDENT_SIDE_VIEW_DEFAULTS.enrollDerollTab,
    },
    {
        key: 'enquiryTab',
        label: 'Enquiry Tab',
        defaultValue: STUDENT_SIDE_VIEW_DEFAULTS.enquiryTab,
    },
    {
        key: 'applicationTab',
        label: 'Application Tab',
        defaultValue: STUDENT_SIDE_VIEW_DEFAULTS.applicationTab,
    },
];

const LEARNER_MANAGEMENT_DEFAULTS: LearnerManagementSettings = {
    allowPortalAccess: true,
    allowViewPassword: true,
    allowSendResetPasswordMail: true,
};

const LEARNER_MANAGEMENT_OPTIONS: Array<{
    key: keyof LearnerManagementSettings;
    label: string;
    defaultValue: boolean;
}> = [
    {
        key: 'allowPortalAccess',
        label: 'Allow Learner Portal Access',
        defaultValue: LEARNER_MANAGEMENT_DEFAULTS.allowPortalAccess,
    },
    {
        key: 'allowViewPassword',
        label: 'Allow Viewing Learner Password',
        defaultValue: LEARNER_MANAGEMENT_DEFAULTS.allowViewPassword,
    },
    {
        key: 'allowSendResetPasswordMail',
        label: 'Allow Sending Reset Password Mail',
        defaultValue: LEARNER_MANAGEMENT_DEFAULTS.allowSendResetPasswordMail,
    },
];

export default function AdminDisplaySettings() {
    const [settings, setSettings] = useState<DisplaySettingsData | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [activeCategory, setActiveCategory] = useState<'CRM' | 'LMS' | 'AI'>('CRM');

    useEffect(() => {
        const run = async () => {
            const s = await getDisplaySettingsWithFallback(ADMIN_DISPLAY_SETTINGS_KEY);
            setSettings(s);
        };
        run();
    }, []);

    const updateSettings = (updater: (prev: DisplaySettingsData) => DisplaySettingsData) => {
        setSettings((prev) => {
            if (!prev) return prev;
            const next = updater(prev);
            setHasChanges(true);
            return next;
        });
    };

    const addCustomTab = () => {
        if (!settings) return;
        const maxOrder = Math.max(0, ...settings.sidebar.map((t) => t.order));
        const newTab: SidebarTabConfig = {
            id: `custom-${Date.now()}`,
            label: 'Custom Tab',
            route: '/',
            order: maxOrder + 1,
            visible: true,
            subTabs: [],
            isCustom: true,
        };
        updateSettings((prev) => ({ ...prev, sidebar: [...prev.sidebar, newTab] }));
    };

    const addSubTab = (parentId: string) => {
        if (!settings) return;
        updateSettings((prev) => ({
            ...prev,
            sidebar: prev.sidebar.map((t) => {
                if (t.id !== parentId) return t;
                const nextOrder = ((t.subTabs?.length || 0) + 1) as number;
                const sub = {
                    id: `custom-sub-${Date.now()}`,
                    label: 'Custom Sub Tab',
                    route: '/',
                    order: nextOrder,
                    visible: true,
                };
                return { ...t, subTabs: [...(t.subTabs || []), sub] };
            }),
        }));
    };

    const removeCustomTab = (tabId: string) => {
        if (!settings) return;
        const t = settings.sidebar.find((x) => x.id === tabId);
        if (!t?.isCustom) return;
        updateSettings((prev) => ({
            ...prev,
            sidebar: prev.sidebar.filter((x) => x.id !== tabId),
        }));
    };

    const removeCustomSubTab = (parentId: string, subId: string) => {
        if (!settings) return;
        updateSettings((prev) => ({
            ...prev,
            sidebar: prev.sidebar.map((t) => {
                if (t.id !== parentId) return t;
                const filtered = (t.subTabs || []).filter(
                    (s) => s.id !== subId || !s.id.startsWith('custom-sub-')
                );
                return { ...t, subTabs: filtered };
            }),
        }));
    };

    const save = async () => {
        if (!settings) return;
        setIsSaving(true);
        try {
            // Admin constraint: Settings tab cannot be hidden
            const fixed = {
                ...settings,
                sidebar: settings.sidebar.map((t) =>
                    t.id === 'settings' ? { ...t, visible: true } : t
                ),
            };
            await saveDisplaySettings(ADMIN_DISPLAY_SETTINGS_KEY, fixed);
            setHasChanges(false);
            toast.success('Admin display settings saved');
        } catch (e) {
            toast.error('Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    if (!settings) return <div className="p-2">Loading...</div>;

    return (
        <div className="space-y-6 p-2">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold">Admin Display Settings</h1>
                    <p className="text-sm text-muted-foreground">
                        Control visibility, ordering, and widgets for Admins.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            setSettings(DEFAULT_ADMIN_DISPLAY_SETTINGS);
                            setHasChanges(true);
                        }}
                    >
                        Reset to Defaults
                    </Button>
                    <MyButton
                        onClick={save}
                        disabled={isSaving || !hasChanges}
                        className="bg-primary-500"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </MyButton>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Course Page Settings</CardTitle>
                    <CardDescription>Control visibility of course page elements.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {(
                        [
                            ['viewInviteLinks', 'View invite links'],
                            ['viewShortInviteLinks', 'View short invite links'],
                            ['viewCourseConfiguration', 'View course configuration'],
                            ['viewCourseOverviewItem', 'View course overview item'],
                            ['viewContentNumbering', 'View content numbering'],
                        ] as const
                    ).map(([key, label]) => (
                        <div
                            key={key}
                            className="flex items-center justify-between rounded border p-3"
                        >
                            <div className="text-sm">{label}</div>
                            <Switch
                                checked={settings.coursePage?.[key] !== false}
                                onCheckedChange={(checked) =>
                                    updateSettings((prev) => ({
                                        ...prev,
                                        coursePage: {
                                            viewInviteLinks:
                                                prev.coursePage?.viewInviteLinks ?? true,
                                            viewShortInviteLinks:
                                                prev.coursePage?.viewShortInviteLinks ?? false,
                                            viewCourseConfiguration:
                                                prev.coursePage?.viewCourseConfiguration ?? true,
                                            viewCourseOverviewItem:
                                                prev.coursePage?.viewCourseOverviewItem ?? true,
                                            viewContentNumbering:
                                                prev.coursePage?.viewContentNumbering ?? true,
                                            [key]: checked,
                                        },
                                    }))
                                }
                            />
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Slide View Settings</CardTitle>
                    <CardDescription>Control action visibility in Slide view.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {(
                        [
                            ['showCopyTo', 'Show "Copy to" option'],
                            ['showMoveTo', 'Show "Move to" option'],
                        ] as const
                    ).map(([key, label]) => (
                        <div
                            key={key}
                            className="flex items-center justify-between rounded border p-3"
                        >
                            <div className="text-sm">{label}</div>
                            <Switch
                                checked={settings.slideView?.[key] !== false}
                                onCheckedChange={(checked) =>
                                    updateSettings((prev) => ({
                                        ...prev,
                                        slideView: {
                                            showCopyTo: prev.slideView?.showCopyTo ?? true,
                                            showMoveTo: prev.slideView?.showMoveTo ?? true,
                                            [key]: checked,
                                        },
                                    }))
                                }
                            />
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Course Creation</CardTitle>
                    <CardDescription>
                        Configure AI course creation entry points and chapter setup defaults.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex items-center justify-between rounded border p-3">
                        <div className="text-sm">Show &quot;Create Course with AI&quot;</div>
                        <Switch
                            checked={
                                settings.courseCreation?.showCreateCourseWithAI ??
                                COURSE_CREATION_DEFAULTS.showCreateCourseWithAI
                            }
                            onCheckedChange={(checked) =>
                                updateSettings((prev) => ({
                                    ...prev,
                                    courseCreation: {
                                        showCreateCourseWithAI: checked,
                                        requirePackageSelectionForNewChapter:
                                            prev.courseCreation
                                                ?.requirePackageSelectionForNewChapter ??
                                            COURSE_CREATION_DEFAULTS.requirePackageSelectionForNewChapter,
                                        showAdvancedSettings:
                                            prev.courseCreation?.showAdvancedSettings ??
                                            COURSE_CREATION_DEFAULTS.showAdvancedSettings,
                                        limitToSingleLevel:
                                            prev.courseCreation?.limitToSingleLevel ??
                                            COURSE_CREATION_DEFAULTS.limitToSingleLevel,
                                    },
                                }))
                            }
                        />
                    </div>
                    <div className="flex items-center justify-between rounded border p-3">
                        <div className="text-sm">
                            Require package session selection when adding a new chapter
                        </div>
                        <Switch
                            checked={
                                settings.courseCreation?.requirePackageSelectionForNewChapter ??
                                COURSE_CREATION_DEFAULTS.requirePackageSelectionForNewChapter
                            }
                            onCheckedChange={(checked) =>
                                updateSettings((prev) => ({
                                    ...prev,
                                    courseCreation: {
                                        showCreateCourseWithAI:
                                            prev.courseCreation?.showCreateCourseWithAI ??
                                            COURSE_CREATION_DEFAULTS.showCreateCourseWithAI,
                                        requirePackageSelectionForNewChapter: checked,
                                        showAdvancedSettings:
                                            prev.courseCreation?.showAdvancedSettings ??
                                            COURSE_CREATION_DEFAULTS.showAdvancedSettings,
                                        limitToSingleLevel:
                                            prev.courseCreation?.limitToSingleLevel ??
                                            COURSE_CREATION_DEFAULTS.limitToSingleLevel,
                                    },
                                }))
                            }
                        />
                    </div>
                    <div className="flex items-center justify-between rounded border p-3">
                        <div className="text-sm">Show Advanced Settings</div>
                        <Switch
                            checked={
                                settings.courseCreation?.showAdvancedSettings ??
                                COURSE_CREATION_DEFAULTS.showAdvancedSettings
                            }
                            onCheckedChange={(checked) =>
                                updateSettings((prev) => ({
                                    ...prev,
                                    courseCreation: {
                                        showCreateCourseWithAI:
                                            prev.courseCreation?.showCreateCourseWithAI ??
                                            COURSE_CREATION_DEFAULTS.showCreateCourseWithAI,
                                        requirePackageSelectionForNewChapter:
                                            prev.courseCreation
                                                ?.requirePackageSelectionForNewChapter ??
                                            COURSE_CREATION_DEFAULTS.requirePackageSelectionForNewChapter,
                                        showAdvancedSettings: checked,
                                        limitToSingleLevel:
                                            prev.courseCreation?.limitToSingleLevel ??
                                            COURSE_CREATION_DEFAULTS.limitToSingleLevel,
                                    },
                                }))
                            }
                        />
                    </div>
                    <div className="flex items-center justify-between rounded border p-3">
                        <div className="text-sm">Limit Course To Single Level</div>
                        <Switch
                            checked={
                                settings.courseCreation?.limitToSingleLevel ??
                                COURSE_CREATION_DEFAULTS.limitToSingleLevel
                            }
                            onCheckedChange={(checked) =>
                                updateSettings((prev) => ({
                                    ...prev,
                                    courseCreation: {
                                        showCreateCourseWithAI:
                                            prev.courseCreation?.showCreateCourseWithAI ??
                                            COURSE_CREATION_DEFAULTS.showCreateCourseWithAI,
                                        requirePackageSelectionForNewChapter:
                                            prev.courseCreation
                                                ?.requirePackageSelectionForNewChapter ??
                                            COURSE_CREATION_DEFAULTS.requirePackageSelectionForNewChapter,
                                        showAdvancedSettings:
                                            prev.courseCreation?.showAdvancedSettings ??
                                            COURSE_CREATION_DEFAULTS.showAdvancedSettings,
                                        limitToSingleLevel: checked,
                                    },
                                }))
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Course List Tabs</CardTitle>
                    <CardDescription>
                        Configure visible tabs, their order, and the default tab. Note: Course
                        Approval is always visible for Admins; Course In Review is hidden.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {(
                        [
                            'AllCourses',
                            'AuthoredCourses',
                            'CourseApproval',
                            'CourseInReview',
                        ] as CourseListTabId[]
                    ).map((id) => {
                        const cfg = settings.courseList?.tabs.find((t) => t.id === id) || {
                            id,
                            order: 0,
                            visible: true,
                        };
                        const isForcedVisible = id === 'CourseApproval';
                        const isForcedHidden = id === 'CourseInReview';
                        const disabledToggle = isForcedVisible || isForcedHidden;
                        const enforcedVisible = isForcedVisible
                            ? true
                            : isForcedHidden
                              ? false
                              : cfg.visible;
                        return (
                            <div
                                key={id}
                                className="grid grid-cols-1 items-center gap-3 rounded border p-3 md:grid-cols-5"
                            >
                                <div className="col-span-2 text-sm font-medium">{id}</div>
                                <div>
                                    <Label>Order</Label>
                                    <Input
                                        type="number"
                                        value={cfg.order}
                                        onChange={(e) =>
                                            updateSettings((prev) => ({
                                                ...prev,
                                                courseList: {
                                                    tabs: (prev.courseList?.tabs || []).map((t) =>
                                                        t.id === id
                                                            ? {
                                                                  ...t,
                                                                  order: Number(e.target.value),
                                                              }
                                                            : t
                                                    ),
                                                    defaultTab:
                                                        prev.courseList?.defaultTab || 'AllCourses',
                                                },
                                            }))
                                        }
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-6">
                                    <Switch
                                        checked={enforcedVisible}
                                        disabled={disabledToggle}
                                        onCheckedChange={(checked) =>
                                            updateSettings((prev) => ({
                                                ...prev,
                                                courseList: {
                                                    tabs: (prev.courseList?.tabs || []).map((t) =>
                                                        t.id === id ? { ...t, visible: checked } : t
                                                    ),
                                                    defaultTab:
                                                        prev.courseList?.defaultTab || 'AllCourses',
                                                },
                                            }))
                                        }
                                    />
                                    <span className="text-sm">Visible</span>
                                </div>
                                <div className="pt-6">
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="radio"
                                            name="admin-course-list-default"
                                            checked={settings.courseList?.defaultTab === id}
                                            onChange={() =>
                                                updateSettings((prev) => ({
                                                    ...prev,
                                                    courseList: {
                                                        tabs: prev.courseList?.tabs || [],
                                                        defaultTab: id,
                                                    },
                                                }))
                                            }
                                            disabled={isForcedHidden}
                                        />
                                        Default
                                    </label>
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Course Details Tabs</CardTitle>
                    <CardDescription>
                        Choose which tabs are visible and set the default tab.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {(
                        [
                            'OUTLINE',
                            'CONTENT_STRUCTURE',
                            'LEARNER',
                            'TEACHER',
                            'ASSESSMENT',
                            'PLANNING',
                            'ACTIVITY',
                        ] as CourseDetailsTabId[]
                    ).map((id) => {
                        const cfg = settings.courseDetails?.tabs.find((t) => t.id === id) || {
                            id,
                            order: 0,
                            visible: true,
                        };
                        return (
                            <div
                                key={id}
                                className="grid grid-cols-1 items-center gap-3 rounded border p-3 md:grid-cols-5"
                            >
                                <div className="col-span-2 text-sm font-medium">
                                    {id.replace('_', ' ')}
                                </div>
                                <div>
                                    <Label>Order</Label>
                                    <Input
                                        type="number"
                                        value={cfg.order}
                                        onChange={(e) =>
                                            updateSettings((prev) => ({
                                                ...prev,
                                                courseDetails: {
                                                    tabs: (prev.courseDetails?.tabs || []).map(
                                                        (t) =>
                                                            t.id === id
                                                                ? {
                                                                      ...t,
                                                                      order: Number(e.target.value),
                                                                  }
                                                                : t
                                                    ),
                                                    defaultTab:
                                                        prev.courseDetails?.defaultTab || 'OUTLINE',
                                                },
                                            }))
                                        }
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-6">
                                    <Switch
                                        checked={cfg.visible}
                                        onCheckedChange={(checked) =>
                                            updateSettings((prev) => {
                                                const prevTabs = prev.courseDetails?.tabs || [];
                                                const exists = prevTabs.some((t) => t.id === id);
                                                const orderForId: Record<string, number> = {
                                                    OUTLINE: 1,
                                                    CONTENT_STRUCTURE: 2,
                                                    LEARNER: 3,
                                                    TEACHER: 4,
                                                    ASSESSMENT: 5,
                                                    PLANNING: 6,
                                                    ACTIVITY: 7,
                                                };
                                                const tabs = exists
                                                    ? prevTabs.map((t) =>
                                                          t.id === id
                                                              ? { ...t, visible: checked }
                                                              : t
                                                      )
                                                    : [
                                                          ...prevTabs,
                                                          {
                                                              id,
                                                              order: orderForId[id] ?? 99,
                                                              visible: checked,
                                                          },
                                                      ];
                                                return {
                                                    ...prev,
                                                    courseDetails: {
                                                        tabs,
                                                        defaultTab:
                                                            prev.courseDetails?.defaultTab ||
                                                            'OUTLINE',
                                                    },
                                                };
                                            })
                                        }
                                    />
                                    <span className="text-sm">Visible</span>
                                </div>
                                <div className="pt-6">
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="radio"
                                            name="admin-course-details-default"
                                            checked={settings.courseDetails?.defaultTab === id}
                                            onChange={() =>
                                                updateSettings((prev) => ({
                                                    ...prev,
                                                    courseDetails: {
                                                        tabs: prev.courseDetails?.tabs || [],
                                                        defaultTab: id,
                                                    },
                                                }))
                                            }
                                        />
                                        Default
                                    </label>
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>UI Options</CardTitle>
                    <CardDescription>Global UI preferences</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between rounded border p-3">
                            <div className="text-sm">Show Support Button</div>
                            <Switch
                                checked={settings.ui?.showSupportButton !== false}
                                onCheckedChange={(checked) =>
                                    updateSettings((prev) => ({
                                        ...prev,
                                        ui: { ...prev.ui, showSupportButton: checked },
                                    }))
                                }
                            />
                        </div>
                        <div className="flex items-center justify-between rounded border p-3">
                            <div className="text-sm">Show Sidebar</div>
                            <Switch
                                checked={settings.ui?.showSidebar !== false}
                                onCheckedChange={(checked) =>
                                    updateSettings((prev) => ({
                                        ...prev,
                                        ui: {
                                            showSupportButton: true,
                                            ...prev.ui,
                                            showSidebar: checked,
                                        },
                                    }))
                                }
                            />
                        </div>
                        <div className="flex items-center justify-between rounded border p-3">
                            <div className="text-sm">Show AI Credits</div>
                            <Switch
                                checked={settings.ui?.showAiCredits !== false}
                                onCheckedChange={(checked) =>
                                    updateSettings((prev) => ({
                                        ...prev,
                                        ui: {
                                            showSupportButton: true,
                                            ...prev.ui,
                                            showAiCredits: checked,
                                        },
                                    }))
                                }
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Sidebar Categories</CardTitle>
                    <CardDescription>
                        Configure visibility, order, and default category for the sidebar.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {(['CRM', 'LMS', 'AI'] as const).map((id) => {
                        const categories = settings.sidebarCategories || [
                            { id: 'CRM', visible: true, default: true, order: 0 },
                            { id: 'LMS', visible: true, default: false, order: 1 },
                            { id: 'AI', visible: true, default: false, order: 2 },
                        ];
                        const cfg = categories.find((c) => c.id === id) || {
                            id,
                            visible: true,
                            default: id === 'CRM',
                            order: 0,
                        };

                        return (
                            <div
                                key={id}
                                className="grid grid-cols-1 items-center gap-3 rounded border p-3 md:grid-cols-5"
                            >
                                <div className="col-span-2 text-sm font-medium">
                                    {id === 'AI' ? 'AI Tools' : id}
                                </div>
                                <div>
                                    <Label>Order</Label>
                                    <Input
                                        type="number"
                                        value={cfg.order ?? 0}
                                        onChange={(e) => {
                                            const newOrder = Number(e.target.value);
                                            updateSettings((prev) => {
                                                const currentCats = prev.sidebarCategories || [
                                                    {
                                                        id: 'CRM',
                                                        visible: true,
                                                        default: true,
                                                        order: 0,
                                                    },
                                                    {
                                                        id: 'LMS',
                                                        visible: true,
                                                        default: false,
                                                        order: 1,
                                                    },
                                                    {
                                                        id: 'AI',
                                                        visible: true,
                                                        default: false,
                                                        order: 2,
                                                    },
                                                ];
                                                const baseIds = ['CRM', 'LMS', 'AI'] as const;
                                                let newCats = [...currentCats];

                                                baseIds.forEach((bid) => {
                                                    if (!newCats.find((c) => c.id === bid)) {
                                                        newCats.push({
                                                            id: bid,
                                                            visible: true,
                                                            default: bid === 'CRM',
                                                            order: 0,
                                                        });
                                                    }
                                                });

                                                newCats = newCats.map((c) =>
                                                    c.id === id ? { ...c, order: newOrder } : c
                                                );

                                                return { ...prev, sidebarCategories: newCats };
                                            });
                                        }}
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-6">
                                    <Select
                                        value={
                                            cfg.visible === false
                                                ? 'hidden'
                                                : cfg.locked
                                                  ? 'locked'
                                                  : 'visible'
                                        }
                                        onValueChange={(value) => {
                                            updateSettings((prev) => {
                                                const currentCats = prev.sidebarCategories || [
                                                    {
                                                        id: 'CRM',
                                                        visible: true,
                                                        default: true,
                                                        order: 0,
                                                    },
                                                    {
                                                        id: 'LMS',
                                                        visible: true,
                                                        default: false,
                                                        order: 1,
                                                    },
                                                    {
                                                        id: 'AI',
                                                        visible: true,
                                                        default: false,
                                                        order: 2,
                                                    },
                                                ];
                                                const baseIds = ['CRM', 'LMS', 'AI'] as const;
                                                let newCats = [...currentCats];
                                                baseIds.forEach((bid) => {
                                                    if (!newCats.find((c) => c.id === bid)) {
                                                        newCats.push({
                                                            id: bid,
                                                            visible: true,
                                                            default: bid === 'CRM',
                                                            order: 0,
                                                        });
                                                    }
                                                });

                                                newCats = newCats.map((c) => {
                                                    if (c.id !== id) return c;
                                                    if (value === 'hidden') {
                                                        return {
                                                            ...c,
                                                            visible: false,
                                                            locked: false,
                                                        };
                                                    }
                                                    if (value === 'locked') {
                                                        return {
                                                            ...c,
                                                            visible: true,
                                                            locked: true,
                                                        };
                                                    }
                                                    return { ...c, visible: true, locked: false };
                                                });
                                                return { ...prev, sidebarCategories: newCats };
                                            });
                                        }}
                                    >
                                        <SelectTrigger className="mt-6 w-[100px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="visible">Visible</SelectItem>
                                            <SelectItem value="hidden">Hidden</SelectItem>
                                            <SelectItem value="locked">Locked</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="pt-6">
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="radio"
                                            name="sidebar-category-default-admin"
                                            checked={cfg.default}
                                            onChange={() => {
                                                updateSettings((prev) => {
                                                    const currentCats = prev.sidebarCategories || [
                                                        {
                                                            id: 'CRM',
                                                            visible: true,
                                                            default: true,
                                                            order: 0,
                                                        },
                                                        {
                                                            id: 'LMS',
                                                            visible: true,
                                                            default: false,
                                                            order: 1,
                                                        },
                                                        {
                                                            id: 'AI',
                                                            visible: true,
                                                            default: false,
                                                            order: 2,
                                                        },
                                                    ];
                                                    const baseIds = ['CRM', 'LMS', 'AI'] as const;
                                                    let newCats = [...currentCats];
                                                    baseIds.forEach((bid) => {
                                                        if (!newCats.find((c) => c.id === bid)) {
                                                            newCats.push({
                                                                id: bid,
                                                                visible: true,
                                                                default: bid === 'CRM',
                                                                order: 0,
                                                            });
                                                        }
                                                    });

                                                    newCats = newCats.map((c) => ({
                                                        ...c,
                                                        default: c.id === id,
                                                    }));
                                                    return { ...prev, sidebarCategories: newCats };
                                                });
                                            }}
                                        />
                                        Default
                                    </label>
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Sidebar Tabs</CardTitle>
                    <CardDescription>
                        Order and toggle visibility. Add custom tabs with name, order, and route.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Tabs
                        value={activeCategory}
                        onValueChange={(v) => setActiveCategory(v as 'CRM' | 'LMS' | 'AI')}
                        className="w-full"
                    >
                        <TabsList className="mb-4 grid w-full grid-cols-3">
                            <TabsTrigger value="LMS">LMS</TabsTrigger>
                            <TabsTrigger value="CRM">CRM</TabsTrigger>
                            <TabsTrigger value="AI">AI Tools</TabsTrigger>
                        </TabsList>

                        {settings.sidebar
                            .filter((tab) => {
                                const baseItem = SidebarItemsData.find((i) => i.id === tab.id);
                                const cat = baseItem?.category || 'CRM';
                                return cat === activeCategory;
                            })
                            .sort((a, b) => a.order - b.order)
                            .map((tab) => (
                                <div key={tab.id} className="mb-3 rounded border p-3">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-5 md:items-center">
                                        <div className="col-span-2">
                                            <Label>Tab Name</Label>
                                            <Input
                                                value={tab.label || ''}
                                                onChange={(e) =>
                                                    updateSettings((prev) => ({
                                                        ...prev,
                                                        sidebar: prev.sidebar.map((t) =>
                                                            t.id === tab.id
                                                                ? { ...t, label: e.target.value }
                                                                : t
                                                        ),
                                                    }))
                                                }
                                            />
                                        </div>
                                        <div>
                                            <Label>Order</Label>
                                            <Input
                                                type="number"
                                                value={tab.order}
                                                onChange={(e) =>
                                                    updateSettings((prev) => ({
                                                        ...prev,
                                                        sidebar: prev.sidebar.map((t) =>
                                                            t.id === tab.id
                                                                ? {
                                                                      ...t,
                                                                      order: Number(e.target.value),
                                                                  }
                                                                : t
                                                        ),
                                                    }))
                                                }
                                            />
                                        </div>
                                        <div>
                                            <Label>Route</Label>
                                            <Input
                                                value={tab.route || ''}
                                                onChange={(e) =>
                                                    updateSettings((prev) => ({
                                                        ...prev,
                                                        sidebar: prev.sidebar.map((t) =>
                                                            t.id === tab.id
                                                                ? { ...t, route: e.target.value }
                                                                : t
                                                        ),
                                                    }))
                                                }
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 pt-6">
                                            <Select
                                                value={
                                                    tab.visible === false
                                                        ? 'hidden'
                                                        : tab.locked
                                                          ? 'locked'
                                                          : 'visible'
                                                }
                                                onValueChange={(value) =>
                                                    updateSettings((prev) => ({
                                                        ...prev,
                                                        sidebar: prev.sidebar.map((t) => {
                                                            if (t.id !== tab.id) return t;
                                                            if (value === 'hidden') {
                                                                return {
                                                                    ...t,
                                                                    visible: false,
                                                                    locked: false,
                                                                };
                                                            }
                                                            if (value === 'locked') {
                                                                return {
                                                                    ...t,
                                                                    visible: true,
                                                                    locked: true,
                                                                };
                                                            }
                                                            return {
                                                                ...t,
                                                                visible: true,
                                                                locked: false,
                                                            };
                                                        }),
                                                    }))
                                                }
                                                disabled={tab.id === 'settings'}
                                            >
                                                <SelectTrigger className="w-[100px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="visible">Visible</SelectItem>
                                                    <SelectItem value="hidden">Hidden</SelectItem>
                                                    <SelectItem value="locked">Locked</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {tab.isCustom && (
                                            <div className="pt-6">
                                                <Button
                                                    variant="destructive"
                                                    onClick={() => removeCustomTab(tab.id)}
                                                >
                                                    Remove Tab
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Sub Tabs</Label>
                                            <Button
                                                variant="outline"
                                                onClick={() => addSubTab(tab.id)}
                                            >
                                                Add Sub Tab
                                            </Button>
                                        </div>
                                        {(tab.subTabs || [])
                                            .slice()
                                            .sort((a, b) => a.order - b.order)
                                            .map((sub) => (
                                                <div
                                                    key={sub.id}
                                                    className="grid grid-cols-1 gap-3 rounded border p-3 md:grid-cols-5 md:items-center"
                                                >
                                                    <div className="col-span-2">
                                                        <Input
                                                            value={sub.label || ''}
                                                            onChange={(e) =>
                                                                updateSettings((prev) => ({
                                                                    ...prev,
                                                                    sidebar: prev.sidebar.map(
                                                                        (t) =>
                                                                            t.id === tab.id
                                                                                ? {
                                                                                      ...t,
                                                                                      subTabs: (
                                                                                          t.subTabs ||
                                                                                          []
                                                                                      ).map((s) =>
                                                                                          s.id ===
                                                                                          sub.id
                                                                                              ? {
                                                                                                    ...s,
                                                                                                    label: e
                                                                                                        .target
                                                                                                        .value,
                                                                                                }
                                                                                              : s
                                                                                      ),
                                                                                  }
                                                                                : t
                                                                    ),
                                                                }))
                                                            }
                                                        />
                                                    </div>
                                                    <div>
                                                        <Input
                                                            type="number"
                                                            value={sub.order}
                                                            onChange={(e) =>
                                                                updateSettings((prev) => ({
                                                                    ...prev,
                                                                    sidebar: prev.sidebar.map(
                                                                        (t) =>
                                                                            t.id === tab.id
                                                                                ? {
                                                                                      ...t,
                                                                                      subTabs: (
                                                                                          t.subTabs ||
                                                                                          []
                                                                                      ).map((s) =>
                                                                                          s.id ===
                                                                                          sub.id
                                                                                              ? {
                                                                                                    ...s,
                                                                                                    order: Number(
                                                                                                        e
                                                                                                            .target
                                                                                                            .value
                                                                                                    ),
                                                                                                }
                                                                                              : s
                                                                                      ),
                                                                                  }
                                                                                : t
                                                                    ),
                                                                }))
                                                            }
                                                        />
                                                    </div>
                                                    <div>
                                                        <Input
                                                            value={sub.route}
                                                            onChange={(e) =>
                                                                updateSettings((prev) => ({
                                                                    ...prev,
                                                                    sidebar: prev.sidebar.map(
                                                                        (t) =>
                                                                            t.id === tab.id
                                                                                ? {
                                                                                      ...t,
                                                                                      subTabs: (
                                                                                          t.subTabs ||
                                                                                          []
                                                                                      ).map((s) =>
                                                                                          s.id ===
                                                                                          sub.id
                                                                                              ? {
                                                                                                    ...s,
                                                                                                    route: e
                                                                                                        .target
                                                                                                        .value,
                                                                                                }
                                                                                              : s
                                                                                      ),
                                                                                  }
                                                                                : t
                                                                    ),
                                                                }))
                                                            }
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Select
                                                            value={
                                                                sub.visible === false
                                                                    ? 'hidden'
                                                                    : sub.locked
                                                                      ? 'locked'
                                                                      : 'visible'
                                                            }
                                                            onValueChange={(value) =>
                                                                updateSettings((prev) => ({
                                                                    ...prev,
                                                                    sidebar: prev.sidebar.map(
                                                                        (t) =>
                                                                            t.id === tab.id
                                                                                ? {
                                                                                      ...t,
                                                                                      subTabs: (
                                                                                          t.subTabs ||
                                                                                          []
                                                                                      ).map((s) => {
                                                                                          if (
                                                                                              s.id !==
                                                                                              sub.id
                                                                                          )
                                                                                              return s;
                                                                                          if (
                                                                                              value ===
                                                                                              'hidden'
                                                                                          ) {
                                                                                              return {
                                                                                                  ...s,
                                                                                                  visible:
                                                                                                      false,
                                                                                                  locked: false,
                                                                                              };
                                                                                          }
                                                                                          if (
                                                                                              value ===
                                                                                              'locked'
                                                                                          ) {
                                                                                              return {
                                                                                                  ...s,
                                                                                                  visible:
                                                                                                      true,
                                                                                                  locked: true,
                                                                                              };
                                                                                          }
                                                                                          return {
                                                                                              ...s,
                                                                                              visible:
                                                                                                  true,
                                                                                              locked: false,
                                                                                          };
                                                                                      }),
                                                                                  }
                                                                                : t
                                                                    ),
                                                                }))
                                                            }
                                                        >
                                                            <SelectTrigger className="w-[100px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="visible">
                                                                    Visible
                                                                </SelectItem>
                                                                <SelectItem value="hidden">
                                                                    Hidden
                                                                </SelectItem>
                                                                <SelectItem value="locked">
                                                                    Locked
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    {sub.id.startsWith('custom-sub-') && (
                                                        <div className="pt-2">
                                                            <Button
                                                                variant="destructive"
                                                                onClick={() =>
                                                                    removeCustomSubTab(
                                                                        tab.id,
                                                                        sub.id
                                                                    )
                                                                }
                                                            >
                                                                Remove
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            ))}
                    </Tabs>
                    {activeCategory === 'CRM' && (
                        <div className="pt-2">
                            <Button variant="outline" onClick={addCustomTab}>
                                Add Custom Tab
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Course Content Types</CardTitle>
                    <CardDescription>
                        Enable or disable slide content types. Video has an extra in-video question
                        option.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {(
                        [
                            ['pdf', 'PDF'],
                            ['codeEditor', 'Code Editor'],
                            ['document', 'Document'],
                            ['question', 'Question'],
                            ['quiz', 'Quiz'],
                            ['assignment', 'Assignment'],
                            ['jupyterNotebook', 'Jupyter Notebook'],
                            ['scratch', 'Scratch'],
                        ] as const satisfies ReadonlyArray<
                            readonly [keyof Omit<CourseContentTypeSettings, 'video'>, string]
                        >
                    ).map(([key, label]) => (
                        <div
                            key={key}
                            className="flex items-center justify-between rounded border p-3"
                        >
                            <div className="text-sm">{label}</div>
                            <Switch
                                checked={settings.contentTypes?.[key] !== false}
                                onCheckedChange={(checked) =>
                                    updateSettings((prev) => {
                                        const base: CourseContentTypeSettings = {
                                            pdf: prev.contentTypes?.pdf ?? true,
                                            codeEditor: prev.contentTypes?.codeEditor ?? true,
                                            document: prev.contentTypes?.document ?? true,
                                            question: prev.contentTypes?.question ?? true,
                                            quiz: prev.contentTypes?.quiz ?? true,
                                            assignment: prev.contentTypes?.assignment ?? true,
                                            jupyterNotebook:
                                                prev.contentTypes?.jupyterNotebook ?? true,
                                            scratch: prev.contentTypes?.scratch ?? true,
                                            video: {
                                                enabled: prev.contentTypes?.video?.enabled ?? true,
                                                showInVideoQuestion:
                                                    prev.contentTypes?.video?.showInVideoQuestion ??
                                                    true,
                                            },
                                        };
                                        return {
                                            ...prev,
                                            contentTypes: {
                                                ...base,
                                                [key]: checked,
                                            },
                                        };
                                    })
                                }
                            />
                        </div>
                    ))}
                    <div className="space-y-2 rounded border p-3">
                        <div className="flex items-center justify-between">
                            <div className="text-sm">Video</div>
                            <Switch
                                checked={settings.contentTypes?.video?.enabled !== false}
                                onCheckedChange={(checked) =>
                                    updateSettings((prev) => {
                                        const base: CourseContentTypeSettings = {
                                            pdf: prev.contentTypes?.pdf ?? true,
                                            codeEditor: prev.contentTypes?.codeEditor ?? true,
                                            document: prev.contentTypes?.document ?? true,
                                            question: prev.contentTypes?.question ?? true,
                                            quiz: prev.contentTypes?.quiz ?? true,
                                            assignment: prev.contentTypes?.assignment ?? true,
                                            jupyterNotebook:
                                                prev.contentTypes?.jupyterNotebook ?? true,
                                            scratch: prev.contentTypes?.scratch ?? true,
                                            video: {
                                                enabled: prev.contentTypes?.video?.enabled ?? true,
                                                showInVideoQuestion:
                                                    prev.contentTypes?.video?.showInVideoQuestion ??
                                                    true,
                                            },
                                        };
                                        return {
                                            ...prev,
                                            contentTypes: {
                                                ...base,
                                                video: {
                                                    enabled: checked,
                                                    showInVideoQuestion:
                                                        base.video.showInVideoQuestion,
                                                },
                                            },
                                        };
                                    })
                                }
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="text-sm">In-video Question Visible</div>
                            <Switch
                                checked={
                                    settings.contentTypes?.video?.showInVideoQuestion !== false
                                }
                                onCheckedChange={(checked) =>
                                    updateSettings((prev) => {
                                        const base: CourseContentTypeSettings = {
                                            pdf: prev.contentTypes?.pdf ?? true,
                                            codeEditor: prev.contentTypes?.codeEditor ?? true,
                                            document: prev.contentTypes?.document ?? true,
                                            question: prev.contentTypes?.question ?? true,
                                            quiz: prev.contentTypes?.quiz ?? true,
                                            assignment: prev.contentTypes?.assignment ?? true,
                                            jupyterNotebook:
                                                prev.contentTypes?.jupyterNotebook ?? true,
                                            scratch: prev.contentTypes?.scratch ?? true,
                                            video: {
                                                enabled: prev.contentTypes?.video?.enabled ?? true,
                                                showInVideoQuestion:
                                                    prev.contentTypes?.video?.showInVideoQuestion ??
                                                    true,
                                            },
                                        };
                                        return {
                                            ...prev,
                                            contentTypes: {
                                                ...base,
                                                video: {
                                                    enabled: base.video.enabled,
                                                    showInVideoQuestion: checked,
                                                },
                                            },
                                        };
                                    })
                                }
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Student Side View Options</CardTitle>
                    <CardDescription>
                        Configure which tabs are visible in the student side view.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {STUDENT_SIDE_VIEW_OPTIONS.map(({ key, label }) => (
                        <div
                            key={key}
                            className="flex items-center justify-between rounded border p-3"
                        >
                            <div className="text-sm">{label}</div>
                            <Switch
                                checked={
                                    settings.studentSideView?.[key] ??
                                    STUDENT_SIDE_VIEW_DEFAULTS[key]
                                }
                                onCheckedChange={(checked) =>
                                    updateSettings((prev) => ({
                                        ...prev,
                                        studentSideView: {
                                            ...STUDENT_SIDE_VIEW_DEFAULTS,
                                            ...prev.studentSideView,
                                            [key]: checked,
                                        },
                                    }))
                                }
                            />
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Learner Management</CardTitle>
                    <CardDescription>
                        Configure learner management permissions and access controls.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {LEARNER_MANAGEMENT_OPTIONS.map(({ key, label }) => (
                        <div
                            key={key}
                            className="flex items-center justify-between rounded border p-3"
                        >
                            <div className="text-sm">{label}</div>
                            <Switch
                                checked={
                                    settings.learnerManagement?.[key] ??
                                    LEARNER_MANAGEMENT_DEFAULTS[key]
                                }
                                onCheckedChange={(checked) =>
                                    updateSettings((prev) => ({
                                        ...prev,
                                        learnerManagement: {
                                            ...LEARNER_MANAGEMENT_DEFAULTS,
                                            ...prev.learnerManagement,
                                            [key]: checked,
                                        },
                                    }))
                                }
                            />
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Manage Doubts</CardTitle>
                    <CardDescription>Show or hide the Doubt Management section.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between rounded border p-3">
                        <div className="text-sm">Show Manage Doubts</div>
                        <Switch
                            checked={(() => {
                                const parent = settings.sidebar.find(
                                    (t) => t.id === 'study-library'
                                );
                                const sub = parent?.subTabs?.find(
                                    (s) => s.id === 'doubt-management'
                                );
                                return sub?.visible !== false;
                            })()}
                            onCheckedChange={(checked) =>
                                updateSettings((prev) => ({
                                    ...prev,
                                    sidebar: prev.sidebar.map((t) => {
                                        if (t.id !== 'study-library') return t;
                                        const subTabs = (t.subTabs || []).map((s) =>
                                            s.id === 'doubt-management'
                                                ? { ...s, visible: checked }
                                                : s
                                        );
                                        return { ...t, subTabs };
                                    }),
                                }))
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Dashboard Widgets</CardTitle>
                    <CardDescription>
                        Order and toggle which widgets admins can see.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {settings.dashboard.widgets
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((w) => (
                            <div
                                key={w.id}
                                className="grid grid-cols-1 items-center gap-3 rounded border p-3 md:grid-cols-4"
                            >
                                <div className="text-sm font-medium">{w.id}</div>
                                <div>
                                    <Label>Order</Label>
                                    <Input
                                        type="number"
                                        value={w.order}
                                        onChange={(e) =>
                                            updateSettings((prev) => ({
                                                ...prev,
                                                dashboard: {
                                                    widgets: prev.dashboard.widgets.map((x) =>
                                                        x.id === w.id
                                                            ? {
                                                                  ...x,
                                                                  order: Number(e.target.value),
                                                              }
                                                            : x
                                                    ),
                                                },
                                            }))
                                        }
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-6">
                                    <Switch
                                        checked={w.visible}
                                        onCheckedChange={(checked) =>
                                            updateSettings((prev) => ({
                                                ...prev,
                                                dashboard: {
                                                    widgets: prev.dashboard.widgets.map((x) =>
                                                        x.id === w.id
                                                            ? { ...x, visible: checked }
                                                            : x
                                                    ),
                                                },
                                            }))
                                        }
                                    />
                                    <span className="text-sm">Visible</span>
                                </div>
                            </div>
                        ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Permissions</CardTitle>
                    <CardDescription>
                        Configure institute and profile visibility and edit access.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {(
                        [
                            ['canViewInstituteDetails', 'Can View Institute Details'],
                            ['canEditInstituteDetails', 'Can Edit Institute Details'],
                            ['canViewProfileDetails', 'Can View Profile Details'],
                            ['canEditProfileDetails', 'Can Edit Profile Details'],
                        ] as const
                    ).map(([key, label]) => (
                        <div
                            key={key}
                            className="flex items-center justify-between rounded border p-3"
                        >
                            <div className="text-sm">{label}</div>
                            <Switch
                                checked={
                                    settings.permissions[
                                        key as keyof DisplaySettingsData['permissions']
                                    ]
                                }
                                onCheckedChange={(checked) =>
                                    updateSettings((prev) => ({
                                        ...prev,
                                        permissions: {
                                            ...prev.permissions,
                                            [key as keyof DisplaySettingsData['permissions']]:
                                                checked,
                                        } as DisplaySettingsData['permissions'],
                                    }))
                                }
                            />
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Post-login Redirect</CardTitle>
                    <CardDescription>Choose where to redirect admins after login.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="max-w-md">
                        <Label>Route</Label>
                        <Input
                            value={settings.postLoginRedirectRoute}
                            onChange={(e) =>
                                updateSettings((prev) => ({
                                    ...prev,
                                    postLoginRedirectRoute: e.target.value,
                                }))
                            }
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
