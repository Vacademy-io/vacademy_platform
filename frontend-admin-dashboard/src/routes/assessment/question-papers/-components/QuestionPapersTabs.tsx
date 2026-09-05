import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { WarningCircle } from '@phosphor-icons/react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TabListComponent } from './TabListComponent';
import { QuestionPapersFilter } from './QuestionPapersFilter';
import { QuestionPapersSearchComponent } from './QuestionPapersSearchComponent';
import { EmptyQuestionPapers } from '@/svgs';
import { QuestionPapersList } from './QuestionPapersList';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { FilterOption } from '@/types/assessments/question-paper-filter';
import { MyButton } from '@/components/design-system/button';
import {
    getQuestionPaperDataWithFilters,
    getQuestionTagsQuery,
} from '../-utils/question-paper-services';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useRefetchStore } from '../-global-states/refetch-store';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { useFilterDataForAssesment } from '../../assessment-list/-utils.ts/useFiltersData';
import { z } from 'zod';
import sectionDetailsSchema from '../../create-assessment/$assessmentId/$examtype/-utils/section-details-schema';
import { UseFormReturn } from 'react-hook-form';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { AssignmentFormType } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-form-schemas/assignmentFormSchema';

export type SectionFormType = z.infer<typeof sectionDetailsSchema>;

interface QuestionPapersTabsProps {
    isAssessment: boolean; // Flag to determine if it's an assessment
    index?: number;
    sectionsForm?: UseFormReturn<SectionFormType>;
    studyLibraryAssignmentForm?: UseFormReturn<AssignmentFormType>;
    isStudyLibraryAssignment?: boolean;
    currentQuestionIndex: number;
    setCurrentQuestionIndex: Dispatch<SetStateAction<number>>;
    examType?: string; // Add exam type prop
    onManualSelectionReady?: (questions: import('@/types/assessments/question-paper-form').MyQuestion[]) => void;
}

