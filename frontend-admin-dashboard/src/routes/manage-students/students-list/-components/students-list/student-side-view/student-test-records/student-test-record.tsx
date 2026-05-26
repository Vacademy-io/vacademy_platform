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
import { MyPagination } from '@/components/design-system/pagination';
import { AssessmentDetailsSearchComponent } from '@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-components/SearchComponent';
import { getSubjectNameById } from '@/routes/assessment/question-papers/-utils/helper';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { AssessmentReportStudentInterface } from '@/types/assessments/assessment-overview';
import { getAssessmentDetailsData } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-services/assessment-services';
import { Steps } from '@/types/assessments/assessment-data-type';
import {
    Exam,
    ChartBar,
    Bell,
    CheckCircle,
    Clock,
    Radio,
} from '@phosphor-icons/react';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { cn } from '@/lib/utils';
import {
    ProfileSectionCard,
    ProfileFieldRow,
    ProfileSkeleton,
    ProfileEmpty,
    ProfileError,
    ProfileHero,
    ProfileHeroStat,
    ProfileMiniBar,
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

const TONE_CHIP_CLASS: Record<ScoreTone, string> = {
    success: 'bg-success-50 text-success-700 border border-success-200',
    primary: 'bg-primary-50 text-primary-700 border border-primary-200',
    warning: 'bg-warning-50 text-warning-700 border border-warning-200',
    danger: 'bg-danger-50 text-danger-700 border border-danger-200',
};

// Filter chip definitions — drives the secondary control bar.
type FilterKey = 'ALL' | 'ENDED' | 'PENDING' | 'LIVE';

const FILTER_CHIPS: { key: FilterKey; label: string; statuses: string[] }[] = [
    { key: 'ALL', label: 'All', statuses: [] },
    { key: 'ENDED', label: 'Completed', statuses: ['ENDED'] },
    { key: 'PENDING', label: 'Pending', statuses: ['PENDING'] },
    { key: 'LIVE', label: 'Live', statuses: ['LIVE'] },
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

    // Active filter chip — drives filter chip bar; updates mutation on change
    const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL');

    // Expanded test row — stores the assessment_id of the currently expanded row
    const [expandedId, setExpandedId] = useState<string | null>(null);

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
                name: searchText,
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
    const pendingRecords = allRecords.filter((r) => r.attempt_status === 'PENDING');
    const attemptedCount = attemptedRecords.length;
    const pendingCount = pendingRecords.length;

    // Avg score: mean of (total_marks) across completed records.
    // total_marks is the raw score; we display it as "X pts avg" since max isn't known per row.
    const avgScore =
        attemptedCount > 0
            ? attemptedRecords.reduce((sum, r) => sum + r.total_marks, 0) / attemptedCount
            : 0;

    // Latest attempt: most-recent ENDED record (sorted by attempt_date desc)
    const latestAttempt =
        attemptedRecords.length > 0
            ? attemptedRecords.slice().sort(
                  (a, b) =>
                      new Date(b.attempt_date).getTime() - new Date(a.attempt_date).getTime()
              )[0]
            : null;

    // Hero tone derived from latest score; neutral when no attempts
    const heroTone = latestAttempt
        ? scoreTone(latestAttempt.total_marks)
        : 'neutral';

    // Apply active filter chip client-side for the visible list
    const records: AssessmentReportStudentInterface[] =
        activeFilter === 'ALL'
            ? allRecords
            : allRecords.filter((r) => r.attempt_status === activeFilter);

    return (
        <div className="flex flex-col gap-3">
            {/* ── Hero zone ─────────────────────────────────────────────────── */}
            <ProfileHero
                eyebrow={latestAttempt ? 'LATEST RESULT' : 'NO ATTEMPTS YET'}
                icon={Exam}
                tone={heroTone as 'success' | 'primary' | 'warning' | 'danger' | 'neutral'}
                title={
                    latestAttempt ? (
                        <span className="text-2xl font-bold leading-none text-neutral-900">
                            {latestAttempt.total_marks.toFixed(2)}&nbsp;pts
                        </span>
                    ) : (
                        <span className="text-xl font-bold leading-none text-neutral-500">
                            No attempts yet
                        </span>
                    )
                }
                subtitle={
                    latestAttempt
                        ? `${latestAttempt.assessment_name} · ${extractDateTime(convertToLocalDateTime(latestAttempt.attempt_date)).date}`
                        : 'Tests assigned to this learner will appear below.'
                }
                action={
                    latestAttempt ? (
                        <MyButton
                            buttonType="secondary"
                            layoutVariant="default"
                            scale="small"
                            onClick={() =>
                                handleViewReport(
                                    latestAttempt.assessment_id,
                                    latestAttempt.attempt_id,
                                    latestAttempt
                                )
                            }
                        >
                            <ChartBar className="size-4" />
                            View Report
                        </MyButton>
                    ) : undefined
                }
            >
                {/* Mini score bar for visual reinforcement — only when an attempt exists */}
                {latestAttempt && (
                    <ProfileMiniBar
                        value={Math.min(100, latestAttempt.total_marks)}
                        tone={heroTone as 'success' | 'primary' | 'warning' | 'danger'}
                        label={`${latestAttempt.total_marks.toFixed(1)} pts`}
                    />
                )}
            </ProfileHero>

            {/* ── Stat row ──────────────────────────────────────────────────── */}
            <div className="flex gap-2">
                <ProfileHeroStat
                    label="Attempted"
                    value={attemptedCount}
                    tone="primary"
                    icon={CheckCircle}
                />
                <ProfileHeroStat
                    label="Pending"
                    value={pendingCount}
                    tone={pendingCount > 0 ? 'warning' : 'neutral'}
                    icon={Clock}
                />
                <ProfileHeroStat
                    label="Avg Score"
                    value={attemptedCount > 0 ? `${avgScore.toFixed(1)} pts` : '—'}
                    tone={
                        attemptedCount > 0
                            ? (scoreTone(avgScore) as 'success' | 'primary' | 'warning' | 'danger')
                            : 'neutral'
                    }
                    icon={ChartBar}
                />
            </div>

            {/* ── Filter chips + search ──────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Filter toggle pills */}
                <div className="flex items-center gap-1.5">
                    {FILTER_CHIPS.map((chip) => {
                        const isActive = activeFilter === chip.key;
                        return (
                            <button
                                key={chip.key}
                                type="button"
                                onClick={() => handleFilterChip(chip.key)}
                                className={cn(
                                    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                                    isActive
                                        ? 'bg-primary-600 text-white'
                                        : 'border border-neutral-200 bg-white text-neutral-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700'
                                )}
                                aria-pressed={isActive}
                            >
                                {chip.key === 'ENDED' && <CheckCircle className="size-3" />}
                                {chip.key === 'PENDING' && <Clock className="size-3" />}
                                {chip.key === 'LIVE' && <Radio className="size-3" />}
                                {chip.label}
                            </button>
                        );
                    })}
                </div>

                {/* Search */}
                <AssessmentDetailsSearchComponent
                    onSearch={handleSearch}
                    searchText={searchText}
                    setSearchText={setSearchText}
                    clearSearch={clearSearch}
                    placeholderText="Search test, subject"
                />
            </div>

            {/* ── Body ──────────────────────────────────────────────────────── */}
            {records.length === 0 ? (
                <ProfileEmpty
                    icon={Exam}
                    title="No tests yet"
                    hint="This student hasn't taken any assessments yet, or records aren't available for the selected filter."
                />
            ) : (
                <ProfileSectionCard heading="Test History" icon={Exam}>
                    <div className="flex flex-col divide-y divide-neutral-100">
                        {records.map((studentReport: AssessmentReportStudentInterface, index: number) => {
                            const isEnded = studentReport.attempt_status === 'ENDED';
                            const isPending = studentReport.attempt_status === 'PENDING';
                            const isExpanded = expandedId === studentReport.assessment_id;

                            const subjectName =
                                getSubjectNameById(
                                    instituteDetails?.subjects || [],
                                    studentReport.subject_id
                                ) || 'N/A';

                            // Score tone for chip (only meaningful when ENDED)
                            const tone = isEnded
                                ? scoreTone(studentReport.total_marks)
                                : 'neutral';

                            return (
                                <div key={index} className="py-3 first:pt-0 last:pb-0">
                                    {/* ── Row header: name + status + score chip ── */}
                                    <button
                                        type="button"
                                        className="flex w-full items-start justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 rounded-sm"
                                        onClick={() =>
                                            setExpandedId(isExpanded ? null : studentReport.assessment_id)
                                        }
                                        aria-expanded={isExpanded}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <span
                                                className="block text-sm font-semibold text-neutral-800 leading-snug truncate"
                                                title={studentReport.assessment_name}
                                            >
                                                {studentReport.assessment_name}
                                            </span>
                                            <span className="mt-0.5 block text-xs text-neutral-500">
                                                {subjectName}
                                                {isEnded && studentReport.attempt_date && (
                                                    <>
                                                        {' · '}
                                                        {extractDateTime(
                                                            convertToLocalDateTime(
                                                                studentReport.attempt_date
                                                            )
                                                        ).date}
                                                    </>
                                                )}
                                            </span>
                                        </div>

                                        {/* Right side: score chip + status pill */}
                                        <div className="flex shrink-0 items-center gap-2">
                                            {isEnded && (
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                                                        TONE_CHIP_CLASS[tone as ScoreTone]
                                                    )}
                                                >
                                                    {studentReport.total_marks.toFixed(1)} pts
                                                </span>
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
                                        </div>
                                    </button>

                                    {/* ── Expanded detail ────────────────────────── */}
                                    {isExpanded && (
                                        <div className="mt-3 border-t border-neutral-100 pt-3">
                                            <dl className="divide-y divide-neutral-100">
                                                <ProfileFieldRow
                                                    label={getTerminology(
                                                        ContentTerms.Subjects,
                                                        SystemTerms.Subjects
                                                    )}
                                                    value={subjectName}
                                                />

                                                {isEnded ? (
                                                    <>
                                                        <ProfileFieldRow
                                                            label="Attempted on"
                                                            value={
                                                                extractDateTime(
                                                                    convertToLocalDateTime(
                                                                        studentReport.attempt_date
                                                                    )
                                                                ).date
                                                            }
                                                        />
                                                        <ProfileFieldRow
                                                            label="Marks"
                                                            value={
                                                                <span className="font-semibold text-primary-600">
                                                                    {studentReport.total_marks.toFixed(2)}
                                                                </span>
                                                            }
                                                        />
                                                        <ProfileFieldRow
                                                            label="Duration"
                                                            value={`${Math.floor(studentReport.duration_in_seconds / 60)} min ${(studentReport.duration_in_seconds % 60).toFixed(0)} sec`}
                                                        />
                                                    </>
                                                ) : (
                                                    <ProfileFieldRow
                                                        label="Schedule"
                                                        value={
                                                            <span className="text-right">
                                                                {convertToLocalDateTime(
                                                                    studentReport.start_time
                                                                )}
                                                                <span className="mx-1 text-neutral-400">
                                                                    –
                                                                </span>
                                                                {convertToLocalDateTime(
                                                                    studentReport.end_time
                                                                )}
                                                            </span>
                                                        }
                                                    />
                                                )}
                                            </dl>

                                            {/* Row actions */}
                                            <div className="mt-3 flex justify-end gap-2">
                                                {isEnded && (
                                                    <MyButton
                                                        buttonType="secondary"
                                                        layoutVariant="default"
                                                        scale="small"
                                                        onClick={() =>
                                                            handleViewReport(
                                                                studentReport.assessment_id,
                                                                studentReport.attempt_id,
                                                                studentReport
                                                            )
                                                        }
                                                    >
                                                        <ChartBar className="size-4" />
                                                        View Report
                                                    </MyButton>
                                                )}
                                                {isPending && (
                                                    <MyButton
                                                        scale="small"
                                                        buttonType="secondary"
                                                        layoutVariant="default"
                                                    >
                                                        <Bell className="size-4" />
                                                        Send Reminder
                                                    </MyButton>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </ProfileSectionCard>
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
