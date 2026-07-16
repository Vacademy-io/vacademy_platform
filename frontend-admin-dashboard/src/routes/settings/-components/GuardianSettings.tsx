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
import { Progress } from '@/components/ui/progress';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL, GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

export type BackfillCredentialRecipient = 'STUDENT' | 'GUARDIAN';

export interface GuardianSettingsData {
    /** If false, all guardian-linking UI (bulk-assign, side-view, backfill) is hidden institute-wide. */
    enabled: boolean;
    /** Whether backfill emails the newly-created guardian's login credentials once created. */
    sendCredentialsOnBackfill: boolean;
    /**
     * Who receives the credential email. "STUDENT" (default) is the only
     * practically deliverable choice for backfill — the guardian's backfilled
     * email is a synthetic, undeliverable @vacademy.com address. "GUARDIAN"
     * is kept for symmetry with the non-backfill link flows.
     */
    backfillCredentialRecipient: BackfillCredentialRecipient;
}

const DEFAULT_GUARDIAN_SETTINGS: GuardianSettingsData = {
    enabled: false,
    sendCredentialsOnBackfill: false,
    backfillCredentialRecipient: 'STUDENT',
};

const SETTING_KEY = 'PARENT_SETTING';
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');
const BACKFILL_URL = `${BASE_URL}/admin-core-service/parent-link/v1/backfill`;
const PENDING_URL = `${BASE_URL}/admin-core-service/parent-link/v1/backfill/pending`;
const LEADS_BACKFILL_URL = `${BASE_URL}/admin-core-service/parent-link/v1/backfill-leads`;
const LEADS_PENDING_URL = `${BASE_URL}/admin-core-service/parent-link/v1/backfill-leads/pending`;
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

const runGuardianBackfill = async (url: string): Promise<BackfillResult> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance.post(url, {}, { params: { instituteId } });
    return response.data as BackfillResult;
};

export interface BackfillProgress {
    createdSoFar: number;
    skippedSoFar: number;
    /** Stable denominator — the outstanding count as of the very first call, before this run touched anything. */
    startingTotal: number;
}

/**
 * The backend processes at most one batch (100) per call and recomputes
 * eligibility fresh each time — so this just calls it repeatedly until it
 * reports nothing left, no cursor/offset to track. Each call is fast (one
 * bounded batch), so no single request risks a timeout regardless of
 * institute size; `onProgress` fires after every batch so the UI can show
 * live "X of Y done" instead of one long blocking spinner.
 */
const runFullBackfillInChunks = async (
    url: string,
    onProgress: (progress: BackfillProgress) => void
): Promise<BackfillProgress> => {
    let createdSoFar = 0;
    let skippedSoFar = 0;
    let startingTotal = 0;
    // Safety backstop only — at chunk size 100 this covers 100,000+ students.
    // Never expected to trigger; just prevents a truly stuck loop from spinning forever.
    const MAX_ROUNDS = 1000;
    for (let round = 0; round < MAX_ROUNDS; round++) {
        const result = await runGuardianBackfill(url);
        if (round === 0) {
            startingTotal = result.total_eligible;
        }
        createdSoFar += result.created;
        skippedSoFar += result.skipped;
        onProgress({ createdSoFar, skippedSoFar, startingTotal });
        const processedThisRound = result.created + result.skipped;
        if (result.total_eligible === 0 || processedThisRound === 0) {
            break;
        }
    }
    return { createdSoFar, skippedSoFar, startingTotal };
};

