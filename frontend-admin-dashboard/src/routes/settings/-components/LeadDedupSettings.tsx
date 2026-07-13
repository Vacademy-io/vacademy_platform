/**
 * LeadDedupSettings — the "Deduplication" config card on Settings → Lead
 * settings → Configuration. Controls whether a new lead submission is
 * rejected when a matching lead already exists:
 *
 *   1. Enabled     → turn duplicate rejection on/off (off preserves prior behaviour)
 *   2. Field       → match by email or phone number
 *   3. Scope       → within the same lead list, or across every lead list in the institute
 *
 * Persisted at LEAD_SETTING.data.dedup (snake_case-free, matches backend enum
 * casing directly). The save path READ-MODIFY-WRITES the whole LEAD_SETTING
 * data object — fetch current, merge only the dedup subtree, save — so
 * sibling keys (enabled, scoringWeights, reports, workbench, …) are never
 * clobbered.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Fingerprint } from '@phosphor-icons/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MyButton } from '@/components/design-system/button';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    LEAD_DEDUP_SETTINGS_QUERY_KEY,
    fetchLeadDedupSettings,
    type LeadDedupField,
    type LeadDedupScope,
    type LeadDedupSettings as LeadDedupSettingsValues,
    type LeadDedupSettingsSubtree,
} from '@/hooks/use-lead-dedup-settings';
import { fetchLeadSettingRawData } from '@/hooks/use-lead-report-settings';

const SETTING_KEY = 'LEAD_SETTING';
// Mirrors LeadSettings.tsx — the institute-settings save endpoint.
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');

async function saveDedupSettings(next: LeadDedupSettingsValues): Promise<void> {
    const instituteId = getCurrentInstituteId();
    // Read-modify-write: fetch the CURRENT full data object right before saving
    // so concurrent edits to sibling subtrees aren't clobbered.
    const current = await fetchLeadSettingRawData();
    const dedup: LeadDedupSettingsSubtree = {
        enabled: next.enabled,
        field: next.field,
        scope: next.scope,
    };
    const merged = { ...current, dedup };
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Lead Settings', setting_data: merged },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
}

export default function LeadDedupSettings() {
    const queryClient = useQueryClient();

    const { data: saved, isLoading } = useQuery({
        queryKey: LEAD_DEDUP_SETTINGS_QUERY_KEY,
        queryFn: fetchLeadDedupSettings,
        staleTime: 5 * 60 * 1000,
    });

    const [enabled, setEnabled] = useState(false);
    const [field, setField] = useState<LeadDedupField>('EMAIL');
    const [scope, setScope] = useState<LeadDedupScope>('CAMPAIGN');
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (saved) {
            setEnabled(saved.enabled);
            setField(saved.field);
            setScope(saved.scope);
            setHasChanges(false);
        }
    }, [saved]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: saveDedupSettings,
        onSuccess: () => {
            toast.success('Deduplication settings saved');
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: LEAD_DEDUP_SETTINGS_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: ['lead-settings-config'] });
            queryClient.invalidateQueries({ queryKey: ['lead-settings'] });
        },
        onError: () => {
            toast.error('Failed to save deduplication settings');
        },
    });

    const handleSave = () => {
        save({ enabled, field, scope });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Fingerprint size={18} className="text-neutral-500" />
                    Deduplication
                </CardTitle>
                <CardDescription>
                    Reject a new lead submission when a matching lead already exists. Off by
                    default — turning this on does not affect leads already captured.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-sm text-muted-foreground">
                        Loading deduplication settings…
                    </div>
                ) : (
                    <div className="flex flex-col gap-5">
                        <div className="flex items-center gap-3">
                            <Switch
                                id="dedup-enabled"
                                checked={enabled}
                                onCheckedChange={(v) => {
                                    setEnabled(v);
                                    setHasChanges(true);
                                }}
                            />
                            <Label htmlFor="dedup-enabled" className="cursor-pointer">
                                {enabled ? 'Enabled' : 'Disabled'}
                            </Label>
                        </div>

                        {enabled && (
                            <>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="dedup-field">Match leads by</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Which identifier counts as a duplicate.
                                    </p>
                                    <Select
                                        value={field}
                                        onValueChange={(v) => {
                                            setField(v as LeadDedupField);
                                            setHasChanges(true);
                                        }}
                                    >
                                        <SelectTrigger id="dedup-field" className="w-full max-w-sm">
                                            <SelectValue placeholder="Select field" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="EMAIL">Email address</SelectItem>
                                            <SelectItem value="PHONE">Phone number</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="dedup-scope">Applies to</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Check only the lead list being submitted to, or every lead
                                        list in the institute.
                                    </p>
                                    <Select
                                        value={scope}
                                        onValueChange={(v) => {
                                            setScope(v as LeadDedupScope);
                                            setHasChanges(true);
                                        }}
                                    >
                                        <SelectTrigger id="dedup-scope" className="w-full max-w-sm">
                                            <SelectValue placeholder="Select scope" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CAMPAIGN">This lead list only</SelectItem>
                                            <SelectItem value="INSTITUTE">
                                                All lead lists in this institute
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}

                        <div className="flex items-center justify-end">
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                onClick={handleSave}
                                disable={saving || !hasChanges}
                            >
                                {saving ? 'Saving…' : 'Save deduplication settings'}
                            </MyButton>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
