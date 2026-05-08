/**
 * AudienceAccessCard — per-role configuration of audience-list access.
 *
 * Three modes:
 *  1. DEFAULT        — role sees every lead and every campaign (the default).
 *  2. COUNSELOR      — Recent Leads + Lead List rows are auto-scoped to leads
 *                      where the user is the linked counselor. Campaign cards
 *                      page is unaffected (still sees all campaigns).
 *  3. AUDIENCE_LIST  — role only sees the explicitly granted audience lists,
 *                      and only those lists' responses on Recent Leads.
 *
 * Persists into the institute setting key
 * {@code ROLE_DISPLAY_SETTINGS.audienceRoleAccess}, read on the backend by
 * {@code AudienceRoleAccessService}. ADMIN users always behave as DEFAULT
 * regardless of this config.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { handleFetchCampaignsList } from '@/routes/audience-manager/list/-services/get-campaigns-list';
import {
    useAudienceRoleAccess,
    type AudienceAccessMode,
    type RoleAccessConfig,
} from '@/hooks/use-audience-role-access';

interface AudienceAccessCardProps {
    /** Uppercase role name as stored in JWT authorities, e.g. "ADMIN", "TEACHER", "COUNSELOR". */
    roleName: string;
    /** Optional friendlier label shown in the card heading. Defaults to roleName. */
    roleLabel?: string;
}

const MODE_OPTIONS: Array<{
    value: AudienceAccessMode;
    title: string;
    description: string;
}> = [
    {
        value: 'DEFAULT',
        title: 'Default — see everything',
        description:
            'All audience lists and responses are visible. This is the default for any role.',
    },
    {
        value: 'COUNSELOR',
        title: 'Only leads assigned to me',
        description:
            'Recent Leads and per-campaign Lead List only show responses where this user is the linked counselor. The list of audience-list cards is unaffected.',
    },
    {
        value: 'AUDIENCE_LIST',
        title: 'Specific audience lists',
        description:
            'Restrict this role to specific audience lists. Recent Leads only includes responses from those lists; the audience-list cards page only shows the granted lists.',
    },
];

