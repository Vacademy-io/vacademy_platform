import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Share,
    Users,
    Envelope,
    Phone,
    Calendar,
    CaretLeft,
    CaretRight,
    Download,
} from '@phosphor-icons/react';
import type { CampaignListResponse } from '@/types/challenge-analytics';
import { useReferralLeads } from '../-hooks/useAnalyticsData';
import { format } from 'date-fns';

interface ReferralTrackingProps {
    referralData: CampaignListResponse | undefined;
    organicData: CampaignListResponse | undefined;
    isLoading: boolean;
    startDate: string;
    endDate: string;
}

export function ReferralTracking({
    referralData,
    organicData,
    isLoading,
    startDate,
    endDate,
}: ReferralTrackingProps) {
    // Get REFERRAL type campaigns only for the leads
    const referralCampaigns = useMemo(() => {
        return referralData?.content?.filter((c) => c.campaign_type === 'REFERRAL') || [];
    }, [referralData]);

    // State for selected campaign and pagination
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
    const [page, setPage] = useState(0);
    const pageSize = 10;

    // Auto-select first referral campaign
    useMemo(() => {
        if (referralCampaigns.length > 0 && !selectedCampaignId) {
            setSelectedCampaignId(referralCampaigns[0]?.id || '');
        }
    }, [referralCampaigns, selectedCampaignId]);

    // Fetch leads for selected campaign
    const { data: leadsData, isLoading: leadsLoading } = useReferralLeads(
        selectedCampaignId,
        startDate,
        endDate,
        page,
        pageSize,
        !!selectedCampaignId
    );

    const selectedCampaign = referralCampaigns.find((c) => c.id === selectedCampaignId);

    // Calculate stats
    const referralUsers = referralCampaigns.reduce((sum, c) => sum + (c.total_users || 0), 0);
    const organicUsers = (organicData?.content || []).reduce(
        (sum, c) => sum + (c.total_users || 0),
        0
    );
    const totalUsers = referralUsers + organicUsers;
    const referralPercentage =
        totalUsers > 0 ? ((referralUsers / totalUsers) * 100).toFixed(1) : '0';

    const exportToCSV = () => {
        if (!leadsData?.content) return;

        const headers = ['Name', 'Email', 'Phone', 'Source', 'Submitted At'];
        const rows = leadsData.content.map((lead) => [
            lead.user?.full_name || 'N/A',
            lead.user?.email || 'N/A',
            lead.user?.mobile_number || 'N/A',
            lead.source_type || 'N/A',
            lead.submitted_at_local ? new Date(lead.submitted_at_local).toLocaleString() : 'N/A',
        ]);

        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `referral_leads_${selectedCampaign?.campaign_name || 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (isLoading) {
        return (
            <Card className="shadow-sm">
                <CardHeader>
                    <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] animate-pulse rounded bg-gray-100" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-emerald-100 p-2">
                            <Share className="size-5 text-emerald-600" weight="fill" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold">
                                Referral Leads
                            </CardTitle>
                            <p className="text-xs text-gray-500">
                                Leads acquired through referral campaigns
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <div className="rounded-lg bg-emerald-50 px-3 py-2">
                            <span className="text-xs text-gray-500">Referral Users</span>
                            <p className="font-bold text-emerald-700">
                                {referralUsers.toLocaleString()}
                            </p>
                        </div>
                        <div className="rounded-lg bg-blue-50 px-3 py-2">
                            <span className="text-xs text-gray-500">Referral Rate</span>
                            <p className="font-bold text-blue-700">{referralPercentage}%</p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* Campaign Selector */}
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700">Select Campaign:</span>
                        <Select
                            value={selectedCampaignId}
                            onValueChange={(val) => {
                                setSelectedCampaignId(val);
                                setPage(0);
                            }}
                        >
                            <SelectTrigger className="w-[250px]">
                                <SelectValue placeholder="Select a referral campaign" />
                            </SelectTrigger>
                            <SelectContent>
                                {referralCampaigns.map((campaign) => (
                                    <SelectItem key={campaign.id} value={campaign.id}>
                                        {campaign.campaign_name} ({campaign.total_users || 0} users)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {leadsData?.content && leadsData.content.length > 0 && (
                        <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
                            <Download className="size-4" />
                            Export CSV
                        </Button>
                    )}
                </div>

                {/* Leads Table */}
                {referralCampaigns.length === 0 ? (
                    <div className="flex h-[200px] items-center justify-center text-gray-500">
                        No referral campaigns found
                    </div>
                ) : leadsLoading ? (
                    <div className="flex h-[200px] items-center justify-center">
                        <div className="text-center">
                            <div className="border-primary mx-auto size-8 animate-spin rounded-full border-2 border-t-transparent"></div>
                            <p className="mt-2 text-sm text-gray-500">Loading leads...</p>
                        </div>
                    </div>
                ) : !leadsData?.content || leadsData.content.length === 0 ? (
                    <div className="flex h-[200px] items-center justify-center text-gray-500">
                        No leads found for the selected campaign and date range
                    </div>
                ) : (
                    <>
                        <div className="overflow-hidden rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium text-gray-700">
                                            #
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-700">
                                            User
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-700">
                                            Contact
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-700">
                                            Source
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-700">
                                            Submitted
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leadsData.content.map((lead, index) => (
                                        <tr
                                            key={lead.response_id}
                                            className="border-t hover:bg-gray-50"
                                        >
                                            <td className="px-4 py-3 text-gray-500">
                                                {page * pageSize + index + 1}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                                        <Users className="size-4" weight="fill" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-800">
                                                            {lead.user?.full_name || 'Anonymous'}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            ID: {lead.user_id?.substring(0, 8)}...
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="space-y-1">
                                                    {lead.user?.email && (
                                                        <div className="flex items-center gap-1 text-xs text-gray-600">
                                                            <Envelope className="size-3" />
                                                            <span className="max-w-[150px] truncate">
                                                                {lead.user.email}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {lead.user?.mobile_number && (
                                                        <div className="flex items-center gap-1 text-xs text-gray-600">
                                                            <Phone className="size-3" />
                                                            <span>{lead.user.mobile_number}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                                    {lead.source_type?.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                                    <Calendar className="size-3" />
                                                    <span>
                                                        {lead.submitted_at_local
                                                            ? format(
                                                                  new Date(lead.submitted_at_local),
                                                                  'MMM dd, yyyy HH:mm'
                                                              )
                                                            : 'N/A'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {leadsData.totalPages > 1 && (
                            <div className="mt-4 flex items-center justify-between">
                                <span className="text-sm text-gray-500">
                                    Showing {page * pageSize + 1} -{' '}
                                    {Math.min((page + 1) * pageSize, leadsData.totalElements)} of{' '}
                                    {leadsData.totalElements} leads
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(page - 1)}
                                        disabled={page === 0}
                                    >
                                        <CaretLeft className="size-4" />
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(page + 1)}
                                        disabled={leadsData.last}
                                    >
                                        Next
                                        <CaretRight className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
