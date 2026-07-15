/**
 * GuardianSettings — institute settings tab for guardian-student linking.
 *
 * Master toggle (PARENT_SETTING.enabled) gates all guardian-linking UI across
 * the app (see useParentSettings). This page also exposes a one-off backfill
 * action that creates a guardian account for every student that doesn't
 * already have one linked.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL, GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GuardianSettingsData {
    /** If false, all guardian-linking UI (bulk-assign, side-view, backfill) is hidden institute-wide. */
    enabled: boolean;
}

const DEFAULT_GUARDIAN_SETTINGS: GuardianSettingsData = {
    enabled: false,
};

const SETTING_KEY = 'PARENT_SETTING';
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');
const BACKFILL_URL = `${BASE_URL}/admin-core-service/parent-link/v1/backfill`;
const PENDING_URL = `${BASE_URL}/admin-core-service/parent-link/v1/backfill/pending`;
const PENDING_PREVIEW_LIMIT = 25;

interface BackfillResult {
    total_eligible: number;
    created: number;
    skipped: number;
}

interface PendingGuardianStudent {
    user_id: string;
    full_name: string | null;
    email: string | null;
    mobile_number: string | null;
}

// ─── API ─────────────────────────────────────────────────────────────────────

const fetchGuardianSettings = async (): Promise<GuardianSettingsData> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_INSITITUTE_SETTINGS,
        params: { instituteId, settingKey: SETTING_KEY },
    });
    // GET returns the SettingDto itself ({key, name, data}) — response.data IS
    // the SettingDto, so its content is one level down at response.data.data
    // (matches LeadSettings.tsx's fetchLeadSettings, verified working).
    const saved = response.data?.data as Partial<GuardianSettingsData> | undefined;
    if (!saved) return DEFAULT_GUARDIAN_SETTINGS;
    return { ...DEFAULT_GUARDIAN_SETTINGS, ...saved };
};

const saveGuardianSettings = async (data: GuardianSettingsData): Promise<void> => {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Guardian Settings', setting_data: data },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
};

const runGuardianBackfill = async (): Promise<BackfillResult> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance.post(
        BACKFILL_URL,
        {},
        { params: { instituteId } }
    );
    return response.data as BackfillResult;
};

