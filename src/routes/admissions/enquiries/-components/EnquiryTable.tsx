import { useMemo, useState, useEffect } from 'react';
import { MyTable } from '@/components/design-system/table';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import EmptyInvitePage from '@/assets/svgs/empty-invite-page.svg';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { ChevronLeft, ChevronRight, Download, UserPlus } from 'lucide-react';
import { generateDynamicColumns, EnquiryTableRow } from './enquiry-table-columns';
import { convertToLocalDateTime } from '@/constants/helper';
import { useCustomFieldSetup } from '@/routes/audience-manager/list/-hooks/useCustomFieldSetup';
import { CustomFieldSetupItem } from '@/routes/audience-manager/list/-services/get-custom-field-setup';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { toast } from 'sonner';
import { fetchEnquiries } from '../-services/get-enquiries';
import { useSuspenseQuery } from '@tanstack/react-query';
import { handleFetchEnquiries } from '../-services/get-enquiries';
import { format } from 'date-fns';
import { useNavigate } from '@tanstack/react-router';
import { MyButton } from '@/components/design-system/button';

// Helper function to generate key from name
const generateKeyFromName = (name: string): string =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

interface EnquiryTableProps {
    enquiryId: string;
    enquiryName?: string;
    customFieldsJson?: string;
    statusFilter?: string;
    sourceFilter?: string;
    packageSessionFilter?: string;
    dateRangeFilter?: { from?: string; to?: string };
}

