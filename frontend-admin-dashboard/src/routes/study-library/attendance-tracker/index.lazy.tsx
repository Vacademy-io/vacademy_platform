/* eslint-disable tailwindcss/no-custom-classname */
import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { useState, useEffect, useRef, useMemo } from 'react';
import { MyButton } from '@/components/design-system/button';
import { Eye, ArrowSquareOut, X, DownloadSimple } from '@phosphor-icons/react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { SidebarProvider } from '@/components/ui/sidebar';
import { StudentSidebar } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-side-view';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import type { StudentTable } from '@/types/student-table-types';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays, startOfDay } from 'date-fns';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getStudentAttendanceReport, StudentSchedule } from '../live-session/-services/utils';
import { useGetAttendance } from './-services/attendance';
import { MyPagination } from '@/components/design-system/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';

import { CaretUpDown, CaretDown, CaretUp, CaretDownIcon } from '@phosphor-icons/react';
import { MyDropdown } from '@/components/common/students/enroll-manually/dropdownForPackageItems';
import { Checkbox } from '@/components/ui/checkbox';
import { useGetBatchesQuery } from '@/routes/manage-institute/batches/-services/get-batches';
import { useStudentFilters } from '@/routes/manage-students/students-list/-hooks/useStudentFilters';
import {
    BatchType,
    batchWithStudentDetails,
} from '@/routes/manage-institute/batches/-types/manage-batches-types';
import { DateRange } from 'react-day-picker';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { LIVE_SESSION_ALL_ATTENDANCE } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import type { AttendanceResponseType, ContentType } from './-services/attendance';

export const Route = createLazyFileRoute('/study-library/attendance-tracker/')({
    component: RouteComponent,
});

interface ClassAttendanceItem {
    id: string;
    className: string;
    date: string;
    time: string;
    status: 'Present' | 'Absent' | 'Unmarked';
}

type ClassAttendanceData = {
    [key: string]: ClassAttendanceItem[];
};

const formatDurationMinutes = (mins: number | null | undefined): string => {
    if (mins == null || mins <= 0) return '—';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

interface AttendanceStudent {
    id: string; // studentId
    name: string;
    username?: string;
    batch: string; // resolved batch name or "All Batches"
    packageSessionId?: string;
    mobileNumber: string;
    email: string;
    attendedClasses: number;
    totalClasses: number;
    attendancePercentage: number;
    avgDurationMinutes: number | null;
}

// runtime generated from API. fallback empty.
const classAttendanceData: ClassAttendanceData = {};

// Attendance Modal Component
interface AttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: AttendanceStudent | null;
    batchId: string;
    startDate?: Date;
    endDate?: Date;
}