export const QuestionPapersTabs = ({
    isAssessment,
    index,
    sectionsForm,
    studyLibraryAssignmentForm,
    isStudyLibraryAssignment,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    examType,
    onManualSelectionReady,
}: QuestionPapersTabsProps) => {
    const { t } = useTranslation('assessmentQuestionPapersTabs');
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const [selectedTab, setSelectedTab] = useState('ACTIVE');
    const [selectedQuestionPaperFilters, setSelectedQuestionPaperFilters] = useState<
        Record<string, FilterOption[]>
    >({});
    const [searchText, setSearchText] = useState('');
    const [pageNo, setPageNo] = useState(0);
    const [questionPaperList, setQuestionPaperList] = useState(null);
    const [questionPaperFavouriteList, setQuestionPaperFavouriteList] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    // A failed fetch used to render the same "No question papers available" screen as a
    // genuinely empty bank, which reads as "there is nothing here" and sends the user off
    // to create a duplicate.
    const [loadError, setLoadError] = useState<string | null>(null);

    const reportPaperListError = useCallback((error: unknown) => {
        console.error(error);
        const message =
            (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Could not load question papers. Please try again.';
        setLoadError(message);
        toast.error(message);
    }, []);
    const setHandleRefetchData = useRefetchStore((state) => state.setHandleRefetchData);

    const { YearClassFilterData, SubjectFilterData } = useFilterDataForAssesment(instituteDetails);

    const { data: questionTags } = useQuery(getQuestionTagsQuery(INSTITUTE_ID));
    const TagFilterData: FilterOption[] = (questionTags ?? []).map((tag) => ({
        id: tag.tag_id,
        name: tag.tag_name,
    }));

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
            data: Record<string, FilterOption[]>;
        }) => getQuestionPaperDataWithFilters(pageNo, pageSize, instituteId, data),
        onSuccess: (data) => {
            if (selectedTab === 'FAVOURITE') {
                setQuestionPaperFavouriteList(data);
            } else {
                setQuestionPaperList(data);
            }
        },
        onError: (error: unknown) => {
            // Was `throw error` inside a react-query callback: an unhandled rejection,
            // no toast, and the list silently rendered its empty state as if the
            // institute simply had no papers.
            reportPaperListError(error);
        },
    });

    const getFilteredFavouriteData = useMutation({
        mutationFn: ({
            pageNo,
            pageSize,
            instituteId,
            data,
        }: {
            pageNo: number;
            pageSize: number;
            instituteId: string | undefined;
            data: Record<string, FilterOption[]>;
        }) => getQuestionPaperDataWithFilters(pageNo, pageSize, instituteId, data),
        onSuccess: (data) => {
            setQuestionPaperFavouriteList(data);
        },
        onError: (error: unknown) => {
            // Was `throw error` inside a react-query callback: an unhandled rejection,
            // no toast, and the list silently rendered its empty state as if the
            // institute simply had no papers.
            reportPaperListError(error);
        },
    });

    const getFilteredActiveData = useMutation({
        mutationFn: ({
            pageNo,
            pageSize,
            instituteId,
            data,
        }: {
            pageNo: number;
            pageSize: number;
            instituteId: string | undefined;
            data: Record<string, FilterOption[]>;
        }) => getQuestionPaperDataWithFilters(pageNo, pageSize, instituteId, data),
        onSuccess: (data) => {
            setQuestionPaperList(data);
        },
        onError: (error: unknown) => {
            // Was `throw error` inside a react-query callback: an unhandled rejection,
            // no toast, and the list silently rendered its empty state as if the
            // institute simply had no papers.
            reportPaperListError(error);
        },
    });

    // Old handleTabChange removed - using handleTabChangeWithLazyLoad instead

    const handleFilterChange = (filterKey: string, selectedItems: FilterOption[]) => {
        setSelectedQuestionPaperFilters((prev) => {
            const updatedFilters = { ...prev, [filterKey]: selectedItems };
            if (selectedItems.length === 0) {
                delete updatedFilters[filterKey]; // Remove empty filters
            }
            if (Object.entries(updatedFilters).length === 0) {
                getFilteredData.mutate({
                    pageNo: pageNo,
                    pageSize: 10,
                    instituteId: INSTITUTE_ID,
                    data: { ...updatedFilters, statuses: [{ id: selectedTab, name: selectedTab }] },
                });
            }
            return updatedFilters;
        });
    };

    const handleResetFilters = () => {
        setSelectedQuestionPaperFilters({});
        setSearchText('');
        getFilteredData.mutate({
            pageNo: pageNo,
            pageSize: 10,
            instituteId: INSTITUTE_ID,
            data: {
                statuses: [{ id: selectedTab, name: selectedTab }],
            },
        });
    };

    const clearSearch = () => {
        setSearchText('');
        delete selectedQuestionPaperFilters['name'];
    };

    const handleSubmitFilters = () => {
        getFilteredData.mutate({
            pageNo: pageNo,
            pageSize: 10,
            instituteId: INSTITUTE_ID,
            data: {
                ...selectedQuestionPaperFilters,
                statuses: [{ id: selectedTab, name: selectedTab }],
            },
        });
    };

    const handlePageChange = (newPage: number) => {
        setPageNo(newPage);
        getFilteredData.mutate({
            pageNo: newPage,
            pageSize: 10,
            instituteId: INSTITUTE_ID,
            data: {
                ...selectedQuestionPaperFilters,
                statuses: [{ id: selectedTab, name: selectedTab }],
            },
        });
    };

    const handleRefetchData = () => {
        getFilteredFavouriteData.mutate({
            pageNo: 0,
            pageSize: 10,
            instituteId: INSTITUTE_ID,
            data: {
                ...selectedQuestionPaperFilters,
                statuses: [{ id: 'FAVOURITE', name: 'FAVOURITE' }],
            },
        });
        getFilteredActiveData.mutate({
            pageNo,
            pageSize: 10,
            instituteId: INSTITUTE_ID,
            data: {
                ...selectedQuestionPaperFilters,
                statuses: [{ id: 'ACTIVE', name: 'ACTIVE' }],
            },
        });
    };

    // Define the handleRefetchData function here
    useEffect(() => {
        setHandleRefetchData(handleRefetchData);
    }, [setHandleRefetchData]);

    // Track which tabs have been loaded
    const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());

    // Fetch data for a specific tab
    const fetchTabData = (tabValue: string) => {
        return getQuestionPaperDataWithFilters(pageNo, 10, INSTITUTE_ID, {
            ...selectedQuestionPaperFilters,
            statuses: [{ id: tabValue, name: tabValue }],
        }).then((data) => {
            setLoadError(null);
            if (tabValue === 'FAVOURITE') {
                setQuestionPaperFavouriteList(data);
            } else {
                setQuestionPaperList(data);
            }
            setLoadedTabs((prev) => new Set([...prev, tabValue]));
        });
    };

    // Handle tab change with lazy loading
    const handleTabChangeWithLazyLoad = (value: string) => {
        setSelectedTab(value);

        // Only fetch if this tab hasn't been loaded yet
        if (!loadedTabs.has(value)) {
            setIsLoading(true);
            fetchTabData(value)
                .catch(reportPaperListError)
                .finally(() => setIsLoading(false));
        }
    };

    // Initial fetch - only load the ACTIVE tab (default selected)
    useEffect(() => {
        setIsLoading(true);
        fetchTabData('ACTIVE')
            .catch(reportPaperListError)
            .finally(() => setIsLoading(false));
    }, []);

    if (isLoading) return <DashboardLoader />;

    return (
        <Tabs value={selectedTab} onValueChange={handleTabChangeWithLazyLoad}>
            <div className="flex flex-wrap items-center justify-between gap-8">
                <div className="flex flex-wrap gap-8">
                    {questionPaperList !== null && (
                        <TabListComponent
                            selectedTab={selectedTab}
                            questionPaperList={questionPaperList}
                            questionPaperFavouriteList={questionPaperFavouriteList}
                        />
                    )}
                    <QuestionPapersFilter
                        label={t('filters.yearClass')}
                        data={YearClassFilterData}
                        selectedItems={selectedQuestionPaperFilters['level_ids'] || []}
                        onSelectionChange={(items) => handleFilterChange('level_ids', items)}
                    />
                    <QuestionPapersFilter
                        label={getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)}
                        data={SubjectFilterData}
                        selectedItems={selectedQuestionPaperFilters['subject_ids'] || []}
                        onSelectionChange={(items) => handleFilterChange('subject_ids', items)}
                    />
                    {TagFilterData.length > 0 && (
                        <QuestionPapersFilter
                            label={t('filters.tags')}
                            data={TagFilterData}
                            selectedItems={selectedQuestionPaperFilters['tag_ids'] || []}
                            onSelectionChange={(items) => handleFilterChange('tag_ids', items)}
                        />
                    )}
                    {Object.keys(selectedQuestionPaperFilters).length > 0 && (
                        <div className="flex gap-6">
                            <MyButton
                                buttonType="primary"
                                scale="small"
                                layoutVariant="default"
                                className="h-8"
                                onClick={handleSubmitFilters}
                            >
                                {t('actions.filter')}
                            </MyButton>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                layoutVariant="default"
                                className="h-8 border border-neutral-400 bg-neutral-200 hover:border-neutral-500 hover:bg-neutral-300 active:border-neutral-600 active:bg-neutral-400"
                                onClick={handleResetFilters}
                            >
                                {t('actions.reset')}
                            </MyButton>
                        </div>
                    )}
                    <div
                        className={`flex gap-4 ${Object.keys(selectedQuestionPaperFilters).length > 0 ? '-mt-1' : ''
                            }`}
                    >
                        <QuestionPapersSearchComponent
                            onSearch={(searchValue: string) => {
                                getFilteredData.mutate({
                                    pageNo: pageNo,
                                    pageSize: 10,
                                    instituteId: INSTITUTE_ID,
                                    data: {
                                        ...selectedQuestionPaperFilters,
                                        statuses: [{ id: selectedTab, name: selectedTab }],
                                        name: [{ id: searchValue, name: searchValue }],
                                    },
                                });
                            }}
                            searchText={searchText}
                            setSearchText={setSearchText}
                            clearSearch={clearSearch}
                        />
                        {/* The date-range filter was rendered with no props and its
                            onSubmit only console.logged, so it never filtered
                            anything. Removed rather than left as a control that
                            looks functional and is not. */}
                    </div>
                </div>
            </div>
            <TabsContent value="ACTIVE">
                {questionPaperList ? (
                    <QuestionPapersList
                        questionPaperList={questionPaperList}
                        pageNo={pageNo}
                        handlePageChange={handlePageChange}
                        refetchData={handleRefetchData}
                        isAssessment={isAssessment}
                        index={index}
                        sectionsForm={sectionsForm}
                        studyLibraryAssignmentForm={studyLibraryAssignmentForm}
                        isStudyLibraryAssignment={isStudyLibraryAssignment}
                        currentQuestionIndex={currentQuestionIndex}
                        setCurrentQuestionIndex={setCurrentQuestionIndex}
                        examType={examType}
                        onManualSelectionReady={onManualSelectionReady}
                    />
                ) : (
                    <div className="flex h-screen flex-col items-center justify-center gap-2">
                        {loadError ? (
                            <>
                                <WarningCircle className="size-8 text-danger-600" />
                                <span className="text-neutral-700">{loadError}</span>
                                <MyButton
                                    buttonType="secondary"
                                    scale="medium"
                                    onClick={() => {
                                        setLoadError(null);
                                        setIsLoading(true);
                                        fetchTabData(selectedTab)
                                            .catch(reportPaperListError)
                                            .finally(() => setIsLoading(false));
                                    }}
                                >
                                    {t('actions.tryAgain')}
                                </MyButton>
                            </>
                        ) : (
                            <>
                                <EmptyQuestionPapers />
                                <span className="text-neutral-600">
                                    {t('emptyStates.noQuestionPapers')}
                                </span>
                            </>
                        )}
                    </div>
                )}
            </TabsContent>
            <TabsContent value="FAVOURITE">
                {questionPaperFavouriteList ? (
                    <QuestionPapersList
                        questionPaperList={questionPaperFavouriteList}
                        pageNo={pageNo}
                        handlePageChange={handlePageChange}
                        refetchData={handleRefetchData}
                        isAssessment={isAssessment}
                        index={index}
                        sectionsForm={sectionsForm}
                        studyLibraryAssignmentForm={studyLibraryAssignmentForm}
                        isStudyLibraryAssignment={isStudyLibraryAssignment}
                        currentQuestionIndex={currentQuestionIndex}
                        setCurrentQuestionIndex={setCurrentQuestionIndex}
                        examType={examType}
                    />
                ) : (
                    <div className="flex h-screen flex-col items-center justify-center">
                        <EmptyQuestionPapers />
                        <span className="text-neutral-600">
                            {t('emptyStates.noFavouriteQuestionPapers')}
                        </span>
                    </div>
                )}
            </TabsContent>
        </Tabs>
    );
};
