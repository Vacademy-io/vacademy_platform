import EmptyInvitePage from '@/assets/svgs/empty-invite-page.svg';
import { usePaginationState } from '@/hooks/pagination';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useMemo, useEffect } from 'react';
import { CreateCampaignDialog } from '../create-campaign-dialog/CreateCampaignDialog';
import { format } from 'date-fns';
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
const VALID_STATUS: readonly string[] = ['ALL', 'ACTIVE', 'INACTIVE', 'DRAFT'];

const SERVER_FETCH_SIZE = 200;
const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 6;

// Force-filled primary CTA. The platform <Button>'s `bg-primary` CSS-var was
// rendering very light, so primary actions looked like outlines — bypass via tokens.
const PRIMARY_BTN = 'bg-primary-500 text-white shadow-sm hover:bg-primary-600';
const CARD_PRIMARY_BTN =
    'h-8 gap-1.5 rounded-md bg-primary-500 px-3 text-xs font-medium text-white shadow-sm hover:bg-primary-600';
const CARD_OUTLINE_BTN =
    'h-8 gap-1.5 rounded-md border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 shadow-sm hover:border-primary-200 hover:bg-primary-50/40 hover:text-primary-700';

// Human date — never show raw ISO to users.
const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : format(d, 'MMM d, yyyy');
};

