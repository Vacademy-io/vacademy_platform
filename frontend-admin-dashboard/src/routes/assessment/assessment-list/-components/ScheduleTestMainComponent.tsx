import { Helmet } from 'react-helmet';
import { Tabs } from '@/components/ui/tabs';
import { useEffect, useState, useCallback } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { ScheduleTestFilters } from './ScheduleTestFilters';
import {
    useFilterDataForAssesment,
    useFilterDataForAssesmentInitData,
} from '../-utils.ts/useFiltersData';
import { ScheduleTestSearchComponent } from './ScheduleTestSearchComponent';
import { MyFilterOption } from '@/types/assessments/my-filter';
import { ScheduleTestHeaderDescription } from './ScheduleTestHeaderDescription';
import ScheduleTestTabList from './ScheduleTestTabList';
import ScheduleTestFilterButtons from './ScheduleTestFilterButtons';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import ScheduleTestLists from './ScheduleTestLists';
import {
    getAssessmentListWithFilters,
    getInitAssessmentDetails,
} from '../-services/assessment-services';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { ScheduleTestTab } from '@/types/assessments/assessment-list';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { NoCourseDialog } from '@/components/common/students/no-course-dialog';
import { useRefetchStoreAssessment } from '../-global-store/refetch-store';
import { Route } from '..';
import { useNavigate } from '@tanstack/react-router';
import { getCourseSubjects } from '@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getSubjects';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';

export interface SelectedQuestionPaperFilters {
    name: string | { id: string; name: string }[];
    batch_ids: MyFilterOption[];
    subjects_ids: MyFilterOption[];
    tag_ids: MyFilterOption[];
    get_live_assessments: boolean;
    get_passed_assessments: boolean;
    get_upcoming_assessments: boolean;
    institute_ids: string[];
    assessment_statuses: MyFilterOption[];
    assessment_modes: MyFilterOption[];
    access_statuses: MyFilterOption[];
    evaluation_types: MyFilterOption[];
}

const SafeRouteSearch = () => {
    try {
        return Route.useSearch();
    } catch (error) {
        // Return a default object if the hook fails
        return { selectedTab: 'liveTests' };
    }
};

