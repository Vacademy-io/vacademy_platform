import { useEffect, useState } from 'react';
import { MyButton } from '@/components/design-system/button';
import { ChipToggleGroup, StatusChips } from '@/components/design-system/chips';
import { TestReportDialog } from './test-report-dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { convertToLocalDateTime, extractDateTime, getInstituteId } from '@/constants/helper';
import {
    getStudentReport,
    handleStudentReportData,
    viewStudentReport,
} from '@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-services/assessment-details-services';
import { MyPagination } from '@/components/design-system/pagination';
import { getSubjectNameById } from '@/routes/assessment/question-papers/-utils/helper';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { AssessmentReportStudentInterface } from '@/types/assessments/assessment-overview';
import { getAssessmentDetailsData } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-services/assessment-services';
import { Steps } from '@/types/assessments/assessment-data-type';
import {
    Trophy,
    CheckCircle,
    Clock,
    Radio,
} from '@phosphor-icons/react';
import {
    ProfileSkeleton,
    ProfileEmpty,
    ProfileError,
    ProfileHero,
} from '../profile-ui';

export interface StudentReportFilterInterface {
    name: string;
    status: string[];
    sort_columns: Record<string, string>;
}

// ── Score-tone helper ─────────────────────────────────────────────────────────
// Derives a tone class from the raw score percentage.
// >=80 → success, >=50 → primary, >=30 → warning, else → danger
type ScoreTone = 'success' | 'primary' | 'warning' | 'danger';

function scoreTone(pct: number): ScoreTone {
    if (pct >= 80) return 'success';
    if (pct >= 50) return 'primary';
    if (pct >= 30) return 'warning';
    return 'danger';
}

// Filter chip definitions — drives the secondary control bar.
type FilterKey = 'ALL' | 'ENDED' | 'PENDING' | 'LIVE';