const fetchPendingGuardianStudents = async (): Promise<PendingGuardianStudent[]> => {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) return [];
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: PENDING_URL,
        params: { instituteId },
    });
    return (response.data as PendingGuardianStudent[]) ?? [];
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function GuardianSettings() {
    const queryClient = useQueryClient();
    const [settings, setSettings] = useState<GuardianSettingsData>(DEFAULT_GUARDIAN_SETTINGS);
    const [hasChanges, setHasChanges] = useState(false);
    const [backfillDialogOpen, setBackfillDialogOpen] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['guardian-settings'],
        queryFn: fetchGuardianSettings,
        staleTime: 5 * 60 * 1000,
    });

    const { data: pendingStudents, isLoading: pendingLoading } = useQuery({
        queryKey: ['guardian-backfill-pending'],
        queryFn: fetchPendingGuardianStudents,
        enabled: settings.enabled,
        staleTime: 60 * 1000,
    });

    useEffect(() => {
        if (data) {
            setSettings(data);
            setHasChanges(false);
        }
    }, [data]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: saveGuardianSettings,
        onSuccess: () => {
            toast.success('Guardian settings saved');
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: ['guardian-settings'] });
            queryClient.invalidateQueries({ queryKey: ['parent-settings-config'] });
        },
        onError: () => {
            toast.error('Failed to save guardian settings');
        },
    });

    const { mutate: backfill, isPending: backfilling } = useMutation({
        mutationFn: runGuardianBackfill,
        onSuccess: (result) => {
            toast.success(
                `Guardian backfill complete: ${result.created} created, ${result.skipped} skipped out of ${result.total_eligible} eligible students.`
            );
            queryClient.invalidateQueries({ queryKey: ['guardian-backfill-pending'] });
        },
        onError: () => {
            toast.error('Guardian backfill failed');
        },
    });

    const update = (patch: Partial<GuardianSettingsData>) => {
        setSettings((prev) => ({ ...prev, ...patch }));
        setHasChanges(true);
    };

    const handleSave = () => {
        save(settings);
    };

    return (
        <div className="p-6">
            <div className="space-y-6">
                {/* ── Enable / Disable Guardian Linking ── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Guardian Setting</CardTitle>
                        <CardDescription>
                            Controls whether guardian-student linking (bulk assignment, student
                            side-view, and backfill) is available institute-wide. Disabling hides
                            all guardian-linking UI without deleting existing links.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-body text-neutral-500">Loading guardian settings…</div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <Switch
                                    id="guardian-enabled"
                                    checked={settings.enabled}
                                    onCheckedChange={(v) => update({ enabled: v })}
                                />
                                <Label htmlFor="guardian-enabled" className="cursor-pointer">
                                    {settings.enabled ? 'Enable Guardian Linking' : 'Guardian Linking Disabled'}
                                </Label>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {!isLoading && (
                    <div className="flex items-center justify-end">
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onClick={handleSave}
                            disable={saving || !hasChanges}
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </MyButton>
                    </div>
                )}

                {/* ── Backfill Existing Students ── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Backfill Existing Students</CardTitle>
                        <CardDescription>
                            Create a guardian account for every student in this institute that
                            doesn&apos;t already have one linked. Students that already have a
                            guardian are skipped and untouched.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {settings.enabled && (
                            <div className="mb-4">
                                {pendingLoading ? (
                                    <div className="text-body text-neutral-500">
                                        Checking for students awaiting a guardian…
                                    </div>
                                ) : (pendingStudents?.length ?? 0) === 0 ? (
                                    <div className="text-body text-success-600">
                                        Every student already has a guardian linked. Nothing to backfill.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <div className="text-body font-medium text-neutral-800">
                                            {pendingStudents!.length} student
                                            {pendingStudents!.length === 1 ? '' : 's'} awaiting a guardian
                                        </div>
                                        <div className="max-h-56 overflow-y-auto rounded-md border border-neutral-200">
                                            <div className="flex flex-col divide-y divide-neutral-100">
                                                {pendingStudents!.slice(0, PENDING_PREVIEW_LIMIT).map((s) => (
                                                    <div key={s.user_id} className="flex flex-col gap-0.5 px-3 py-2">
                                                        <span className="text-caption font-medium text-neutral-800">
                                                            {s.full_name || '—'}
                                                        </span>
                                                        <span className="text-2xs text-neutral-500">
                                                            {s.email || '—'} · {s.mobile_number || '—'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {pendingStudents!.length > PENDING_PREVIEW_LIMIT && (
                                            <div className="text-caption text-neutral-500">
                                                +{pendingStudents!.length - PENDING_PREVIEW_LIMIT} more not shown
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onClick={() => setBackfillDialogOpen(true)}
                            disable={!settings.enabled || backfilling || (pendingStudents?.length ?? 0) === 0}
                        >
                            {backfilling ? 'Running Backfill…' : 'Run Backfill'}
                        </MyButton>
                    </CardContent>
                </Card>
            </div>

            <GuardianBackfillConfirmDialog
                open={backfillDialogOpen}
                onOpenChange={setBackfillDialogOpen}
                onConfirm={() => backfill()}
                pendingCount={pendingStudents?.length ?? 0}
            />
        </div>
    );
}

// ─── Backfill confirmation dialog ─────────────────────────────────────────────

interface GuardianBackfillConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Called when the user confirms. Closing is handled by the dialog. */
    onConfirm: () => void;
    pendingCount: number;
}

function GuardianBackfillConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    pendingCount,
}: GuardianBackfillConfirmDialogProps) {
    const footer = (
        <div className="flex w-full items-center justify-end gap-2">
            <MyButton buttonType="secondary" scale="medium" onClick={() => onOpenChange(false)}>
                Cancel
            </MyButton>
            <MyButton
                buttonType="primary"
                scale="medium"
                onClick={() => {
                    onConfirm();
                    onOpenChange(false);
                }}
            >
                Confirm
            </MyButton>
        </div>
    );

    return (
        <MyDialog
            open={open}
            onOpenChange={onOpenChange}
            heading="Run guardian backfill?"
            footer={footer}
            dialogWidth="max-w-md"
        >
            <div className="px-6 py-6">
                <p className="text-body text-neutral-500">
                    This will create a guardian account for{' '}
                    <span className="font-medium text-neutral-800">
                        {pendingCount} student{pendingCount === 1 ? '' : 's'}
                    </span>{' '}
                    in this institute that {pendingCount === 1 ? "doesn't" : "don't"} already have one
                    linked. Students that already have a guardian are skipped and untouched.
                </p>
            </div>
        </MyDialog>
    );
}
