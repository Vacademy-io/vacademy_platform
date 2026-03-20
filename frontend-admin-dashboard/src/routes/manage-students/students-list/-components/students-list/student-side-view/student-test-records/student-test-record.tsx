import { useEffect, useState } from 'react';
import { MyButton } from '@/components/design-system/button';
import { StatusChips } from '@/components/design-system/chips';
import { TestReportDialog } from './test-report-dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { convertToLocalDateTime, extractDateTime, getInstituteId } from '@/constants/helper';
import {
    getStudentReport,
    handleStudentReportData,
    viewStudentReport,
} from '@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-services/assessment-details-services';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyPagination } from '@/components/design-system/pagination';
import { AssessmentDetailsSearchComponent } from '@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-components/SearchComponent';
import { getSubjectNameById } from '@/routes/assessment/question-papers/-utils/helper';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { AssessmentReportStudentInterface } from '@/types/assessments/assessment-overview';
import { getAssessmentDetailsData } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-services/assessment-services';
import { Steps } from '@/types/assessments/assessment-data-type';
import {
    Shield,
    Warning,
    X,
    ArrowClockwise,
    FileX,
    ShieldCheck,
    Info,
} from '@phosphor-icons/react';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';

export interface StudentReportFilterInterface {
    name: string;
    status: string[];
    sort_columns: Record<string, string>; // Assuming it can have dynamic keys with any value
}