export const AudienceAccessCard = ({ roleName, roleLabel }: AudienceAccessCardProps) => {
    const normalizedRole = roleName.toUpperCase();
    const { config, isLoading, saving, save } = useAudienceRoleAccess();
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id ?? '';

    // Local form state, hydrated from the saved setting on first load and
    // whenever the saved config changes. Keeping it local lets the user toggle
    // multiple checkboxes before clicking Save.
    const [mode, setMode] = useState<AudienceAccessMode>('DEFAULT');
    const [selectedAudienceIds, setSelectedAudienceIds] = useState<string[]>([]);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        const existing: RoleAccessConfig | undefined = config.roles?.[normalizedRole];
        setMode(existing?.mode ?? 'DEFAULT');
        setSelectedAudienceIds(existing?.audience_ids ?? []);
        setDirty(false);
    }, [config, normalizedRole]);

    // Audience lists for the multi-select. Generous size so even institutes
    // with many campaigns see them all.
    const audiencesQuery = useQuery(
        handleFetchCampaignsList({
            institute_id: instituteId,
            page: 0,
            size: 200,
        })
    );

    const audienceOptions = useMemo(
        () =>
            (audiencesQuery.data?.content ?? [])
                .map((c) => ({
                    id: c.id || c.campaign_id || c.audience_id || '',
                    name: c.campaign_name || 'Untitled audience',
                }))
                .filter((opt) => opt.id !== ''),
        [audiencesQuery.data]
    );

    const handleModeChange = (value: string) => {
        setMode(value as AudienceAccessMode);
        setDirty(true);
        // Reset selection when switching out of AUDIENCE_LIST so we don't
        // silently persist stale ids.
        if (value !== 'AUDIENCE_LIST') {
            setSelectedAudienceIds([]);
        }
    };

    const toggleAudience = (id: string, checked: boolean) => {
        setSelectedAudienceIds((prev) => {
            const set = new Set(prev);
            if (checked) set.add(id);
            else set.delete(id);
            return Array.from(set);
        });
        setDirty(true);
    };

    const onSave = async () => {
        // Build the next config: merge the role's new entry into the existing
        // map. Keep DEFAULT roles persisted (don't drop them) so when the user
        // re-opens the card they still see "Default" selected — otherwise
        // dropping the entry leaves no record that the admin explicitly set
        // it, and on next render the stored blob would be empty.
        const nextRoles = { ...(config.roles ?? {}) };
        if (mode === 'DEFAULT') {
            nextRoles[normalizedRole] = { mode: 'DEFAULT' };
        } else if (mode === 'COUNSELOR') {
            nextRoles[normalizedRole] = { mode: 'COUNSELOR' };
        } else {
            nextRoles[normalizedRole] = {
                mode: 'AUDIENCE_LIST',
                audience_ids: selectedAudienceIds,
            };
        }
        try {
            await save({ roles: nextRoles });
            toast.success(`Audience access saved for ${roleLabel ?? normalizedRole}`);
            setDirty(false);
        } catch (err) {
            console.error('Failed to save audience access', err);
            toast.error('Failed to save audience access');
        }
    };

    const showAudienceMultiSelect = mode === 'AUDIENCE_LIST';
    const audienceListEmpty =
        showAudienceMultiSelect &&
        !audiencesQuery.isLoading &&
        audienceOptions.length === 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">
                    Audience access — {roleLabel ?? normalizedRole}
                </CardTitle>
                <CardDescription>
                    Controls which audience lists and responses a user with the{' '}
                    <span className="font-medium">{normalizedRole}</span> role can see across the
                    Recent Leads page, the per-campaign Lead List, and the audience-list cards.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <RadioGroup
                    value={mode}
                    onValueChange={handleModeChange}
                    className="flex flex-col gap-3"
                    aria-label="Audience access mode"
                >
                    {MODE_OPTIONS.map((opt) => (
                        <label
                            key={opt.value}
                            htmlFor={`audience-access-${normalizedRole}-${opt.value}`}
                            className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 p-3 hover:border-primary-200"
                        >
                            <RadioGroupItem
                                id={`audience-access-${normalizedRole}-${opt.value}`}
                                value={opt.value}
                                className="mt-0.5"
                            />
                            <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium text-neutral-900">
                                    {opt.title}
                                </span>
                                <span className="text-xs text-neutral-600">
                                    {opt.description}
                                </span>
                            </div>
                        </label>
                    ))}
                </RadioGroup>

                {showAudienceMultiSelect && (
                    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50/40 p-3">
                        <Label className="text-sm font-medium text-neutral-800">
                            Granted audience lists
                        </Label>
                        {audiencesQuery.isLoading ? (
                            <p className="text-xs text-neutral-500">Loading audience lists…</p>
                        ) : audienceListEmpty ? (
                            <p className="text-xs text-neutral-500">
                                No audience lists exist yet. Create one first under Leads → Lead
                                List.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {audienceOptions.map((opt) => {
                                    const checked = selectedAudienceIds.includes(opt.id);
                                    return (
                                        <label
                                            key={opt.id}
                                            className="flex cursor-pointer items-center gap-2 rounded-md bg-white px-2 py-1.5 hover:bg-neutral-50"
                                        >
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={(v) =>
                                                    toggleAudience(opt.id, v === true)
                                                }
                                                aria-label={opt.name}
                                            />
                                            <span className="text-sm text-neutral-800">
                                                {opt.name}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                        {showAudienceMultiSelect && selectedAudienceIds.length === 0 && (
                            <p className="text-xs text-warning-600">
                                Saving with zero lists selected will hide all leads from this
                                role.
                            </p>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-end gap-2">
                    <span className="text-xs text-neutral-500">
                        {isLoading ? 'Loading current setting…' : ''}
                    </span>
                    <Button
                        size="sm"
                        onClick={onSave}
                        disabled={!dirty || saving || isLoading}
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default AudienceAccessCard;
