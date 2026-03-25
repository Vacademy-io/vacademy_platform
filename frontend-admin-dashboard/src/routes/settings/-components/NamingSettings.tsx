'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Save, RotateCcw, Settings } from 'lucide-react';
import { MyButton } from '@/components/design-system/button';
import useLocalStorage from '@/hooks/use-local-storage';
import {
    createNamingSettings,
    updateNamingSettings,
    getNamingSettings,
    type NamingSettingsRequest,
} from '@/services/naming-settings';
import { StorageKey } from '@/constants/storage/storage';
import { isNullOrEmptyOrUndefined } from '@/lib/utils';
import {
    CONTENT_TERMS,
    defaultNamingSettings,
    NamingSettingsType,
    ROLE_TERMS,
    systemValueDescription,
} from '../-constants/terms';
import { toast } from 'sonner';

export enum ContentTerms {
    Course = 'Course',
    Level = 'Level',
    Session = 'Session',
    Subjects = 'Subjects',
    Modules = 'Modules',
    Chapters = 'Chapters',
    Slides = 'Slides',
    LiveSession = 'LiveSession',
    Batch = 'Batch',
    PopularTag = 'PopularTag',
}

export enum RoleTerms {
    Admin = 'Admin',
    Teacher = 'Teacher',
    CourseCreator = 'CourseCreator',
    AssessmentCreator = 'AssessmentCreator',
    Evaluator = 'Evaluator',
    Learner = 'Learner',
}
export enum SystemTerms {
    Course = 'Course',
    Level = 'Level',
    Session = 'Session',
    Subjects = 'Subject',
    Modules = 'Module',
    Chapters = 'Chapter',
    Slides = 'Slide',
    LiveSession = 'Live Session',
    Batch = 'Batch',
    Admin = 'Admin',
    Teacher = 'Teacher',
    CourseCreator = 'Course Creator',
    AssessmentCreator = 'Assessment Creator',
    Evaluator = 'Evaluator',
    Learner = 'Learner',
    PopularTag = 'Popular',
}

const createNameRequest = (settings: NamingSettingsType[]): NamingSettingsRequest => {
    const request: Partial<NamingSettingsRequest> = {};
    settings.forEach((item) => {
        let backendKey = item.key;
        if (item.key === 'Subject') backendKey = 'Subjects';
        if (item.key === 'Module') backendKey = 'Modules';
        if (item.key === 'Chapter') backendKey = 'Chapters';
        if (item.key === 'Slide') backendKey = 'Slides';
        if (item.key === 'Learner') backendKey = 'Student';

        (request as Record<string, string>)[backendKey] = item.customValue;

        // Also keep original key just in case backend supports both or dynamic
        if (backendKey !== item.key) {
            (request as Record<string, string>)[item.key] = item.customValue;
        }
    });
    return request as unknown as NamingSettingsRequest;
};

