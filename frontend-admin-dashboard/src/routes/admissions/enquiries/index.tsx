import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import {
    handleFetchEnquiriesList,
    EnquiryItem as EnquiryListItem,
} from './-services/get-enquiries-list';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { EnquiryTable } from './-components/EnquiryTable';
import { MyButton } from '@/components/design-system/button';
import { Copy, Plus, X, Monitor } from 'lucide-react';
import createCampaignLink from '@/routes/audience-manager/list/-utils/createCampaignLink';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { FilterChips } from '@/components/design-system/chips';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { CreateEnquiryDialog } from './-components/create-enquiry-dialog/CreateEnquiryDialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useLeadSettings } from '@/hooks/use-lead-settings';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
export const Route = createFileRoute('/admissions/enquiries/')({
    component: RouteComponent,
});

// Predefined date ranges
const DATE_RANGES = [
    { id: 'today', label: 'Today' },
    { id: 'last_7_days', label: 'Last 7 Days' },
    { id: 'last_30_days', label: 'Last 30 Days' },
    { id: 'last_3_months', label: 'Last 3 Months' },
    { id: 'last_6_months', label: 'Last 6 Months' },
    { id: 'last_year', label: 'Last Year' },
];

const ENQUIRY_STATUSES = [
    { id: 'NEW', label: 'New' },
    { id: 'CONTACTED', label: 'Contacted' },
    { id: 'NOT_ELIGIBLE', label: 'Not Eligible' },
    { id: 'QUALIFIED', label: 'Qualified' },
    { id: 'FOLLOW_UP', label: 'Follow up' },
    { id: 'CLOSED', label: 'Closed' },
    { id: 'CONVERTED', label: 'Converted' },
    { id: 'ADMITTED', label: 'Admitted' },
];

const SOURCE_TYPES = [
    { id: 'WEBSITE', label: 'Website' },
    { id: 'GOOGLE_ADS', label: 'Google Ads' },
    { id: 'FACEBOOK', label: 'Facebook' },
    { id: 'INSTAGRAM', label: 'Instagram' },
    { id: 'REFERRAL', label: 'Referral' },
    { id: 'OTHER', label: 'Other' },
];

const LEAD_TIERS = [
    { id: 'HOT', label: '🔴 HOT' },
    { id: 'WARM', label: '🟡 WARM' },
    { id: 'COLD', label: '🔵 COLD' },
];

// Helper function to calculate date range
const getDateRange = (rangeValue: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (rangeValue) {
        case 'today':
            return {
                from: today.toISOString(),
                to: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString(),
            };
        case 'last_7_days':
            return {
                from: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                to: now.toISOString(),
            };
        case 'last_30_days':
            return {
                from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                to: now.toISOString(),
            };
        case 'last_3_months':
            return {
                from: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
                to: now.toISOString(),
            };
        case 'last_6_months':
            return {
                from: new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
                to: now.toISOString(),
            };
        case 'last_year':
            return {
                from: new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
                to: now.toISOString(),
            };
        default:
            return undefined;
    }
};