const fetchPendingGuardianStudents = async (url: string): Promise<PendingGuardianStudent[]> => {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) return [];
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url,
        params: { instituteId },
    });
    return (response.data as PendingGuardianStudent[]) ?? [];
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function GuardianSettings() {
    const queryClient = useQueryClient();
    const [settings, setSettings] = useState<GuardianSettingsData>(DEFAULT_GUARDIAN_SETTINGS);
    const [hasChanges, setHasChanges] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['guardian-settings'],
        queryFn: fetchGuardianSettings,
        staleTime: 5 * 60 * 1000,
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

                {/* ── Backfill credential notification ── */}
                {settings.enabled && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Backfill Credential Notification</CardTitle>
                            <CardDescription>
                                Optionally email the newly-created guardian&apos;s login credentials
                                when a backfill creates them.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <Switch
                                    id="guardian-send-credentials"
                                    checked={settings.sendCredentialsOnBackfill}
                                    onCheckedChange={(v) => update({ sendCredentialsOnBackfill: v })}
                                />
                                <Label htmlFor="guardian-send-credentials" className="cursor-pointer">
                                    Send credential email during backfill
                                </Label>
                            </div>
                            {settings.sendCredentialsOnBackfill && (
                                <div className="flex flex-col gap-2">
                                    <Label>Send to</Label>
                                    <div className="flex items-center gap-2">
                                        <MyButton
                                            buttonType={
                                                settings.backfillCredentialRecipient === 'STUDENT'
                                                    ? 'primary'
                                                    : 'secondary'
                                            }
                                            scale="small"
                                            onClick={() => update({ backfillCredentialRecipient: 'STUDENT' })}
                                        >
                                            Student
                                        </MyButton>
                                        <MyButton
                                            buttonType={
                                                settings.backfillCredentialRecipient === 'GUARDIAN'
                                                    ? 'primary'
                                                    : 'secondary'
                                            }
                                            scale="small"
                                            onClick={() => update({ backfillCredentialRecipient: 'GUARDIAN' })}
                                        >
                                            Guardian
                                        </MyButton>
                                    </div>
                                    <p className="text-caption text-neutral-500">
                                        {settings.backfillCredentialRecipient === 'STUDENT'
                                            ? "Sends to the student's own email, since the backfilled guardian's email is a placeholder address that can't receive mail."
                                            : "Sends to the guardian's own (placeholder @vacademy.com) address — kept for symmetry, but not actually deliverable for backfilled guardians."}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

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
                <BackfillSection
                    settingsEnabled={settings.enabled}
                    title="Backfill Existing Students"
                    description="Create a guardian account for every enrolled student in this institute that doesn't already have one linked. Students that already have a guardian are skipped and untouched."
                    pendingUrl={PENDING_URL}
                    backfillUrl={BACKFILL_URL}
                    queryKeySuffix="enrolled"
                    dialogHeading="Run guardian backfill?"
                    emptyStateLabel="Every student already has a guardian linked. Nothing to backfill."
                    awaitingLabel="awaiting a guardian"
                />

                {/* ── Backfill Leads' Guardians ── */}
                <BackfillSection
                    settingsEnabled={settings.enabled}
                    title="Backfill Leads' Guardians"
                    description="Create a guardian account for every lead in this institute whose student side already has a real account but no guardian linked — reaches leads that haven't been enrolled yet. Leads that already have a guardian are skipped and untouched."
                    pendingUrl={LEADS_PENDING_URL}
                    backfillUrl={LEADS_BACKFILL_URL}
                    queryKeySuffix="leads"
                    dialogHeading="Run leads guardian backfill?"
                    emptyStateLabel="Every lead already has a guardian linked. Nothing to backfill."
                    awaitingLabel="awaiting a guardian (leads)"
                />
            </div>
        </div>
    );
}

// ─── Backfill section (reused for enrolled students + leads) ──────────────────

interface BackfillSectionProps {
    settingsEnabled: boolean;
    title: string;
    description: string;
    pendingUrl: string;
    backfillUrl: string;
    queryKeySuffix: string;
    dialogHeading: string;
    emptyStateLabel: string;
    awaitingLabel: string;
}

function BackfillSection({
    settingsEnabled,
    title,
    description,
    pendingUrl,
    backfillUrl,
    queryKeySuffix,
    dialogHeading,
    emptyStateLabel,
    awaitingLabel,
}: BackfillSectionProps) {
    const queryClient = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [progress, setProgress] = useState<BackfillProgress | null>(null);
    const pendingQueryKey = ['guardian-backfill-pending', queryKeySuffix];

    const { data: pendingStudents, isLoading: pendingLoading } = useQuery({
        queryKey: pendingQueryKey,
        queryFn: () => fetchPendingGuardianStudents(pendingUrl),
        enabled: settingsEnabled,
        staleTime: 60 * 1000,
    });

    const { mutate: backfill, isPending: backfilling } = useMutation({
        mutationFn: () => {
            setProgress(null);
            return runFullBackfillInChunks(backfillUrl, setProgress);
        },
        onSuccess: (result) => {
            toast.success(
                `${title} complete: ${result.createdSoFar} created, ${result.skippedSoFar} skipped out of ${result.startingTotal} eligible.`
            );
            setProgress(null);
            queryClient.invalidateQueries({ queryKey: pendingQueryKey });
        },
        onError: () => {
            setProgress(null);
            toast.error(`${title} failed`);
        },
    });

    const progressDone = progress ? progress.createdSoFar + progress.skippedSoFar : 0;
    const progressPct =
        progress && progress.startingTotal > 0
            ? Math.min(100, Math.round((progressDone / progress.startingTotal) * 100))
            : 0;

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                    {settingsEnabled && (
                        <div className="mb-4">
                            {pendingLoading ? (
                                <div className="text-body text-neutral-500">Checking for {awaitingLabel}…</div>
                            ) : (pendingStudents?.length ?? 0) === 0 ? (
                                <div className="text-body text-success-600">{emptyStateLabel}</div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <div className="text-body font-medium text-neutral-800">
                                        {pendingStudents!.length} student
                                        {pendingStudents!.length === 1 ? '' : 's'} {awaitingLabel}
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
                    {backfilling && progress && (
                        <div className="mb-4 flex flex-col gap-1.5">
                            <Progress value={progressPct} className="w-full" />
                            <div className="text-caption text-neutral-500">
                                {progressDone} of {progress.startingTotal} processed ({progress.createdSoFar}{' '}
                                created, {progress.skippedSoFar} skipped) — running in batches, this may take a
                                while for a large institute.
                            </div>
                        </div>
                    )}
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={() => setDialogOpen(true)}
                        disable={!settingsEnabled || backfilling || (pendingStudents?.length ?? 0) === 0}
                    >
                        {backfilling ? 'Running Backfill…' : 'Run Backfill'}
                    </MyButton>
                </CardContent>
            </Card>

            <GuardianBackfillConfirmDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onConfirm={() => backfill()}
                pendingCount={pendingStudents?.length ?? 0}
                heading={dialogHeading}
            />
        </>
    );
}

// ─── Backfill confirmation dialog ─────────────────────────────────────────────

interface GuardianBackfillConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Called when the user confirms. Closing is handled by the dialog. */
    onConfirm: () => void;
    pendingCount: number;
    heading: string;
}

function GuardianBackfillConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    pendingCount,
    heading,
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
            heading={heading}
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
