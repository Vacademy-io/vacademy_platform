import EmptyInvitePage from '@/assets/svgs/empty-invite-page.svg';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyPagination } from '@/components/design-system/pagination';
import { usePaginationState } from '@/hooks/pagination';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useEffect } from 'react';
import { CreateCampaignDialog } from '../create-campaign-dialog/CreateCampaignDialog';
import { getDateFromUTCString } from '@/constants/helper';
import { Search, Plus, UserPlus, Code, Code2 } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiIntegrationDialog } from '../api-integration-dialog/ApiIntegrationDialog';
import { EmbedCodeDialog } from '../embed-code-dialog/EmbedCodeDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
                <p className="text-xl font-semibold md:text-h3">Campaign List</p>

                <Button
                    onClick={() => {
                        setCampaignBeingEdited(null);
                        setIsDialogOpen(true);
                    }}
                    className="w-full sm:w-auto"
                >
                    <Plus className="mr-2 size-4" /> Add Campaign
                </Button>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Search className="size-4 text-neutral-500" />
                    </div>
                    <Input
                        type="text"
                        placeholder="Search Campaign"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-10 w-full pl-10"
                        aria-label="Search Campaign"
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
                                        } as any,
                                    } as any);
                                };

                                const getStatusBadgeVariant = (status?: string) => {
                                    const s = status?.trim().toUpperCase();
                                    if (s === 'ACTIVE') return 'default'; // primary
                                    if (s === 'INACTIVE') return 'secondary';
                                    if (s === 'DRAFT') return 'outline';
                                    return 'outline';
                                };

                                return (
                                    <Card
                                        key={campaignId || index}
                                        className="cursor-pointer transition-all hover:border-primary-300 hover:shadow-md"
                                        onClick={handleCampaignClick}
                                    >
                                        <CardHeader className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="flex flex-col gap-2">
                                                <CardTitle className="text-xl font-semibold">
                                                    {campaign.campaign_name}
                                                </CardTitle>
                                                <div className="flex flex-wrap items-center gap-3 text-sm font-normal text-neutral-600">
                                                    <div className="flex items-center gap-2">
                                                        <span>Type:</span>
                                                        <Badge
                                                            variant="outline"
                                                            className="capitalize"
                                                        >
                                                            {campaign.campaign_type}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span>Status:</span>
                                                        <Badge
                                                            variant={getStatusBadgeVariant(
                                                                campaign.status
                                                            )}
                                                            className="capitalize"
                                                        >
                                                            {campaign.status?.toLowerCase()}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <AudienceCampaignCardMenuOptions
                                                    campaign={campaign}
                                                    onEdit={(selectedCampaign) => {
                                                        setCampaignBeingEdited(selectedCampaign);
                                                        setIsDialogOpen(true);
                                                    }}
                                                />
                                            </div>
                                        </CardHeader>
                                        <CardContent className="px-6 pb-2">
                                            <div className="mb-4 flex flex-col gap-2 text-sm text-neutral-600 sm:flex-row sm:items-center sm:gap-12">
                                                <p>
                                                    <span className="font-medium text-neutral-900">
                                                        Start Date:
                                                    </span>{' '}
                                                    {getDateFromUTCString(
                                                        campaign.start_date_local
                                                    )}
                                                </p>
                                                <p>
                                                    <span className="font-medium text-neutral-900">
                                                        End Date:
                                                    </span>{' '}
                                                    {getDateFromUTCString(campaign.end_date_local)}
                                                </p>
                                            </div>
                                            {campaign.description && (
                                                <div className="mb-2 text-sm text-neutral-600">
                                                    <p className="mb-1 font-semibold text-neutral-900">
                                                        Description:
                                                    </p>
                                                    <p className="line-clamp-2">
                                                        {campaign.description}
                                                    </p>
                                                </div>
                                            )}
                                            {campaign.campaign_objective && (
                                                <div className="text-sm text-neutral-600">
                                                    <p>
                                                        Objective:{' '}
                                                        <span className="font-semibold text-neutral-900">
                                                            {campaign.campaign_objective}
                                                        </span>
                                                    </p>
                                                </div>
                                            )}
                                        </CardContent>
                                        <CardFooter
                                            className="px-6 pb-6 pt-2"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {normalizedStatus === 'ACTIVE' ? (
                                                <CampaignLink
                                                    campaignId={campaignId}
                                                    label="Shareable link"
                                                />
                                            ) : (
                                                <div className="flex flex-col gap-2">
                                                    <span className="text-sm font-semibold text-neutral-700">
                                                        Shareable link
                                                    </span>
                                                    <p className="text-sm text-neutral-600">
                                                        You need to set campaign status to Active
                                                    </p>
                                                </div>
                                            )}
                                        </CardFooter>
                                        {/* Action Buttons Row */}
                                        <div
                                            className="flex flex-wrap items-center gap-2 border-t px-6 py-4"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
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
                                                            <UserPlus className="mr-2 size-4" />
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
                                                            onClick={() =>
                                                                setApiDialogCampaign(campaign)
                                                            }
                                                        >
                                                            <Code className="mr-2 size-4" />
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
                                                            onClick={() =>
                                                                setEmbedDialogCampaign(campaign)
                                                            }
                                                        >
                                                            <Code2 className="mr-2 size-4" />
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