// Enhanced Error Component
const ErrorDisplay = ({
    error,
    onRetry,
    context = 'data',
}: {
    // eslint-disable-next-line
    error: any;
    onRetry: () => void;
    context?: string;
}) => {
    const isUnauthorized = error?.response?.status === 403;
    const isServerError = error?.response?.status >= 500;

    return (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <div
                className={`mb-4 rounded-full p-4 ${
                    isUnauthorized ? 'bg-orange-100' : isServerError ? 'bg-red-100' : 'bg-gray-100'
                }`}
            >
                {isUnauthorized ? (
                    <Shield className="size-8 text-orange-600" />
                ) : isServerError ? (
                    <X className="size-8 text-red-600" />
                ) : (
                    <Warning className="size-8 text-gray-600" />
                )}
            </div>

            <h3 className="mb-2 text-lg font-semibold text-neutral-800">
                {isUnauthorized
                    ? 'Access Restricted'
                    : isServerError
                      ? 'Server Error'
                      : 'Unable to Load Data'}
            </h3>

            <p className="mb-4 max-w-md text-sm text-neutral-600">
                {isUnauthorized
                    ? `You don't have permission to view ${context}. Please contact your administrator for access.`
                    : isServerError
                      ? `There's a problem with our servers. Please try again later.`
                      : `We're having trouble loading the ${context}. Please check your connection and try again.`}
            </p>

            {!isUnauthorized && (
                <MyButton
                    onClick={onRetry}
                    buttonType="secondary"
                    scale="medium"
                    className="flex items-center gap-2"
                >
                    <ArrowClockwise className="size-4" />
                    Try Again
                </MyButton>
            )}

            {isUnauthorized && (
                <div className="mt-4 max-w-md rounded-lg border border-orange-200 bg-orange-50 p-3">
                    <div className="flex items-start gap-2">
                        <Info className="mt-0.5 size-4 shrink-0 text-orange-600" />
                        <div className="text-xs text-orange-700">
                            <p className="mb-1 font-medium">Need access?</p>
                            <p>
                                Contact your system administrator to grant permissions for viewing
                                test records.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Empty State Component
const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 rounded-full bg-neutral-100 p-4">
            <FileX className="size-8 text-neutral-400" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-neutral-700">No Test Records</h3>
        <p className="max-w-md text-sm text-neutral-500">
            This student hasn&apos;t taken any assessments yet, or the test records are not
            available.
        </p>
    </div>
);

export const StudentTestRecord = ({
    selectedTab,
    examType,
    isStudentList = false,
}: {
    selectedTab: string | undefined;
    examType: string | undefined;
    isStudentList?: boolean;
}) => {
    // Institute data with error handling
    const {
        data: instituteDetails,
        isLoading: instituteLoading,
        error: instituteError,
        refetch: refetchInstitute,
    } = useQuery(useInstituteQuery());

    const [searchText, setSearchText] = useState('');
    const [selectedFilter] = useState<StudentReportFilterInterface>({
        name: '',
        status: isStudentList
            ? (selectedTab ?? '').split(',')
            : [
                  selectedTab === 'Attempted'
                      ? 'ENDED'
                      : selectedTab === 'Pending'
                        ? 'PENDING'
                        : 'LIVE',
              ],
        sort_columns: {},
    });
    const { selectedStudent } = useStudentSidebar();

    const [pageNo, setPageNo] = useState(0);
    const instituteId = getInstituteId();

    // Student report data with error handling
    const {
        data,
        isLoading,
        error: reportError,
        refetch: refetchReport,
    } = useQuery({
        ...handleStudentReportData({
            studentId: selectedStudent?.id,
            instituteId,
            pageNo,
            pageSize: 10,
            selectedFilter,
        }),
        // eslint-disable-next-line
        retry: (failureCount, error: any) => {
            // Don't retry on 403 errors
            if (error?.response?.status === 403) return false;
            // Retry up to 2 times for other errors
            return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });

    const [studentReportData, setStudentReportData] = useState(
        data || { content: [], total_pages: 0 }
    );

    const [selectedTest, setSelectedTest] = useState(null);
    const [assessmentDetails, setAssessmentDetails] = useState<Steps | null>(null);

    const handlePageChange = (newPage: number) => {
        setPageNo(newPage);
        getStudentReportMutation.mutate({
            studentId: selectedStudent?.id,
            instituteId,
            pageNo: newPage,
            pageSize: 10,
            selectedFilter,
        });
    };

    const viewStudentTestReportMutation = useMutation({
        mutationFn: ({
            assessmentId,
            attemptId,
            instituteId,
        }: {
            assessmentId: string;
            attemptId: string;
            instituteId: string | undefined;
        }) => viewStudentReport(assessmentId, attemptId, instituteId),
        onSuccess: async (data, { assessmentId }) => {
            setSelectedTest(data);
            try {
                const assessData = await getAssessmentDetailsData({
                    assessmentId: assessmentId,
                    instituteId: instituteDetails?.id,
                    type: examType,
                });
                setAssessmentDetails(assessData);
            } catch (error) {
                console.error('Failed to fetch assessment details:', error);
                // Continue with partial data instead of failing completely
            }
        },
        // eslint-disable-next-line
        onError: (error: any) => {
            console.error('Failed to view student report:', error);
        },
    });

    const [selectedStudentReport, setSelectedStudentReport] =
        useState<AssessmentReportStudentInterface | null>(null);

    const handleViewReport = (
        assessmentId: string,
        attemptId: string,
        studentReport: AssessmentReportStudentInterface
    ) => {
        setSelectedTest(null);
        setSelectedStudentReport(studentReport);
        viewStudentTestReportMutation.mutate({
            assessmentId,
            attemptId,
            instituteId: instituteDetails?.id,
        });
    };

    const getStudentReportMutation = useMutation({
        mutationFn: ({
            studentId,
            instituteId,
            pageNo,
            pageSize,
            selectedFilter,
        }: {
            studentId: string | undefined;
            instituteId: string | undefined;
            pageNo: number;
            pageSize: number;
            selectedFilter: StudentReportFilterInterface;
        }) => getStudentReport(studentId, instituteId, pageNo, pageSize, selectedFilter),
        onSuccess: (data) => {
            setStudentReportData(data);
        },
        // eslint-disable-next-line
        onError: (error: any) => {
            console.error('Failed to fetch student report:', error);
        },
    });

    const clearSearch = () => {
        setSearchText('');
        selectedFilter['name'] = '';
        getStudentReportMutation.mutate({
            studentId: selectedStudent?.id,
            instituteId,
            pageNo,
            pageSize: 10,
            selectedFilter: {
                ...selectedFilter,
                name: '',
            },
        });
    };

    const handleSearch = (searchValue: string) => {
        setSearchText(searchValue);
        getStudentReportMutation.mutate({
            studentId: selectedStudent?.id,
            instituteId,
            pageNo,
            pageSize: 10,
            selectedFilter: {
                ...selectedFilter,
                name: searchValue,
            },
        });
    };

    const handleRetryReport = () => {
        refetchReport();
    };

    const handleRetryInstitute = () => {
        refetchInstitute();
    };

    useEffect(() => {
        if (data) {
            setStudentReportData(data);
        }
    }, [data]);

    // Show loading state
    if (isLoading || instituteLoading || viewStudentTestReportMutation.status === 'pending') {
        return <DashboardLoader />;
    }

    // Show institute error
    if (instituteError) {
        return (
            <ErrorDisplay
                error={instituteError}
                onRetry={handleRetryInstitute}
                context="institute details"
            />
        );
    }

    // Show report error
    if (reportError) {
        return (
            <ErrorDisplay error={reportError} onRetry={handleRetryReport} context="test records" />
        );
    }

    return (
        <div className="animate-fadeIn flex flex-col gap-6">
            {/* Enhanced header with better styling */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="text-primary-600 size-5" />
                    <h3 className="text-lg font-semibold text-neutral-800">Test Records</h3>
                </div>
                <AssessmentDetailsSearchComponent
                    onSearch={handleSearch}
                    searchText={searchText}
                    setSearchText={setSearchText}
                    clearSearch={clearSearch}
                    placeholderText="Search test, subject"
                />
            </div>

            {/* Content area */}
            <div className="flex flex-col gap-6">
                {studentReportData.content && studentReportData.content.length > 0 ? (
                    studentReportData.content.map(
                        (studentReport: AssessmentReportStudentInterface, index: number) => (
                            <div
                                className="group flex w-full flex-col gap-4 rounded-xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50/30 p-4 transition-all duration-300 hover:border-primary-200 hover:shadow-lg"
                                key={index}
                            >
                                <div className="flex w-full items-start gap-4">
                                    <div className="group-hover:text-primary-700 flex-1 text-base font-medium text-neutral-800 transition-colors duration-300">
                                        {studentReport.assessment_name}
                                    </div>
                                    <div className="transition-all duration-300 group-hover:scale-105">
                                        <StatusChips
                                            status={
                                                studentReport.attempt_status === 'PENDING'
                                                    ? 'pending'
                                                    : studentReport.attempt_status === 'ENDED'
                                                      ? 'Attempted'
                                                      : 'Not Attempted'
                                            }
                                        />
                                    </div>
                                </div>

                                {studentReport.attempt_status === 'ENDED' ? (
                                    <div className="flex w-full flex-col gap-4">
                                        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-neutral-600">Subject:</span>
                                                <span className="font-medium text-neutral-800">
                                                    {getSubjectNameById(
                                                        instituteDetails?.subjects || [],
                                                        studentReport.subject_id
                                                    ) || 'N/A'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-neutral-600">Attempted:</span>
                                                <span className="font-medium text-neutral-800">
                                                    {
                                                        extractDateTime(
                                                            convertToLocalDateTime(
                                                                studentReport.attempt_date
                                                            )
                                                        ).date
                                                    }
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-neutral-600">Marks:</span>
                                                <span className="text-primary-600 font-semibold">
                                                    {studentReport.total_marks.toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-neutral-600">Duration:</span>
                                                <span className="font-medium text-neutral-800">
                                                    {Math.floor(
                                                        studentReport.duration_in_seconds / 60
                                                    )}{' '}
                                                    min{' '}
                                                    {(
                                                        studentReport.duration_in_seconds % 60
                                                    ).toFixed(0)}{' '}
                                                    sec
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex w-full justify-end">
                                            <MyButton
                                                buttonType="secondary"
                                                layoutVariant="default"
                                                scale="medium"
                                                onClick={() =>
                                                    handleViewReport(
                                                        studentReport.assessment_id,
                                                        studentReport.attempt_id,
                                                        studentReport
                                                    )
                                                }
                                                className="transition-transform duration-200 hover:scale-105"
                                            >
                                                📊 View Report
                                            </MyButton>
                                        </div>
                                        {selectedTest && selectedStudentReport && (
                                            <TestReportDialog
                                                isOpen={!!selectedTest}
                                                onClose={() => {
                                                    setSelectedTest(null);
                                                    setSelectedStudentReport(null);
                                                }}
                                                testReport={selectedTest}
                                                studentReport={selectedStudentReport}
                                                assessmentDetails={assessmentDetails!}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex w-full flex-col gap-4">
                                        <div className="grid grid-cols-1 gap-3 text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="text-neutral-600">
                                                    {getTerminology(
                                                        ContentTerms.Subjects,
                                                        SystemTerms.Subjects
                                                    )}
                                                    :
                                                </span>
                                                <span className="font-medium text-neutral-800">
                                                    {getSubjectNameById(
                                                        instituteDetails?.subjects || [],
                                                        studentReport.subject_id
                                                    ) || 'N/A'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-neutral-600">Schedule:</span>
                                                <span className="font-medium text-neutral-800">
                                                    {convertToLocalDateTime(
                                                        studentReport.start_time
                                                    )}
                                                    <span className="mx-2 text-neutral-500">
                                                        to
                                                    </span>
                                                    {convertToLocalDateTime(studentReport.end_time)}
                                                </span>
                                            </div>
                                        </div>
                                        {studentReport.attempt_status === 'PENDING' && (
                                            <div className="flex w-full justify-end">
                                                <MyButton
                                                    scale="medium"
                                                    buttonType="secondary"
                                                    layoutVariant="default"
                                                    className="transition-transform duration-200 hover:scale-105"
                                                >
                                                    🔔 Send Reminder
                                                </MyButton>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    )
                ) : (
                    <EmptyState />
                )}
            </div>

            {/* Enhanced pagination */}
            {studentReportData.total_pages > 1 && (
                <div className="flex justify-center pt-4">
                    <MyPagination
                        currentPage={pageNo}
                        totalPages={studentReportData.total_pages}
                        onPageChange={handlePageChange}
                    />
                </div>
            )}
        </div>
    );
};
