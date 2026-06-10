/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import { useEffect, useState } from 'react';
import { OnChangeFn, RowSelectionState } from '@tanstack/react-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    getAllColumnsForTable,
    getAllColumnsForTableWidth,
    getAssessmentSubmissionsFilteredDataStudentData,
} from '../-utils/helper';
import { Route } from '..';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getInstituteId } from '@/constants/helper';
import {
    getAdminParticipants,
    handleGetAssessmentTotalMarksData,
    handleExportResultCSV,
} from '../-services/assessment-details-services';
import { MyPagination } from '@/components/design-system/pagination';
import { MyButton } from '@/components/design-system/button';
import { ArrowCounterClockwise, Export } from '@phosphor-icons/react';
import { AssessmentDetailsSearchComponent } from './SearchComponent';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { useFilterDataForAssesment } from '@/routes/assessment/assessment-list/-utils.ts/useFiltersData';
import { ScheduleTestFilters } from '@/routes/assessment/assessment-list/-components/ScheduleTestFilters';
import { MyFilterOption } from '@/types/assessments/my-filter';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import AssessmentSubmissionsFilterButtons from './AssessmentSubmissionsFilterButtons';
import { StudentSidebar } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-side-view';
import { SidebarProvider } from '@/components/ui/sidebar';
import { StudentSidebarContext } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { BulkActions } from './bulk-actions/bulk-actions';
import { AssessmentSubmissionsStudentTable } from './AssessmentSubmissionsStudentTable';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import AssessmentGlobalLevelRevaluateAssessment from './assessment-global-level-revaluate/assessment-global-level-revaluate-assessment';
import { AssessmentGlobalLevelRevaluateQuestionWise } from './assessment-global-level-revaluate/assessment-global-level-revaluate-question-wise';
import { AssessmentGlobalLevelReleaseResultAssessment } from './assessment-global-level-revaluate/assessment-global-level-release-result-assessment';
import Papa from 'papaparse';
import { useRef } from 'react';
import { useUsersCredentials } from '@/routes/manage-students/students-list/-services/usersCredentials';
import { OpenStudentSidebar } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/open-student-side-view';
import { useNavigate } from '@tanstack/react-router';
import { getAssessmentSettingsFromCache } from '@/services/assessment-settings';
import { cn } from '@/lib/utils';

export interface SelectedSubmissionsFilterInterface {
    name: string;
    assessment_type: string;
    attempt_type: string[];
    registration_source: string;
    batches: MyFilterOption[];
    status: string[];
    sort_columns: Record<string, string>;
}

export interface SelectedReleaseResultFilterInterface {
    attempt_ids: string[];
}

