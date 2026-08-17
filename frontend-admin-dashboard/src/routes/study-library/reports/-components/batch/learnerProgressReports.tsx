import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { CaretDown, CaretRight, MagnifyingGlass, Warning, X } from '@phosphor-icons/react';
import type { ColumnDef } from '@tanstack/react-table';

import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { MyInput } from '@/components/design-system/input';
import { MyButton } from '@/components/design-system/button';
import { StatusChip, type StatusType } from '@/components/design-system/status-chips';
import { SearchableSelect } from '@/components/design-system/searchable-select';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { cn, convertCapitalToTitleCase } from '@/lib/utils';

import { fetchStudents } from '@/routes/manage-students/students-list/-services/getStudentTable';
import { fetchStudentSubjectsProgress } from '@/routes/manage-students/students-list/-services/getStudentSubjects';
import calculateLearningPercentage from '@/routes/manage-students/students-list/-utils/calculateLearningPercentage';
import type { StudentSubjectsDetailsTypes } from '@/routes/manage-students/students-list/-types/student-subjects-details-types';
import {
    ProfileMiniBar,
    ProfileStat,
} from '@/routes/manage-students/students-list/-components/students-list/student-side-view/profile-ui';

import { LearnerProgressBreakdown } from './learnerProgressBreakdown';

/**
 * Course Details → Reports → {Learner} Progress.
 *
 * The same numbers the learner side-view Progress panel shows, but for every
 * learner enrolled in the batch at once: one paginated, searchable row per
 * learner with their course completion, expanding into
 * {@link ContentTerms.Subject} → {@link ContentTerms.Module} → chapter.
 *
 * Both APIs already exist — the learner list (`fetchStudents`) and the
 * per-learner subject tree (`fetchStudentSubjectsProgress`, the endpoint behind
 * the side-view panel). The subject tree is fetched once per learner on the
 * current page under the *same* query key the side view uses, so the two
 * surfaces share a cache and expanding a row costs no extra request.
 */

const PAGE_SIZE = 10;

/** Course % for one learner — the same nested rollup the side-view gauge uses. */
const courseCompletion = (subjects: StudentSubjectsDetailsTypes | null | undefined) =>
    subjects && subjects.length ? calculateLearningPercentage(subjects) : 0;

/** Two-letter avatar fallback, matching the learner list's initials treatment. */
const initials = (name: string) =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || '?';

/** Completion → chip. Same bands the side-view hero uses for its ring tone. */
const completionStatus = (value: number): { status: StatusType; label: string } => {
    if (value >= 100) return { status: 'SUCCESS', label: 'Completed' };
    if (value >= 75) return { status: 'SUCCESS', label: 'On track' };
    if (value >= 40) return { status: 'INFO', label: 'In progress' };
    if (value > 0) return { status: 'WARNING', label: 'Behind' };
    return { status: 'DANGER', label: 'Not started' };
};

/** Chapters finished vs total across every subject — the "content covered" cell. */
const contentCounts = (subjects: StudentSubjectsDetailsTypes | null) => {
    let chaptersDone = 0;
    let chaptersTotal = 0;
    (subjects ?? []).forEach((subject) => {
        (subject.modules ?? []).forEach((mod) => {
            (mod.chapters ?? []).forEach((chapter) => {
                chaptersTotal += 1;
                if ((chapter.percentage_completed ?? 0) >= 100) chaptersDone += 1;
            });
        });
    });
    return { chaptersDone, chaptersTotal };
};

/** One table row: the learner, plus their progress payload once it lands. */
interface LearnerProgressRow {
    user_id: string;
    full_name: string;
    email: string;
    username: string | null;
    enrollment_number?: string;
    subjects: StudentSubjectsDetailsTypes | null;
    isProgressLoading: boolean;
    coursePercentage: number;
}

interface LearnerProgressReportsProps {
    /**
     * Batch the report is scoped to. Course Details supplies this and the
     * course/session/level picker is hidden. Omitted on the standalone Learning
     * Reports page, where the admin picks the course here instead.
     */
    packageSessionId?: string;
    /** Course id backing `packageSessionId`, when the parent already knows it. */
    courseId?: string;
}