const statusDropdownOptions: { label: string; value: StatusFilter }[] = [
    { label: 'All Status', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' },
    { label: 'Draft', value: 'DRAFT' },
];

export const AudienceInvite = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
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
        initialPageSize: PAGE_SIZE,
    });

    // Seed state from the URL on mount — refresh-safe deep linking.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const q = params.get('q');
        const s = params.get('status');
        const p = params.get('page');
        if (q) {
            setSearchQuery(q);
            setAppliedSearch(q);
        }
        if (s && VALID_STATUS.includes(s)) setStatusFilter(s as StatusFilter);
        if (p) {
            const n = parseInt(p, 10);
            if (!Number.isNaN(n) && n > 0) handlePageChange(n);
        }
        // intentionally only on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Debounce search input (typing → applied → query key).
    useEffect(() => {
        const trimmed = searchQuery.trim();
        if (trimmed === appliedSearch) return;
        const timer = window.setTimeout(() => {
            setAppliedSearch(trimmed);
            handlePageChange(0);
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [searchQuery, appliedSearch, handlePageChange]);

    // Sync state → URL (replaceState so the back button isn't polluted by typing).
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (appliedSearch) params.set('q', appliedSearch);
        else params.delete('q');
        if (statusFilter !== 'ALL') params.set('status', statusFilter);
        else params.delete('status');
        if (page > 0) params.set('page', String(page));
        else params.delete('page');
        const qs = params.toString();
        const newUrl = `${window.location.pathname}${qs ? '?' + qs : ''}`;
        window.history.replaceState(null, '', newUrl);
    }, [appliedSearch, statusFilter, page]);

    const handleStatusChange = (value: StatusFilter) => {
        handlePageChange(0);
        setStatusFilter(value);
    };

    const handleClearFilters = () => {
        setSearchQuery('');
        setAppliedSearch('');
        setStatusFilter('ALL');
        handlePageChange(0);
    };

    const campaignsPayload = useMemo(
        () => ({
            institute_id: instituteDetails?.id || '',
            page: 0,
            size: SERVER_FETCH_SIZE,
            campaign_name: appliedSearch || undefined,
            status: statusFilter !== 'ALL' ? statusFilter : undefined,
            sort_by: 'created_at',
            sort_direction: 'DESC',
        }),
        [instituteDetails?.id, appliedSearch, statusFilter]
    );

    const { data: campaignsList, isLoading, isError } = useCampaignsList(campaignsPayload);

    const filteredCampaigns = useMemo(() => {
        if (!campaignsList?.content) return [];
        return campaignsList.content.filter((c: CampaignItem) => {
            const s = c.status?.trim().toUpperCase();
            return ['ACTIVE', 'INACTIVE', 'DRAFT'].includes(s);
        });
    }, [campaignsList?.content]);

    const totalFilteredPages = useMemo(() => {
        if (!filteredCampaigns.length) return 1;
        return Math.max(1, Math.ceil(filteredCampaigns.length / pageSize));
    }, [filteredCampaigns.length, pageSize]);

    useEffect(() => {
        if (page > 0 && page >= totalFilteredPages) {
            handlePageChange(Math.max(totalFilteredPages - 1, 0));
        }
    }, [handlePageChange, page, totalFilteredPages]);

    const paginatedCampaigns = useMemo(() => {
        const startIndex = page * pageSize;
        return filteredCampaigns.slice(startIndex, startIndex + pageSize);
    }, [filteredCampaigns, page, pageSize]);

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
    const hasActiveFilter = !!appliedSearch || statusFilter !== 'ALL';

    const kpis: {
        label: string;
        value: number;
        dot: string;
        filter: StatusFilter;
        ring: string;
    }[] = [
        {
            label: 'Active',
            value: statusCounts.active,
            dot: 'bg-success-500',
            filter: 'ACTIVE',
            ring: 'ring-success-500',
        },
        {
            label: 'Draft',
            value: statusCounts.draft,
            dot: 'bg-warning-500',
            filter: 'DRAFT',
            ring: 'ring-warning-500',
        },
        {
            label: 'Inactive',
            value: statusCounts.inactive,
            dot: 'bg-neutral-400',
            filter: 'INACTIVE',
            ring: 'ring-neutral-400',
        },
    ];

    return (
        <div className="flex w-full flex-col gap-6">
            {/* Heading */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold leading-tight text-neutral-900">
                        {isLoading
                            ? audienceTermPlural
                            : `${filteredCampaigns.length.toLocaleString()} ${audienceTermPlural}`}
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
                    className={cn('w-full shrink-0 sm:w-auto', PRIMARY_BTN)}
                >
                    <Plus className="mr-2 size-4" /> Add {audienceTerm}
                </Button>
            </div>

            {/* Compact clickable KPI strip — click to filter, click again to clear. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {isLoading
                    ? [0, 1, 2].map((i) => (
                          <div
                              key={i}
                              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm"
                          >
                              <Skeleton className="h-3 w-16" />
                              <Skeleton className="mt-2 h-6 w-12" />
                          </div>
                      ))
                    : kpis.map((kpi) => {
                          const isActive = statusFilter === kpi.filter;
                          return (
                              <button
                                  key={kpi.filter}
                                  type="button"
                                  onClick={() => handleStatusChange(isActive ? 'ALL' : kpi.filter)}
                                  aria-pressed={isActive}
                                  className={cn(
                                      'flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition-all hover:border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
                                      isActive
                                          ? cn('border-transparent ring-2 ring-inset', kpi.ring)
                                          : 'border-neutral-200'
                                  )}
                              >
                                  <span className="flex items-center gap-2">
                                      <span className={cn('size-1.5 rounded-full', kpi.dot)} />
                                      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                          {kpi.label}
                                      </span>
                                  </span>
                                  <span className="text-xl font-semibold tabular-nums text-neutral-900">
                                      {kpi.value.toLocaleString()}
                                  </span>
                              </button>
                          );
                      })}
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
                    onValueChange={(v) => handleStatusChange(v as StatusFilter)}
                >
                    <SelectTrigger className="h-10 w-full sm:w-44">
                        <SelectValue placeholder="Filter by Status" />
                    </SelectTrigger>
                    <SelectContent>
                        {statusDropdownOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
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
                <SkeletonCards />
            ) : !hasResults ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                    <EmptyInvitePage />
                    <p className="text-sm text-neutral-600">
                        {hasActiveFilter
                            ? `No ${audienceTermPlural.toLowerCase()} match your filters.`
                            : `You haven't created any ${audienceTermPlural.toLowerCase()} yet.`}
                    </p>
                    {hasActiveFilter ? (
                        <Button variant="outline" size="sm" onClick={handleClearFilters}>
                            Clear filters
                        </Button>
                    ) : (
                        <Button
                            className={PRIMARY_BTN}
                            onClick={() => {
                                setCampaignBeingEdited(null);
                                setIsDialogOpen(true);
                            }}
                        >
                            <Plus className="mr-2 size-4" /> Create your first{' '}
                            {audienceTerm.toLowerCase()}
                        </Button>
                    )}
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
                                    role="button"
                                    tabIndex={0}
                                    onClick={handleCampaignClick}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleCampaignClick();
                                        }
                                    }}
                                    aria-label={`Open ${campaign.campaign_name}`}
                                    className="group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
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
                                                {formatDate(campaign.start_date_local)}
                                            </span>
                                            <span className="text-neutral-400">→</span>
                                            <span className="font-medium text-neutral-800">
                                                {formatDate(campaign.end_date_local)}
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
                                                <CampaignLink campaignId={campaignId} />
                                            ) : (
                                                <div className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 px-3 py-2.5 text-sm text-neutral-500">
                                                    <Info className="size-4 shrink-0 text-neutral-400" />
                                                    <span>
                                                        Activate this {audienceTerm.toLowerCase()}{' '}
                                                        to generate a shareable link.
                                                    </span>
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
                                                        className={CARD_PRIMARY_BTN}
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
                                                        className={CARD_OUTLINE_BTN}
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
                                                        className={CARD_OUTLINE_BTN}
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

/** Skeleton placeholder for the card grid while data loads. */
function SkeletonCards() {
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
                <div
                    key={i}
                    className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                    <div className="flex items-start gap-3">
                        <Skeleton className="size-10 shrink-0 rounded-lg" />
                        <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    </div>
                    <Skeleton className="mt-4 h-4 w-2/3" />
                    <Skeleton className="mt-3 h-10 w-full" />
                    <div className="mt-3 flex gap-2">
                        <Skeleton className="h-8 w-28" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-20" />
                    </div>
                </div>
            ))}
        </div>
    );
}
