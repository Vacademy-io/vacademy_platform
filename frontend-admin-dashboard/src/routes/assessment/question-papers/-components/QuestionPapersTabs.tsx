import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TabListComponent } from './TabListComponent';
import { QuestionPapersFilter } from './QuestionPapersFilter';
import { QuestionPapersSearchComponent } from './QuestionPapersSearchComponent';
import { QuestionPapersDateRangeComponent } from './QuestionPapersDateRangeComponent';
import { EmptyQuestionPapers } from '@/svgs';
import { QuestionPapersList } from './QuestionPapersList';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { FilterOption } from '@/types/assessments/question-paper-filter';
import { MyButton } from '@/components/design-system/button';
import { getQuestionPaperDataWithFilters } from '../-utils/question-paper-services';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useRefetchStore } from '../-global-states/refetch-store';
import { useFilterDataForAssesment } from '../../assessment-list/-utils.ts/useFiltersData';
import { z } from 'zod';
import sectionDetailsSchema from '../../create-assessment/$assessmentId/$examtype/-utils/section-details-schema';
import { UseFormReturn } from 'react-hook-form';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { AssignmentFormType } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-form-schemas/assignmentFormSchema';

export type SectionFormType = z.infer<typeof sectionDetailsSchema>;

interface QuestionPapersTabsProps {
    isAssessment: boolean; // Flag to determine if it's an assessment
    index?: number;
    sectionsForm?: UseFormReturn<SectionFormType>;
    studyLibraryAssignmentForm?: UseFormReturn<AssignmentFormType>;
    isStudyLibraryAssignment?: boolean;
    currentQuestionIndex: number;
    setCurrentQuestionIndex: Dispatch<SetStateAction<number>>;
}

export const QuestionPapersTabs = ({
    isAssessment,
    index,
    sectionsForm,
    studyLibraryAssignmentForm,
    isStudyLibraryAssignment,
    currentQuestionIndex,
    setCurrentQuestionIndex,
}: QuestionPapersTabsProps) => {
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
    const setHandleRefetchData = useRefetchStore((state) => state.setHandleRefetchData);

    const { YearClassFilterData, SubjectFilterData } = useFilterDataForAssesment(instituteDetails);

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
            throw error;
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
            throw error;
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
            throw error;
        },
    });

    const handleTabChange = (value: string) => {
        setSelectedTab(value);
    };

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

    useEffect(() => {
        setIsLoading(true);
        const timeoutId = setTimeout(() => {
            getQuestionPaperDataWithFilters(pageNo, 10, INSTITUTE_ID, {
                ...selectedQuestionPaperFilters,
                statuses: [{ id: 'ACTIVE', name: 'ACTIVE' }],
            })
                .then((data) => {
                    setQuestionPaperList(data);
                    setIsLoading(false);
                })
                .catch((error) => {
                    console.error(error);
                    setIsLoading(false);
                });
        }, 0);

        return () => {
            clearTimeout(timeoutId);
        };
    }, []);

    useEffect(() => {
        setIsLoading(true);
        const timeoutId = setTimeout(() => {
            getQuestionPaperDataWithFilters(pageNo, 10, INSTITUTE_ID, {
                ...selectedQuestionPaperFilters,
                statuses: [{ id: 'FAVOURITE', name: 'FAVOURITE' }],
            })
                .then((data) => {
                    setQuestionPaperFavouriteList(data);
                    setIsLoading(false);
                })
                .catch((error) => {
                    console.error(error);
                    setIsLoading(false);
                });
        }, 0); // Adjust delay as necessary, 0 means immediate execution in the next event loop.

        return () => {
            clearTimeout(timeoutId); // Cleanup: prevent execution of pending timeout if unmounted
        };
    }, []);

    if (isLoading) return <DashboardLoader />;

    return (
        <Tabs value={selectedTab} onValueChange={handleTabChange}>
            <div className="flex flex-wrap items-center justify-between gap-8">
                <div className="flex flex-wrap gap-8">
                    {questionPaperList !== null && questionPaperFavouriteList !== null && (
                        <TabListComponent
                            selectedTab={selectedTab}
                            questionPaperList={questionPaperList}
                            questionPaperFavouriteList={questionPaperFavouriteList}
                        />
                    )}
                    <QuestionPapersFilter
                        label="Year/Class"
                        data={YearClassFilterData}
                        selectedItems={selectedQuestionPaperFilters['level_ids'] || []}
                        onSelectionChange={(items) => handleFilterChange('level_ids', items)}
                    />
                    <QuestionPapersFilter
                        label="Subject"
                        data={SubjectFilterData}
                        selectedItems={selectedQuestionPaperFilters['subject_ids'] || []}
                        onSelectionChange={(items) => handleFilterChange('subject_ids', items)}
                    />
                    {Object.keys(selectedQuestionPaperFilters).length > 0 && (
                        <div className="flex gap-6">
                            <MyButton
                                buttonType="primary"
                                scale="small"
                                layoutVariant="default"
                                className="h-8"
                                onClick={handleSubmitFilters}
                            >
                                Filter
                            </MyButton>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                layoutVariant="default"
                                className="h-8 border border-neutral-400 bg-neutral-200 hover:border-neutral-500 hover:bg-neutral-300 active:border-neutral-600 active:bg-neutral-400"
                                onClick={handleResetFilters}
                            >
                                Reset
                            </MyButton>
                        </div>
                    )}
                    <div
                        className={`flex gap-4 ${
                            Object.keys(selectedQuestionPaperFilters).length > 0 ? 'mt-[-3px]' : ''
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
                        <QuestionPapersDateRangeComponent />
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
                    />
                ) : (
                    <div className="flex h-screen flex-col items-center justify-center">
                        <EmptyQuestionPapers />
                        <span className="text-neutral-600">No question papers available</span>
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
                    />
                ) : (
                    <div className="flex h-screen flex-col items-center justify-center">
                        <EmptyQuestionPapers />
                        <span className="text-neutral-600">
                            No question paper has been marked as favourites yet
                        </span>
                    </div>
                )}
            </TabsContent>
        </Tabs>
    );
};