export default function LearnerProgressReports({
    packageSessionId,
    courseId,
}: LearnerProgressReportsProps = {}) {
    const learnerTerm = getTerminology(RoleTerms.Learner, SystemTerms.Learner);
    const courseTerm = getTerminology(ContentTerms.Course, SystemTerms.Course);
    const sessionTerm = getTerminology(ContentTerms.Session, SystemTerms.Session);
    const levelTerm = getTerminology(ContentTerms.Level, SystemTerms.Level);

    const instituteId = getCurrentInstituteId();
    const {
        instituteDetails,
        getCourseFromPackage,
        getSessionFromPackage,
        getLevelsFromPackage2,
        getPackageSessionId,
    } = useInstituteDetailsStore();

    // Batch is fixed by the parent (Course Details) → no picker.
    const isBatchFixed = Boolean(packageSessionId);

    const [page, setPage] = useState(0);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

    // ── Course / session / level picker (standalone mode only) ────────────────
    const [selectedCourse, setSelectedCourse] = useState<string>(courseId ?? '');
    const [selectedSession, setSelectedSession] = useState<string>('');
    const [selectedLevel, setSelectedLevel] = useState<string>('');

    const courseList = useMemo(
        () => (isBatchFixed ? [] : getCourseFromPackage()),
        // getCourseFromPackage reads the institute store; re-derive when it loads.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [isBatchFixed, instituteDetails]
    );
    const sessionList = useMemo(
        () => (selectedCourse ? getSessionFromPackage({ courseId: selectedCourse }) : []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [selectedCourse, instituteDetails]
    );
    const levelList = useMemo(
        () =>
            selectedCourse && selectedSession
                ? getLevelsFromPackage2({
                      courseId: selectedCourse,
                      sessionId: selectedSession,
                  })
                : [],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [selectedCourse, selectedSession, instituteDetails]
    );

    // Cascade: a new course invalidates the session, a new session the level.
    // Auto-pick when a list has exactly one option so choosing a course is
    // usually the only click needed.
    useEffect(() => {
        setSelectedSession(sessionList.length === 1 ? sessionList[0]?.id ?? '' : '');
    }, [sessionList]);
    useEffect(() => {
        setSelectedLevel(levelList.length === 1 ? levelList[0]?.id ?? '' : '');
    }, [levelList]);

    /** The batch every query below runs against. */
    const activePackageSessionId = useMemo(() => {
        if (packageSessionId) return packageSessionId;
        if (!selectedCourse || !selectedSession || !selectedLevel) return '';
        return (
            getPackageSessionId({
                courseId: selectedCourse,
                sessionId: selectedSession,
                levelId: selectedLevel,
            }) || ''
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [packageSessionId, selectedCourse, selectedSession, selectedLevel, instituteDetails]);

    // Debounce so typing doesn't fire a request per keystroke.
    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // A new search or batch starts from page 1, and the open row no longer exists.
    useEffect(() => {
        setPage(0);
        setExpandedUserId(null);
    }, [search, activePackageSessionId]);

    const statuses = useMemo(
        () => instituteDetails?.student_statuses ?? ['ACTIVE'],
        [instituteDetails?.student_statuses]
    );

    const {
        data: studentPage,
        isLoading: isLearnersLoading,
        isFetching,
        isError,
        refetch,
    } = useQuery({
        queryKey: [
            'COURSE_REPORT_LEARNERS',
            activePackageSessionId,
            page,
            search,
            statuses,
            instituteId,
        ],
        queryFn: () =>
            fetchStudents({
                pageNo: page,
                pageSize: PAGE_SIZE,
                filters: {
                    name: search,
                    institute_ids: instituteId ? [instituteId] : [],
                    package_session_ids: [activePackageSessionId],
                    statuses,
                    sort_columns: {},
                },
            }),
        enabled: Boolean(activePackageSessionId),
        staleTime: 60 * 1000,
    });

    const learners = useMemo(() => studentPage?.content ?? [], [studentPage?.content]);

    // One subject-tree request per learner on this page. Same query key as
    // useStudentSubjectsProgressQuery, so anything the side view already loaded
    // is reused rather than refetched.
    const progressResults = useQueries({
        queries: learners.map((learner) => ({
            queryKey: ['GET_STUDENT_SUBJECTS_PROGRESS', learner.user_id, activePackageSessionId],
            queryFn: () =>
                fetchStudentSubjectsProgress(
                    learner.user_id,
                    activePackageSessionId
                ) as Promise<StudentSubjectsDetailsTypes | null>,
            enabled: Boolean(learner.user_id && activePackageSessionId),
            staleTime: 3600000,
        })),
    });

    const rows = useMemo<LearnerProgressRow[]>(
        () =>
            learners.map((learner, index) => {
                const result = progressResults[index];
                const subjects = (result?.data ?? null) as StudentSubjectsDetailsTypes | null;
                return {
                    user_id: learner.user_id,
                    full_name: learner.full_name,
                    email: learner.email,
                    username: learner.username,
                    enrollment_number: learner.institute_enrollment_number,
                    subjects,
                    isProgressLoading: Boolean(result?.isLoading),
                    coursePercentage: courseCompletion(subjects),
                };
            }),
        // progressResults is a fresh array each render; its useQueries entries are
        // stable per (learner, batch), so key off the resolved values instead.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [learners, progressResults.map((r) => `${r.status}:${r.dataUpdatedAt}`).join('|')]
    );

    // Page-scoped, because only this page's learners have their progress loaded.
    // Labelled as such in the UI so it never reads as a whole-batch average.
    const pageSummary = useMemo(() => {
        const scored = rows.filter((row) => !row.isProgressLoading);
        if (!scored.length) return { average: 0, completed: 0, notStarted: 0 };
        return {
            average: scored.reduce((sum, row) => sum + row.coursePercentage, 0) / scored.length,
            completed: scored.filter((row) => row.coursePercentage >= 100).length,
            notStarted: scored.filter((row) => row.coursePercentage <= 0).length,
        };
    }, [rows]);

    const tableData = useMemo(
        () => ({
            content: rows,
            total_pages: studentPage?.total_pages ?? 0,
            page_no: page,
            page_size: PAGE_SIZE,
            total_elements: studentPage?.total_elements ?? 0,
            last: studentPage?.last ?? true,
        }),
        [rows, studentPage?.total_pages, studentPage?.total_elements, studentPage?.last, page]
    );

    const columns = useMemo<ColumnDef<LearnerProgressRow>[]>(
        () => [
            {
                accessorKey: 'full_name',
                header: learnerTerm,
                size: 300,
                cell: ({ row }) => {
                    const isOpen = expandedUserId === row.original.user_id;
                    const name = row.original.full_name || `Unnamed ${learnerTerm.toLowerCase()}`;
                    return (
                        <button
                            type="button"
                            onClick={() => setExpandedUserId(isOpen ? null : row.original.user_id)}
                            className="flex w-full items-center gap-2.5 py-1 text-left"
                            aria-expanded={isOpen}
                        >
                            <span
                                className={cn(
                                    'shrink-0 transition-transform',
                                    isOpen ? 'text-primary-500' : 'text-neutral-400'
                                )}
                            >
                                {isOpen ? (
                                    <CaretDown className="size-4" weight="bold" />
                                ) : (
                                    <CaretRight className="size-4" weight="bold" />
                                )}
                            </span>
                            <span
                                className={cn(
                                    'flex size-8 shrink-0 items-center justify-center rounded-full text-caption font-semibold',
                                    isOpen
                                        ? 'bg-primary-100 text-primary-600'
                                        : 'bg-neutral-100 text-neutral-600'
                                )}
                            >
                                {initials(name)}
                            </span>
                            <span className="flex min-w-0 flex-col">
                                <span
                                    className={cn(
                                        'truncate text-body font-semibold',
                                        isOpen ? 'text-primary-600' : 'text-neutral-800'
                                    )}
                                >
                                    {name}
                                </span>
                                <span className="truncate text-2xs text-neutral-500">
                                    {row.original.email || row.original.username || '—'}
                                </span>
                            </span>
                        </button>
                    );
                },
            },
            {
                accessorKey: 'enrollment_number',
                header: 'Enrolment no.',
                size: 130,
                cell: ({ row }) => (
                    <span className="text-caption text-neutral-600">
                        {row.original.enrollment_number || '—'}
                    </span>
                ),
            },
            {
                accessorKey: 'coursePercentage',
                header: `${courseTerm} progress`,
                size: 220,
                cell: ({ row }) =>
                    row.original.isProgressLoading ? (
                        <div className="h-2 w-full max-w-40 animate-pulse rounded-full bg-neutral-100" />
                    ) : (
                        <ProfileMiniBar
                            value={row.original.coursePercentage}
                            className="max-w-44"
                        />
                    ),
            },
            {
                id: 'status',
                header: 'Status',
                size: 150,
                cell: ({ row }) => {
                    if (row.original.isProgressLoading) {
                        return <span className="text-caption text-neutral-400">Loading…</span>;
                    }
                    const { status, label } = completionStatus(row.original.coursePercentage);
                    return <StatusChip status={status} textSize="text-caption" text={label} />;
                },
            },
            {
                id: 'content',
                header: 'Content covered',
                size: 220,
                cell: ({ row }) => {
                    const { chaptersDone, chaptersTotal } = contentCounts(row.original.subjects);
                    if (row.original.isProgressLoading) {
                        return <span className="text-caption text-neutral-400">—</span>;
                    }
                    return (
                        <span className="text-caption text-neutral-600">
                            {chaptersDone}/{chaptersTotal} chapters
                            {chaptersTotal === 0 ? '' : ' completed'}
                        </span>
                    );
                },
            },
        ],
        [expandedUserId, learnerTerm, courseTerm]
    );

    /** Course / session / level pickers — standalone (Learning Reports) mode. */
    const picker = !isBatchFixed && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                    <label className="text-caption font-medium text-neutral-700">
                        {courseTerm}
                        <span className="ml-1 text-danger-600">*</span>
                    </label>
                    <SearchableSelect
                        options={courseList.map((course) => ({
                            label: convertCapitalToTitleCase(course.name),
                            value: course.id,
                        }))}
                        value={selectedCourse}
                        onChange={setSelectedCourse}
                        placeholder={`Select a ${courseTerm.toLowerCase()}`}
                        searchPlaceholder={`Search ${courseTerm.toLowerCase()}...`}
                        triggerClassName="h-9 text-body"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-caption font-medium text-neutral-700">
                        {sessionTerm}
                    </label>
                    <Select
                        value={selectedSession}
                        onValueChange={setSelectedSession}
                        disabled={!sessionList.length}
                    >
                        <SelectTrigger className="h-9 text-body">
                            <SelectValue placeholder={`Select a ${sessionTerm.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                            {sessionList.map((session) => (
                                <SelectItem key={session.id} value={session.id}>
                                    {convertCapitalToTitleCase(session.name)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-caption font-medium text-neutral-700">{levelTerm}</label>
                    <Select
                        value={selectedLevel}
                        onValueChange={setSelectedLevel}
                        disabled={!levelList.length}
                    >
                        <SelectTrigger className="h-9 text-body">
                            <SelectValue placeholder={`Select a ${levelTerm.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                            {levelList.map((level) => (
                                <SelectItem key={level.id} value={level.id}>
                                    {convertCapitalToTitleCase(level.level_name)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );

    // Nothing to report on until a batch is resolved. The picker stays mounted
    // so the admin can carry on choosing.
    if (!activePackageSessionId) {
        return (
            <div className="space-y-4">
                {picker}
                <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center">
                    <p className="text-body font-medium text-neutral-700">
                        {isBatchFixed
                            ? `Select a batch to view ${learnerTerm.toLowerCase()} progress.`
                            : `Select a ${courseTerm.toLowerCase()} to see ${learnerTerm.toLowerCase()} progress.`}
                    </p>
                    {!isBatchFixed && (
                        <p className="mt-1 text-caption text-neutral-500">
                            {sessionTerm} and {levelTerm} are picked automatically when there is
                            only one.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {picker}

            {/* Batch summary — computed from the current page's learners, so the
                caption says so rather than implying a whole-batch average. */}
            <div className="flex flex-wrap gap-3">
                <ProfileStat
                    label={`Enrolled ${learnerTerm.toLowerCase()}s`}
                    value={studentPage?.total_elements ?? 0}
                    tone="primary"
                />
                <ProfileStat
                    label="Avg progress (this page)"
                    value={`${Math.round(pageSummary.average)}%`}
                    tone={pageSummary.average >= 40 ? 'success' : 'warning'}
                />
                <ProfileStat
                    label="Completed (this page)"
                    value={pageSummary.completed}
                    tone="success"
                />
                <ProfileStat
                    label="Not started (this page)"
                    value={pageSummary.notStarted}
                    tone={pageSummary.notStarted > 0 ? 'danger' : 'neutral'}
                />
            </div>

            {/* Search — the only filter; the batch is already fixed by the page. */}
            <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="relative">
                        <MyInput
                            inputType="text"
                            input={searchInput}
                            onChangeFunction={(event) => setSearchInput(event.target.value)}
                            inputPlaceholder={`Search ${learnerTerm.toLowerCase()} by name`}
                            label="Search"
                            size="medium"
                            className="w-full pl-8 sm:w-80"
                        />
                        <MagnifyingGlass
                            size={16}
                            className="pointer-events-none absolute bottom-2.5 left-2.5 text-neutral-400"
                        />
                    </div>
                    {search && (
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => setSearchInput('')}
                        >
                            <X size={14} />
                            Clear
                        </MyButton>
                    )}
                </div>
                <span className="text-caption text-neutral-500">
                    {isFetching
                        ? 'Loading…'
                        : `${studentPage?.total_elements ?? 0} enrolled ${learnerTerm.toLowerCase()}${
                              (studentPage?.total_elements ?? 0) === 1 ? '' : 's'
                          }`}
                </span>
            </div>

            {isError ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-danger-200 bg-danger-50 p-6 text-center">
                    <Warning size={22} className="text-danger-600" />
                    <p className="text-body text-danger-600">
                        Could not load enrolled {learnerTerm.toLowerCase()}s for this batch.
                    </p>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => refetch()}
                    >
                        Retry
                    </MyButton>
                </div>
            ) : !isLearnersLoading && rows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center">
                    <p className="text-body font-medium text-neutral-700">
                        {search
                            ? `No ${learnerTerm.toLowerCase()} matches “${search}”.`
                            : `No ${learnerTerm.toLowerCase()} is enrolled in this batch yet.`}
                    </p>
                    <p className="mt-1 text-caption text-neutral-500">
                        {search
                            ? 'Try a different name.'
                            : `Progress appears here once ${learnerTerm.toLowerCase()}s are enrolled.`}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* No scroll wrapper here — MyTable owns its own capped,
                        auto-overflow container with a sticky header; nesting a
                        second scroll container clips the first row under it. */}
                    <div className="rounded-lg bg-white">
                        <MyTable<LearnerProgressRow>
                            data={tableData}
                            columns={columns}
                            isLoading={isLearnersLoading}
                            error={null}
                            currentPage={page}
                            renderExpandedRow={(row) =>
                                row.user_id === expandedUserId ? (
                                    <LearnerProgressBreakdown
                                        subjects={row.subjects}
                                        isLoading={row.isProgressLoading}
                                    />
                                ) : null
                            }
                        />
                    </div>
                    {(studentPage?.total_pages ?? 0) > 1 && (
                        <MyPagination
                            currentPage={page}
                            totalPages={studentPage?.total_pages ?? 0}
                            onPageChange={setPage}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
