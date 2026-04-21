import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

type DoubtAssigneeSource = 'SUBJECT_TEACHER' | 'BATCH_TEACHER' | 'BOTH' | 'NONE';

interface DoubtManagementSettingsData {
    default_assignee_source: DoubtAssigneeSource;
    fallback_to_batch_when_no_subject_teacher: boolean;
}

const DEFAULT_SETTINGS: DoubtManagementSettingsData = {
    default_assignee_source: 'BATCH_TEACHER',
    fallback_to_batch_when_no_subject_teacher: true,
};

const SETTING_KEY = 'DOUBT_MANAGEMENT_SETTING';
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');

const OPTIONS: { value: DoubtAssigneeSource; title: string; description: string }[] = [
    {
        value: 'SUBJECT_TEACHER',
        title: 'Subject teacher',
        description:
            'Auto-assign to faculty mapped to the doubt’s subject (narrowest match). Ideal for slide-level doubts where the subject is unambiguous.',
    },
    {
        value: 'BATCH_TEACHER',
        title: 'Batch teacher',
        description:
            'Auto-assign to every faculty mapped to the batch, regardless of subject. This is the legacy behavior.',
    },
    {
        value: 'BOTH',
        title: 'Both',
        description: 'Union of subject-mapped and batch-mapped faculty.',
    },
    {
        value: 'NONE',
        title: 'None (manual)',
        description: 'No auto-assign. Admins assign each doubt manually.',
    },
];

const fetchSettings = async (): Promise<DoubtManagementSettingsData> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_INSITITUTE_SETTINGS,
        params: { instituteId, settingKey: SETTING_KEY },
    });
    // `/get` returns a SettingDto shape: { key, name, data }. `data` is the typed payload.
    return response.data?.data ?? DEFAULT_SETTINGS;
};

const saveSettings = async (data: DoubtManagementSettingsData): Promise<void> => {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Doubt Management Settings', setting_data: data },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
};

export default function DoubtManagementSettings() {
    const queryClient = useQueryClient();
    const [settings, setSettings] = useState<DoubtManagementSettingsData>(DEFAULT_SETTINGS);
    const [hasChanges, setHasChanges] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['doubt-management-settings'],
        queryFn: fetchSettings,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (data) {
            setSettings({
                default_assignee_source: data.default_assignee_source ?? 'BATCH_TEACHER',
                fallback_to_batch_when_no_subject_teacher:
                    data.fallback_to_batch_when_no_subject_teacher ?? true,
            });
            setHasChanges(false);
        }
    }, [data]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: saveSettings,
        onSuccess: () => {
            toast.success('Doubt management settings saved');
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: ['doubt-management-settings'] });
        },
        onError: () => {
            toast.error('Failed to save doubt management settings');
        },
    });

    const update = (patch: Partial<DoubtManagementSettingsData>) => {
        setSettings((prev) => ({ ...prev, ...patch }));
        setHasChanges(true);
    };

    const showFallbackToggle = settings.default_assignee_source === 'SUBJECT_TEACHER';

    if (isLoading) {
        return <div className="p-6 text-sm text-muted-foreground">Loading settings…</div>;
    }

    return (
        <div className="space-y-6 p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Default auto-assignment</CardTitle>
                    <CardDescription>
                        Controls who gets pre-assigned when a learner raises a new doubt. Only
                        affects new doubts — existing doubts keep their current assignees.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {OPTIONS.map((opt) => {
                        const selected = settings.default_assignee_source === opt.value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => update({ default_assignee_source: opt.value })}
                                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                                    selected
                                        ? 'border-primary-400 bg-primary-50'
                                        : 'border-neutral-200 hover:border-neutral-300'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <span
                                        aria-hidden
                                        className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                                            selected
                                                ? 'border-primary-500 bg-primary-500'
                                                : 'border-neutral-300 bg-white'
                                        }`}
                                    >
                                        {selected && (
                                            <span className="size-1.5 rounded-full bg-white" />
                                        )}
                                    </span>
                                    <div>
                                        <div className="text-sm font-medium text-neutral-800">
                                            {opt.title}
                                        </div>
                                        <p className="mt-0.5 text-xs text-neutral-600">
                                            {opt.description}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </CardContent>
            </Card>

            {showFallbackToggle && (
                <Card>
                    <CardHeader>
                        <CardTitle>Fallback behavior</CardTitle>
                        <CardDescription>
                            What to do when a doubt’s subject has no mapped faculty.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-start gap-3">
                            <Switch
                                id="fallback-to-batch"
                                checked={settings.fallback_to_batch_when_no_subject_teacher}
                                onCheckedChange={(v) =>
                                    update({ fallback_to_batch_when_no_subject_teacher: v })
                                }
                            />
                            <div>
                                <Label
                                    htmlFor="fallback-to-batch"
                                    className="cursor-pointer text-sm font-medium text-neutral-800"
                                >
                                    Fall back to batch teachers when no subject teacher exists
                                </Label>
                                <p className="mt-0.5 text-xs text-neutral-600">
                                    If off, doubts with no subject-mapped faculty will be left
                                    unassigned and require manual attention.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="flex justify-end">
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={() => save(settings)}
                    disable={saving || !hasChanges}
                >
                    {saving ? 'Saving…' : 'Save settings'}
                </MyButton>
            </div>
        </div>
    );
}