export default function NamingSettings() {
    const [settings, setSettings] = useState<NamingSettingsType[] | null>(null);
    const { getValue: getNamingSettingsStorage, setValue: setNamingSettingsStorage } = useLocalStorage<
        NamingSettingsType[]
    >(StorageKey.NAMING_SETTINGS, []);

    const [isLoading, setIsLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Initialize settings from Backend
    useEffect(() => {
        const initializeSettings = async () => {
            // 1. First, check local storage for immediate render (better UX)
            const savedSettings = getNamingSettingsStorage();
            if (Array.isArray(savedSettings) && savedSettings.length > 0) {
                setSettings(savedSettings);
            }

            try {
                // 2. Always fetch fresh data from the backend
                const backendSettings = await getNamingSettings();

                if (backendSettings && Array.isArray(backendSettings)) {
                    // Map backend array to UI array
                    const settingsArray: NamingSettingsType[] = defaultNamingSettings.map((defaultItem) => {
                        let customValue = defaultItem.systemValue;

                        // Helper to find item in backend array
                        const findInBackend = (key: string) => backendSettings.find(i => i.key === key);

                        // 1. Try exact match
                        let foundItem = findInBackend(defaultItem.key);

                        // 2. If not found, try plural/alias mappings
                        if (!foundItem) {
                            if (defaultItem.key === 'Subject') foundItem = findInBackend('Subjects') || findInBackend('Subject');
                            else if (defaultItem.key === 'Module') foundItem = findInBackend('Modules') || findInBackend('Module');
                            else if (defaultItem.key === 'Chapter') foundItem = findInBackend('Chapters') || findInBackend('Chapter');
                            else if (defaultItem.key === 'Slide') foundItem = findInBackend('Slides') || findInBackend('Slide');
                            else if (defaultItem.key === 'Learner') foundItem = findInBackend('Student') || findInBackend('Learner');
                        }

                        // 3. If found, use its custom value
                        if (foundItem) {
                            customValue = foundItem.customValue;
                        }

                        return {
                            ...defaultItem,
                            customValue: customValue,
                        };
                    });

                    setSettings(settingsArray);
                    setNamingSettingsStorage(settingsArray);
                } else if (!savedSettings || savedSettings.length === 0) {
                    // If API returns null AND local storage is empty, use defaults
                    setSettings(defaultNamingSettings);
                }
            } catch (error) {
                console.error('Failed to initialize naming settings:', error);
                // If API fails, rely on local storage or defaults
                if (!savedSettings || savedSettings.length === 0) {
                    setSettings(defaultNamingSettings);
                }
                toast.error(
                    'Failed to sync settings with server.'
                );
            }
        };

        initializeSettings();
    }, []);

    const handleCustomValueChange = (key: string, newValue: string) => {
        if (!settings) return;

        const updatedSettings = settings.map((item) =>
            item.key === key ? { ...item, customValue: newValue } : item
        );

        setSettings(updatedSettings);
        setHasChanges(true);
    };

    const resetToDefault = (key: string) => {
        if (!settings) return;

        const item = settings.find((item) => item.key === key);
        if (item) {
            handleCustomValueChange(key, item.systemValue);
        }
    };

    const resetAllToDefault = async () => {
        if (!settings) return;

        const updatedSettings = settings.map((item) => ({
            ...item,
            customValue: item.systemValue,
        }));

        setSettings(updatedSettings);
        setHasChanges(true);
    };

    const saveSettings = async () => {
        if (!settings) return;

        setIsLoading(true);
        try {
            // Call the update API
            const nameRequest = createNameRequest(settings);
            await updateNamingSettings(nameRequest);

            // Save to localStorage
            setNamingSettingsStorage(settings);
            setHasChanges(false);
            toast.success('Settings saved');
        } catch (error) {
            console.error('Failed to save settings:', error);
            toast.error('Failed to save settings. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!settings) {
        return <div className="flex items-center justify-center p-8">Loading...</div>;
    }

    const terminologyData = settings;

    // Group terminology by category
    const contentTerms = terminologyData.filter((item) =>
        (CONTENT_TERMS as readonly string[]).includes(item.key)
    );
    console.log('contentTerms', contentTerms, terminologyData);
    const roleTerms = terminologyData.filter((item) =>
        (ROLE_TERMS as readonly string[]).includes(item.key)
    );

    return (
        <div className=" space-y-6 p-2">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="flex items-center gap-2 text-lg font-bold">
                        <Settings className="size-6" />
                        Naming Settings
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Customize the naming conventions used throughout your institute
                        <br />
                        <span className="text-xs  text-primary-500">
                            Please enter singular form of the term
                        </span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={resetAllToDefault} disabled={isLoading}>
                        <RotateCcw className="mr-2 size-4" />
                        Reset All
                    </Button>
                    <MyButton
                        onClick={saveSettings}
                        disabled={isLoading || !hasChanges}
                        className="bg-primary-500"
                    >
                        <Save className="mr-2 size-4" />
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </MyButton>
                </div>
            </div>

            {hasChanges && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm text-amber-800">
                        You have unsaved changes. Don&apos;t forget to save your updates.
                    </p>
                </div>
            )}

            <div className="grid gap-6">
                {/* Content & Structure Terms */}
                <Card>
                    <CardHeader>
                        <CardTitle>Content & Structure</CardTitle>
                        <CardDescription>
                            Customize terms related to course content and structure
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {contentTerms.map((item) => (
                            <div
                                key={item.key}
                                className="grid grid-cols-1 items-center gap-4 rounded-lg border p-4 md:grid-cols-3"
                            >
                                <div className="space-y-1">
                                    <Label className="text-sm font-medium">
                                        {item.systemValue}
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant="secondary"
                                            className="text-xs text-muted-foreground"
                                        >
                                            {
                                                systemValueDescription[
                                                item.key as keyof typeof systemValueDescription
                                                ]
                                            }
                                        </Badge>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor={`custom-${item.key}`} className="text-sm">
                                        Custom Name
                                    </Label>
                                    <Input
                                        id={`custom-${item.key}`}
                                        value={item.customValue}
                                        onChange={(e) =>
                                            handleCustomValueChange(item.key, e.target.value)
                                        }
                                        placeholder={item.systemValue}
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => resetToDefault(item.key)}
                                        disabled={item.customValue === item.systemValue}
                                    >
                                        <RotateCcw className="mr-1 size-3" />
                                        Reset
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* User Roles */}
                <Card>
                    <CardHeader>
                        <CardTitle>User Roles</CardTitle>
                        <CardDescription>
                            Customize terms for different user roles in your institute
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {roleTerms.map((item) => (
                            <div
                                key={item.key}
                                className="grid grid-cols-1 items-center gap-4 rounded-lg border p-4 md:grid-cols-3"
                            >
                                <div className="space-y-1">
                                    <Label className="text-sm font-medium">
                                        {item.systemValue}
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant="secondary"
                                            className="text-xs text-muted-foreground"
                                        >
                                            {
                                                systemValueDescription[
                                                item.key as keyof typeof systemValueDescription
                                                ]
                                            }
                                        </Badge>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor={`custom-${item.key}`} className="text-sm">
                                        Custom Name
                                    </Label>
                                    <Input
                                        id={`custom-${item.key}`}
                                        value={item.customValue}
                                        onChange={(e) =>
                                            handleCustomValueChange(item.key, e.target.value)
                                        }
                                        placeholder={item.systemValue}
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => resetToDefault(item.key)}
                                        disabled={item.customValue === item.systemValue}
                                    >
                                        <RotateCcw className="mr-1 size-3" />
                                        Reset
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            <Separator />

            <div className="text-sm text-muted-foreground">
                <p>
                    <strong>Note:</strong> Changes will be applied across your entire institute once
                    saved. All users will see the updated terminology in their interface.
                </p>
            </div>
        </div>
    );
}