const AttendanceModal = ({
    isOpen,
    onClose,
    student,
    batchId,
    startDate,
    endDate,
}: AttendanceModalProps) => {
    const [loading, setLoading] = useState(false);
    const [studentClasses, setStudentClasses] = useState<ClassAttendanceItem[]>([]);
    const [overallAttendance, setOverallAttendance] = useState<number | null>(null);

    useEffect(() => {
        const showAttendance = async () => {
            if (!student || !isOpen) return;

            // 1️⃣ Reuse sessions that were already fetched with the batch call.
            const cached = classAttendanceData[student.id];
            if (cached && cached.length) {
                setStudentClasses(cached);
                setOverallAttendance(student.attendancePercentage);
                return; // no extra API call needed ✔️
            }

            // 2️⃣ Fallback – fetch from student-report endpoint.
            try {
                setLoading(true);
                const start = startDate ? format(startDate, 'yyyy-MM-dd') : '2020-01-01';
                const end = endDate
                    ? format(endDate, 'yyyy-MM-dd')
                    : format(new Date(), 'yyyy-MM-dd');

                const report = await getStudentAttendanceReport(
                    student.id,
                    batchId !== '' ? batchId : undefined,
                    start,
                    end
                );

                setOverallAttendance(Math.round(report.attendancePercentage));

                const transformed: ClassAttendanceItem[] = report.schedules.map(
                    (s: StudentSchedule) => ({
                        id: s.scheduleId,
                        className: s.sessionTitle,
                        date: s.meetingDate,
                        time: s.startTime,
                        status: s.attendanceStatus === 'PRESENT' ? 'Present' : s.attendanceStatus === 'ABSENT' ? 'Absent' : 'Unmarked',
                    })
                );

                // cache for next time
                classAttendanceData[student.id] = transformed;
                setStudentClasses(transformed);
            } catch (err) {
                console.error('Failed to fetch attendance report', err);
            } finally {
                setLoading(false);
            }
        };

        showAttendance();
    }, [student, batchId, startDate, endDate, isOpen]);

    if (!student) return null;

    // while data is loading, we can show spinner

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="flex max-h-[75vh] flex-col sm:max-w-[450px]">
                <div className="flex items-center justify-between border-b border-neutral-200 p-4">
                    <h2 className="text-lg font-semibold text-neutral-800">
                        {student.name} - Class Attendance
                    </h2>
                </div>

                <div className="flex flex-col gap-4 overflow-y-auto p-4">
                    {/* Overall Attendance */}
                    <div className="rounded-lg bg-primary-50 p-4 text-center">
                        <div className="text-4xl font-bold text-primary-500">
                            {overallAttendance !== null ? `${overallAttendance}%` : '--'}
                        </div>
                        <div className="mt-2 text-base text-neutral-600">Overall Attendance</div>
                    </div>

                    {/* Class List */}
                    <div className="flex flex-col gap-3 overflow-y-auto">
                        {loading ? (
                            <p className="text-center text-neutral-500">Loading...</p>
                        ) : (
                            studentClasses.map((classItem) => (
                                <div
                                    key={classItem.id}
                                    className="rounded-lg border border-neutral-200 p-4"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-base font-medium text-neutral-800">
                                                {classItem.className}
                                            </h3>
                                            <p className="text-sm text-neutral-600">
                                                {classItem.date} • {classItem.time}
                                            </p>
                                        </div>
                                        <div
                                            className={`rounded-full px-3 py-1 text-xs font-medium ${classItem.status === 'Present'
                                                    ? 'bg-success-50 text-success-600'
                                                    : classItem.status === 'Absent'
                                                        ? 'bg-danger-100 text-danger-600'
                                                        : 'bg-gray-100 text-gray-500'
                                                }`}
                                        >
                                            {classItem.status}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

function RouteComponent() {
    return (
        <LayoutContainer>
            <AttendanceTrackerContent />
        </LayoutContainer>
    );
}

function AttendanceTrackerContent() {
    const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 7));
    const [endDate, setEndDate] = useState<Date | undefined>(new Date());
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLiveSessions, setSelectedLiveSessions] = useState<string[]>([]);
    const [attendanceFilter, setAttendanceFilter] = useState('All');
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });
    const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
    const { currentSession, sessionList, handleSessionChange } = useStudentFilters();
    const { data: batches } = useGetBatchesQuery({ sessionId: currentSession.id });
    const [page, setPage] = useState(0);
    const [rowSelections, setRowSelections] = useState<Record<string, boolean>>({});
    const [sortConfig, setSortConfig] = useState<{
        key: string | null;
        direction: 'asc' | 'desc';
    }>({
        key: null,
        direction: 'asc',
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAttendanceStudent, setSelectedAttendanceStudent] =
        useState<AttendanceStudent | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { setSelectedStudent: setSidebarStudent } = useStudentSidebar();

    // Extract batch options for dropdown
    const batchOptions = useMemo(() => {
        if (!batches || !Array.isArray(batches)) return [{ label: 'All Batches', value: null }];

        const extractedBatches = batches.flatMap((batchData: batchWithStudentDetails) =>
            batchData.batches.map((batch: BatchType) => ({
                label: `${batch.batch_name} (${batch.invite_code})`,
                value: batch.package_session_id,
            }))
        );

        return [{ label: 'All Batches', value: null }, ...extractedBatches];
    }, [batches]);

    // Map packageSessionId → { batchName, packageId } for fast lookup
    const batchInfoMap = useMemo(() => {
        const map = new Map<string, { batchName: string; packageId: string }>();
        if (batches && Array.isArray(batches)) {
            for (const batchData of batches as batchWithStudentDetails[]) {
                for (const batch of batchData.batches) {
                    map.set(batch.package_session_id, {
                        batchName: `${batch.batch_name} (${batch.invite_code})`,
                        packageId: batchData.package_dto.id,
                    });
                }
            }
        }
        return map;
    }, [batches]);

    // Reset batch selection when session changes, and re-enable the one-shot auto-select below
    const hasAutoSelectedBatchRef = useRef(false);
    useEffect(() => {
        setSelectedBatchId(null);
        hasAutoSelectedBatchRef.current = false;
    }, [currentSession.id]);

    // Set the first batch as default once per session load — never override an explicit
    // "All Batches" (null) selection the user makes afterwards.
    useEffect(() => {
        if (hasAutoSelectedBatchRef.current) return;
        if (batchOptions.length > 1 && selectedBatchId === null) {
            const firstBatch = batchOptions[1];
            if (firstBatch && firstBatch.value) {
                setSelectedBatchId(firstBatch.value);
                hasAutoSelectedBatchRef.current = true;
            }
        }
    }, [batchOptions, selectedBatchId]);

    const sortIconFor = (key: string) => {
        if (sortConfig.key !== key) return <CaretUpDown className="inline" />;
        return sortConfig.direction === 'asc' ? (
            <CaretUp className="inline" />
        ) : (
            <CaretDown className="inline" />
        );
    };

    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            const newSelections: Record<string, boolean> = {};
            studentsData.forEach((s: { id: string | number }) => {
                newSelections[s.id] = true;
            });
            setRowSelections(newSelections);
        } else {
            setRowSelections({});
        }
    };

    const toggleRowSelection = (id: string, checked: boolean) => {
        setRowSelections((prev) => {
            const newSel = { ...prev };
            if (checked) newSel[id] = true;
            else delete newSel[id];
            return newSel;
        });
    };

    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading('Attendance Tracker');
    }, [setNavHeading]);

    // Sync dateRange with individual date states for backwards compatibility
    useEffect(() => {
        setStartDate(dateRange.from);
        setEndDate(dateRange.to);
    }, [dateRange]);

    // Debounce search input so the API only fires after the user stops typing
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(searchInput);
            setPage(0);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const filterRequest = useMemo(
        () => ({
            name: searchQuery,
            start_date: startDate ? format(startDate, 'yyyy-MM-dd') : '2020-01-01',
            end_date: endDate ? format(endDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            batch_ids: selectedBatchId ? [selectedBatchId] : null,
            live_session_ids: selectedLiveSessions.length > 0 ? selectedLiveSessions : null,
        }),
        [searchQuery, startDate, endDate, selectedBatchId, selectedLiveSessions]
    );

    // Use attendance service hook
    const {
        data: attendanceData,
        isLoading,
        error,
    } = useGetAttendance({
        pageNo: page,
        pageSize: 10,
        filterRequest,
    });

    // Get selected batch label for display
    const selectedBatchLabel = useMemo(() => {
        if (!selectedBatchId) return 'All Batches';
        const batch = batchOptions.find((opt) => opt.value === selectedBatchId);
        return batch?.label || 'All Batches';
    }, [selectedBatchId, batchOptions]);

    // Process attendance data to match current table structure
    const studentsData = useMemo(() => {
        if (!attendanceData?.pages) return [];

        const allStudents: AttendanceStudent[] = [];

        attendanceData.pages.forEach((pageData) => {
            console.log('pageData', pageData);
            if (pageData?.content) {
                const mappedStudents = pageData.content.map((student: ContentType) => {
                    const total = student.sessions.length;
                    const attended = student.sessions.filter(
                        (s) => s.attendanceStatus === 'PRESENT'
                    ).length;
                    const percent = student.attendancePercentage;

                    const sessionsWithDuration = student.sessions.filter(
                        (s) => typeof s.durationMinutes === 'number' && s.durationMinutes > 0
                    );
                    const avgDurationMinutes = sessionsWithDuration.length
                        ? Math.round(
                              sessionsWithDuration.reduce(
                                  (acc, s) => acc + (s.durationMinutes ?? 0),
                                  0
                              ) / sessionsWithDuration.length
                          )
                        : null;

                    // Store sessions for modal
                    classAttendanceData[student.studentId] = student.sessions.map((sess) => ({
                        id: sess.scheduleId,
                        className: sess.title,
                        date: sess.meetingDate,
                        time: sess.startTime,
                        status: sess.attendanceStatus === 'PRESENT' ? 'Present' : sess.attendanceStatus === 'ABSENT' ? 'Absent' : 'Unmarked',
                    }));

                    const batchInfo = student.packageSessionId
                        ? batchInfoMap.get(student.packageSessionId)
                        : null;

                    return {
                        id: student.studentId,
                        name: student.fullName,
                        username: student.instituteEnrollmentNumber || '',
                        batch: batchInfo?.batchName || selectedBatchLabel,
                        packageSessionId: student.packageSessionId,
                        mobileNumber: student.mobileNumber,
                        email: student.email,
                        attendedClasses: attended,
                        totalClasses: total,
                        attendancePercentage: percent,
                        avgDurationMinutes,
                    };
                });
                allStudents.push(...mappedStudents);
            }
        });

        return allStudents;
    }, [attendanceData, selectedBatchLabel, batchInfoMap]);

    // Function to clear all filters
    const clearFilters = () => {
        setStartDate(undefined);
        setEndDate(undefined);
        setDateRange({});
        setSearchQuery('');
        setSearchInput('');
        setSelectedBatchId(null);
        setSelectedLiveSessions([]);
        setAttendanceFilter('All');
    };

    // Function to handle View More click (attendance details modal)
    const handleViewMoreClick = (student: AttendanceStudent) => {
        setSelectedAttendanceStudent(student);
        setIsModalOpen(true);
    };

    // Function to handle student details view (eye icon in first column).
    // Populates the shared StudentSidebar context with a minimal StudentTable —
    // sub-components (StudentOverview etc.) refetch full details by user_id.
    const handleViewDetailsClick = (student: AttendanceStudent) => {
        const packageSessionId = student.packageSessionId || selectedBatchId || '';
        const resolvedPackageId = packageSessionId
            ? batchInfoMap.get(packageSessionId)?.packageId
            : undefined;

        const minimalStudent: StudentTable = {
            id: student.id,
            user_id: student.id,
            username: student.username || null,
            email: student.email,
            full_name: student.name,
            mobile_number: student.mobileNumber,
            institute_enrollment_id: student.username || '',
            institute_enrollment_number: student.username || '',
            package_session_id: packageSessionId,
            package_id: resolvedPackageId,
            status: 'ACTIVE',
            face_file_id: null,
            address_line: '',
            attendance_percent: student.attendancePercentage,
            referral_count: 0,
            region: null,
            city: '',
            pin_code: '',
            date_of_birth: '',
            gender: '',
            fathers_name: '',
            mothers_name: '',
            father_mobile_number: '',
            father_email: '',
            mother_mobile_number: '',
            mother_email: '',
            linked_institute_name: null,
            created_at: '',
            updated_at: '',
            session_expiry_days: 0,
            institute_id: '',
            expiry_date: 0,
            parents_email: '',
            parents_mobile_number: '',
            parents_to_mother_email: '',
            parents_to_mother_mobile_number: '',
            destination_package_session_id: '',
            enroll_invite_id: '',
            payment_status: '',
            custom_fields: {},
        };
        setSidebarStudent(minimalStudent);
        setIsSidebarOpen(true);
    };

    // Pagination helpers - with server-side pagination
    const totalPages = attendanceData?.pages?.[0]?.totalPages || 1;
    const totalElements = attendanceData?.pages?.[0]?.totalElements || 0;

    const allRowsSelected =
        studentsData.length > 0 && studentsData.every((s) => rowSelections[s.id]);

    // Fetch all pages of attendance data for export
    const fetchAllAttendancePages = async (): Promise<ContentType[]> => {
        const allContent: ContentType[] = [];
        let currentPage = 0;
        let hasMore = true;
        const pageSize = 50;

        while (hasMore) {
            const response = await authenticatedAxiosInstance.post<AttendanceResponseType>(
                `${LIVE_SESSION_ALL_ATTENDANCE}?page=${currentPage}&size=${pageSize}`,
                filterRequest
            );
            const data = response.data;
            if (data?.content) {
                allContent.push(...data.content);
            }
            hasMore = !data?.last;
            currentPage++;
        }
        return allContent;
    };

    const downloadCsv = (csvString: string, filename: string) => {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const [isExporting, setIsExporting] = useState(false);

    const exportAccountDetails = async (_sel: AttendanceStudent[]) => {
        setIsExporting(true);
        try {
            const allStudents = await fetchAllAttendancePages();
            const csvData = allStudents.map((student) => ({
                'Name': student.fullName || '',
                'Email': student.email || '',
                'Mobile Number': student.mobileNumber || '',
                'Enrollment Number': student.instituteEnrollmentNumber || '',
                'Gender': student.gender || '',
                'Enrollment Status': student.enrollmentStatus || '',
            }));
            const csv = Papa.unparse(csvData);
            downloadCsv(csv, `attendance_account_details_${format(new Date(), 'yyyy-MM-dd')}.csv`);
            toast.success('Account details exported successfully');
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export account details');
        } finally {
            setIsExporting(false);
        }
    };

    const exportFullData = async (_sel: AttendanceStudent[]) => {
        setIsExporting(true);
        try {
            const allStudents = await fetchAllAttendancePages();

            const csvData = allStudents.map((student) => {
                const total = student.sessions.length;
                const attended = student.sessions.filter(
                    (s) => s.attendanceStatus === 'PRESENT'
                ).length;

                const sessionsWithDuration = student.sessions.filter(
                    (s) => typeof s.durationMinutes === 'number' && s.durationMinutes > 0
                );
                const avgDurationMinutes = sessionsWithDuration.length
                    ? Math.round(
                          sessionsWithDuration.reduce(
                              (acc, s) => acc + (s.durationMinutes ?? 0),
                              0
                          ) / sessionsWithDuration.length
                      )
                    : null;

                const presentSessions = student.sessions
                    .filter((s) => s.attendanceStatus === 'PRESENT')
                    .map((s) => `${s.title} (${s.meetingDate})`)
                    .join(', ');

                const absentSessions = student.sessions
                    .filter((s) => s.attendanceStatus !== 'PRESENT')
                    .map((s) => `${s.title} (${s.meetingDate})`)
                    .join(', ');

                return {
                    'Name': student.fullName || '',
                    'Email': student.email || '',
                    'Mobile Number': student.mobileNumber || '',
                    'Enrollment Number': student.instituteEnrollmentNumber || '',
                    'Attendance %': `${student.attendancePercentage}%`,
                    'Classes Attended': `${attended}/${total}`,
                    'Avg Duration': formatDurationMinutes(avgDurationMinutes),
                    'Present': presentSessions,
                    'Absent': absentSessions,
                };
            });

            const csv = Papa.unparse(csvData);
            downloadCsv(csv, `attendance_full_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
            toast.success('Attendance data exported successfully');
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export attendance data');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
                <Helmet>
                    <title>Live Class Attendance</title>
                    <meta
                        name="description"
                        content="Track and manage student attendance for live classes"
                    />
                </Helmet>
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h1 className="text-xl font-semibold text-neutral-800 sm:text-2xl">
                                Live Class Attendance
                            </h1>
                            <p className="text-sm text-neutral-600 sm:text-base">
                                Track and manage student attendance for live classes
                            </p>
                        </div>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            className="flex items-center gap-2"
                            disabled={isExporting || studentsData.length === 0}
                            onClick={() => exportFullData([])}
                        >
                            {isExporting ? (
                                <>
                                    <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <DownloadSimple size={18} />
                                    Export CSV
                                </>
                            )}
                        </MyButton>
                    </div>

                    <div className="rounded-lg border border-neutral-200 bg-white p-4">
                        <div className="mb-4 flex flex-col gap-3">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="w-full [&>*]:w-full">
                                    <MyDropdown
                                        currentValue={currentSession}
                                        dropdownList={sessionList}
                                        placeholder={`Select ${getTerminology(ContentTerms.Session, SystemTerms.Session)}`}
                                        handleChange={handleSessionChange}
                                    />
                                </div>
                                <div className="relative w-full">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <Search className="size-4 text-neutral-500" />
                                    </div>
                                    <Input
                                        type="text"
                                        placeholder="Search students..."
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        className="h-9 w-full rounded-md border border-neutral-300 bg-white py-2 pl-10 pr-3 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    />
                                </div>
                                <RangeDateFilter range={dateRange} onChange={setDateRange} />
                                <BatchDropdown
                                    label={getTerminology(ContentTerms.Batch, SystemTerms.Batch)}
                                    value={selectedBatchLabel}
                                    options={batchOptions}
                                    onSelect={(batchId) => setSelectedBatchId(batchId)}
                                />
                            </div>

                            {(searchInput ||
                                startDate ||
                                endDate ||
                                selectedBatchId ||
                                selectedLiveSessions.length > 0 ||
                                attendanceFilter !== 'All') && (
                                <div className="flex justify-end">
                                    <button
                                        onClick={clearFilters}
                                        className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200"
                                    >
                                        <X className="size-4" />
                                        Clear Filters
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Students Count */}
                        <div className="flex items-center justify-between text-xs text-neutral-500">
                            <span>
                                {isLoading ? (
                                    'Loading students...'
                                ) : (
                                    <>
                                        Showing{' '}
                                        <span className="font-medium text-neutral-700">
                                            {studentsData.length}
                                        </span>
                                        {totalElements > studentsData.length && (
                                            <>
                                                {' '}
                                                of{' '}
                                                <span className="font-medium text-neutral-700">
                                                    {totalElements}
                                                </span>
                                            </>
                                        )}{' '}
                                        students
                                    </>
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Table Section */}
                    <div className="overflow-hidden rounded-lg border border-neutral-200">
                        {/* Table */}
                        <div className="w-full overflow-x-auto">
                            <div className="max-h-[640px] overflow-y-auto">
                                <table className="w-full min-w-[800px] table-auto border-collapse">
                                    <thead className="sticky top-0 z-10 bg-primary-100">
                                        <tr className="border-b border-neutral-200 text-left text-sm font-medium text-neutral-600">
                                            <th className="sticky top-0 z-10 w-[40px] bg-primary-100 px-4 py-4">
                                                <Checkbox
                                                    checked={allRowsSelected}
                                                    onCheckedChange={(val) =>
                                                        toggleSelectAll(!!val)
                                                    }
                                                    className="border-neutral-400 bg-white text-neutral-600 data-[state=checked]:bg-primary-500 data-[state=checked]:text-white"
                                                />
                                            </th>
                                            <th className="sticky top-0 z-10 w-[60px] bg-primary-100 px-4 py-4">
                                                Details
                                            </th>
                                            <th className="sticky top-0 z-10 select-none bg-primary-100 px-4 py-4">
                                                <MyDropdown
                                                    dropdownList={['ASC', 'DESC']}
                                                    onSelect={(val) =>
                                                        setSortConfig({
                                                            key: 'name',
                                                            direction:
                                                                val === 'ASC' ? 'asc' : 'desc',
                                                        })
                                                    }
                                                >
                                                    <button
                                                        type="button"
                                                        className="flex items-center gap-1 text-neutral-700 hover:text-neutral-900 focus:outline-none"
                                                        aria-label="Sort learner name"
                                                    >
                                                        <span>Learner Name</span>
                                                        {sortIconFor('name')}
                                                    </button>
                                                </MyDropdown>
                                            </th>
                                            <th className="sticky top-0 z-10 bg-primary-100 px-4 py-4">
                                                Username
                                            </th>
                                            <th className="sticky top-0 z-10 bg-primary-100 px-4 py-4">
                                                {getTerminology(
                                                    ContentTerms.Batch,
                                                    SystemTerms.Batch
                                                )}
                                            </th>
                                            <th className="sticky top-0 z-10 bg-primary-100 px-4 py-4">
                                                Mobile Number
                                            </th>
                                            <th className="sticky top-0 z-10 bg-primary-100 px-4 py-4">
                                                Email
                                            </th>
                                            <th className="sticky top-0 z-10 bg-primary-100 px-4 py-4">
                                                Avg Duration
                                            </th>
                                            <th className="sticky top-0 z-10 bg-primary-100 px-4 py-4">
                                                Live Classes and Attendance
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isLoading ? (
                                            <tr>
                                                <td
                                                    colSpan={9}
                                                    className="p-8 text-center text-neutral-500"
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <div className="mb-3 size-8 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-500"></div>
                                                        <p className="text-lg font-medium">
                                                            Loading students...
                                                        </p>
                                                        <p className="mt-1 text-sm">
                                                            Please wait while we fetch attendance
                                                            data
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : error ? (
                                            <tr>
                                                <td
                                                    colSpan={9}
                                                    className="p-8 text-center text-neutral-500"
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="40"
                                                            height="40"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            className="mb-3 text-red-300"
                                                        >
                                                            <circle cx="12" cy="12" r="10"></circle>
                                                            <line
                                                                x1="12"
                                                                y1="8"
                                                                x2="12"
                                                                y2="12"
                                                            ></line>
                                                            <line
                                                                x1="12"
                                                                y1="16"
                                                                x2="12.01"
                                                                y2="16"
                                                            ></line>
                                                        </svg>
                                                        <p className="text-lg font-medium text-red-600">
                                                            Error loading attendance data
                                                        </p>
                                                        <p className="mt-1 text-sm">
                                                            Please try refreshing the page or
                                                            adjusting your filters
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : studentsData.length > 0 ? (
                                            studentsData.map((student) => (
                                                <tr
                                                    key={student.id}
                                                    className="border-b border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50"
                                                >
                                                    <td className="px-4 py-3">
                                                        <Checkbox
                                                            checked={!!rowSelections[student.id]}
                                                            onCheckedChange={(val) =>
                                                                toggleRowSelection(
                                                                    student.id,
                                                                    !!val
                                                                )
                                                            }
                                                            className="flex size-4 items-center justify-center border-neutral-400 text-neutral-600 shadow-none data-[state=checked]:bg-primary-500 data-[state=checked]:text-white"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            className="text-neutral-500 hover:text-primary-500"
                                                            onClick={() =>
                                                                handleViewDetailsClick(student)
                                                            }
                                                        >
                                                            <ArrowSquareOut size={20} />
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3">{student.name}</td>
                                                    <td className="px-4 py-3">{student.username}</td>
                                                    <td className="px-4 py-3">{student.batch}</td>
                                                    <td className="px-4 py-3">{student.mobileNumber}</td>
                                                    <td className="px-4 py-3">{student.email}</td>
                                                    <td className="px-4 py-3">
                                                        {formatDurationMinutes(
                                                            student.avgDurationMinutes
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col">
                                                            <span>
                                                                {student.attendedClasses}/
                                                                {student.totalClasses} Attended
                                                            </span>
                                                            <div className="mt-1 flex items-center gap-3">
                                                                <button
                                                                    className="flex items-center gap-1 font-medium text-primary-500 hover:underline"
                                                                    onClick={() =>
                                                                        handleViewMoreClick(student)
                                                                    }
                                                                >
                                                                    <Eye size={14} />
                                                                    View More
                                                                </button>
                                                                <div className="h-4 w-px bg-neutral-300"></div>
                                                                <span
                                                                    className={`rounded-full px-2 py-0.5 font-medium ${student.attendancePercentage >=
                                                                            75
                                                                            ? 'bg-success-50 text-success-600'
                                                                            : student.attendancePercentage >=
                                                                                50
                                                                                ? 'bg-warning-50 text-warning-600'
                                                                                : 'bg-danger-50 text-danger-600'
                                                                        }`}
                                                                >
                                                                    {student.attendancePercentage}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td
                                                    colSpan={9}
                                                    className="p-8 text-center text-neutral-500"
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="40"
                                                            height="40"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            className="mb-3 text-neutral-300"
                                                        >
                                                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                                            <line
                                                                x1="12"
                                                                y1="9"
                                                                x2="12"
                                                                y2="13"
                                                            ></line>
                                                            <line
                                                                x1="12"
                                                                y1="17"
                                                                x2="12.01"
                                                                y2="17"
                                                            ></line>
                                                        </svg>
                                                        <p className="text-lg font-medium">
                                                            No students found
                                                        </p>
                                                        <p className="mt-1 text-sm">
                                                            Try adjusting your search or filter
                                                            criteria
                                                        </p>
                                                        <button
                                                            className="mt-4 rounded-md bg-primary-50 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-100"
                                                            onClick={clearFilters}
                                                        >
                                                            Clear all filters
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pagination Controls */}
                        <div className="flex flex-col gap-4 border-t border-neutral-200 p-4">
                            {/* Bulk Actions Bar */}
                            {Object.keys(rowSelections).length > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-4 text-neutral-600">
                                    <div className="flex gap-1 text-sm">
                                        [{Object.keys(rowSelections).length}]<span> Selected</span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <MyButton
                                            buttonType="secondary"
                                            scale="medium"
                                            onClick={() => setRowSelections({})}
                                        >
                                            Reset
                                        </MyButton>

                                        <MyDropdown
                                            dropdownList={['Export Account Details', 'Export Data']}
                                            onSelect={(value) => {
                                                const sel = studentsData.filter(
                                                    (s) => rowSelections[s.id]
                                                );
                                                if (value === 'Export Account Details') {
                                                    exportAccountDetails(sel);
                                                } else if (value === 'Export Data') {
                                                    exportFullData(sel);
                                                }
                                            }}
                                        >
                                            <MyButton
                                                buttonType="primary"
                                                scale="medium"
                                                className="flex items-center gap-1"
                                            >
                                                Bulk Actions
                                                <CaretUpDown />
                                            </MyButton>
                                        </MyDropdown>
                                    </div>
                                </div>
                            )}

                            <MyPagination
                                currentPage={page}
                                totalPages={totalPages}
                                onPageChange={(p) => setPage(p)}
                            />
                        </div>
                    </div>
                </div>

                {/* Attendance details modal — sessions list for a single student */}
                <AttendanceModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    student={selectedAttendanceStudent}
                    batchId={selectedBatchId || ''}
                    startDate={startDate}
                    endDate={endDate}
                />

                {/* Shared StudentSidebar reused from manage-students/students-list */}
                <SidebarProvider
                    style={{ ['--sidebar-width' as string]: '565px' }}
                    defaultOpen={false}
                    open={isSidebarOpen}
                    onOpenChange={setIsSidebarOpen}
                >
                    <StudentSidebar isStudentList />
                </SidebarProvider>
        </>
    );
}

interface RangeDateFilterProps {
    range: { from?: Date; to?: Date };
    onChange: (r: { from?: Date; to?: Date }) => void;
}

type DatePresetKey = '7' | '15' | '30' | 'custom';

function RangeDateFilter({ range, onChange }: RangeDateFilterProps) {
    const { from, to } = range;

    const activePreset: DatePresetKey = useMemo(() => {
        if (!from || !to) return 'custom';
        const today = startOfDay(new Date());
        const toDay = startOfDay(to);
        if (toDay.getTime() !== today.getTime()) return 'custom';
        const diffDays = Math.round(
            (today.getTime() - startOfDay(from).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays === 7) return '7';
        if (diffDays === 15) return '15';
        if (diffDays === 30) return '30';
        return 'custom';
    }, [from, to]);

    const applyPreset = (days: number) => {
        onChange({ from: startOfDay(subDays(new Date(), days)), to: new Date() });
    };

    const presets: Array<{ key: DatePresetKey; label: string; days: number }> = [
        { key: '7', label: 'Last 7 days', days: 7 },
        { key: '15', label: 'Last 15 days', days: 15 },
        { key: '30', label: 'Last 30 days', days: 30 },
    ];

    return (
        <div className="w-full">
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        className={`flex h-9 w-full items-center justify-between rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm ${
                            from || to ? 'text-neutral-900' : 'text-neutral-500'
                        } focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
                    >
                        <span className="truncate">
                            {from && to ? (
                                <>
                                    {format(from, 'dd/MM/yy')} - {format(to, 'dd/MM/yy')}
                                </>
                            ) : from ? (
                                <>From {format(from, 'dd/MM/yy')}</>
                            ) : (
                                <>Date range</>
                            )}
                        </span>
                        <CalendarIcon className="ml-2 size-4 shrink-0 text-neutral-500" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto max-w-[95vw] p-3" align="start">
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <div className="flex flex-col gap-2 sm:w-40">
                            <h4 className="text-xs font-medium text-neutral-500">Quick Select</h4>
                            {presets.map((preset) => {
                                const isActive = activePreset === preset.key;
                                return (
                                    <button
                                        key={preset.key}
                                        onClick={() => applyPreset(preset.days)}
                                        className={`w-full rounded-md border px-3 py-1.5 text-left text-xs transition ${
                                            isActive
                                                ? 'border-primary-300 bg-primary-50 font-medium text-primary-600'
                                                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => onChange({})}
                                className={`w-full rounded-md border px-3 py-1.5 text-left text-xs transition ${
                                    activePreset === 'custom' && (from || to)
                                        ? 'border-primary-300 bg-primary-50 font-medium text-primary-600'
                                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
                                }`}
                            >
                                Custom range
                            </button>
                        </div>
                        <div className="sm:border-l sm:border-neutral-100 sm:pl-3">
                            <h4 className="mb-2 text-xs font-medium text-neutral-500">
                                Pick custom range
                            </h4>
                            <Calendar
                                mode="range"
                                selected={range as DateRange}
                                onSelect={(sel: { from?: Date; to?: Date } | undefined) =>
                                    onChange(sel || {})
                                }
                            />
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}

interface BatchDropdownProps {
    label: string;
    value: string;
    options: Array<{ label: string; value: string | null }>;
    onSelect: (batchId: string | null) => void;
}

function BatchDropdown({ label, value, options, onSelect }: BatchDropdownProps) {
    const [batchSearch, setBatchSearch] = useState('');

    const uniqueOptions = useMemo(() => {
        const seen = new Set<string>();
        return options.filter((opt) => {
            const key = `${opt.value ?? 'all'}::${opt.label}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [options]);

    const filteredOptions = useMemo(() => {
        const query = batchSearch.trim().toLowerCase();
        if (!query) return uniqueOptions;
        return uniqueOptions.filter((opt) => opt.label.toLowerCase().includes(query));
    }, [uniqueOptions, batchSearch]);

    return (
        <div className="w-full">
            <Popover onOpenChange={(open) => { if (!open) setBatchSearch(''); }}>
                <PopoverTrigger asChild>
                    <button
                        className={`flex h-9 w-full items-center justify-between rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm ${value !== 'All Batches' ? 'text-neutral-900' : 'text-neutral-500'
                            } focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
                    >
                        <span className="truncate">{value || label}</span>
                        <CaretDownIcon className="ml-2 size-4 shrink-0 text-neutral-500" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                    <div className="flex flex-col gap-2">
                        <h4 className="mb-1 text-xs font-medium text-neutral-500">{label}</h4>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={batchSearch}
                                onChange={(e) => setBatchSearch(e.target.value)}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                name="batch-dropdown-search"
                                className="h-8 w-full rounded-md border border-neutral-200 bg-white pl-8 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                        </div>
                        <div className="flex max-h-52 flex-col gap-1 overflow-y-auto">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((opt) => (
                                    <button
                                        key={`${opt.value ?? 'all'}::${opt.label}`}
                                        onClick={() => onSelect(opt.value)}
                                        title={opt.label}
                                        className={`flex w-full items-center rounded-md border border-neutral-200 bg-white px-3 py-2 text-left text-xs leading-5 hover:border-neutral-300 hover:bg-neutral-50 ${value === opt.label ? 'bg-primary-50 text-primary-600' : ''
                                            }`}
                                    >
                                        <span className="block w-full truncate">{opt.label}</span>
                                    </button>
                                ))
                            ) : (
                                <p className="py-2 text-center text-xs text-neutral-400">No batches found</p>
                            )}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