const FILTER_CHIPS: {
    key: FilterKey;
    label: string;
    statuses: string[];
    icon?: React.ComponentType<{ className?: string }>;
}[] = [
    { key: 'ALL', label: 'All', statuses: [] },
    { key: 'ENDED', label: 'Completed', statuses: ['ENDED'], icon: CheckCircle },
    { key: 'PENDING', label: 'Pending', statuses: ['PENDING'], icon: Clock },
    { key: 'LIVE', label: 'Live', statuses: ['LIVE'], icon: Radio },
];

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

    // Active filter chip — drives filter chip bar; updates mutation on change
    const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL');

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
            if (error?.response?.status === 403) return false;
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

    // Apply filter chip selection — re-fetches with the chosen status array
    const handleFilterChip = (chipKey: FilterKey) => {
        setActiveFilter(chipKey);
        const chip = FILTER_CHIPS.find((c) => c.key === chipKey)!;
        const statusFilter = chip.statuses.length
            ? chip.statuses
            : selectedFilter.status;
        getStudentReportMutation.mutate({
            studentId: selectedStudent?.id,
            instituteId,
            pageNo: 0,
            pageSize: 10,
            selectedFilter: {
                ...selectedFilter,
                status: statusFilter,
            },
        });
        setPageNo(0);
    };

    useEffect(() => {
        if (data) {
            setStudentReportData(data);
        }
    }, [data]);

    // ── Four-state guards ──────────────────────────────────────────────────────

    if (isLoading || instituteLoading || viewStudentTestReportMutation.status === 'pending') {
        return <ProfileSkeleton blocks={4} />;
    }

    if (instituteError) {
        // eslint-disable-next-line
        const err = instituteError as any;
        const isUnauthorized = err?.response?.status === 403;
        return (
            <ProfileError
                title={isUnauthorized ? 'Access Restricted' : "Couldn't load institute details"}
                hint={
                    isUnauthorized
                        ? "You don't have permission to view institute details. Contact your administrator."
                        : 'Something went wrong fetching institute details. Please try again.'
                }
                onRetry={isUnauthorized ? undefined : () => refetchInstitute()}
            />
        );
    }

    if (reportError) {
        // eslint-disable-next-line
        const err = reportError as any;
        const isUnauthorized = err?.response?.status === 403;
        return (
            <ProfileError
                title={isUnauthorized ? 'Access Restricted' : "Couldn't load test records"}
                hint={
                    isUnauthorized
                        ? "You don't have permission to view test records. Contact your administrator."
                        : 'Something went wrong fetching test records. Please try again.'
                }
                onRetry={isUnauthorized ? undefined : () => refetchReport()}
            />
        );
    }

    const allRecords: AssessmentReportStudentInterface[] = studentReportData.content ?? [];

    // ── Derived stat values ────────────────────────────────────────────────────
    const attemptedRecords = allRecords.filter((r) => r.attempt_status === 'ENDED');
    const attemptedCount = attemptedRecords.length;

    // Avg score: mean of (total_marks) across completed records.
    // total_marks is the raw score; we display it as "X pts avg" since max isn't known per row.
    const avgScore =
        attemptedCount > 0
            ? attemptedRecords.reduce((sum, r) => sum + r.total_marks, 0) / attemptedCount
            : 0;

    // Apply active filter chip client-side for the visible list
    const records: AssessmentReportStudentInterface[] =
        activeFilter === 'ALL'
            ? allRecords
            : allRecords.filter((r) => r.attempt_status === activeFilter);

    return (
        <div className="flex flex-col gap-3">
            {/* ── Hero zone (Vacademy design handoff: TestsSection) ──────────
                Hero is a PASSIVE summary card — the average score IS the
                title, attempt count is the subtitle, no per-row action. */}
            <ProfileHero
                eyebrow="TEST PERFORMANCE"
                icon={Trophy}
                tone={
                    attemptedCount > 0
                        ? (scoreTone(avgScore) as
                              | 'success'
                              | 'primary'
                              | 'warning'
                              | 'danger')
                        : 'neutral'
                }
                title={
                    attemptedCount > 0 ? (
                        <span className="text-h2 font-semibold leading-none text-card-foreground">
                            {avgScore.toFixed(1)} avg score
                        </span>
                    ) : (
                        <span className="text-h3 font-semibold leading-none text-muted-foreground">
                            No attempts yet
                        </span>
                    )
                }
                subtitle={
                    attemptedCount > 0
                        ? `${attemptedCount} test${attemptedCount === 1 ? '' : 's'} recorded`
                        : 'Tests assigned to this learner will appear below.'
                }
            />

            {/* Stat-tile row removed per design handoff — the avg score is
                already surfaced as the hero title above, and the handoff's
                TestsSection has no separate stat row. */}

            {/* ── Filter chips (no search per handoff) ───────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
                <ChipToggleGroup<FilterKey>
                    value={activeFilter}
                    onChange={handleFilterChip}
                    options={FILTER_CHIPS.map((c) => ({
                        value: c.key,
                        label: c.label,
                        icon: c.icon,
                    }))}
                    ariaLabel="Filter test attempts by status"
                />
            </div>

            {/* ── Body ──────────────────────────────────────────────────────── */}
            {records.length === 0 ? (
                <ProfileEmpty
                    icon={Trophy}
                    title="No tests yet"
                    hint="This learner hasn't taken any assessments yet."
                />
            ) : (
                <div className="flex flex-col gap-2.5">
                    {records.map(
                        (studentReport: AssessmentReportStudentInterface, index: number) => {
                            const isEnded = studentReport.attempt_status === 'ENDED';
                            const isPending = studentReport.attempt_status === 'PENDING';

                            const subjectName =
                                getSubjectNameById(
                                    instituteDetails?.subjects || [],
                                    studentReport.subject_id
                                ) || 'N/A';

                            // Subtitle date: prefer attempt_date for ENDED rows,
                            // fall back to scheduled start_time so every card shows
                            // "subject · date" per handoff.
                            const subtitleDateSource = isEnded
                                ? studentReport.attempt_date
                                : studentReport.start_time;
                            const subtitleDate = subtitleDateSource
                                ? extractDateTime(
                                      convertToLocalDateTime(subtitleDateSource)
                                  ).date
                                : '';

                            return (
                                <div
                                    key={index}
                                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
                                >
                                    {/* Left block: name + subject · date */}
                                    <div className="min-w-0 flex-1">
                                        <div
                                            className="block truncate text-h5 font-bold leading-snug text-card-foreground"
                                            title={studentReport.assessment_name}
                                        >
                                            {studentReport.assessment_name}
                                        </div>
                                        <div className="mt-0.5 text-caption text-muted-foreground">
                                            {subjectName}
                                            {subtitleDate && (
                                                <>
                                                    {' · '}
                                                    {subtitleDate}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right block: score (large) + status pill + action */}
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                        {isEnded && (
                                            <div className="text-h4 font-bold leading-none text-primary-600">
                                                {studentReport.total_marks.toFixed(1)}
                                            </div>
                                        )}
                                        <StatusChips
                                            status={
                                                isPending
                                                    ? 'pending'
                                                    : isEnded
                                                      ? 'Attempted'
                                                      : 'Not Attempted'
                                            }
                                        />
                                        {isEnded && (
                                            <MyButton
                                                buttonType="text"
                                                scale="small"
                                                layoutVariant="default"
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
                                        )}
                                        {isPending && (
                                            <MyButton
                                                buttonType="text"
                                                scale="small"
                                                layoutVariant="default"
                                            >
                                                Send Reminder
                                            </MyButton>
                                        )}
                                    </div>
                                </div>
                            );
                        }
                    )}
                </div>
            )}

            {/* Report dialog — hoisted outside the list so only one instance renders */}
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

            {/* ── Pagination ────────────────────────────────────────────────── */}
            {studentReportData.total_pages > 1 && (
                <div className="flex justify-center pt-2">
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
