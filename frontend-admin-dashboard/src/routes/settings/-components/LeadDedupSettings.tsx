/**
 * LeadDedupSettings — the "Deduplication" config card on Settings → Lead
 * settings → Configuration. Controls what happens when a new lead submission
 * matches one that already exists:
 *
 *   1. Enabled     → turn duplicate detection on/off (off preserves prior behaviour)
 *   2. Field       → match by email or phone number
 *   3. Scope       → this lead list, a hand-picked set of lead lists, or every
 *                    lead list in the institute
 *   4. Action      → reject the submission, or allow it through and reassign
 *   5. Repeat lead handling (only when action = allow & reassign):
 *      - Counsellor: none / same as previous / a specific counsellor / round-robin
 *      - Status: keep their current status, or reset to New
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
import { Fingerprint, X } from '@phosphor-icons/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { useCampaignsList } from '@/routes/audience-manager/list/-hooks/useCampaignsList';
import { useUserAutosuggestDebounced, USER_ROLES } from '@/services/user-autosuggest';
import {
    LEAD_DEDUP_SETTINGS_QUERY_KEY,
    fetchLeadDedupSettings,
    type LeadDedupAction,
    type LeadDedupField,
    type LeadDedupScope,
    type LeadDedupSettings as LeadDedupSettingsValues,
    type LeadDedupSettingsSubtree,
    type RepeatLeadCounsellorMode,
    type RepeatLeadSettings,
    type RepeatLeadStatusMode,
    REPEAT_LEAD_SETTINGS_DEFAULTS,
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
        audienceIds: next.scope === 'SELECTED' ? next.audienceIds : [],
        action: next.action,
        repeatLead: next.action === 'ALLOW_REASSIGN' ? next.repeatLead : REPEAT_LEAD_SETTINGS_DEFAULTS,
    };
    const merged = { ...current, dedup };
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Lead Settings', setting_data: merged },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
}

/** Single-counsellor search picker — mirrors the autosuggest pattern in
 * routes/settings/-components/School/Counsellor.tsx, simplified to one pick. */