export const EnquiryTable = ({
    enquiryId,
    enquiryName,
    customFieldsJson,
    statusFilter,
    sourceFilter,
    packageSessionFilter,
    dateRangeFilter,
}: EnquiryTableProps) => {
    const [page, setPage] = useState(0);
    const pageSize = 10;
    const { instituteDetails, getDetailsFromPackageSessionId } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id;
    const [isDownloading, setIsDownloading] = useState(false);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const navigate = useNavigate();

    // Reset page and selected rows when enquiry or filters change
    useEffect(() => {
        setPage(0);
        setSelectedRows(new Set());
        console.log('🔄 [EnquiryTable] Enquiry or filters changed, resetting page and selection');
    }, [enquiryId, statusFilter, sourceFilter, packageSessionFilter, dateRangeFilter]);

    // Parse custom fields from JSON
    const customFields = useMemo(() => {
        if (!customFieldsJson) return [];
        try {
            const parsed = JSON.parse(customFieldsJson);
            const fields = Array.isArray(parsed) ? parsed : [];
            return fields;
        } catch (error) {
            console.error('Error parsing custom fields:', error);
            return [];
        }
    }, [customFieldsJson]);

    const {
        data: customFieldSetup,
        isLoading: isCustomFieldsLoading,
        error: customFieldsError,
    } = useCustomFieldSetup(instituteId);

    const customFieldMap = useMemo(() => {
        const map = new Map<string, CustomFieldSetupItem>();
        if (!customFieldSetup || customFieldSetup.length === 0) {
            return map;
        }

        customFieldSetup.forEach((field) => {
            const registerKey = (key?: string) => {
                if (!key) return;
                map.set(key, field);
                map.set(key.toLowerCase(), field);
                map.set(key.toUpperCase(), field);
                const normalized = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                if (normalized && normalized !== key.toLowerCase()) {
                    map.set(normalized, field);
                }
            };

            registerKey(field.custom_field_id);
            registerKey(field.field_key);
            if (field.field_name) {
                const nameKey = generateKeyFromName(field.field_name);
                registerKey(nameKey);
            }
        });
        return map;
    }, [customFieldSetup]);

    const enquiriesPayload = useMemo(
        () => ({
            audience_id: enquiryId,
            page,
            size: pageSize,
            status: statusFilter,
            source: sourceFilter,
            destination_package_session_id: packageSessionFilter,
            created_from: dateRangeFilter?.from,
            created_to: dateRangeFilter?.to,
        }),
        [
            enquiryId,
            page,
            pageSize,
            statusFilter,
            sourceFilter,
            packageSessionFilter,
            dateRangeFilter,
        ]
    );

    const {
        data: enquiriesResponse,
        isLoading,
        error,
    } = useSuspenseQuery(handleFetchEnquiries(enquiriesPayload));

    const allFieldIdsFromAllEnquiries = useMemo(() => {
        const allFieldIds = new Set<string>();

        if (customFields && customFields.length > 0) {
            customFields.forEach((enquiryField: any) => {
                const fieldId =
                    enquiryField.custom_field?.id ||
                    enquiryField.id ||
                    enquiryField._id ||
                    enquiryField.field_id;
                if (fieldId) {
                    allFieldIds.add(fieldId);
                }
            });
        }

        if (enquiriesResponse && enquiriesResponse.content) {
            enquiriesResponse.content.forEach((enquiry: any) => {
                const customValues = enquiry.custom_fields || {};
                Object.keys(customValues).forEach((fieldId) => {
                    allFieldIds.add(fieldId);
                });
            });
        }

        return Array.from(allFieldIds);
    }, [customFields, enquiriesResponse]);

    const handleRowSelectionChange = (id: string, selected: boolean) => {
        setSelectedRows((prev) => {
            const newSet = new Set(prev);
            if (selected) {
                newSet.add(id);
            } else {
                newSet.delete(id);
            }
            return newSet;
        });
    };

    const handleSelectAll = (selected: boolean) => {
        if (selected && enquiriesResponse?.content) {
            const allIds = enquiriesResponse.content.map(
                (enquiry) => enquiry.enquiry_id || enquiry.audience_response_id || ''
            );
            setSelectedRows(new Set(allIds.filter(Boolean)));
        } else {
            setSelectedRows(new Set());
        }
    };

    const columns = useMemo(() => {
        const allCustomFieldsArray = allFieldIdsFromAllEnquiries.map((fieldId) => ({
            id: fieldId,
            _id: fieldId,
            field_id: fieldId,
        }));

        const fieldIdsToUse = allCustomFieldsArray.length > 0 ? allCustomFieldsArray : customFields;
        return generateDynamicColumns(
            fieldIdsToUse,
            customFieldMap,
            selectedRows,
            handleRowSelectionChange,
            handleSelectAll
        );
    }, [customFields, allFieldIdsFromAllEnquiries, customFieldMap, selectedRows]);

    const tableKey = useMemo(() => {
        const fieldIdsKey =
            allFieldIdsFromAllEnquiries.length > 0
                ? allFieldIdsFromAllEnquiries.sort().join('-')
                : 'default';
        return `enquiry-table-${enquiryId}-${fieldIdsKey}`;
    }, [enquiryId, allFieldIdsFromAllEnquiries]);

    const tableData = useMemo(() => {
        if (
            !enquiriesResponse ||
            !enquiriesResponse.content ||
            enquiriesResponse.content.length === 0
        ) {
            return undefined;
        }

        return {
            content: enquiriesResponse.content.map((enquiry, index) => {
                const customValues = enquiry.custom_fields || {};
                const submittedAt = enquiry.submitted_at
                    ? format(enquiry.submitted_at, 'd MMM, yyyy')
                    : '-';

                // Get class name from package session
                const packageSessionDetails = enquiry.destination_package_session_id
                    ? getDetailsFromPackageSessionId({
                          packageSessionId: enquiry.destination_package_session_id,
                      })
                    : null;

                const className = packageSessionDetails
                    ? `${packageSessionDetails.level.level_name}`
                    : '-';

                const rowData: any = {
                    id: enquiry.enquiry_id || enquiry.audience_response_id || `${index}`,
                    index: page * pageSize + index,

                    // Student Details (from child_user)
                    studentName: enquiry.child_user?.full_name || '-',
                    studentGender: enquiry.child_user?.gender || null,
                    studentDob: enquiry.child_user?.date_of_birth || null,

                    // Parent Details (from parent_user)
                    parentName: enquiry.parent_user?.full_name || enquiry.parent_name || '-',
                    parentEmail: enquiry.parent_user?.email || enquiry.parent_email || '-',
                    parentMobile:
                        enquiry.parent_user?.mobile_number || enquiry.parent_mobile || '-',

                    // Enquiry Details
                    trackingId: enquiry.enquiry_tracking_id || null,
                    className,
                    enquiryStatus: enquiry.enquiry_status || '-',
                    sourceType: enquiry.source_type || '-',
                    assignedCounsellor: enquiry.assigned_counsellor_id || null,
                };

                // Add custom field values
                allFieldIdsFromAllEnquiries.forEach((fieldId) => {
                    const value = customValues[fieldId];
                    rowData[fieldId] =
                        value !== undefined && value !== null && value !== '' ? value : null;
                });

                return rowData as EnquiryTableRow;
            }),
            total_pages: enquiriesResponse.totalPages,
            page_no: enquiriesResponse.number,
            page_size: enquiriesResponse.size,
            total_elements: enquiriesResponse.totalElements,
            last: enquiriesResponse.last,
        };
    }, [enquiriesResponse, allFieldIdsFromAllEnquiries, page, pageSize]);

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    const handleDownload = async () => {
        if (!tableData?.total_elements) return;

        try {
            setIsDownloading(true);
            toast.info('Starting download...');

            const allDataPayload = {
                ...enquiriesPayload,
                page: 0,
                size: tableData.total_elements,
            };

            const response = await fetchEnquiries(allDataPayload);

            if (!response.content || response.content.length === 0) {
                toast.error('No data to download');
                setIsDownloading(false);
                return;
            }

            const csvHeaders = [
                'Enquiry ID',
                'Class',
                'Student Name',
                'Gender',
                'Date of Birth',
                'Parent Name',
                'Parent Email',
                'Parent Mobile',
                'Tracking ID',
                'Status',
                'Source',
                'Counsellor',
                'Submitted At',
            ];

            // Add custom field headers
            allFieldIdsFromAllEnquiries.forEach((fieldId) => {
                const fieldInfo = customFieldMap.get(fieldId);
                const headerName = fieldInfo?.field_name || fieldId;
                csvHeaders.push(headerName);
            });

            const csvRows = response.content.map((enquiry) => {
                const customValues = enquiry.custom_fields || {};
                const submittedAt = enquiry.submitted_at
                    ? convertToLocalDateTime(enquiry.submitted_at)
                    : '-';

                // Get class name
                const packageSessionDetails = enquiry.destination_package_session_id
                    ? instituteDetails?.batches_for_sessions.find(
                          (batch) => batch.id === enquiry.destination_package_session_id
                      )
                    : null;

                const className = packageSessionDetails
                    ? `${packageSessionDetails.level.level_name}`
                    : '-';

                // Format DOB as dd/MM/yyyy
                const formatDOB = (dob: string | null | undefined) => {
                    if (!dob) return '-';
                    try {
                        const date = new Date(dob);
                        if (!isNaN(date.getTime())) {
                            const day = String(date.getDate()).padStart(2, '0');
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const year = date.getFullYear();
                            return `${day}/${month}/${year}`;
                        }
                    } catch (e) {
                        return '-';
                    }
                    return '-';
                };

                const safeString = (val: any) => {
                    if (val === undefined || val === null) return '';
                    const str = String(val);
                    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                };

                const row = [
                    safeString(enquiry.enquiry_id || '-'),
                    safeString(className),
                    safeString(enquiry.child_user?.full_name || '-'),
                    safeString(enquiry.child_user?.gender || '-'),
                    safeString(formatDOB(enquiry.child_user?.date_of_birth)),
                    safeString(enquiry.parent_user?.full_name || enquiry.parent_name || '-'),
                    safeString(enquiry.parent_user?.email || enquiry.parent_email || '-'),
                    safeString(enquiry.parent_user?.mobile_number || enquiry.parent_mobile || '-'),
                    safeString(enquiry.enquiry_tracking_id || '-'),
                    safeString(enquiry.enquiry_status || '-'),
                    safeString(enquiry.source_type || '-'),
                    safeString(enquiry.assigned_counsellor_id ? 'Assigned' : 'Not Assigned'),
                    safeString(submittedAt),
                ];

                allFieldIdsFromAllEnquiries.forEach((fieldId) => {
                    const value = customValues[fieldId];
                    row.push(safeString(value));
                });
                return row.join(',');
            });

            const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute(
                'download',
                `${enquiryName || 'enquiries'}_${new Date().toISOString().split('T')[0]}.csv`
            );
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success('Download completed successfully');
        } catch (error) {
            console.error('Download failed:', error);
            toast.error('Failed to download data');
        } finally {
            setIsDownloading(false);
        }
    };

    if (isLoading || isCustomFieldsLoading) {
        return (
            <div className="flex w-full flex-col items-center gap-4 py-12">
                <DashboardLoader />
                <p className="animate-pulse text-sm text-neutral-500">
                    Loading enquiry responses...
                </p>
            </div>
        );
    }

    if (error || customFieldsError) {
        return (
            <div className="flex h-[70vh] w-full flex-col items-center justify-center gap-2">
                <p className="text-red-500">Error loading enquiry responses</p>
            </div>
        );
    }

    if (!tableData || tableData.content.length === 0) {
        return (
            <div className="flex h-[70vh] w-full flex-col items-center justify-center gap-2">
                <EmptyInvitePage />
                <p>No responses for this enquiry yet!</p>
                <MyButton
                    buttonType="secondary"
                    onClick={() => navigate({ to: `/admissions/new-enquiry/${enquiryId}` })}
                >
                    Add Response
                </MyButton>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-h3 font-semibold">{enquiryName}</h2>
                    <p className="mt-1 text-sm text-neutral-600">
                        Total Responses:{' '}
                        <span className="font-semibold">{tableData.total_elements}</span>
                    </p>
                    {selectedRows.size > 0 && (
                        <p className="mt-1 text-sm text-primary-600">
                            {selectedRows.size} row(s) selected
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate({ to: `/admissions/new-enquiry/${enquiryId}` })}
                    >
                        <UserPlus className="mr-2 size-4" />
                        Add Response
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownload}
                        disabled={isDownloading || !tableData?.total_elements}
                    >
                        <Download className="mr-2 size-4" />
                        {isDownloading ? 'Downloading...' : 'Download CSV'}
                    </Button>
                </div>
            </div>

            <div className="rounded-md shadow-sm">
                <MyTable<EnquiryTableRow>
                    key={tableKey}
                    data={tableData}
                    columns={columns}
                    isLoading={isLoading || isCustomFieldsLoading}
                    error={error || customFieldsError}
                    currentPage={page}
                    tableState={{ columnVisibility: {} }}
                />
            </div>

            {tableData.total_pages > 1 && (
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handlePageChange(Math.max(0, page - 1))}
                                disabled={page === 0}
                            >
                                <span className="sr-only">Previous</span>
                                <ChevronLeft className="size-4" />
                            </Button>
                        </PaginationItem>
                        <PaginationItem className="hidden sm:block">
                            <span className="px-4 text-sm text-muted-foreground">
                                Page {page + 1} of {tableData.total_pages}
                            </span>
                        </PaginationItem>
                        <PaginationItem>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                    handlePageChange(Math.min(tableData.total_pages - 1, page + 1))
                                }
                                disabled={page >= tableData.total_pages - 1}
                            >
                                <span className="sr-only">Next</span>
                                <ChevronRight className="size-4" />
                            </Button>
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}
        </div>
    );
};
