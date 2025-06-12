import { useEffect, useState } from 'react';
import { MyButton } from '@/components/design-system/button';
import { StatusChips } from '@/components/design-system/chips';
import { TestReportDialog } from './test-report-dialog';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
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
export interface StudentReportFilterInterface {
    name: string;
    status: string[];
    sort_columns: Record<string, string>; // Assuming it can have dynamic keys with any value
}

export const StudentTestRecord = ({
    selectedTab,
    examType,
    isStudentList = false,
}: {
    selectedTab: string | undefined;
    examType: string | undefined;
    isStudentList?: boolean;
}) => {
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());

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
    const { data, isLoading } = useSuspenseQuery(
        handleStudentReportData({
            studentId: selectedStudent?.id,
            instituteId,
            pageNo,
            pageSize: 10,
            selectedFilter,
        })
    );
    const [studentReportData, setStudentReportData] = useState(data);

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
            const assessData = await getAssessmentDetailsData({
                assessmentId: assessmentId,
                instituteId: instituteDetails?.id,
                type: examType,
            });
            setAssessmentDetails(assessData);
        },
        onError: (error: unknown) => {
            throw error;
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
        onError: (error: unknown) => {
            throw error;
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

    useEffect(() => {
        setStudentReportData(data);
    }, [data]);

    if (isLoading || viewStudentTestReportMutation.status === 'pending') return <DashboardLoader />;

    return (
        <div className="flex flex-col gap-10">
            <div className="flex justify-between">
                <AssessmentDetailsSearchComponent
                    onSearch={handleSearch}
                    searchText={searchText}
                    setSearchText={setSearchText}
                    clearSearch={clearSearch}
                    placeholderText="Search text, subject"
                />
            </div>
            <div className="flex flex-col gap-10">
                {studentReportData.content && studentReportData.content.length > 0 ? (
                    studentReportData.content.map(
                        (studentReport: AssessmentReportStudentInterface, index: number) => (
                            <div
                                className="flex w-full flex-col gap-2 rounded-lg border border-primary-300 p-4"
                                key={index}
                            >
                                <div className="flex w-full gap-4">
                                    <div className="text-subtitle">
                                        {studentReport.assessment_name}
                                    </div>
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
                                {studentReport.attempt_status === 'ENDED' ? (
                                    <div className="flex w-full flex-col gap-8">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                Subject:{' '}
                                                {getSubjectNameById(
                                                    instituteDetails?.subjects || [],
                                                    studentReport.subject_id
                                                ) || ''}
                                            </div>
                                            <div>
                                                Attempted Date:{' '}
                                                {
                                                    extractDateTime(
                                                        convertToLocalDateTime(
                                                            studentReport.attempt_date
                                                        )
                                                    ).date
                                                }
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>Marks: {studentReport.total_marks.toFixed(2)}</div>
                                            <div>
                                                Duration:{' '}
                                                {(studentReport.duration_in_seconds % 60).toFixed(
                                                    2
                                                )}{' '}
                                                min
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
                                            >
                                                View Report
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
                                    <div className="flex w-full flex-col gap-8">
                                        <div>
                                            Subject:{' '}
                                            {getSubjectNameById(
                                                instituteDetails?.subjects || [],
                                                studentReport.subject_id
                                            ) || ''}
                                        </div>
                                        <div>
                                            Assessment Schedule:{' '}
                                            {convertToLocalDateTime(studentReport.start_time)}
                                            &nbsp;-&nbsp;
                                            {convertToLocalDateTime(studentReport.end_time)}
                                        </div>
                                        {studentReport.attempt_status === 'PENDING' && (
                                            <div className="flex w-full justify-end">
                                                <MyButton
                                                    scale="medium"
                                                    buttonType="secondary"
                                                    layoutVariant="default"
                                                >
                                                    Send Reminder
                                                </MyButton>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    )
                ) : (
                    <p className="py-4 text-center text-subtitle">No test record available </p>
                )}
            </div>

            <MyPagination
                currentPage={pageNo}
                totalPages={studentReportData.total_pages}
                onPageChange={handlePageChange}
            />
        </div>
    );
};