function CounsellorPicker({
    counsellorId,
    counsellorName,
    onChange,
}: {
    counsellorId: string | null;
    counsellorName: string | null;
    onChange: (id: string | null, name: string | null) => void;
}) {
    const [query, setQuery] = useState('');
    const { data: suggestions, isLoading } = useUserAutosuggestDebounced(
        query,
        [USER_ROLES.ADMIN, USER_ROLES.COUNSELLOR],
        300
    );

    if (counsellorId) {
        return (
            <div className="flex max-w-sm items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span className="text-sm">{counsellorName || counsellorId}</span>
                <button
                    type="button"
                    onClick={() => onChange(null, null)}
                    className="text-neutral-400 hover:text-neutral-600"
                    aria-label="Clear selected counsellor"
                >
                    <X size={14} />
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-sm">
            <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search counsellors…"
            />
            {isLoading && <p className="mt-1 text-xs text-muted-foreground">Searching…</p>}
            {suggestions && suggestions.length > 0 && query && (
                <div className="mt-1 max-h-48 overflow-y-auto rounded-md border">
                    {suggestions.map((user) => (
                        <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                                onChange(user.id, user.full_name);
                                setQuery('');
                            }}
                            className="w-full border-b p-2 text-left text-sm transition-colors last:border-0 hover:bg-neutral-50"
                        >
                            <div className="font-medium">{user.full_name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function LeadDedupSettings() {
    const queryClient = useQueryClient();
    const instituteId = getCurrentInstituteId() ?? '';

    const { data: saved, isLoading } = useQuery({
        queryKey: LEAD_DEDUP_SETTINGS_QUERY_KEY,
        queryFn: fetchLeadDedupSettings,
        staleTime: 5 * 60 * 1000,
    });

    // All lead lists in the institute, for the "specific lead lists" multi-select
    // and for detecting a full selection (→ auto-switch to institute-wide).
    const { data: campaignsPage, isLoading: campaignsLoading } = useCampaignsList({
        institute_id: instituteId,
        page: 0,
        size: 200,
    });
    const audienceOptions: OptionType[] = (campaignsPage?.content ?? []).map((c) => ({
        // AudienceDTO's actual id field is `id` (== Audience.id, the FK
        // audience_response.audience_id points at); campaign_id/audience_id are
        // defensive aliases in case a different serializer shape shows up.
        value: c.id ?? c.audience_id ?? c.campaign_id ?? '',
        label: c.campaign_name,
    }));

    const [enabled, setEnabled] = useState(false);
    const [field, setField] = useState<LeadDedupField>('EMAIL');
    const [scope, setScope] = useState<LeadDedupScope>('CAMPAIGN');
    const [audienceIds, setAudienceIds] = useState<string[]>([]);
    const [action, setAction] = useState<LeadDedupAction>('REJECT');
    const [repeatLead, setRepeatLead] = useState<RepeatLeadSettings>(REPEAT_LEAD_SETTINGS_DEFAULTS);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (saved) {
            setEnabled(saved.enabled);
            setField(saved.field);
            setScope(saved.scope);
            setAudienceIds(saved.audienceIds);
            setAction(saved.action);
            setRepeatLead(saved.repeatLead);
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
        if (scope === 'SELECTED' && audienceIds.length === 0) {
            toast.error('Pick at least one lead list, or choose a different scope');
            return;
        }
        if (action === 'ALLOW_REASSIGN' && repeatLead.counsellorMode === 'SPECIFIC' && !repeatLead.specificCounsellorId) {
            toast.error('Pick a counsellor, or choose a different repeat-lead counsellor option');
            return;
        }
        save({ enabled, field, scope, audienceIds, action, repeatLead });
    };

    // Picking every currently-available lead list is equivalent to "the whole
    // institute" and stays correct as new lead lists get created later, so
    // collapse it to the INSTITUTE scope instead of storing a static id list.
    const handleAudienceSelectionChange = (ids: string[]) => {
        if (audienceOptions.length > 0 && ids.length === audienceOptions.length) {
            setScope('INSTITUTE');
            setAudienceIds([]);
        } else {
            setAudienceIds(ids);
        }
        setHasChanges(true);
    };

    const updateRepeatLead = (patch: Partial<RepeatLeadSettings>) => {
        setRepeatLead((prev) => ({ ...prev, ...patch }));
        setHasChanges(true);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Fingerprint size={18} className="text-neutral-500" />
                    Deduplication
                </CardTitle>
                <CardDescription>
                    Control what happens when a new lead submission matches one that already
                    exists. Off by default — turning this on does not affect leads already
                    captured.
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
                                        Check only the lead list being submitted to, a specific set
                                        of lead lists, or every lead list in the institute.
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
                                            <SelectItem value="SELECTED">Specific lead lists</SelectItem>
                                            <SelectItem value="INSTITUTE">
                                                All lead lists in this institute
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {scope === 'SELECTED' && (
                                    <div className="flex flex-col gap-1.5">
                                        <Label>Lead lists</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Duplicates are checked across only the lead lists picked
                                            here. Selecting all of them switches this to
                                            institute-wide automatically.
                                        </p>
                                        <MultiSelect
                                            options={audienceOptions}
                                            selected={audienceIds}
                                            onChange={handleAudienceSelectionChange}
                                            placeholder={
                                                campaignsLoading
                                                    ? 'Loading lead lists…'
                                                    : 'Select lead lists'
                                            }
                                            disabled={campaignsLoading}
                                            className="max-w-sm"
                                        />
                                    </div>
                                )}

                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="dedup-action">When a duplicate is found</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Block the submission, or let it through and apply the
                                        repeat-lead rules below.
                                    </p>
                                    <Select
                                        value={action}
                                        onValueChange={(v) => {
                                            setAction(v as LeadDedupAction);
                                            setHasChanges(true);
                                        }}
                                    >
                                        <SelectTrigger id="dedup-action" className="w-full max-w-sm">
                                            <SelectValue placeholder="Select action" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="REJECT">Reject the submission</SelectItem>
                                            <SelectItem value="ALLOW_REASSIGN">
                                                Allow it through and reassign
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {action === 'ALLOW_REASSIGN' && (
                                    <div className="flex flex-col gap-4 rounded-md border p-4">
                                        <p className="text-sm font-medium">Repeat lead handling</p>

                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="repeat-counsellor-mode">
                                                Assign a counsellor?
                                            </Label>
                                            <Select
                                                value={repeatLead.counsellorMode}
                                                onValueChange={(v) =>
                                                    updateRepeatLead({
                                                        counsellorMode: v as RepeatLeadCounsellorMode,
                                                    })
                                                }
                                            >
                                                <SelectTrigger
                                                    id="repeat-counsellor-mode"
                                                    className="w-full max-w-sm"
                                                >
                                                    <SelectValue placeholder="Select" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NONE">Don&apos;t assign one</SelectItem>
                                                    <SelectItem value="SAME_AS_PREVIOUS">
                                                        Keep their previous counsellor
                                                    </SelectItem>
                                                    <SelectItem value="SPECIFIC">
                                                        Always assign a specific counsellor
                                                    </SelectItem>
                                                    <SelectItem value="ROUND_ROBIN">
                                                        Use round-robin, same as new leads
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {repeatLead.counsellorMode === 'SPECIFIC' && (
                                            <div className="flex flex-col gap-1.5">
                                                <Label>Counsellor</Label>
                                                <CounsellorPicker
                                                    counsellorId={repeatLead.specificCounsellorId}
                                                    counsellorName={repeatLead.specificCounsellorName}
                                                    onChange={(id, name) =>
                                                        updateRepeatLead({
                                                            specificCounsellorId: id,
                                                            specificCounsellorName: name,
                                                        })
                                                    }
                                                />
                                            </div>
                                        )}

                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="repeat-status-mode">Lead status</Label>
                                            <Select
                                                value={repeatLead.statusMode}
                                                onValueChange={(v) =>
                                                    updateRepeatLead({
                                                        statusMode: v as RepeatLeadStatusMode,
                                                    })
                                                }
                                            >
                                                <SelectTrigger
                                                    id="repeat-status-mode"
                                                    className="w-full max-w-sm"
                                                >
                                                    <SelectValue placeholder="Select" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="KEEP_EXISTING">
                                                        Keep their current status
                                                    </SelectItem>
                                                    <SelectItem value="RESET_TO_NEW">
                                                        Reset to New
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}
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