const AssessmentSubmissionsTab = ({ type }: { type: string }) => {
    const navigate = useNavigate();
    const { data: initData } = useSuspenseQuery(useInstituteQuery());
    const { BatchesFilterData } = useFilterDataForAssesment(initData);
    const instituteId = getInstituteId();
    const { assessmentId, examType, assesssmentType, assessmentTab } = Route.useParams();
    const assessmentSettings = getAssessmentSettingsFromCache();
    const isOfflineEntryEnabled = assessmentSettings.offlineEntry.enabled;
    const { data: totalMarks } = useSuspenseQuery(
        handleGetAssessmentTotalMarksData({ assessmentId })
    );
    const [selectedParticipantsTab, setSelectedParticipantsTab] = useState('internal');
    const [selectedTab, setSelectedTab] = useState('Attempted');
    const [batchSelectionTab, setBatchSelectionTab] = useState('batch');
    const [page, setPage] = useState(0);
    const [selectedStudent, setSelectedStudent] = useState<StudentTable | null>(null);
    const [selectedFilter, setSelectedFilter] = useState<SelectedSubmissionsFilterInterface>({
        name: '',
        assessment_type: assesssmentType,
        attempt_type: ['ENDED'],
        registration_source: 'BATCH_PREVIEW_REGISTRATION',
        batches: [],
        status: ['ACTIVE'],
        sort_columns: {},
    });

    const [searchText, setSearchText] = useState('');
    const [participantsData, setParticipantsData] = useState({
        content: [],
        total_pages: 0,
        page_no: 0,
        page_size: 10,
        total_elements: 0,
        last: false,
    });
    const [isParticipantsLoading, setIsParticipantsLoading] = useState(false);

    const [rowSelections, setRowSelections] = useState<Record<number, Record<string, boolean>>>({});
    const currentPageSelection = rowSelections[page] || {};
    const totalSelectedCount = Object.values(rowSelections).reduce(
        (count, pageSelection) => count + Object.keys(pageSelection).length,
        0
    );

    const [attemptedCount, setAttemptedCount] = useState(0);
    const [ongoingCount, setOngoingCount] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const getParticipantsListData = useMutation({
        mutationFn: ({
            assessmentId,
            instituteId,
            pageNo,
            pageSize,
            selectedFilter,
        }: {
            assessmentId: string;
            instituteId: string | undefined;
            pageNo: number;
            pageSize: number;
            selectedFilter: SelectedSubmissionsFilterInterface;
        }) => getAdminParticipants(assessmentId, instituteId, pageNo, pageSize, selectedFilter),
        onSuccess: (data) => {
            console.log('submissions data', data);
            setParticipantsData(data);
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const [allPagesData, setAllPagesData] = useState<Record<number, StudentTable[]>>({});

    const handleRowSelectionChange: OnChangeFn<RowSelectionState> = (updaterOrValue) => {
        const newSelection =
            typeof updaterOrValue === 'function'
                ? updaterOrValue(rowSelections[page] || {})
                : updaterOrValue;

        setRowSelections((prev) => ({
            ...prev,
            [page]: newSelection,
        }));
    };

    const handleResetSelections = () => {
        setRowSelections({});
    };

    const getSelectedStudents = (): StudentTable[] => {
        return Object.entries(rowSelections).flatMap(([pageNum, selections]) => {
            const pageData = allPagesData[parseInt(pageNum)];
            if (!pageData) return [];

            return Object.entries(selections)
                .filter(([, isSelected]) => isSelected)
                .map(([index]) => pageData[parseInt(index)])
                .filter((student): student is StudentTable => student !== undefined);
        });
    };

    const getSelectedStudentIds = (): string[] => {
        return getSelectedStudents().map((student) => student.user_id);
    };

    const getAssessmentColumn = {
        Attempted: getAllColumnsForTable(type, selectedParticipantsTab).Attempted,
        Pending: getAllColumnsForTable(type, selectedParticipantsTab).Pending,
        Ongoing: getAllColumnsForTable(type, selectedParticipantsTab).Ongoing,
    };

    const getAssessmentColumnWidth = {
        Attempted: getAllColumnsForTableWidth(type, selectedParticipantsTab).Attempted,
        Pending: getAllColumnsForTableWidth(type, selectedParticipantsTab).Pending,
        Ongoing: getAllColumnsForTableWidth(type, selectedParticipantsTab).Ongoing,
    };

    const handleAttemptedTab = (value: string) => {
        setSelectedTab(value);
        if (selectedParticipantsTab === 'internal' && batchSelectionTab === 'batch') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'BATCH_PREVIEW_REGISTRATION',
                    attempt_type: [
                        value === 'Attempted' ? 'ENDED' : value === 'Pending' ? 'PENDING' : 'LIVE',
                    ],
                },
            });
        }

        if (selectedParticipantsTab === 'internal' && batchSelectionTab === 'individual') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'ADMIN_PRE_REGISTRATION',
                    attempt_type: [
                        value === 'Attempted' ? 'ENDED' : value === 'Pending' ? 'PENDING' : 'LIVE',
                    ],
                },
            });
        }

        if (selectedParticipantsTab === 'external') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'OPEN_REGISTRATION',
                    attempt_type: [
                        value === 'Attempted' ? 'ENDED' : value === 'Pending' ? 'PENDING' : 'LIVE',
                    ],
                },
            });
        }
    };

    const handleParticipantsTab = (value: string) => {
        setSelectedParticipantsTab(value);
        if (value === 'internal' && batchSelectionTab === 'batch') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'BATCH_PREVIEW_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }

        if (value === 'internal' && batchSelectionTab === 'individual') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'ADMIN_PRE_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }

        if (value === 'external') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'OPEN_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }
    };

    const handleBatchSeletectionTab = (value: string) => {
        setBatchSelectionTab(value);
        if (selectedParticipantsTab === 'internal' && value === 'batch') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'BATCH_PREVIEW_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }

        if (selectedParticipantsTab === 'internal' && value === 'individual') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'ADMIN_PRE_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }

        if (selectedParticipantsTab === 'external') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'OPEN_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }
    };

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        if (selectedParticipantsTab === 'internal' && batchSelectionTab === 'batch') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: newPage,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'BATCH_PREVIEW_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }

        if (selectedParticipantsTab === 'internal' && batchSelectionTab === 'individual') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: newPage,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'ADMIN_PRE_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }

        if (selectedParticipantsTab === 'external') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: newPage,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'OPEN_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }
    };

    const handleRefreshLeaderboard = () => {
        if (selectedParticipantsTab === 'internal' && batchSelectionTab === 'batch') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'BATCH_PREVIEW_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }

        if (selectedParticipantsTab === 'internal' && batchSelectionTab === 'individual') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'ADMIN_PRE_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }

        if (selectedParticipantsTab === 'external') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'OPEN_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }
    };

    const clearSearch = () => {
        setSearchText('');
        selectedFilter['name'] = '';
        if (selectedParticipantsTab === 'internal' && batchSelectionTab === 'batch') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'BATCH_PREVIEW_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }

        if (selectedParticipantsTab === 'internal' && batchSelectionTab === 'individual') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'ADMIN_PRE_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }

        if (selectedParticipantsTab === 'external') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    registration_source: 'OPEN_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }
    };

    const handleSearch = (searchValue: string) => {
        setSearchText(searchValue);
        if (selectedParticipantsTab === 'internal' && batchSelectionTab === 'batch') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    name: searchValue,
                    registration_source: 'BATCH_PREVIEW_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }

        if (selectedParticipantsTab === 'internal' && batchSelectionTab === 'individual') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    name: searchValue,
                    registration_source: 'ADMIN_PRE_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }

        if (selectedParticipantsTab === 'external') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    name: searchValue,
                    registration_source: 'OPEN_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }
    };

    const handleFilterChange = (filterKey: string, selectedItems: MyFilterOption[]) => {
        setSelectedFilter((prev) => {
            const updatedFilters = { ...prev, [filterKey]: selectedItems };
            return updatedFilters;
        });
    };

    const handleResetFilters = () => {
        setSelectedFilter((prevFilter) => ({
            ...prevFilter,
            name: '',
            batches: [],
        }));
        setSearchText('');
        if (selectedParticipantsTab === 'internal' && batchSelectionTab === 'batch') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    name: '',
                    batches: [],
                    registration_source: 'BATCH_PREVIEW_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }

        if (selectedParticipantsTab === 'internal' && batchSelectionTab === 'individual') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    name: '',
                    batches: [],
                    registration_source: 'ADMIN_PRE_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }

        if (selectedParticipantsTab === 'external') {
            getParticipantsListData.mutate({
                assessmentId,
                instituteId,
                pageNo: page,
                pageSize: 10,
                selectedFilter: {
                    ...selectedFilter,
                    name: '',
                    batches: [],
                    registration_source: 'OPEN_REGISTRATION',
                    attempt_type: [
                        selectedTab === 'Attempted'
                            ? 'ENDED'
                            : selectedTab === 'Pending'
                              ? 'PENDING'
                              : 'LIVE',
                    ],
                },
            });
        }
    };

    const [isExportingCSV, setIsExportingCSV] = useState(false);

    const handleExportCSV = async () => {
        setIsExportingCSV(true);
        try {
            const data = await handleExportResultCSV(
                initData?.id,
                assessmentId,
                assesssmentType
            );
            if (!data) {
                toast.error('No data returned. Please try again.');
                return;
            }
            const parsed = Papa.parse(data, { header: true, skipEmptyLines: true }).data;
            const csv = Papa.unparse(parsed);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute(
                'download',
                `results_${assessmentId}_${new Date().toLocaleDateString()}.csv`
            );
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('Results exported successfully.');
        } catch {
            toast.error('Failed to export CSV. Please try again.');
        } finally {
            setIsExportingCSV(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            const fetchAllParticipants = async () => {
                setIsParticipantsLoading(true);

                try {
                    const [attemptedData, ongoingData, pendingData] = await Promise.all([
                        getAdminParticipants(assessmentId, instituteId, page, 10, selectedFilter),
                        getAdminParticipants(assessmentId, instituteId, page, 10, {
                            ...selectedFilter,
                            attempt_type: ['LIVE'],
                        }),
                        getAdminParticipants(assessmentId, instituteId, page, 10, {
                            ...selectedFilter,
                            attempt_type: ['Pending'],
                        }),
                    ]);
                    console.log('participants data', attemptedData);
                    setParticipantsData(attemptedData);
                    setAttemptedCount(attemptedData.content.length);
                    setOngoingCount(ongoingData.content.length);
                    setPendingCount(pendingData.content.length);
                } catch (error) {
                    console.log(error);
                } finally {
                    setIsParticipantsLoading(false);
                }
            };
            fetchAllParticipants();
        }, 300); // Adjust the debounce time as needed

        return () => clearTimeout(timer); // Cleanup the timeout on component unmount
    }, []);

    useEffect(() => {
        if (participantsData?.content) {
            setAllPagesData((prev) => ({
                ...prev,
                [page]: participantsData.content,
            }));
        }
    }, [participantsData?.content, page]);

    const tableRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element | null;
            // Side-view panel + any portaled overlay (dialog, menu, popover/select,
            // toast) render at <body>, outside tableRef. Treat clicks inside them as
            // "inside" so e.g. closing the Assign-Course dialog doesn't also close
            // the side view.
            if (
                target?.closest(
                    '[data-sidebar="sidebar"],[role="dialog"],[role="menu"],[role="listbox"],[data-radix-popper-content-wrapper],[data-sonner-toaster]'
                )
            )
                return;
            if (
                tableRef.current &&
                !tableRef.current.contains(event.target as Node) &&
                isSidebarOpen
            ) {
                setIsSidebarOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSidebarOpen]);

    const getUserCredentialsMutation = useUsersCredentials();

    async function getCredentials() {
        const ids = participantsData?.content.map((student: StudentTable) => student.user_id);
        if (!ids || ids.length === 0) {
            return;
        }
        const credentials = await getUserCredentialsMutation.mutateAsync({ userIds: ids || [] });
        return credentials;
    }

    useEffect(() => {
        async function fetchCredentials() {
            if (participantsData?.content && participantsData.content.length > 0) {
                await getCredentials();
            }
        }
        fetchCredentials();
    }, [participantsData]);

    if (isParticipantsLoading) return <DashboardLoader />;

    return (
        <StudentSidebarContext.Provider value={{ selectedStudent, setSelectedStudent }}>
            <Tabs
                value={selectedTab}
                onValueChange={handleAttemptedTab}
                className="flex w-full flex-col gap-4"
            >
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <TabsList className="mb-2 ml-4 mt-6 inline-flex h-auto justify-start gap-4 rounded-none border-b !bg-transparent p-0">
                        <TabsTrigger
                            value="Attempted"
                            className={`flex gap-1.5 rounded-none px-6 py-2 !shadow-none ${
                                selectedTab === 'Attempted'
                                    ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                    : 'border-none bg-transparent'
                            }`}
                        >
                            <span
                                className={`${
                                    selectedTab === 'Attempted' ? 'text-primary-500' : ''
                                }`}
                            >
                                Attempted
                            </span>
                            <Badge
                                className="rounded-full bg-primary-500 p-0 px-2 text-xs text-white"
                                variant="outline"
                            >
                                {attemptedCount}
                            </Badge>
                        </TabsTrigger>
                        {assessmentTab !== 'previousTests' && (
                            <TabsTrigger
                                value="Ongoing"
                                className={`flex gap-1.5 rounded-none px-6 py-2 !shadow-none ${
                                    selectedTab === 'Ongoing'
                                        ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                        : 'border-none bg-transparent'
                                }`}
                            >
                                <span
                                    className={`${
                                        selectedTab === 'Ongoing' ? 'text-primary-500' : ''
                                    }`}
                                >
                                    Ongoing
                                </span>
                                <Badge
                                    className="rounded-full bg-primary-500 p-0 px-2 text-xs text-white"
                                    variant="outline"
                                >
                                    {ongoingCount}
                                </Badge>
                            </TabsTrigger>
                        )}
                        <TabsTrigger
                            value="Pending"
                            className={`flex gap-1.5 rounded-none px-6 py-2 !shadow-none ${
                                selectedTab === 'Pending'
                                    ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                    : 'border-none bg-transparent'
                            }`}
                        >
                            <span
                                className={`${selectedTab === 'Pending' ? 'text-primary-500' : ''}`}
                            >
                                Pending
                            </span>
                            <Badge
                                className="rounded-full bg-primary-500 p-0 px-2 text-xs text-white"
                                variant="outline"
                            >
                                {pendingCount}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>
                    <div className="mr-4 mt-4 flex items-center gap-2">
                        <MyButton
                            type="button"
                            scale="small"
                            buttonType="secondary"
                            className="font-medium"
                            onClick={handleExportCSV}
                            disable={isExportingCSV}
                        >
                            <Export size={16} />
                            {isExportingCSV ? 'Exporting…' : 'Export'}
                        </MyButton>
                        {isOfflineEntryEnabled && (
                            <MyButton
                                type="button"
                                scale="small"
                                buttonType="primary"
                                className="font-medium"
                                onClick={() =>
                                    navigate({
                                        to: '/assessment/assessment-list/offline-entry/$assessmentId',
                                        params: { assessmentId },
                                    })
                                }
                            >
                                Offline Entry
                            </MyButton>
                        )}
                        <MyButton
                            type="button"
                            scale="small"
                            buttonType="secondary"
                            className="min-w-8"
                            onClick={handleRefreshLeaderboard}
                        >
                            <ArrowCounterClockwise size={18} />
                        </MyButton>
                    </div>
                </div>
                {/* Unified toolbar row: participant toggles + sub-tabs on the left, filters + actions on the right */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 bg-white px-4 py-3">
                    {/* LEFT CLUSTER — participant type + (when internal) batch/individual sub-tabs */}
                    <div className="flex flex-wrap items-center gap-2">
                        {assesssmentType === 'PUBLIC' && (
                            <div className="flex items-center overflow-hidden rounded-lg border border-neutral-200">
                                <button
                                    type="button"
                                    onClick={() => handleParticipantsTab('internal')}
                                    className={cn(
                                        'px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        selectedParticipantsTab === 'internal'
                                            ? 'bg-primary-50 text-primary-600'
                                            : 'bg-white text-neutral-600 hover:bg-neutral-50'
                                    )}
                                >
                                    Internal
                                </button>
                                <div className="h-5 w-px bg-neutral-200" />
                                <button
                                    type="button"
                                    onClick={() => handleParticipantsTab('external')}
                                    className={cn(
                                        'px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        selectedParticipantsTab === 'external'
                                            ? 'bg-primary-50 text-primary-600'
                                            : 'bg-white text-neutral-600 hover:bg-neutral-50'
                                    )}
                                >
                                    External
                                </button>
                            </div>
                        )}

                        {/* Batch / Individual sub-tabs — only when viewing internal participants */}
                        {selectedParticipantsTab === 'internal' && (
                            <div className="flex items-center overflow-hidden rounded-lg border border-neutral-200">
                                <button
                                    type="button"
                                    onClick={() => handleBatchSeletectionTab('batch')}
                                    className={cn(
                                        'px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        batchSelectionTab === 'batch'
                                            ? 'bg-primary-50 text-primary-600'
                                            : 'bg-white text-neutral-600 hover:bg-neutral-50'
                                    )}
                                >
                                    Batch Selection
                                </button>
                                <div className="h-5 w-px bg-neutral-200" />
                                <button
                                    type="button"
                                    onClick={() => handleBatchSeletectionTab('individual')}
                                    className={cn(
                                        'px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        batchSelectionTab === 'individual'
                                            ? 'bg-primary-50 text-primary-600'
                                            : 'bg-white text-neutral-600 hover:bg-neutral-50'
                                    )}
                                >
                                    Individual Selection
                                </button>
                            </div>
                        )}
                    </div>

                    {/* RIGHT CLUSTER — search, filters, and (when Attempted) revaluate + release */}
                    <div className="flex flex-wrap items-center gap-2">
                        <AssessmentDetailsSearchComponent
                            onSearch={handleSearch}
                            searchText={searchText}
                            setSearchText={setSearchText}
                            clearSearch={clearSearch}
                        />
                        <ScheduleTestFilters
                            label={getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch)}
                            data={BatchesFilterData}
                            selectedItems={selectedFilter['batches'] || []}
                            onSelectionChange={(items) => handleFilterChange('batches', items)}
                        />
                        <AssessmentSubmissionsFilterButtons
                            selectedQuestionPaperFilters={selectedFilter}
                            handleSubmitFilters={handleRefreshLeaderboard}
                            handleResetFilters={handleResetFilters}
                        />

                        {/* Revaluate + Release Result — visible for all participant types when Attempted */}
                        {selectedTab === 'Attempted' && (
                            <>
                                <div className="h-5 w-px bg-neutral-200" />
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <MyButton
                                            type="button"
                                            scale="small"
                                            buttonType="secondary"
                                            className="font-medium"
                                        >
                                            Revaluate
                                        </MyButton>
                                    </DialogTrigger>
                                    <DialogContent className="p-0">
                                        <h1 className="rounded-t-lg bg-primary-50 p-4 text-primary-500">
                                            Revaluate Result
                                        </h1>
                                        <div className="flex flex-col items-center justify-center gap-4 p-4">
                                            <AssessmentGlobalLevelRevaluateAssessment />
                                            <AssessmentGlobalLevelRevaluateQuestionWise />
                                        </div>
                                    </DialogContent>
                                </Dialog>
                                <AssessmentGlobalLevelReleaseResultAssessment />
                            </>
                        )}
                    </div>
                </div>
                <div className="flex max-h-screen flex-col gap-6 overflow-y-auto p-4">
                    <TabsContent value={selectedTab} ref={tableRef}>
                        <SidebarProvider
                            style={{ ['--sidebar-width' as string]: '565px' } /* dynamic CSS custom property, cannot use Tailwind token */}
                            defaultOpen={false}
                            open={isSidebarOpen}
                            onOpenChange={setIsSidebarOpen}
                        >
                            <AssessmentSubmissionsStudentTable
                                data={{
                                    content: getAssessmentSubmissionsFilteredDataStudentData(
                                        participantsData.content,
                                        type,
                                        selectedTab,
                                        initData?.batches_for_sessions,
                                        totalMarks.total_achievable_marks
                                    ),
                                    total_pages: participantsData.total_pages,
                                    page_no: page,
                                    page_size: 10,
                                    total_elements: participantsData.total_elements,
                                    last: participantsData.last,
                                }}
                                columns={
                                    getAssessmentColumn[
                                        selectedTab as keyof typeof getAssessmentColumn
                                    ] || []
                                }
                                columnWidths={
                                    getAssessmentColumnWidth[
                                        selectedTab as keyof typeof getAssessmentColumnWidth
                                    ] || []
                                }
                                rowSelection={currentPageSelection}
                                onRowSelectionChange={handleRowSelectionChange}
                                currentPage={page}
                            />
                            {selectedParticipantsTab === 'external' ? (
                                // External participants registered via the public form
                                // — show the form answers and custom-field responses.
                                <OpenStudentSidebar />
                            ) : (
                                // Internal participants (whether the assessment is
                                // PRIVATE or PUBLIC) get the full student profile
                                // sheet, same as the students list.
                                <StudentSidebar
                                    selectedTab={selectedTab}
                                    examType={examType}
                                    selectedStudent={selectedStudent}
                                    isSubmissionTab={true}
                                />
                            )}
                        </SidebarProvider>
                    </TabsContent>
                    <div className="flex justify-between">
                        <BulkActions
                            selectedCount={totalSelectedCount}
                            selectedStudentIds={getSelectedStudentIds()}
                            selectedStudents={getSelectedStudents()}
                            onReset={handleResetSelections}
                            selectedTab={selectedTab}
                        />
                        <MyPagination
                            currentPage={page}
                            totalPages={participantsData.total_pages}
                            onPageChange={handlePageChange}
                        />
                    </div>
                </div>
            </Tabs>
        </StudentSidebarContext.Provider>
    );
};

export default AssessmentSubmissionsTab;
