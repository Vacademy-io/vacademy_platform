/**
 * Manage which campaigns (audiences) belong to this pool.
 * Lists currently-attached campaigns and lets admin attach more from the
 * institute's full campaign list. Backend enforces "one campaign per pool".
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MyButton } from '@/components/design-system/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    handleFetchCampaignsList,
    type CampaignItem,
} from '@/routes/audience-manager/list/-services/get-campaigns-list';
import {
    CounselorPoolDTO,
    useAddAudienceToPool,
    useRemoveAudienceFromPool,
} from '@/services/counselor-pool';

interface AudiencesTabProps {
    pool: CounselorPoolDTO;
}

export default function AudiencesTab({ pool }: AudiencesTabProps) {
    const [pendingAudienceId, setPendingAudienceId] = useState<string>('');

    // Reuse the existing campaign-list service from audience-manager. Pull a wide page
    // (size 500) so we get every campaign in the institute regardless of pagination.
    const instituteId = getCurrentInstituteId() ?? '';
    const campaignsQuery = handleFetchCampaignsList({
        institute_id: instituteId,
        page: 0,
        size: 500,
    });
    const { data: campaignsPage, isLoading } = useQuery(campaignsQuery);
    const allCampaigns: CampaignItem[] = campaignsPage?.content ?? [];

    const { mutate: addAudience, isPending: adding } = useAddAudienceToPool(pool.id);
    const { mutate: removeAudience, isPending: removing } = useRemoveAudienceFromPool(pool.id);

    const attachedIds = useMemo(
        () => new Set((pool.audiences ?? []).map((a) => a.audience_id)),
        [pool.audiences]
    );

    const attached = useMemo(
        () =>
            (pool.audiences ?? []).map((a) => ({
                audienceId: a.audience_id,
                campaignName:
                    allCampaigns.find((c) => c.id === a.audience_id)?.campaign_name ??
                    `(unknown — ${a.audience_id.slice(0, 8)}…)`,
                lastAssignedCounselorId: a.last_assigned_counselor_id,
                lastAssignedAt: a.last_assigned_at,
            })),
        [pool.audiences, allCampaigns]
    );

    const available = useMemo(
        () => allCampaigns.filter((c) => c.id && !attachedIds.has(c.id)),
        [allCampaigns, attachedIds]
    );

    const handleAdd = () => {
        if (!pendingAudienceId) return;
        addAudience(pendingAudienceId, {
            onSuccess: () => {
                toast.success('Campaign attached to pool');
                setPendingAudienceId('');
            },
            onError: (err) => toast.error(extractError(err) ?? 'Failed to attach campaign'),
        });
    };

    const handleRemove = (audienceId: string, campaignName: string) => {
        if (!window.confirm(`Remove "${campaignName}" from this pool?`)) return;
        removeAudience(audienceId, {
            onSuccess: () => toast.success('Campaign detached'),
            onError: (err) => toast.error(extractError(err) ?? 'Failed to detach campaign'),
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Add Campaign</CardTitle>
                    <CardDescription>
                        Attach a campaign to this pool. Leads submitted to that campaign will be
                        auto-routed using this pool's settings.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                        <Select value={pendingAudienceId} onValueChange={setPendingAudienceId}>
                            <SelectTrigger className="w-full max-w-md">
                                <SelectValue
                                    placeholder={
                                        isLoading
                                            ? 'Loading campaigns…'
                                            : available.length === 0
                                              ? 'No unattached campaigns available'
                                              : 'Select a campaign'
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {available.map((c) => (
                                    <SelectItem key={c.id} value={c.id!}>
                                        {c.campaign_name}
                                        <span className="ml-2 text-xs text-muted-foreground">
                                            ({c.status})
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <MyButton
                            buttonType="primary"
                            scale="small"
                            onClick={handleAdd}
                            disable={!pendingAudienceId || adding}
                        >
                            {adding ? 'Adding…' : 'Add'}
                        </MyButton>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        A campaign already in another pool will be rejected — remove it from there
                        first.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Attached Campaigns ({attached.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {attached.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No campaigns attached yet.
                        </p>
                    ) : (
                        <ul className="divide-y">
                            {attached.map((a) => (
                                <li
                                    key={a.audienceId}
                                    className="flex items-center justify-between py-3"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium">{a.campaignName}</p>
                                        {a.lastAssignedAt && (
                                            <p className="text-xs text-muted-foreground">
                                                Last assigned:{' '}
                                                {new Date(a.lastAssignedAt).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                                        disabled={removing}
                                        onClick={() => handleRemove(a.audienceId, a.campaignName)}
                                    >
                                        Remove
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function extractError(err: unknown): string | undefined {
    return (
        (err as { response?: { data?: { ex?: string; message?: string } } })?.response?.data?.ex ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    );
}
