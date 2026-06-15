/**
 * LeadReportSettings — the "Reports" config card on Settings → Lead settings →
 * Configuration. Controls the three institute-level knobs the Reports Center
 * SQL honours:
 *
 *   1. Report timezone        → all day/hour bucketing (AT TIME ZONE)
 *   2. Connected call statuses → which telephony CALL_STATUS values count as
 *                                a "connected" call (connect-rate etc.)
 *   3. Interested statuses     → which lead-status keys count as "interested"
 *                                in source/funnel reports
 *
 * Persisted at LEAD_SETTING.data.reports (snake_case subtree). The save path
 * READ-MODIFY-WRITES the whole LEAD_SETTING data object — fetch current, merge
 * only the reports subtree, save — so sibling keys (enabled, scoringWeights,
 * workbench, …) are never clobbered.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChartBar } from '@phosphor-icons/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MultiSelect, type OptionType } from '@/components/design-system/multi-select';
import { MyButton } from '@/components/design-system/button';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useLeadStatuses } from '@/hooks/use-lead-statuses';
import { DEFAULT_CUSTOM_LEAD_STATUSES } from '@/hooks/use-lead-settings';
import {
    LEAD_REPORT_SETTINGS_QUERY_KEY,
    TELEPHONY_CALL_STATUSES,
    fetchLeadReportSettings,
    fetchLeadSettingRawData,
    humanizeCallStatus,
    type LeadReportSettings as LeadReportSettingsValues,
    type LeadReportSettingsSubtree,
} from '@/hooks/use-lead-report-settings';

const SETTING_KEY = 'LEAD_SETTING';
// Mirrors LeadSettings.tsx — the institute-settings save endpoint.
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');

/**
 * Curated IANA timezones — default (Asia/Kolkata) first. Extend the list if an
 * institute outside these regions onboards; the value is a free-form IANA id
 * on the backend, only this picker is curated.
 */
const REPORT_TIMEZONES = [
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Singapore',
    'Europe/London',
    'America/New_York',
    'America/Los_Angeles',
    'UTC',
] as const;

const CALL_STATUS_OPTIONS: OptionType[] = TELEPHONY_CALL_STATUSES.map((s) => ({
    value: s,
    label: humanizeCallStatus(s),
}));

async function saveReportSettings(next: LeadReportSettingsValues): Promise<void> {
    const instituteId = getCurrentInstituteId();
    // Read-modify-write: fetch the CURRENT full data object right before saving
    // so concurrent edits to sibling subtrees aren't clobbered.
    const current = await fetchLeadSettingRawData();
    const reports: LeadReportSettingsSubtree = {
        timezone: next.timezone,
        connected_call_statuses: next.connectedCallStatuses,
        interested_status_keys: next.interestedStatusKeys,
    };
    const merged = { ...current, reports };
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Lead Settings', setting_data: merged },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
}