function EnquiryPage() {
    const { data: instituteData } = useSuspenseQuery(useInstituteQuery());
    const [selectedEnquiryId, setSelectedEnquiryId] = useState<string>('');
    const [selectedEnquiry, setSelectedEnquiry] = useState<EnquiryListItem | null>(null);
    const { instituteDetails } = useInstituteDetailsStore();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    // Filter states - using arrays for multi-select
    const [statusFilters, setStatusFilters] = useState<{ id: string; label: string }[]>([]);
    const [sourceFilters, setSourceFilters] = useState<{ id: string; label: string }[]>([]);
    const [dateRangeFilters, setDateRangeFilters] = useState<{ id: string; label: string }[]>([]);
    const [packageSessionFilters, setPackageSessionFilters] = useState<
        { id: string; label: string }[]
    >([]);
    const [searchInput, setSearchInput] = useState('');
    const [searchFilter, setSearchFilter] = useState('');
    // Phase 1 filters
    const [tierFilter, setTierFilter] = useState('');
    const [showDuplicates, setShowDuplicates] = useState(true);
    const [sortBy, setSortBy] = useState('');
    const [sortDirection, setSortDirection] = useState('DESC');
    const [isWalkInOpen, setIsWalkInOpen] = useState(false);
    const { setNavHeading } = useNavHeadingStore();
    const navigate = useNavigate();
    const leadSettings = useLeadSettings();

    // Fetch all enquiries (campaigns)
    const { data: enquiriesData, refetch: refetchEnquiries } = useSuspenseQuery(
        handleFetchEnquiriesList({
            institute_id: instituteData?.id || '',
            page: 0,
            size: 100, // Fetch all for dropdown
        })
    );

    const enquiries = useMemo(
        () =>
            (enquiriesData?.content || []).filter(
                (enquiry) => enquiry.session_id !== null && enquiry.session_id !== undefined
            ),
        [enquiriesData?.content]
    );
    useEffect(() => {
        setNavHeading('Enquiries');
    }, [setNavHeading]);

    // Auto-select first enquiry by default
    useEffect(() => {
        if (enquiries.length > 0 && !selectedEnquiryId) {
            setSelectedEnquiryId(enquiries[0]?.id || '');
            setSelectedEnquiry(enquiries[0] ?? null);
        }
    }, [enquiries, selectedEnquiryId]);

    const handleCopy = () => {
        const shareableLink = createCampaignLink(
            selectedEnquiryId,
            instituteDetails?.learner_portal_base_url,
            true
        );
        navigator.clipboard
            .writeText(shareableLink)
            .then(() => {
                toast.success('Enquiry link copied to clipboard!');
            })
            .catch((error) => {
                console.error('Unable to copy enquiry link', error);
                toast.error('Failed to copy link');
            });
    };

    const handleCreateSuccess = () => {
        setIsCreateDialogOpen(false);
        refetchEnquiries();
    };

    // Update selected enquiry when selection changes
    useEffect(() => {
        if (selectedEnquiryId) {
            const found = enquiries.find((e) => e.id === selectedEnquiryId);
            setSelectedEnquiry(found || null);
        }
    }, [selectedEnquiryId, enquiries]);

    // Get package sessions from institute store
    const packageSessionOptions = useMemo(() => {
        if (!instituteDetails?.batches_for_sessions) return [];

        return instituteDetails.batches_for_sessions
            .filter((batch) => batch.is_parent === true || !batch.parent_id)
            .map((batch) => ({
                id: batch.id,
                label: `${batch.package_dto.package_name} - ${batch.level.level_name} - ${batch.session.session_name}${batch.name ? ` - ${batch.name}` : ''}`,
            }));
    }, [instituteDetails]);

    // Calculate filter values for API
    const statusFilter = statusFilters.length > 0 ? statusFilters[0]?.id : undefined;
    const sourceFilter = sourceFilters.length > 0 ? sourceFilters[0]?.id : undefined;
    const packageSessionFilter =
        packageSessionFilters.length > 0 ? packageSessionFilters[0]?.id : undefined;

    const dateRange = useMemo(() => {
        if (dateRangeFilters.length === 0) return undefined;
        return getDateRange(dateRangeFilters[0]?.id || '');
    }, [dateRangeFilters]);

    // Check if any filter is active
    const hasActiveFilters =
        statusFilters.length > 0 ||
        sourceFilters.length > 0 ||
        dateRangeFilters.length > 0 ||
        packageSessionFilters.length > 0 ||
        searchFilter.length > 0 ||
        tierFilter.length > 0 ||
        sortBy.length > 0;

    const clearAllFilters = () => {
        setStatusFilters([]);
        setSourceFilters([]);
        setDateRangeFilters([]);
        setPackageSessionFilters([]);
        setSearchInput('');
        setSearchFilter('');
        setTierFilter('');
        setSortBy('');
        setSortDirection('DESC');
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Enquiries</h1>
                <div className="flex items-stretch gap-4">
                    <Select value={selectedEnquiryId} onValueChange={setSelectedEnquiryId}>
                        <SelectTrigger className="h-auto w-[280px] px-3 py-1.5">
                            <SelectValue placeholder="Select Enquiry" />
                        </SelectTrigger>
                        <SelectContent>
                            {enquiries.map((enquiry) => (
                                <SelectItem key={enquiry.id} value={enquiry.id || ''}>
                                    <div className="flex flex-col items-start gap-0.5 text-left">
                                        <span className="text-sm font-medium">
                                            {enquiry.campaign_name}
                                        </span>
                                        <span className="text-xs font-light text-muted-foreground">
                                            Enquiry type: {enquiry.campaign_type}
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        onClick={() =>
                            navigate({ to: `/admissions/new-enquiry/${selectedEnquiryId}` })
                        }
                        className="h-full"
                    >
                        <Plus className="mr-1 size-4" />
                        Add New Enquiry Response
                    </MyButton>
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={handleCopy}
                        className="h-full"
                        title="Copy enquiry link to clipboard"
                        aria-label="Copy enquiry link to clipboard"
                    >
                        {' '}
                        Copy Form Link
                        <Copy />
                    </MyButton>
                    {leadSettings.enabled && (
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            onClick={() => setIsWalkInOpen(true)}
                            className="h-full"
                            title="Open walk-in registration form"
                            aria-label="Open walk-in registration form"
                            disabled={!selectedEnquiryId}
                        >
                            Walk-in Register
                            <Monitor className="ml-1 size-4" />
                        </MyButton>
                    )}
                </div>
            </div>

            {/* Filters Section */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter */}
                <FilterChips
                    label="Status"
                    filterList={ENQUIRY_STATUSES}
                    selectedFilters={statusFilters}
                    handleSelect={(option) => {
                        const exists = statusFilters.some((f) => f.id === option.id);
                        if (exists) {
                            setStatusFilters(statusFilters.filter((f) => f.id !== option.id));
                        } else {
                            // For single selection, replace existing
                            setStatusFilters([option]);
                        }
                    }}
                    handleClearFilters={() => setStatusFilters([])}
                    clearFilters={false}
                />

                {/* Source Filter */}
                <FilterChips
                    label="Source"
                    filterList={SOURCE_TYPES}
                    selectedFilters={sourceFilters}
                    handleSelect={(option) => {
                        const exists = sourceFilters.some((f) => f.id === option.id);
                        if (exists) {
                            setSourceFilters(sourceFilters.filter((f) => f.id !== option.id));
                        } else {
                            // For single selection, replace existing
                            setSourceFilters([option]);
                        }
                    }}
                    handleClearFilters={() => setSourceFilters([])}
                    clearFilters={false}
                />

                {/* Date Range Filter */}
                <FilterChips
                    label="Date Range"
                    filterList={DATE_RANGES}
                    selectedFilters={dateRangeFilters}
                    handleSelect={(option) => {
                        const exists = dateRangeFilters.some((f) => f.id === option.id);
                        if (exists) {
                            setDateRangeFilters(dateRangeFilters.filter((f) => f.id !== option.id));
                        } else {
                            // For single selection, replace existing
                            setDateRangeFilters([option]);
                        }
                    }}
                    handleClearFilters={() => setDateRangeFilters([])}
                    clearFilters={false}
                />

                {/* Package Session Filter */}
                {packageSessionOptions.length > 0 && (
                    <FilterChips
                        label="Class"
                        filterList={packageSessionOptions}
                        selectedFilters={packageSessionFilters}
                        handleSelect={(option) => {
                            const exists = packageSessionFilters.some((f) => f.id === option.id);
                            if (exists) {
                                setPackageSessionFilters(
                                    packageSessionFilters.filter((f) => f.id !== option.id)
                                );
                            } else {
                                // For single selection, replace existing
                                setPackageSessionFilters([option]);
                            }
                        }}
                        handleClearFilters={() => setPackageSessionFilters([])}
                        clearFilters={false}
                    />
                )}

                {/* Search Bar */}
                <div className="flex items-center gap-2">
                    <Input
                        type="text"
                        placeholder="Search by name or mobile..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setSearchFilter(searchInput);
                            }
                        }}
                        className="h-8 bg-white text-xs md:w-[250px]"
                    />
                    <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => setSearchFilter(searchInput)}
                    >
                        <Search className="size-4" />
                    </Button>
                </div>

                {/* Lead Tier Filter — only shown when lead system is enabled */}
                {leadSettings.enabled && (
                    <div className="flex items-center gap-1">
                        {LEAD_TIERS.map((tier) => (
                            <button
                                key={tier.id}
                                onClick={() => setTierFilter(tierFilter === tier.id ? '' : tier.id)}
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                    tierFilter === tier.id
                                        ? tier.id === 'HOT'
                                            ? 'bg-red-500 text-white'
                                            : tier.id === 'WARM'
                                              ? 'bg-amber-500 text-white'
                                              : 'bg-blue-500 text-white'
                                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                }`}
                            >
                                {tier.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Sort By */}
                <Select
                    value={sortBy || 'none'}
                    onValueChange={(v) => {
                        if (v === 'none') {
                            setSortBy('');
                        } else if (v === sortBy) {
                            setSortDirection((d) => (d === 'ASC' ? 'DESC' : 'ASC'));
                        } else {
                            setSortBy(v);
                            // Names default ASC (A→Z); scores/dates default DESC (highest/newest first)
                            setSortDirection(v === 'PARENT_NAME' ? 'ASC' : 'DESC');
                        }
                    }}
                >
                    <SelectTrigger className="h-8 w-[180px] text-xs">
                        <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Default Order</SelectItem>
                        <SelectItem value="SUBMITTED_AT">Date Submitted</SelectItem>
                        {leadSettings.enabled && (
                            <SelectItem value="LEAD_SCORE">
                                Lead Score{' '}
                                {sortBy === 'LEAD_SCORE' ? (sortDirection === 'DESC' ? '↓' : '↑') : ''}
                            </SelectItem>
                        )}
                        <SelectItem value="PARENT_NAME">
                            Parent Name{' '}
                            {sortBy === 'PARENT_NAME' ? (sortDirection === 'DESC' ? '↓' : '↑') : ''}
                        </SelectItem>
                    </SelectContent>
                </Select>

                {/* Show Duplicates Toggle — only shown when lead system is enabled */}
                {leadSettings.enabled && (
                    <div className="flex items-center gap-2">
                        <Switch
                            id="show-duplicates"
                            checked={showDuplicates}
                            onCheckedChange={setShowDuplicates}
                        />
                        <Label htmlFor="show-duplicates" className="text-xs text-neutral-600">
                            Show duplicates
                        </Label>
                    </div>
                )}

                {hasActiveFilters && (
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={clearAllFilters}
                        className="h-8 px-2 text-xs"
                    >
                        <X className="mr-1 size-3" />
                        Clear All
                    </MyButton>
                )}
            </div>

            {/* Table Section powered by EnquiryTable component */}
            {selectedEnquiryId && selectedEnquiry && (
                <EnquiryTable
                    enquiryId={selectedEnquiryId}
                    enquiryName={selectedEnquiry.campaign_name}
                    customFieldsJson={JSON.stringify(selectedEnquiry.institute_custom_fields || [])}
                    statusFilter={statusFilter}
                    sourceFilter={sourceFilter}
                    packageSessionFilter={packageSessionFilter}
                    dateRangeFilter={dateRange}
                    searchFilter={searchFilter}
                    leadTierFilter={tierFilter || undefined}
                    excludeDuplicates={showDuplicates ? undefined : true}
                    sortBy={sortBy || undefined}
                    sortDirection={sortBy ? sortDirection : undefined}
                />
            )}

            {/* No enquiry selected state */}
            {!selectedEnquiryId && (
                <Card className="p-12 text-center">
                    <p className="text-muted-foreground">
                        Please select an enquiry to view responses
                    </p>
                </Card>
            )}

            {/* Disconnected Create Button */}
            <div className="fixed bottom-8 right-8 z-50">
                <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="h-12 rounded-full bg-primary-500 px-6 text-white shadow-xl transition-all hover:-translate-y-1 hover:bg-primary-600 hover:shadow-2xl md:h-14"
                >
                    <Plus className="mr-2 size-5" />
                    Create New Enquiry Form
                </Button>
            </div>

            {/* Create Enquiry Dialog */}
            <CreateEnquiryDialog isOpen={isCreateDialogOpen} onClose={handleCreateSuccess} />

            {/* Walk-in Registration Sheet */}
            <Sheet open={isWalkInOpen} onOpenChange={setIsWalkInOpen}>
                <SheetContent side="right" className="w-full max-w-2xl p-0 sm:max-w-2xl">
                    <SheetHeader className="border-b px-6 py-4">
                        <SheetTitle>Walk-in Registration</SheetTitle>
                    </SheetHeader>
                    {selectedEnquiryId && (
                        <iframe
                            src={createCampaignLink(
                                selectedEnquiryId,
                                instituteDetails?.learner_portal_base_url,
                                true
                            )}
                            className="h-[calc(100vh-70px)] w-full border-0"
                            title="Walk-in Registration Form"
                        />
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}

function RouteComponent() {
    return (
        <LayoutContainer>
            <EnquiryPage />
        </LayoutContainer>
    );
}
