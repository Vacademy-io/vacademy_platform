import EmptyInvitePage from '@/assets/svgs/empty-invite-page.svg';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { usePaginationState } from '@/hooks/pagination';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useEffect } from 'react';
import { CreateCampaignDialog } from '../create-campaign-dialog/CreateCampaignDialog';
import { getDateFromUTCString } from '@/constants/helper';
import {
    MagnifyingGlass,
    Plus,
    UserPlus,
    Code,
    CodeSimple,
    CalendarBlank,
    Info,
    Megaphone,
    Globe,
} from '@phosphor-icons/react';
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
import { Card } from '@/components/ui/card';
import { ApiIntegrationDialog } from '../api-integration-dialog/ApiIntegrationDialog';
import { EmbedCodeDialog } from '../embed-code-dialog/EmbedCodeDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LeadPagination } from '@/components/shared/leads';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'DRAFT';

const SERVER_FETCH_SIZE = 200;

// Reusable outline action button on each card (Add Response / API / Embed).
const CARD_ACTION_BTN =
    'h-8 gap-1.5 rounded-md border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 shadow-sm hover:border-primary-200 hover:bg-primary-50/40 hover:text-primary-700';

export const AudienceInvite = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [campaignBeingEdited, setCampaignBeingEdited] = useState<CampaignItem | null>(null);
    const [apiDialogCampaign, setApiDialogCampaign] = useState<CampaignItem | null>(null);
    const [embedDialogCampaign, setEmbedDialogCampaign] = useState<CampaignItem | null>(null);
    const { instituteDetails } = useInstituteDetailsStore();
    const navigate = useNavigate();

    const audienceTerm = getTerminology(OtherTerms.AudienceList, SystemTerms.AudienceList);
    const audienceTermPlural = getTerminologyPlural(
        OtherTerms.AudienceList,
        SystemTerms.AudienceList
    );

    const { page, pageSize, handlePageChange } = usePaginationState({
        initialPage: 0,
        initialPageSize: 6,
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

    // Status breakdown — drives the hero KPI tiles.
    const statusCounts = useMemo(() => {
        const acc = { active: 0, draft: 0, inactive: 0 };
        for (const c of filteredCampaigns) {
            const s = c.status?.trim().toUpperCase();
            if (s === 'ACTIVE') acc.active += 1;
            else if (s === 'DRAFT') acc.draft += 1;
            else acc.inactive += 1;
        }
        return acc;
    }, [filteredCampaigns]);

    const hasResults = paginatedCampaigns.length > 0;

    return (
        <div className="flex w-full flex-col gap-6">
            {/* Heading */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold leading-tight text-neutral-900">
                        {filteredCampaigns.length.toLocaleString()} {audienceTermPlural}
                    </h1>
                    <p className="mt-1 text-sm text-neutral-500">
                        Manage and share your {audienceTermPlural.toLowerCase()} across campaigns.
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setCampaignBeingEdited(null);
                        setIsDialogOpen(true);
                    }}
                    className="w-full shrink-0 sm:w-auto"
                >
                    <Plus className="mr-2 size-4" /> Add {audienceTerm}
                </Button>
            </div>

            {/* KPI tiles — status breakdown */}
            <div className="grid grid-cols-3 gap-3">
                {(
                    [
                        { label: 'Active', value: statusCounts.active, dot: 'bg-success-500' },
                        { label: 'Draft', value: statusCounts.draft, dot: 'bg-warning-500' },
                        {
                            label: 'Inactive',
                            value: statusCounts.inactive,
                            dot: 'bg-neutral-400',
                        },
                    ] as const
                ).map((kpi) => (
                    <div
                        key={kpi.label}
                        className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm"
                    >
                        <div className="flex items-center gap-2">
                            <span className={cn('size-1.5 rounded-full', kpi.dot)} />
                            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                {kpi.label}
                            </span>
                        </div>
                        <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
                            {kpi.value.toLocaleString()}
                        </p>
                    </div>
                ))}
            </div>

            {/* Toolbar — search + status filter */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                        type="text"
                        placeholder={`Search ${audienceTerm}`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-10 w-full pl-8"
                        aria-label={`Search ${audienceTerm}`}
                    />
                </div>
                <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                >
                    <SelectTrigger className="h-10 w-full sm:w-44">
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

            {/* Content */}
            {isError ? (
                <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-neutral-200 bg-white px-6 py-16 text-center">
                    <p className="text-sm font-medium text-neutral-700">
                        Couldn&apos;t load {audienceTermPlural.toLowerCase()}
                    </p>
                    <p className="text-xs text-neutral-500">Something went wrong. Try again.</p>
                </div>
            ) : isLoading ? (
                <DashboardLoader />
            ) : !hasResults ? (
                <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
                    <EmptyInvitePage />
                    <p className="text-sm text-neutral-600">
                        {statusFilter === 'ALL'
                            ? `No ${audienceTermPlural.toLowerCase()} found!`
                            : `No ${getStatusDisplayText(statusFilter).toLowerCase()} ${audienceTermPlural.toLowerCase()} found!`}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {paginatedCampaigns.map((campaign: CampaignItem, index: number) => {
                            const normalizedStatus = campaign.status?.trim().toUpperCase();
                            const campaignId =
                                campaign.id || campaign.campaign_id || campaign.audience_id || '';

                            const handleCampaignClick = () => {
                                if (!campaignId) {
                                    toast.error(
                                        'Unable to open campaign details. Missing campaign identifier.'
                                    );
                                    return;
                                }
                                navigate({
                                    to: '/audience-manager/list/campaign-users',
                                    search: {
                                        campaignId,
                                        campaignName: campaign.campaign_name,
                                        customFields: campaign.institute_custom_fields
                                            ? JSON.stringify(campaign.institute_custom_fields)
                                            : undefined,
                                        campaignType: campaign.campaign_type,
                                    },
                                    // Router's typed search doesn't model these dynamic params.
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                } as any);
                            };

                            const statusStyles = (() => {
                                const s = normalizedStatus;
                                if (s === 'ACTIVE') {
                                    return {
                                        dot: 'bg-success-500',
                                        chip: 'bg-success-50 text-success-700',
                                        tile: 'bg-success-50 text-success-700',
                                    };
                                }
                                if (s === 'DRAFT') {
                                    return {
                                        dot: 'bg-warning-500',
                                        chip: 'bg-warning-50 text-warning-700',
                                        tile: 'bg-warning-50 text-warning-700',
                                    };
                                }
                                return {
                                    dot: 'bg-neutral-400',
                                    chip: 'bg-neutral-100 text-neutral-600',
                                    tile: 'bg-neutral-100 text-neutral-500',
                                };
                            })();
                            const statusLabel =
                                (campaign.status?.charAt(0).toUpperCase() ?? '') +
                                (campaign.status?.slice(1).toLowerCase() ?? '');
                            const TypeIcon =
                                campaign.campaign_type?.toUpperCase() === 'WEBSITE'
                                    ? Globe
                                    : Megaphone;

                            return (
                                <Card
                                    key={campaignId || index}
                                    className="group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg"
                                    onClick={handleCampaignClick}
                                >
                                    {/* Header */}
                                    <div className="flex items-start gap-3 p-4 pb-3">
                                        <span
                                            className={cn(
                                                'flex size-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105',
                                                statusStyles.tile
                                            )}
                                        >
                                            <TypeIcon weight="fill" className="size-5" />
                                        </span>
                                        <div className="min-w-0 flex-1 space-y-1.5">
                                            <h3
                                                className="truncate text-base font-semibold leading-tight text-neutral-900 transition-colors group-hover:text-primary-700"
                                                title={campaign.campaign_name}
                                            >
                                                {campaign.campaign_name}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                                                        statusStyles.chip
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
                                                {campaign.campaign_type && (
                                                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-neutral-600">
                                                        {campaign.campaign_type}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div
                                            className="shrink-0"
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
                                    </div>

                                    {/* Body */}
                                    <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600">
                                            <CalendarBlank className="size-4 shrink-0 text-neutral-400" />
                                            <span className="font-medium text-neutral-800">
                                                {getDateFromUTCString(campaign.start_date_local)}
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
                                        <div
                                            className="mt-auto min-w-0 pt-1"
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
                                                            Activate this{' '}
                                                            {audienceTerm.toLowerCase()} to generate
                                                            a shareable link.
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div
                                        className="flex flex-wrap items-center gap-1.5 border-t border-neutral-100 bg-neutral-50/40 px-4 py-3"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        className="h-8 gap-1.5 rounded-md px-3 text-xs font-medium shadow-sm"
                                                        onClick={() => {
                                                            navigate({
                                                                to: '/audience-manager/list/campaign-users/add',
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
                                                                },
                                                                // Router's typed search doesn't model these dynamic params.
                                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                            } as any);
                                                        }}
                                                    >
                                                        <UserPlus className="size-3.5" />
                                                        Add Response
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Add a response on behalf of a respondent</p>
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className={CARD_ACTION_BTN}
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
                                                        Get API integration details for automation
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className={CARD_ACTION_BTN}
                                                        onClick={() =>
                                                            setEmbedDialogCampaign(campaign)
                                                        }
                                                    >
                                                        <CodeSimple className="size-3.5" />
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
                        })}
                    </div>
                    <LeadPagination
                        currentPage={page}
                        totalPages={totalFilteredPages}
                        onPageChange={handlePageChange}
                    />
                </div>
            )}

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