export const ScheduleTestMainComponent = ({
    isCourseOutline = false,
    batchId,
    showBatchFilter = true,
}: {
    isCourseOutline?: boolean;
    batchId?: string;
    showBatchFilter?: boolean;
}) => {
    const navigate = useNavigate();

    // Always call Route.useSearch() regardless of props
    const routeSearchParams = SafeRouteSearch();

    const searchParams = !isCourseOutline ? routeSearchParams : { selectedTab: 'liveTests' };

    // Set state based on the derived value
    const [selectedTab, setSelectedTab] = useState(searchParams.selectedTab ?? 'liveTests');
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const [isOpen, setIsOpen] = useState(false);
    const data = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
    const { setNavHeading } = useNavHeadingStore();
    const { data: initData } = useSuspenseQuery(useInstituteQuery());
    const { data: initAssessmentData } = useSuspenseQuery(getInitAssessmentDetails(initData?.id));
    const { BatchesFilterData, SubjectFilterData } = useFilterDataForAssesment(initData);
    const { AssessmentTypeData, ModeData, EvaluationTypeData } =
        useFilterDataForAssesmentInitData(initAssessmentData);
    const { getCourseFromPackage, getDetailsFromPackageSessionId } = useInstituteDetailsStore();
    const setHandleRefetchDataAssessment = useRefetchStoreAssessment(
        (state) => state.setHandleRefetchDataAssessment
    );

    const [selectedQuestionPaperFilters, setSelectedQuestionPaperFilters] =
        useState<SelectedQuestionPaperFilters>({
            name: '',
            // If in course outline mode and batchId is provided, pre-select it
            batch_ids: isCourseOutline && batchId ? [{ id: batchId, name: '' }] : [],
            subjects_ids: [],
            tag_ids: [],
            get_live_assessments: false,
            get_passed_assessments: false,
            get_upcoming_assessments: false,
            institute_ids: [initData?.id || ''],
            assessment_statuses: [],
            assessment_modes: [],
            access_statuses: [],
            evaluation_types: [],
        });

    const [scheduleTestTabsData, setScheduleTestTabsData] = useState<ScheduleTestTab[]>([
        {
            value: 'liveTests',
            message: 'No tests are currently live.',
            data: {
                content: [],
                last: false,
                page_no: 1,
                page_size: 10,
                total_elements: 0,
                total_pages: 0,
            },
        },
        {
            value: 'upcomingTests',
            message: 'No upcoming tests scheduled.',
            data: {
                content: [],
                last: false,
                page_no: 1,
                page_size: 10,
                total_elements: 0,
                total_pages: 0,
            },
        },
        {
            value: 'previousTests',
            message: 'No previous tests available.',
            data: {
                content: [],
                last: false,
                page_no: 1,
                page_size: 10,
                total_elements: 0,
                total_pages: 0,
            },
        },
        {
            value: 'draftTests',
            message: 'No draft tests available.',
            data: {
                content: [],
                last: false,
                page_no: 1,
                page_size: 10,
                total_elements: 0,
                total_pages: 0,
            },
        },
    ]);

    const [searchText, setSearchText] = useState('');
    const [pageNo, setPageNo] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const handleFilterChange = (filterKey: string, selectedItems: MyFilterOption[]) => {
        setSelectedQuestionPaperFilters((prev) => {
            const updatedFilters = { ...prev, [filterKey]: selectedItems };
            return updatedFilters;
        });
    };

    const clearSearch = () => {
        setSearchText('');
        selectedQuestionPaperFilters['name'] = '';
        getFilteredData.mutate({
            pageNo: pageNo,
            pageSize: 10,
            instituteId: INSTITUTE_ID,
            data: {
                ...selectedQuestionPaperFilters,
                get_live_assessments: selectedTab === 'liveTests' ? true : false,
                get_passed_assessments: selectedTab === 'previousTests' ? true : false,
                get_upcoming_assessments: selectedTab === 'upcomingTests' ? true : false,
                assessment_statuses: [
                    {
                        id: '0',
                        name: selectedTab === 'draftTests' ? 'DRAFT' : 'PUBLISHED',
                    },
                ],
                name: '',
            },
        });
    };

    const handleSearch = (searchValue: string) => {
        setSearchText(searchValue);
        getFilteredData.mutate({
            pageNo: pageNo,
            pageSize: 10,
            instituteId: INSTITUTE_ID,
            data: {
                ...selectedQuestionPaperFilters,
                get_live_assessments: selectedTab === 'liveTests' ? true : false,
                get_passed_assessments: selectedTab === 'previousTests' ? true : false,
                get_upcoming_assessments: selectedTab === 'upcomingTests' ? true : false,
                assessment_statuses: [
                    {
                        id: '0',
                        name: selectedTab === 'draftTests' ? 'DRAFT' : 'PUBLISHED',
                    },
                ],
                name: [{ id: searchValue, name: searchValue }],
            },
        });
    };

    const handleResetFilters = () => {
        setSelectedQuestionPaperFilters({
            name: '',
            // Keep the batch selection if in course outline mode
            batch_ids: isCourseOutline && batchId ? [{ id: batchId, name: '' }] : [],
            subjects_ids: [],
            tag_ids: [],
            get_live_assessments: false,
            get_passed_assessments: false,
            get_upcoming_assessments: false,
            institute_ids: [initData?.id || ''],
            assessment_statuses: [],
            assessment_modes: [],
            access_statuses: [],
            evaluation_types: [],
        });
        setSearchText('');
        getFilteredData.mutate({
            pageNo: pageNo,
            pageSize: 10,
            instituteId: INSTITUTE_ID,
            data: {
                name: '',
                batch_ids: [],
                subjects_ids: [],
                tag_ids: [],
                get_live_assessments: selectedTab === 'liveTests' ? true : false,
                get_passed_assessments: selectedTab === 'previousTests' ? true : false,
                get_upcoming_assessments: selectedTab === 'upcomingTests' ? true : false,
                institute_ids: [initData?.id || ''],
                evaluation_types: [],
                assessment_statuses: [
                    {
                        id: '0',
                        name: selectedTab === 'draftTests' ? 'DRAFT' : 'PUBLISHED',
                    },
                ],
                assessment_modes: [],
                access_statuses: [],
            },
        });
    };

    const getFilteredData = useMutation({
        mutationFn: ({
            pageNo,
            pageSize,
            instituteId,
            data,
        }: {
            pageNo: number;
            pageSize: number;
            instituteId: string | undefined;
            data: SelectedQuestionPaperFilters;
        }) => getAssessmentListWithFilters(pageNo, pageSize, instituteId, data),
        onSuccess: (data) => {
            if (selectedTab === 'liveTests') {
                setScheduleTestTabsData((prevTabs) =>
                    prevTabs.map((tab) =>
                        tab.value === 'liveTests' ? { ...tab, data: data } : tab
                    )
                );
            } else if (selectedTab === 'upcomingTests') {
                setScheduleTestTabsData((prevTabs) =>
                    prevTabs.map((tab) =>
                        tab.value === 'upcomingTests' ? { ...tab, data: data } : tab
                    )
                );
            } else if (selectedTab === 'previousTests') {
                setScheduleTestTabsData((prevTabs) =>
                    prevTabs.map((tab) =>
                        tab.value === 'previousTests' ? { ...tab, data: data } : tab
                    )
                );
            } else {
                setScheduleTestTabsData((prevTabs) =>
                    prevTabs.map((tab) =>
                        tab.value === 'draftTests' ? { ...tab, data: data } : tab
                    )
                );
            }
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handleSubmitFilters = () => {
        getFilteredData.mutate({
            pageNo: pageNo,
            pageSize: 10,
            instituteId: INSTITUTE_ID,
            data: {
                ...selectedQuestionPaperFilters,
                get_live_assessments: selectedTab === 'liveTests' ? true : false,
                get_passed_assessments: selectedTab === 'previousTests' ? true : false,
                get_upcoming_assessments: selectedTab === 'upcomingTests' ? true : false,
                assessment_statuses: [
                    {
                        id: '0',
                        name: selectedTab === 'draftTests' ? 'DRAFT' : 'PUBLISHED',
                    },
                ],
            },
        });
    };

    const handleRefetchData = () => {
        getFilteredData.mutate({
            pageNo: pageNo,
            pageSize: 10,
            instituteId: INSTITUTE_ID,
            data: {
                ...selectedQuestionPaperFilters,
                get_live_assessments: selectedTab === 'liveTests' ? true : false,
                get_passed_assessments: selectedTab === 'previousTests' ? true : false,
                get_upcoming_assessments: selectedTab === 'upcomingTests' ? true : false,
                assessment_statuses: [
                    {
                        id: '0',
                        name: selectedTab === 'draftTests' ? 'DRAFT' : 'PUBLISHED',
                    },
                ],
            },
        });
    };

    const handlePageChange = (newPage: number) => {
        setPageNo(newPage);
        getAssessmentListWithFilters(newPage, 10, INSTITUTE_ID, {
            ...selectedQuestionPaperFilters,
            get_live_assessments: selectedTab === 'liveTests' ? true : false,
            get_passed_assessments: selectedTab === 'previousTests' ? true : false,
            get_upcoming_assessments: selectedTab === 'upcomingTests' ? true : false,
            assessment_statuses: [
                {
                    id: '0',
                    name: selectedTab === 'draftTests' ? 'DRAFT' : 'PUBLISHED',
                },
            ],
        })
            .then((data) => {
                setScheduleTestTabsData((prevTabs) =>
                    prevTabs.map((tab) =>
                        tab.value === selectedTab ? { ...tab, data: data } : tab
                    )
                );
                setIsLoading(false);
            })
            .catch((error) => {
                console.error(error);
                setIsLoading(false);
            });
    };

    // Make sure getSubjectsByBatchId is defined outside any effect or function
    const getSubjectsByBatchId = useCallback(
        (batchId: string) => {
            const batch = getDetailsFromPackageSessionId({ packageSessionId: batchId });
            const subjects = getCourseSubjects(
                batch?.package_dto?.id ?? '',
                batch?.session?.id ?? '',
                batch?.level?.id ?? ''
            );
            return subjects.map((subject) => ({
                name: subject.subject_name,
                id: subject.id,
            }));
        },
        [getDetailsFromPackageSessionId]
    );

    // Track which tabs have been loaded
    const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());

    // Define base filters that include batch_id if in course outline mode
    const getBaseFilters = useCallback(() => ({
        ...selectedQuestionPaperFilters,
        batch_ids:
            isCourseOutline && batchId
                ? [{ id: batchId, name: '' }]
                : selectedQuestionPaperFilters.batch_ids,
    }), [selectedQuestionPaperFilters, isCourseOutline, batchId]);

    // Fetch data for a specific tab
    const fetchTabData = useCallback((tabValue: string) => {
        const tabConfigs: Record<string, { get_live: boolean; get_passed: boolean; get_upcoming: boolean; status: string }> = {
            liveTests: { get_live: true, get_passed: false, get_upcoming: false, status: 'PUBLISHED' },
            upcomingTests: { get_live: false, get_passed: false, get_upcoming: true, status: 'PUBLISHED' },
            previousTests: { get_live: false, get_passed: true, get_upcoming: false, status: 'PUBLISHED' },
            draftTests: { get_live: false, get_passed: false, get_upcoming: false, status: 'DRAFT' },
        };

        const config = tabConfigs[tabValue];
        if (!config) return Promise.resolve();

        return getAssessmentListWithFilters(pageNo, 10, INSTITUTE_ID, {
            ...getBaseFilters(),
            assessment_statuses: [{ id: '0', name: config.status }],
            get_live_assessments: config.get_live,
            get_passed_assessments: config.get_passed,
            get_upcoming_assessments: config.get_upcoming,
        }).then((data) => {
            setScheduleTestTabsData((prevTabs) =>
                prevTabs.map((tab) =>
                    tab.value === tabValue ? { ...tab, data: data } : tab
                )
            );
            setLoadedTabs((prev) => new Set([...prev, tabValue]));
        });
    }, [pageNo, INSTITUTE_ID, getBaseFilters]);

    // Handle tab change - fetch data if tab hasn't been loaded yet
    const handleTabChange = useCallback((newTab: string) => {
        setSelectedTab(newTab);

        // Only fetch if this tab hasn't been loaded yet
        if (!loadedTabs.has(newTab)) {
            setIsLoading(true);
            fetchTabData(newTab)
                .catch((error) => console.error(error))
                .finally(() => setIsLoading(false));
        }
    }, [loadedTabs, fetchTabData]);

    // Initial fetch - only load the default tab
    useEffect(() => {
        setIsLoading(true);

        // Only fetch the currently selected tab (liveTests by default)
        fetchTabData(selectedTab)
            .catch((error) => console.error(error))
            .finally(() => setIsLoading(false));
    }, [isCourseOutline, batchId]);

    useEffect(() => {
        if (!isCourseOutline) setNavHeading(<h1 className="text-lg">Assessments List</h1>);
    }, []);

    useEffect(() => {
        const courseList = getCourseFromPackage();
        if (courseList.length === 0) {
            setIsOpen(true);
        }
    }, []);

    useEffect(() => {
        if (!isCourseOutline)
            navigate({
                to: '/assessment/assessment-list',
                search: {
                    selectedTab: selectedTab,
                },
            });
    }, [selectedTab, isCourseOutline, navigate]);

    // Define the handleRefetchData function here
    useEffect(() => {
        setHandleRefetchDataAssessment(handleRefetchData);
    }, [setHandleRefetchDataAssessment]);

    if (isLoading) return <DashboardLoader />;
    return (
        <>
            <Helmet>
                <title>Schedule Tests</title>
                <meta
                    name="description"
                    content="This page shows the list of all the schedules tests and also an assessment can be scheduled here."
                />
            </Helmet>
            <ScheduleTestHeaderDescription isCourseOutline />
            <div className="flex flex-col gap-4">
                <Tabs value={selectedTab} onValueChange={handleTabChange}>
                    <ScheduleTestTabList
                        selectedTab={selectedTab}
                        scheduleTestTabsData={scheduleTestTabsData}
                    />
                    <div className="my-4 flex flex-col gap-3 sm:my-6 sm:gap-4">
                        {/* Filters Row - scrollable on mobile */}
                        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:gap-4 sm:overflow-visible sm:px-0">
                            {/* Only show batch filter if not in course outline mode or explicitly enabled */}
                            {(!isCourseOutline || showBatchFilter) && (
                                <ScheduleTestFilters
                                    label={getTerminologyPlural(
                                        ContentTerms.Batch,
                                        SystemTerms.Batch
                                    )}
                                    data={BatchesFilterData}
                                    selectedItems={selectedQuestionPaperFilters['batch_ids'] || []}
                                    onSelectionChange={(items) =>
                                        handleFilterChange('batch_ids', items)
                                    }
                                />
                            )}
                            <ScheduleTestFilters
                                label={getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)}
                                data={
                                    isCourseOutline && batchId
                                        ? getSubjectsByBatchId(batchId)
                                        : SubjectFilterData
                                }
                                selectedItems={selectedQuestionPaperFilters['subjects_ids'] || []}
                                onSelectionChange={(items) =>
                                    handleFilterChange('subjects_ids', items)
                                }
                            />
                            <ScheduleTestFilters
                                label="Mode"
                                data={ModeData}
                                selectedItems={
                                    selectedQuestionPaperFilters['assessment_modes'] || []
                                }
                                onSelectionChange={(items) =>
                                    handleFilterChange('assessment_modes', items)
                                }
                            />
                            <ScheduleTestFilters
                                label="Type"
                                data={AssessmentTypeData}
                                selectedItems={
                                    selectedQuestionPaperFilters['access_statuses'] || []
                                }
                                onSelectionChange={(items) =>
                                    handleFilterChange('access_statuses', items)
                                }
                            />
                            <ScheduleTestFilters
                                label="Evaluation"
                                data={EvaluationTypeData}
                                selectedItems={
                                    selectedQuestionPaperFilters['evaluation_types'] || []
                                }
                                onSelectionChange={(items) =>
                                    handleFilterChange('evaluation_types', items)
                                }
                            />
                            <ScheduleTestFilterButtons
                                selectedQuestionPaperFilters={selectedQuestionPaperFilters}
                                handleSubmitFilters={handleSubmitFilters}
                                handleResetFilters={handleResetFilters}
                            />
                        </div>
                        {/* Search - full width on mobile */}
                        <div className="w-full sm:max-w-xs sm:self-end">
                            <ScheduleTestSearchComponent
                                onSearch={handleSearch}
                                searchText={searchText}
                                setSearchText={setSearchText}
                                clearSearch={clearSearch}
                            />
                        </div>
                    </div>
                    {scheduleTestTabsData.map((tab, index) => (
                        <ScheduleTestLists
                            key={index}
                            tab={tab}
                            pageNo={pageNo}
                            handlePageChange={handlePageChange}
                            selectedTab={selectedTab}
                            handleRefetchData={handleRefetchData}
                        />
                    ))}
                </Tabs>
            </div>
            <NoCourseDialog type={'Creating assessment'} isOpen={isOpen} setIsOpen={setIsOpen} />
        </>
    );
};
