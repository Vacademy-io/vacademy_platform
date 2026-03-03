import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { handleFetchEnquiriesList } from './-services/get-enquiries-list';
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
import { Copy, Plus, X } from 'lucide-react';
import createCampaignLink from '@/routes/audience-manager/list/-utils/createCampaignLink';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { FilterChips } from '@/components/design-system/chips';
import { Button } from '@/components/ui/button';
import { CreateEnquiryDialog } from './-components/create-enquiry-dialog/CreateEnquiryDialog';

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
];

const SOURCE_TYPES = [
    { id: 'WEBSITE', label: 'Website' },
    { id: 'GOOGLE_ADS', label: 'Google Ads' },
    { id: 'FACEBOOK', label: 'Facebook' },
    { id: 'INSTAGRAM', label: 'Instagram' },
    { id: 'REFERRAL', label: 'Referral' },
    { id: 'OTHER', label: 'Other' },
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
    const [selectedEnquiry, setSelectedEnquiry] = useState<any>(null);
    const { instituteDetails } = useInstituteDetailsStore();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    // Filter states - using arrays for multi-select
    const [statusFilters, setStatusFilters] = useState<{ id: string; label: string }[]>([]);
    const [sourceFilters, setSourceFilters] = useState<{ id: string; label: string }[]>([]);
    const [dateRangeFilters, setDateRangeFilters] = useState<{ id: string; label: string }[]>([]);
    const [packageSessionFilters, setPackageSessionFilters] = useState<
        { id: string; label: string }[]
    >([]);

    // Fetch all enquiries (campaigns)
    const { data: enquiriesData, refetch: refetchEnquiries } = useSuspenseQuery(
        handleFetchEnquiriesList({
            institute_id: instituteData?.id || '',
            page: 0,
            size: 100, // Fetch all for dropdown
        })
    );

    const enquiries = enquiriesData?.content || [];

    // Auto-select first enquiry by default
    useEffect(() => {
        if (enquiries.length > 0 && !selectedEnquiryId) {
            setSelectedEnquiryId(enquiries[0]?.id || '');
            setSelectedEnquiry(enquiries[0]);
        }
    }, [enquiries, selectedEnquiryId]);

    const handleCopy = () => {
        const shareableLink = createCampaignLink(
            selectedEnquiryId,
            instituteDetails?.learner_portal_base_url,
            true
        );
        navigator.clipboard.writeText(shareableLink).catch((error) => {
            console.error('Unable to copy enquiry link', error);
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

        return instituteDetails.batches_for_sessions.map((batch) => ({
            id: batch.id,
            label: `${batch.package_dto.package_name} - ${batch.level.level_name} - ${batch.session.session_name}`,
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
        packageSessionFilters.length > 0;

    const clearAllFilters = () => {
        setStatusFilters([]);
        setSourceFilters([]);
        setDateRangeFilters([]);
        setPackageSessionFilters([]);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Enquiries</h1>
                <div className="flex items-center gap-4">
                    <Select value={selectedEnquiryId} onValueChange={setSelectedEnquiryId}>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Select Enquiry" />
                        </SelectTrigger>
                        <SelectContent>
                            {enquiries.map((enquiry) => (
                                <SelectItem key={enquiry.id} value={enquiry.id || ''}>
                                    {enquiry.campaign_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        onClick={() => setIsCreateDialogOpen(true)}
                        className="h-8"
                    >
                        <Plus className="mr-1 h-4 w-4" />
                        Create Enquiry
                    </MyButton>
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={handleCopy}
                        className="h-8"
                    >
                        <Copy />
                    </MyButton>
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
                        label="Package Session"
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

                {hasActiveFilters && (
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={clearAllFilters}
                        className="h-8 px-2 text-xs"
                    >
                        <X className="mr-1 h-3 w-3" />
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

            {/* Create Enquiry Dialog */}
            <CreateEnquiryDialog isOpen={isCreateDialogOpen} onClose={handleCreateSuccess} />
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