export default function LeadReportSettings() {
    const queryClient = useQueryClient();

    const { data: saved, isLoading } = useQuery({
        queryKey: LEAD_REPORT_SETTINGS_QUERY_KEY,
        queryFn: fetchLeadReportSettings,
        staleTime: 5 * 60 * 1000,
    });

    // Institute lead-status catalog → options for the "interested" picker.
    const { statuses, isLoading: statusesLoading } = useLeadStatuses();
    const statusOptions: OptionType[] =
        statuses.length > 0
            ? statuses
                  .filter((s) => s.is_active)
                  .map((s) => ({ value: s.status_key, label: s.label }))
            : // Catalog empty / unreachable — fall back to the starter pipeline keys.
              DEFAULT_CUSTOM_LEAD_STATUSES.map((s) => ({ value: s.key, label: s.label }));

    const [timezone, setTimezone] = useState<string>('Asia/Kolkata');
    const [connectedStatuses, setConnectedStatuses] = useState<string[]>(['COMPLETED']);
    const [interestedKeys, setInterestedKeys] = useState<string[]>(['INTERESTED']);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (saved) {
            setTimezone(saved.timezone);
            setConnectedStatuses(saved.connectedCallStatuses);
            setInterestedKeys(saved.interestedStatusKeys);
            setHasChanges(false);
        }
    }, [saved]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: saveReportSettings,
        onSuccess: () => {
            toast.success('Report settings saved');
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: LEAD_REPORT_SETTINGS_QUERY_KEY });
            // Other lead-settings consumers re-read the merged LEAD_SETTING object.
            queryClient.invalidateQueries({ queryKey: ['lead-settings-config'] });
            queryClient.invalidateQueries({ queryKey: ['lead-settings'] });
        },
        onError: () => {
            toast.error('Failed to save report settings');
        },
    });

    const handleSave = () => {
        if (connectedStatuses.length === 0) {
            toast.error('Pick at least one connected call status');
            return;
        }
        if (interestedKeys.length === 0) {
            toast.error('Pick at least one interested status');
            return;
        }
        save({
            timezone,
            connectedCallStatuses: connectedStatuses,
            interestedStatusKeys: interestedKeys,
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ChartBar size={18} className="text-neutral-500" />
                    Reports
                </CardTitle>
                <CardDescription>
                    How the Reports Center buckets and counts activity. Changes apply to all report
                    tabs (Sources, Calling, Funnel, Follow-ups, Counsellors).
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-sm text-muted-foreground">Loading report settings…</div>
                ) : (
                    <div className="flex flex-col gap-5">
                        {/* Timezone */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="report-timezone">Report timezone</Label>
                            <p className="text-xs text-muted-foreground">
                                All daily and hourly report bucketing uses this timezone.
                            </p>
                            <Select
                                value={timezone}
                                onValueChange={(v) => {
                                    setTimezone(v);
                                    setHasChanges(true);
                                }}
                            >
                                <SelectTrigger id="report-timezone" className="w-full max-w-sm">
                                    <SelectValue placeholder="Select timezone" />
                                </SelectTrigger>
                                <SelectContent>
                                    {REPORT_TIMEZONES.map((tz) => (
                                        <SelectItem key={tz} value={tz}>
                                            {tz}
                                        </SelectItem>
                                    ))}
                                    {/* Keep a previously saved non-curated zone selectable. */}
                                    {!(REPORT_TIMEZONES as readonly string[]).includes(
                                        timezone
                                    ) && <SelectItem value={timezone}>{timezone}</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Connected call statuses */}
                        <div className="flex flex-col gap-1.5">
                            <Label>Connected call statuses</Label>
                            <p className="text-xs text-muted-foreground">
                                Call outcomes that count as a connected call in connect-rate and
                                source reports. Default: Completed.
                            </p>
                            <MultiSelect
                                options={CALL_STATUS_OPTIONS}
                                selected={connectedStatuses}
                                onChange={(v) => {
                                    setConnectedStatuses(v);
                                    setHasChanges(true);
                                }}
                                placeholder="Select call statuses"
                                className="max-w-sm"
                            />
                        </div>

                        {/* Interested statuses */}
                        <div className="flex flex-col gap-1.5">
                            <Label>Interested statuses</Label>
                            <p className="text-xs text-muted-foreground">
                                Lead statuses that count as &quot;interested&quot; in source and
                                funnel reports. Default: Interested.
                            </p>
                            <MultiSelect
                                options={statusOptions}
                                selected={interestedKeys}
                                onChange={(v) => {
                                    setInterestedKeys(v);
                                    setHasChanges(true);
                                }}
                                placeholder={
                                    statusesLoading ? 'Loading statuses…' : 'Select lead statuses'
                                }
                                disabled={statusesLoading}
                                className="max-w-sm"
                            />
                        </div>

                        <div className="flex items-center justify-end">
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                onClick={handleSave}
                                disable={saving || !hasChanges}
                            >
                                {saving ? 'Saving…' : 'Save report settings'}
                            </MyButton>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
