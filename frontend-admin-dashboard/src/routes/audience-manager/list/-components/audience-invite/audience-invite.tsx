import EmptyInvitePage from '@/assets/svgs/empty-invite-page.svg';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyPagination } from '@/components/design-system/pagination';
import { usePaginationState } from '@/hooks/pagination';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useEffect } from 'react';
import { CreateCampaignDialog } from '../create-campaign-dialog/CreateCampaignDialog';
import { getDateFromUTCString } from '@/constants/helper';
import { Search, Plus, UserPlus, Code, Code2, Calendar, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useCampaignsList } from '../../-hooks/useCampaignsList';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { CampaignItem } from '../../-services/get-campaigns-list';
import { AudienceCampaignCardMenuOptions } from './audience-campaign-card-menu-options';
import CampaignLink from '../create-campaign-dialog/CampaignLink';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiIntegrationDialog } from '../api-integration-dialog/ApiIntegrationDialog';
import { EmbedCodeDialog } from '../embed-code-dialog/EmbedCodeDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getTerminology, getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'DRAFT';

const SERVER_FETCH_SIZE = 200;

export const AudienceInvite = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [campaignBeingEdited, setCampaignBeingEdited] = useState<CampaignItem | null>(null);
    const [apiDialogCampaign, setApiDialogCampaign] = useState<CampaignItem | null>(null);
    const [embedDialogCampaign, setEmbedDialogCampaign] = useState<CampaignItem | null>(null);
    const { instituteDetails } = useInstituteDetailsStore();
    const navigate = useNavigate();

    const { page, pageSize, handlePageChange } = usePaginationState({
        initialPage: 0,
        initialPageSize: 5,
    });

    // Reset to page 0 when filter or search changes
    useEffect(() => {
        if (page !== 0) {
            handlePageChange(0);
        }
        // we intentionally skip `page` in deps so this only runs when filters change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handlePageChange, searchQuery, statusFilter]);

    const statusDropdownOptions = [
        { label: 'All Status', value: 'ALL' },
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Inactive', value: 'INACTIVE' },
        { label: 'Draft', value: 'DRAFT' },
    ];

    const getStatusDisplayText = (status: string) => {
        const statusMap: Record<string, string> = {
            ALL: 'All Status',
            ACTIVE: 'Active',
            INACTIVE: 'Inactive',
            DRAFT: 'Draft',
        };
        return statusMap[status.toUpperCase()] || status;
    };

    const campaignsPayload = useMemo(
        () => ({
            institute_id: instituteDetails?.id || '',
            page: 0,
            size: SERVER_FETCH_SIZE,
            campaign_name: searchQuery || undefined,
            status: statusFilter !== 'ALL' ? statusFilter : undefined,
            sort_by: 'created_at',
            sort_direction: 'DESC',
        }),
        [instituteDetails?.id, searchQuery, statusFilter]
    );

    const { data: campaignsList, isLoading, isError } = useCampaignsList(campaignsPayload);

    // Filter campaigns to only show ACTIVE, INACTIVE, or DRAFT status
    const filteredCampaigns = useMemo(() => {
        if (!campaignsList?.content) return [];
        return campaignsList.content.filter((campaign: CampaignItem) => {
            const normalizedStatus = campaign.status?.trim().toUpperCase();
            return ['ACTIVE', 'INACTIVE', 'DRAFT'].includes(normalizedStatus);
        });
    }, [campaignsList?.content]);

    const totalFilteredPages = useMemo(() => {
        if (!filteredCampaigns.length) return 1;
        return Math.max(1, Math.ceil(filteredCampaigns.length / pageSize));
    }, [filteredCampaigns.length, pageSize]);

    // Clamp page if current page exceeds total pages after filtering
    useEffect(() => {
        if (page > 0 && page >= totalFilteredPages) {
            handlePageChange(Math.max(totalFilteredPages - 1, 0));
        }
    }, [handlePageChange, page, totalFilteredPages]);

    const paginatedCampaigns = useMemo(() => {
        const startIndex = page * pageSize;
        return filteredCampaigns.slice(startIndex, startIndex + pageSize);
    }, [filteredCampaigns, page, pageSize]);

    // Update pagination info based on filtered (client-side paginated) results
    const displayCampaignsList = useMemo(() => {
        if (!campaignsList) return null;
        return {
            ...campaignsList,
            content: paginatedCampaigns,
            numberOfElements: paginatedCampaigns.length,
            totalElements: filteredCampaigns.length,
            totalPages: totalFilteredPages,
        };
    }, [campaignsList, filteredCampaigns.length, paginatedCampaigns, totalFilteredPages]);

    return (
        <div className="flex w-full flex-col gap-6 md:gap-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xl font-semibold md:text-h3">{`${getTerminology(OtherTerms.AudienceList, SystemTerms.AudienceList)} List`}</p>

                <Button
                    onClick={() => {
                        setCampaignBeingEdited(null);
                        setIsDialogOpen(true);
                    }}
                    className="w-full sm:w-auto"
                >
                    <Plus className="mr-2 size-4" /> {`Add ${getTerminology(OtherTerms.AudienceList, SystemTerms.AudienceList)}`}
                </Button>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Search className="size-4 text-neutral-500" />
                    </div>
                    <Input
                        type="text"
                        placeholder={`Search ${getTerminology(OtherTerms.AudienceList, SystemTerms.AudienceList)}`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-10 w-full pl-10"
                        aria-label={`Search ${getTerminology(OtherTerms.AudienceList, SystemTerms.AudienceList)}`}
                    />
                </div>
                <div className="w-full sm:w-[180px]">
                    <Select
                        value={statusFilter}
                        onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Filter by Status" />
                        </SelectTrigger>
                        <SelectContent>
                            {statusDropdownOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex w-full flex-col gap-10">
                {isError ? (
                    <p>Error fetching campaigns</p>
                ) : isLoading ? (
                    <DashboardLoader />
                ) : !displayCampaignsList?.content || displayCampaignsList.content.length === 0 ? (
                    <div className="flex h-[70vh] w-full flex-col items-center justify-center gap-2">
                        <EmptyInvitePage />
                        <p>
                            {statusFilter === 'ALL'
                                ? 'No campaigns found!'
                                : `No ${getStatusDisplayText(statusFilter).toLowerCase()} campaigns found!`}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {displayCampaignsList.content.map(
                            (campaign: CampaignItem, index: number) => {
                                // Calculate total users count from custom fields
                                // const totalUsersCount = campaign.institute_custom_fields?.length || 0;
                                const normalizedStatus = campaign.status?.trim().toUpperCase();
                                const campaignId =
                                    campaign.id ||
                                    campaign.campaign_id ||
                                    campaign.audience_id ||
                                    '';

                                const handleCampaignClick = () => {
                                    if (!campaignId) {
                                        toast.error(
                                            'Unable to open campaign details. Missing campaign identifier.'
                                        );
                                        return;
                                    }
                                    navigate({
                                        to: '/audience-manager/list/campaign-users' as any,
                                        search: {
                                            campaignId,
                                            campaignName: campaign.campaign_name,
                                            customFields: campaign.institute_custom_fields
                                                ? JSON.stringify(campaign.institute_custom_fields)
                                                : undefined,
                                            campaignType: campaign.campaign_type,
                                        } as any,
                                    } as any);
                                };

                                const statusStyles = (() => {
                                    const s = normalizedStatus;
                                    if (s === 'ACTIVE') {
                                        return {
                                            dot: 'bg-success-500',
                                            text: 'text-success-700',
                                            ring: 'ring-success-500/20',
                                        };
                                    }
                                    if (s === 'DRAFT') {
                                        return {
                                            dot: 'bg-warning-500',
                                            text: 'text-warning-700',
                                            ring: 'ring-warning-500/20',
                                        };
                                    }
                                    return {
                                        dot: 'bg-neutral-400',
                                        text: 'text-neutral-600',
                                        ring: 'ring-neutral-400/20',
                                    };
                                })();
                                const statusLabel =
                                    (campaign.status?.charAt(0).toUpperCase() ?? '') +
                                    (campaign.status?.slice(1).toLowerCase() ?? '');

                                return (
                                    <Card
                                        key={campaignId || index}
                                        className="group w-full min-w-0 cursor-pointer overflow-hidden rounded-xl border-neutral-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lg"
                                        onClick={handleCampaignClick}
                                    >
                                        <CardHeader className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-6 sm:pb-4">
                                            <div className="flex min-w-0 flex-col gap-2.5">
                                                <CardTitle className="break-words text-lg font-semibold leading-tight tracking-tight text-neutral-900 sm:text-xl">
                                                    {campaign.campaign_name}
                                                </CardTitle>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
                                                            statusStyles.text,
                                                            statusStyles.ring
                                                        )}
                                                    >
                                                        <span
                                                            className={cn(
                                                                'size-1.5 rounded-full',
                                                                statusStyles.dot
                                                            )}
                                                        />
                                                        {statusLabel}
                                                    </span>
                                                    <Badge
                                                        variant="secondary"
                                                        className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-600 hover:bg-neutral-100"
                                                    >
                                                        {campaign.campaign_type}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div
                                                className="shrink-0 self-end sm:self-start"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <AudienceCampaignCardMenuOptions
                                                    campaign={campaign}
                                                    onEdit={(selectedCampaign) => {
                                                        setCampaignBeingEdited(selectedCampaign);
                                                        setIsDialogOpen(true);
                                                    }}
                                                />
                                            </div>
                                        </CardHeader>
                                        <CardContent className="flex flex-col gap-4 px-4 pb-5 pt-0 sm:px-6">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600">
                                                <Calendar className="size-4 shrink-0 text-neutral-400" />
                                                <span className="font-medium text-neutral-800">
                                                    {getDateFromUTCString(
                                                        campaign.start_date_local
                                                    )}
                                                </span>
                                                <span className="text-neutral-400">→</span>
                                                <span className="font-medium text-neutral-800">
                                                    {getDateFromUTCString(campaign.end_date_local)}
                                                </span>
                                            </div>
                                            {campaign.description && (
                                                <p className="line-clamp-2 break-words text-sm leading-relaxed text-neutral-600">
                                                    {campaign.description}
                                                </p>
                                            )}
                                            {campaign.campaign_objective && (
                                                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                                                    <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                                        Objective
                                                    </span>
                                                    <span className="break-words font-medium text-neutral-800">
                                                        {campaign.campaign_objective}
                                                    </span>
                                                </div>
                                            )}
                                            <div
                                                className="w-full min-w-0 pt-1"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {normalizedStatus === 'ACTIVE' ? (
                                                    <CampaignLink
                                                        campaignId={campaignId}
                                                        label="Shareable link"
                                                    />
                                                ) : (
                                                    <div className="flex w-full min-w-0 flex-col gap-1.5">
                                                        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                                            Shareable link
                                                        </span>
                                                        <div className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 px-3 py-2.5 text-sm text-neutral-500">
                                                            <Info className="size-4 shrink-0 text-neutral-400" />
                                                            <span>
                                                                Activate this campaign to generate a
                                                                shareable link.
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                        {/* Action Buttons Row */}
                                        <div
                                            className="flex flex-wrap items-center gap-1.5 border-t border-neutral-100 bg-neutral-50/40 px-4 py-3 sm:px-6"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 gap-1.5 rounded-md border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 shadow-sm hover:border-primary-200 hover:bg-primary-50/40 hover:text-primary-700"
                                                            onClick={() => {
                                                                navigate({
                                                                    to: '/audience-manager/list/campaign-users/add' as any,
                                                                    search: {
                                                                        campaignId,
                                                                        campaignName:
                                                                            campaign.campaign_name,
                                                                        customFields:
                                                                            campaign.institute_custom_fields
                                                                                ? JSON.stringify(
                                                                                      campaign.institute_custom_fields
                                                                                  )
                                                                                : undefined,
                                                                    } as any,
                                                                } as any);
                                                            }}
                                                        >
                                                            <UserPlus className="size-3.5" />
                                                            Add Response
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>
                                                            Add a response on behalf of a respondent
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 gap-1.5 rounded-md border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 shadow-sm hover:border-primary-200 hover:bg-primary-50/40 hover:text-primary-700"
                                                            onClick={() =>
                                                                setApiDialogCampaign(campaign)
                                                            }
                                                        >
                                                            <Code className="size-3.5" />
                                                            API
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>
                                                            Get API integration details for
                                                            automation
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 gap-1.5 rounded-md border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 shadow-sm hover:border-primary-200 hover:bg-primary-50/40 hover:text-primary-700"
                                                            onClick={() =>
                                                                setEmbedDialogCampaign(campaign)
                                                            }
                                                        >
                                                            <Code2 className="size-3.5" />
                                                            Embed
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Get embed code for your website</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </Card>
                                );
                            }
                        )}
                        <MyPagination
                            currentPage={page}
                            totalPages={displayCampaignsList?.totalPages || 0}
                            onPageChange={handlePageChange}
                        />
                    </div>
                )}
            </div>
            <CreateCampaignDialog
                isOpen={isDialogOpen}
                onClose={() => {
                    setIsDialogOpen(false);
                    setCampaignBeingEdited(null);
                }}
                campaign={campaignBeingEdited}
            />
            {apiDialogCampaign && (
                <ApiIntegrationDialog
                    isOpen={!!apiDialogCampaign}
                    onClose={() => setApiDialogCampaign(null)}
                    campaign={apiDialogCampaign}
                />
            )}
            {embedDialogCampaign && (
                <EmbedCodeDialog
                    isOpen={!!embedDialogCampaign}
                    onClose={() => setEmbedDialogCampaign(null)}
                    campaign={embedDialogCampaign}
                />
            )}
        </div>
    );
};
