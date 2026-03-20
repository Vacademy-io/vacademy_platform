import { useMemo, useState, useEffect } from 'react';
import { MyTable } from '@/components/design-system/table';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import EmptyInvitePage from '@/assets/svgs/empty-invite-page.svg';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { ChevronLeft, ChevronRight, Download, UserPlus } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useCampaignUsers } from '../../-hooks/useCampaignUsers';
import {
    campaignUsersColumns,
    CampaignUserTable,
    generateDynamicColumns,
} from './campaign-users-columns';
import { convertToLocalDateTime } from '@/constants/helper';
import { useCustomFieldSetup } from '../../-hooks/useCustomFieldSetup';
import { CustomFieldSetupItem } from '../../-services/get-custom-field-setup';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { toast } from 'sonner';
import { fetchCampaignLeads } from '../../-services/get-campaign-users';

// Helper function to generate key from name
const generateKeyFromName = (name: string): string =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

interface CampaignUsersTableProps {
    campaignId: string;
    campaignName?: string;
    customFieldsJson?: string;
}

export const CampaignUsersTable = ({
    campaignId,
    campaignName,
    customFieldsJson,
}: CampaignUsersTableProps) => {
    const [page, setPage] = useState(0);
    const pageSize = 10;
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id;
    const [isDownloading, setIsDownloading] = useState(false);
    const navigate = useNavigate();

    // Reset page when campaign changes
    useEffect(() => {
        setPage(0);
        console.log('🔄 [CampaignUsersTable] Campaign changed, resetting page to 0');
    }, [campaignId]);

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

    const leadsPayload = useMemo(
        () => ({
            audience_id: campaignId,
            page,
            size: pageSize,
            sort_by: 'submitted_at_local',
            sort_direction: 'DESC',
        }),
        [campaignId, page, pageSize]
    );

    const { data: usersResponse, isLoading, error } = useCampaignUsers(leadsPayload);

    const allFieldIdsFromAllUsers = useMemo(() => {
        const allFieldIds = new Set<string>();

        if (customFields && customFields.length > 0) {
            customFields.forEach((campaignField: any) => {
                const fieldId =
                    campaignField.custom_field?.id ||
                    campaignField.id ||
                    campaignField._id ||
                    campaignField.field_id;
                if (fieldId) {
                    allFieldIds.add(fieldId);
                }
            });
        }

        if (usersResponse && usersResponse.content) {
            usersResponse.content.forEach((lead: any) => {
                const customValues = lead.custom_field_values || {};
                Object.keys(customValues).forEach((fieldId) => {
                    allFieldIds.add(fieldId);
                });
            });
        }

        return Array.from(allFieldIds);
    }, [customFields, usersResponse]);

    const campaignFieldsMap = useMemo(() => {
        const map = new Map<string, { name: string; key?: string }>();
        if (!customFields || customFields.length === 0) {
            return map;
        }

        customFields.forEach((campaignField: any) => {
            const fieldId =
                campaignField.custom_field?.id ||
                campaignField.id ||
                campaignField._id ||
                campaignField.field_id;

            if (fieldId) {
                const meta = campaignField.custom_field || {};
                const fieldName =
                    meta.fieldName || meta.field_name || campaignField.field_name || '';
                const fieldKey = meta.fieldKey || meta.field_key || generateKeyFromName(fieldName);

                if (fieldName) {
                    map.set(fieldId, { name: fieldName, key: fieldKey });
                    map.set(fieldId.toLowerCase(), { name: fieldName, key: fieldKey });
                    map.set(fieldId.toUpperCase(), { name: fieldName, key: fieldKey });
                }
            }
        });
        return map;
    }, [customFields]);

    const columns = useMemo(() => {
        const allCustomFieldsArray = allFieldIdsFromAllUsers.map((fieldId) => ({
            id: fieldId,
            _id: fieldId,
            field_id: fieldId,
        }));

        if (allCustomFieldsArray.length === 0 && customFields.length === 0) {
            return campaignUsersColumns;
        }

        const fieldIdsToUse = allCustomFieldsArray.length > 0 ? allCustomFieldsArray : customFields;
        const generatedColumns = generateDynamicColumns(fieldIdsToUse, customFieldMap);
        return generatedColumns;
    }, [customFields, allFieldIdsFromAllUsers, customFieldMap]);

    const tableKey = useMemo(() => {
        const fieldIdsKey =
            allFieldIdsFromAllUsers.length > 0
                ? allFieldIdsFromAllUsers.sort().join('-')
                : 'default';
        return `campaign-users-table-${campaignId}-${fieldIdsKey}`;
    }, [campaignId, allFieldIdsFromAllUsers]);

    const tableData = useMemo(() => {
        if (!usersResponse || !usersResponse.content || usersResponse.content.length === 0) {
            return undefined;
        }

        return {
            content: usersResponse.content.map((lead, index) => {
                const user = lead.user || {};
                const customValues = lead.custom_field_values || {};
                const submittedAt = lead.submitted_at_local
                    ? convertToLocalDateTime(lead.submitted_at_local)
                    : '-';

                const rowData: any = {
                    id: lead.response_id || lead.user_id || `${index}`,
                    submittedAt,
                    index: page * pageSize + index,
                };

                allFieldIdsFromAllUsers.forEach((fieldId) => {
                    let fieldInfo =
                        customFieldMap.get(fieldId) ||
                        customFieldMap.get(fieldId.toLowerCase()) ||
                        customFieldMap.get(fieldId.toUpperCase()) ||
                        customFieldMap.get(fieldId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());

                    if (!fieldInfo && customFieldMap.size > 0) {
                        for (const [key, field] of customFieldMap.entries()) {
                            const customFieldId = field.custom_field_id?.toLowerCase();
                            const fieldKey = field.field_key?.toLowerCase();
                            const searchId = fieldId.toLowerCase();

                            if (
                                customFieldId === searchId ||
                                fieldKey === searchId ||
                                customFieldId?.replace(/[^a-zA-Z0-9]/g, '') ===
                                    searchId.replace(/[^a-zA-Z0-9]/g, '') ||
                                fieldKey?.replace(/[^a-zA-Z0-9]/g, '') ===
                                    searchId.replace(/[^a-zA-Z0-9]/g, '')
                            ) {
                                fieldInfo = field;
                                break;
                            }
                        }
                    }

                    let value: any = customValues[fieldId];

                    if (value === undefined || value === null || value === '') {
                        if (fieldInfo && fieldInfo.field_key) {
                            const fieldKey = fieldInfo.field_key;
                            value = (user as any)[fieldKey];

                            if (value === undefined || value === null) {
                                if (fieldKey === 'phone_number' && user.mobile_number) {
                                    value = user.mobile_number;
                                } else if (fieldKey === 'phone' && user.mobile_number) {
                                    value = user.mobile_number;
                                } else if (fieldKey === 'full_name' && user.full_name) {
                                    value = user.full_name;
                                } else if (fieldKey === 'email' && user.email) {
                                    value = user.email;
                                }
                            }
                        } else {
                            if (fieldId === 'full_name' || fieldId === 'name') {
                                value = user.full_name || (user as any).name;
                            } else if (fieldId === 'email') {
                                value = user.email;
                            }
                        }
                    }

                    rowData[fieldId] =
                        value !== undefined && value !== null && value !== '' ? value : null;
                });

                return rowData as CampaignUserTable;
            }),
            total_pages: usersResponse.totalPages,
            page_no: usersResponse.number,
            page_size: usersResponse.size,
            total_elements: usersResponse.totalElements,
            last: usersResponse.last,
        };
    }, [usersResponse, allFieldIdsFromAllUsers, customFieldMap, page, pageSize]);

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    const handleDownload = async () => {
        if (!tableData?.total_elements) return;

        try {
            setIsDownloading(true);
            toast.info('Starting download...');

            const allDataPayload = {
                ...leadsPayload,
                page: 0,
                size: tableData.total_elements,
            };

            const response = await fetchCampaignLeads(allDataPayload);

            if (!response.content || response.content.length === 0) {
                toast.error('No data to download');
                setIsDownloading(false);
                return;
            }

            const allFieldIds = new Set<string>();
            customFields.forEach((field: any) => {
                const fieldId = field.custom_field?.id || field.id || field._id || field.field_id;
                if (fieldId) allFieldIds.add(fieldId);
            });
            response.content.forEach((lead: any) => {
                const customValues = lead.custom_field_values || {};
                Object.keys(customValues).forEach((key) => allFieldIds.add(key));
            });

            const fieldIdsArray = Array.from(allFieldIds);

            const csvHeaders = ['Lead ID', 'Submitted At', 'Name', 'Email', 'Mobile'];
            const fieldIdToHeaderNameMap: Record<string, string> = {};

            fieldIdsArray.forEach((fieldId) => {
                let headerName = fieldId;
                let fieldInfo =
                    customFieldMap.get(fieldId) ||
                    customFieldMap.get(fieldId.toLowerCase()) ||
                    customFieldMap.get(fieldId.toUpperCase()) ||
                    customFieldMap.get(fieldId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());

                if (!fieldInfo && customFieldMap.size > 0) {
                    for (const [key, field] of customFieldMap.entries()) {
                        const customFieldId = field.custom_field_id?.toLowerCase();
                        const fieldKey = field.field_key?.toLowerCase();
                        const searchId = fieldId.toLowerCase();

                        if (
                            customFieldId === searchId ||
                            fieldKey === searchId ||
                            customFieldId?.replace(/[^a-zA-Z0-9]/g, '') ===
                                searchId.replace(/[^a-zA-Z0-9]/g, '') ||
                            fieldKey?.replace(/[^a-zA-Z0-9]/g, '') ===
                                searchId.replace(/[^a-zA-Z0-9]/g, '')
                        ) {
                            fieldInfo = field;
                            break;
                        }
                    }
                }

                if (fieldInfo && fieldInfo.field_name) {
                    headerName = fieldInfo.field_name;
                } else if (campaignFieldsMap.has(fieldId)) {
                    headerName = campaignFieldsMap.get(fieldId)?.name || fieldId;
                }

                if (headerName.includes(',')) headerName = `"${headerName}"`;

                fieldIdToHeaderNameMap[fieldId] = headerName;
                csvHeaders.push(headerName);
            });

            const csvRows = response.content.map((lead) => {
                const user = lead.user || {};
                const customValues = lead.custom_field_values || {};
                const submittedAt = lead.submitted_at_local
                    ? convertToLocalDateTime(lead.submitted_at_local)
                    : '-';

                const safeString = (val: any) => {
                    if (val === undefined || val === null) return '';
                    const str = String(val);
                    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                };

                const row = [
                    safeString(lead.response_id || lead.user_id || '-'),
                    safeString(submittedAt),
                    safeString(user.full_name || (user as any).name || '-'),
                    safeString(user.email || '-'),
                    safeString(user.mobile_number || '-'),
                ];

                fieldIdsArray.forEach((fieldId) => {
                    let value: any = customValues[fieldId];
                    if (value === undefined || value === null || value === '') {
                        const fieldInfo =
                            customFieldMap.get(fieldId) ||
                            customFieldMap.get(fieldId.toLowerCase());

                        if (fieldInfo && fieldInfo.field_key) {
                            const k = fieldInfo.field_key;
                            if (k === 'email') value = user.email;
                            else if (k === 'phone' || k === 'phone_number')
                                value = user.mobile_number;
                            else if (k === 'full_name' || k === 'name') value = user.full_name;
                            else value = (user as any)[k];
                        }
                    }
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
                `${campaignName || 'campaign_users'}_${new Date().toISOString().split('T')[0]}.csv`
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
                <p className="animate-pulse text-sm text-neutral-500">Loading campaign users...</p>
            </div>
        );
    }

    if (error || customFieldsError) {
        return (
            <div className="flex h-[70vh] w-full flex-col items-center justify-center gap-2">
                <p className="text-red-500">Error loading campaign users</p>
            </div>
        );
    }

    if (!tableData || tableData.content.length === 0) {
        return (
            <div className="flex h-[70vh] w-full flex-col items-center justify-center gap-2">
                <EmptyInvitePage />
                <p>No users enrolled in this campaign yet!</p>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6">
            {campaignName && (
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-h3 font-semibold">{campaignName}</h2>
                        <p className="mt-1 text-sm text-neutral-600">
                            Total Users:{' '}
                            <span className="font-semibold">{tableData.total_elements}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                navigate({
                                    to: '/audience-manager/list/campaign-users/add' as any,
                                    search: {
                                        campaignId,
                                        campaignName,
                                        customFields: customFieldsJson,
                                    } as any,
                                } as any)
                            }
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
            )}

            <div className="rounded-md shadow-sm">
                <MyTable<CampaignUserTable>
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
