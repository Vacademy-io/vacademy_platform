/* eslint-disable tailwindcss/no-custom-classname */
import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MyButton } from '@/components/design-system/button';
import { Eye, ArrowSquareOut, X, DownloadSimple, Warning, Check } from '@phosphor-icons/react';
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
import { MyTable } from '@/components/design-system/table';
import type { ColumnDef, RowSelectionState, OnChangeFn } from '@tanstack/react-table';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { MyDialog } from '@/components/design-system/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type ExportScope = 'both' | 'present' | 'absent';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';

import { CaretUpDown, CaretDownIcon } from '@phosphor-icons/react';
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
    // Anything not explicitly PRESENT is treated as Absent (no separate "Unmarked" state).
    status: 'Present' | 'Absent';
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

// Columns for the per-learner session table shown in the View More dialog.
const SESSION_COLUMNS: ColumnDef<ClassAttendanceItem>[] = [
    {
        id: 'className',
        accessorKey: 'className',
        size: 520,
        minSize: 240,
        maxSize: 640,
        header: 'Class',
        cell: ({ row }) => (
            <span className="font-medium text-neutral-800">{row.original.className}</span>
        ),
    },
    {
        id: 'date',
        accessorKey: 'date',
        size: 160,
        minSize: 120,
        maxSize: 200,
        header: 'Date',
        cell: ({ row }) => <span className="text-neutral-600">{row.original.date}</span>,
    },
    {
        id: 'time',
        accessorKey: 'time',
        size: 150,
        minSize: 100,
        maxSize: 180,
        header: 'Time',
        cell: ({ row }) => <span className="text-neutral-600">{row.original.time}</span>,
    },
    {
        id: 'status',
        size: 160,
        minSize: 110,
        maxSize: 200,
        header: 'Status',
        cell: ({ row }) => {
            const status = row.original.status;
            return (
                <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                        status === 'Present'
                            ? 'bg-success-50 text-success-600'
                            : 'bg-danger-100 text-danger-600'
                    }`}
                >
                    {status}
                </span>
            );
        },
    },
];

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
                        status: s.attendanceStatus === 'PRESENT' ? 'Present' : 'Absent',
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

    // Breakdown for the donut chart / legend. Colors are design-token CSS vars
    // (fed to recharts as SVG fill values).
    const totalSessions = studentClasses.length;
    const presentCount = studentClasses.filter((c) => c.status === 'Present').length;
    const absentCount = studentClasses.filter((c) => c.status === 'Absent').length;
    const chartData = [
        { name: 'Present', value: presentCount, color: 'hsl(var(--success-500))' },
        { name: 'Absent', value: absentCount, color: 'hsl(var(--danger-500))' },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="flex max-h-[85vh] w-full flex-col sm:max-w-5xl">
                <div className="flex items-center justify-between border-b border-neutral-200 p-4">
                    <h2 className="text-lg font-semibold text-neutral-800">
                        {student.name} - Class Attendance
                    </h2>
                </div>

                <div className="flex flex-col gap-4 overflow-y-auto p-4">
                    {/* Overall Attendance — donut chart + breakdown */}
                    {loading ? (
                        <div className="flex h-40 items-center justify-center rounded-lg bg-primary-50 text-sm text-neutral-500">
                            Loading attendance…
                        </div>
                    ) : totalSessions === 0 ? null : (
                        <div className="flex flex-col items-center gap-6 rounded-lg bg-primary-50 p-4 sm:flex-row sm:justify-center sm:gap-12">
                            {/* Donut */}
                            <div className="relative size-40 shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={52}
                                            outerRadius={72}
                                            paddingAngle={totalSessions > 0 ? 2 : 0}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {chartData.map((entry) => (
                                                <Cell key={entry.name} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            formatter={(value: number, name: string) => [
                                                `${value} ${value === 1 ? 'class' : 'classes'}`,
                                                name,
                                            ]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-bold text-primary-500">
                                        {overallAttendance !== null ? `${overallAttendance}%` : '--'}
                                    </span>
                                    <span className="text-xs text-neutral-500">Attendance</span>
                                </div>
                            </div>

                            {/* Legend / counts */}
                            <div className="flex w-full max-w-xs flex-col gap-2.5">
                                {chartData.map((entry) => (
                                    <div
                                        key={entry.name}
                                        className="flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-2">
                                            {/* data-driven chart color */}
                                            <span
                                                className="size-3 shrink-0 rounded-full"
                                                style={{ backgroundColor: entry.color }}
                                            />
                                            <span className="text-sm text-neutral-700">
                                                {entry.name}
                                            </span>
                                        </div>
                                        <span className="text-sm font-semibold text-neutral-800">
                                            {entry.value}
                                            <span className="ml-1 text-xs font-normal text-neutral-400">
                                                (
                                                {totalSessions
                                                    ? Math.round((entry.value / totalSessions) * 100)
                                                    : 0}
                                                %)
                                            </span>
                                        </span>
                                    </div>
                                ))}
                                <div className="mt-1 flex items-center justify-between border-t border-neutral-200 pt-2">
                                    <span className="text-sm font-medium text-neutral-700">
                                        Total Classes
                                    </span>
                                    <span className="text-sm font-semibold text-neutral-800">
                                        {totalSessions}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Class List */}
                    {!loading && studentClasses.length === 0 ? (
                        <p className="py-6 text-center text-sm text-neutral-500">
                            No sessions found for this learner
                        </p>
                    ) : (
                        <MyTable<ClassAttendanceItem>
                            data={{
                                content: studentClasses,
                                total_pages: 1,
                                page_no: 0,
                                page_size: studentClasses.length || 10,
                                total_elements: studentClasses.length,
                                last: true,
                            }}
                            columns={SESSION_COLUMNS}
                            isLoading={loading}
                            error={null}
                            currentPage={0}
                            scrollable
                        />
                    )}
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
    const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
    const { currentSession, sessionList, handleSessionChange } = useStudentFilters();
    const { data: batches } = useGetBatchesQuery({ sessionId: currentSession.id });
    const [page, setPage] = useState(0);
    // Row selection is tracked per page (keyed by TanStack row index), matching the
    // students-list MyTable pattern.
    const [rowSelections, setRowSelections] = useState<Record<number, RowSelectionState>>({});
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

    // Map packageSessionId → { batchName, packageId, packageName } for fast lookup
    const batchInfoMap = useMemo(() => {
        const map = new Map<string, { batchName: string; packageId: string; packageName: string }>();
        if (batches && Array.isArray(batches)) {
            for (const batchData of batches as batchWithStudentDetails[]) {
                for (const batch of batchData.batches) {
                    map.set(batch.package_session_id, {
                        batchName: `${batch.batch_name} (${batch.invite_code})`,
                        packageId: batchData.package_dto.id,
                        packageName: batchData.package_dto.package_name,
                    });
                }
            }
        }
        return map;
    }, [batches]);

    // Reset batch selection when session changes, and re-enable the one-shot auto-select below
    const hasAutoSelectedBatchRef = useRef(false);
    useEffect(() => {
        setSelectedBatchIds([]);
        hasAutoSelectedBatchRef.current = false;
    }, [currentSession.id]);

    // Select the first batch as default once per session load — never override an explicit
    // "All Batches" (empty) selection the user makes afterwards.
    useEffect(() => {
        if (hasAutoSelectedBatchRef.current) return;
        if (batchOptions.length > 1 && selectedBatchIds.length === 0) {
            const firstBatch = batchOptions[1];
            if (firstBatch && firstBatch.value) {
                setSelectedBatchIds([firstBatch.value]);
                hasAutoSelectedBatchRef.current = true;
            }
        }
    }, [batchOptions, selectedBatchIds]);

    // Selection for the current page + a per-page setter for MyTable.
    const currentPageSelection = rowSelections[page] || {};
    const handleRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
        setRowSelections((prev) => {
            const next = typeof updater === 'function' ? updater(prev[page] || {}) : updater;
            return { ...prev, [page]: next };
        });
    };
    const totalSelectedCount = Object.values(rowSelections).reduce(
        (count, sel) => count + Object.values(sel).filter(Boolean).length,
        0
    );

    // MyTable sortable headers call this via table meta.
    const handleSort = (columnId: string, direction: string) => {
        setSortConfig({
            key: columnId,
            direction: direction.toLowerCase() === 'desc' ? 'desc' : 'asc',
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
            batch_ids: selectedBatchIds.length > 0 ? selectedBatchIds : null,
            live_session_ids: selectedLiveSessions.length > 0 ? selectedLiveSessions : null,
        }),
        [searchQuery, startDate, endDate, selectedBatchIds, selectedLiveSessions]
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

    // Fallback label for the Batch column when a learner's package_session can't be resolved.
    const selectedBatchLabel = useMemo(() => {
        if (selectedBatchIds.length !== 1) return 'All Batches';
        const batch = batchOptions.find((opt) => opt.value === selectedBatchIds[0]);
        return batch?.label || 'All Batches';
    }, [selectedBatchIds, batchOptions]);

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
                        status: sess.attendanceStatus === 'PRESENT' ? 'Present' : 'Absent',
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

    // Client-side sort of the current page by learner name (server returns unsorted rows).
    const sortedStudents = useMemo(() => {
        if (!sortConfig.key) return studentsData;
        const sorted = [...studentsData].sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
        );
        return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
    }, [studentsData, sortConfig]);

    // Function to clear all filters
    const clearFilters = () => {
        setStartDate(undefined);
        setEndDate(undefined);
        setDateRange({});
        setSearchQuery('');
        setSearchInput('');
        setSelectedBatchIds([]);
        setSelectedLiveSessions([]);
        setAttendanceFilter('All');
    };

    // Function to handle View More click (attendance details modal)
    const handleViewMoreClick = useCallback((student: AttendanceStudent) => {
        setSelectedAttendanceStudent(student);
        setIsModalOpen(true);
    }, []);

    // Function to handle student details view (eye icon in first column).
    // Populates the shared StudentSidebar context with a minimal StudentTable —
    // sub-components (StudentOverview etc.) refetch full details by user_id.
    const handleViewDetailsClick = useCallback((student: AttendanceStudent) => {
        const packageSessionId =
            student.packageSessionId ||
            (selectedBatchIds.length === 1 ? selectedBatchIds[0] : '') ||
            '';
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
    }, [selectedBatchIds, batchInfoMap, setSidebarStudent]);

    // Column definitions for the MyTable-based attendance table.
    const attendanceColumns = useMemo<ColumnDef<AttendanceStudent>[]>(
        () => [
            {
                id: 'checkbox',
                size: 50,
                minSize: 50,
                maxSize: 50,
                enableResizing: false,
                enablePinning: true,
                header: ({ table }) => (
                    <Checkbox
                        checked={table.getIsAllRowsSelected()}
                        onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
                        className="border-neutral-400 bg-white text-neutral-600 data-[state=checked]:bg-primary-500 data-[state=checked]:text-white"
                    />
                ),
                cell: ({ row }) => (
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        className="flex size-4 items-center justify-center border-neutral-400 text-neutral-600 shadow-none data-[state=checked]:bg-primary-500 data-[state=checked]:text-white"
                    />
                ),
            },
            {
                id: 'details',
                size: 72,
                minSize: 60,
                maxSize: 100,
                enablePinning: true,
                header: 'Details',
                cell: ({ row }) => (
                    <button
                        className="text-neutral-500 hover:text-primary-500"
                        onClick={() => handleViewDetailsClick(row.original)}
                        aria-label="View learner details"
                    >
                        <ArrowSquareOut size={20} />
                    </button>
                ),
            },
            {
                id: 'full_name',
                accessorKey: 'name',
                size: 190,
                minSize: 150,
                maxSize: 320,
                enablePinning: true,
                header: (props) => {
                    const meta = props.table.options.meta as {
                        onSort?: (columnId: string, direction: string) => void;
                    };
                    return (
                        <MyDropdown
                            dropdownList={['ASC', 'DESC']}
                            onSelect={(value) => {
                                if (typeof value === 'string')
                                    meta.onSort?.('full_name', value);
                            }}
                        >
                            <button
                                type="button"
                                className="flex w-full items-center justify-between gap-1 text-neutral-700 hover:text-neutral-900 focus:outline-none"
                                aria-label="Sort learner name"
                            >
                                <span>Learner Name</span>
                                <CaretUpDown />
                            </button>
                        </MyDropdown>
                    );
                },
                cell: ({ row }) => (
                    <span className="font-medium text-neutral-800">{row.original.name}</span>
                ),
            },
            {
                accessorKey: 'username',
                size: 130,
                minSize: 100,
                maxSize: 220,
                header: 'Username',
                cell: ({ row }) => <span>{row.original.username || '—'}</span>,
            },
            {
                id: 'batch',
                accessorKey: 'batch',
                size: 200,
                minSize: 140,
                maxSize: 320,
                header: getTerminology(ContentTerms.Batch, SystemTerms.Batch),
                cell: ({ row }) => (
                    <span className="line-clamp-2" title={row.original.batch}>
                        {row.original.batch}
                    </span>
                ),
            },
            {
                accessorKey: 'mobileNumber',
                size: 150,
                minSize: 120,
                maxSize: 220,
                header: 'Mobile Number',
                cell: ({ row }) => <span>{row.original.mobileNumber || '—'}</span>,
            },
            {
                accessorKey: 'email',
                size: 230,
                minSize: 160,
                maxSize: 340,
                header: 'Email',
                cell: ({ row }) => (
                    <span className="block truncate" title={row.original.email}>
                        {row.original.email || '—'}
                    </span>
                ),
            },
            {
                id: 'avgDuration',
                size: 120,
                minSize: 100,
                maxSize: 160,
                header: 'Avg Duration',
                cell: ({ row }) => (
                    <span>{formatDurationMinutes(row.original.avgDurationMinutes)}</span>
                ),
            },
            {
                id: 'attendance',
                size: 220,
                minSize: 180,
                maxSize: 300,
                header: 'Live Classes and Attendance',
                cell: ({ row }) => {
                    const student = row.original;
                    return (
                        <div className="flex flex-col">
                            <span>
                                {student.attendedClasses}/{student.totalClasses} Attended
                            </span>
                            <div className="mt-1 flex items-center gap-3">
                                <button
                                    className="flex items-center gap-1 font-medium text-primary-500 hover:underline"
                                    onClick={() => handleViewMoreClick(student)}
                                >
                                    <Eye size={14} />
                                    View More
                                </button>
                                <div className="h-4 w-px bg-neutral-300"></div>
                                <span
                                    className={`rounded-full px-2 py-0.5 font-medium ${
                                        student.attendancePercentage >= 75
                                            ? 'bg-success-50 text-success-600'
                                            : student.attendancePercentage >= 50
                                              ? 'bg-warning-50 text-warning-600'
                                              : 'bg-danger-50 text-danger-600'
                                    }`}
                                >
                                    {student.attendancePercentage}%
                                </span>
                            </div>
                        </div>
                    );
                },
            },
        ],
        [handleViewDetailsClick, handleViewMoreClick]
    );

    // Pagination helpers - with server-side pagination
    const totalPages = attendanceData?.pages?.[0]?.totalPages || 1;
    const totalElements = attendanceData?.pages?.[0]?.totalElements || 0;

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
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [exportScope, setExportScope] = useState<ExportScope>('both');

    const exportAccountDetails = async (_sel: AttendanceStudent[]) => {
        setIsExporting(true);
        try {
            const allStudents = await fetchAllAttendancePages();
            const csvData = allStudents.map((student) => {
                const info = student.packageSessionId
                    ? batchInfoMap.get(student.packageSessionId)
                    : undefined;
                return {
                    'Name': student.fullName || '',
                    'Email': student.email || '',
                    'Mobile Number': student.mobileNumber || '',
                    'Enrollment Number': student.instituteEnrollmentNumber || '',
                    // 'Batch': info?.batchName || '',
                    'Course': info?.packageName || '',
                    'Gender': student.gender || '',
                    'Enrollment Status': student.enrollmentStatus || '',
                };
            });
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

    const exportFullData = async (scope: ExportScope = 'both') => {
        const includePresent = scope === 'both' || scope === 'present';
        const includeAbsent = scope === 'both' || scope === 'absent';
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

                const info = student.packageSessionId
                    ? batchInfoMap.get(student.packageSessionId)
                    : undefined;

                const row: Record<string, string> = {
                    'Name': student.fullName || '',
                    'Email': student.email || '',
                    'Mobile Number': student.mobileNumber || '',
                    'Enrollment Number': student.instituteEnrollmentNumber || '',
                    // 'Batch': info?.batchName || '',
                    'Course': info?.packageName || '',
                    'Attendance %': `${student.attendancePercentage}%`,
                    'Classes Attended': `${attended}/${total}`,
                    'Avg Duration': formatDurationMinutes(avgDurationMinutes),
                };
                if (includePresent) row['Present'] = presentSessions;
                if (includeAbsent) row['Absent'] = absentSessions;
                return row;
            });

            const csv = Papa.unparse(csvData);
            const scopeSuffix = scope === 'both' ? 'full' : scope;
            downloadCsv(
                csv,
                `attendance_${scopeSuffix}_report_${format(new Date(), 'yyyy-MM-dd')}.csv`
            );
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
                            onClick={() => setExportDialogOpen(true)}
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
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-neutral-600">
                                        {getTerminology(
                                            ContentTerms.Session,
                                            SystemTerms.Session
                                        )}
                                    </span>
                                    <div className="w-full [&>*]:w-full">
                                        <MyDropdown
                                            currentValue={currentSession}
                                            dropdownList={sessionList}
                                            placeholder={`Select ${getTerminology(ContentTerms.Session, SystemTerms.Session)}`}
                                            handleChange={handleSessionChange}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-neutral-600">
                                        Search
                                    </span>
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
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-neutral-600">
                                        {getTerminology(ContentTerms.Batch, SystemTerms.Batch)}
                                    </span>
                                    <BatchDropdown
                                        label={getTerminology(
                                            ContentTerms.Batch,
                                            SystemTerms.Batch
                                        )}
                                        options={batchOptions}
                                        selectedValues={selectedBatchIds}
                                        onChange={setSelectedBatchIds}
                                    />
                                </div>
                            </div>

                            {/* Quick date presets (chips) + global clear share one line */}
                            <div className="flex flex-wrap items-end justify-between gap-3">
                                <RangeDateFilter range={dateRange} onChange={setDateRange} />

                                {(searchInput ||
                                    startDate ||
                                    endDate ||
                                    selectedBatchIds.length > 0 ||
                                    selectedLiveSessions.length > 0 ||
                                    attendanceFilter !== 'All') && (
                                    <button
                                        onClick={clearFilters}
                                        className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm font-medium text-danger-600 hover:bg-danger-100"
                                    >
                                        <X className="size-4" />
                                        Clear Filters
                                    </button>
                                )}
                            </div>
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
                    {error ? (
                        <div className="flex flex-col items-center rounded-lg border border-neutral-200 bg-white p-8 text-center text-neutral-500">
                            <Warning size={40} weight="thin" className="mb-3 text-danger-300" />
                            <p className="text-lg font-medium text-danger-600">
                                Error loading attendance data
                            </p>
                            <p className="mt-1 text-sm">
                                Please try refreshing the page or adjusting your filters
                            </p>
                        </div>
                    ) : !isLoading && sortedStudents.length === 0 ? (
                        <div className="flex flex-col items-center rounded-lg border border-neutral-200 bg-white p-8 text-center text-neutral-500">
                            <Warning size={40} weight="thin" className="mb-3 text-neutral-300" />
                            <p className="text-lg font-medium">No students found</p>
                            <p className="mt-1 text-sm">
                                Try adjusting your search or filter criteria
                            </p>
                            <button
                                className="mt-4 rounded-md bg-primary-50 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-100"
                                onClick={clearFilters}
                            >
                                Clear all filters
                            </button>
                        </div>
                    ) : (
                        <MyTable<AttendanceStudent>
                            data={{
                                content: sortedStudents,
                                total_pages: totalPages,
                                page_no: page,
                                page_size: 10,
                                total_elements: totalElements,
                                last: page >= totalPages - 1,
                            }}
                            columns={attendanceColumns}
                            isLoading={isLoading}
                            error={error}
                            onSort={handleSort}
                            rowSelection={currentPageSelection}
                            onRowSelectionChange={handleRowSelectionChange}
                            currentPage={page}
                            scrollable
                        />
                    )}

                    {/* Bulk actions + pagination */}
                    <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4">
                        {totalSelectedCount > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-4 text-neutral-600">
                                <div className="flex gap-1 text-sm">
                                    [{totalSelectedCount}]<span> Selected</span>
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
                                            if (value === 'Export Account Details') {
                                                exportAccountDetails([]);
                                            } else if (value === 'Export Data') {
                                                exportFullData('both');
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

                {/* Attendance details modal — sessions list for a single student */}
                <AttendanceModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    student={selectedAttendanceStudent}
                    batchId={selectedBatchIds.length === 1 ? selectedBatchIds[0] ?? '' : ''}
                    startDate={startDate}
                    endDate={endDate}
                />

                {/* Export scope chooser — present / absent / both */}
                <MyDialog
                    heading="Export Attendance CSV"
                    open={exportDialogOpen}
                    onOpenChange={setExportDialogOpen}
                    footer={
                        <>
                            <MyButton
                                buttonType="secondary"
                                scale="medium"
                                onClick={() => setExportDialogOpen(false)}
                            >
                                Cancel
                            </MyButton>
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                disabled={isExporting}
                                onClick={() => {
                                    setExportDialogOpen(false);
                                    exportFullData(exportScope);
                                }}
                            >
                                Download CSV
                            </MyButton>
                        </>
                    }
                >
                    <div className="flex flex-col gap-3">
                        <p className="text-sm text-neutral-600">
                            Choose which attendance records to include in the export.
                        </p>
                        <RadioGroup
                            value={exportScope}
                            onValueChange={(v) => setExportScope(v as ExportScope)}
                            className="flex flex-col gap-2"
                        >
                            {(
                                [
                                    {
                                        value: 'both',
                                        label: 'Present & Absent',
                                        desc: 'Include both attended and missed classes (default)',
                                    },
                                    {
                                        value: 'present',
                                        label: 'Present only',
                                        desc: 'Only the classes the learner attended',
                                    },
                                    {
                                        value: 'absent',
                                        label: 'Absent only',
                                        desc: 'Only the classes the learner missed',
                                    },
                                ] as Array<{ value: ExportScope; label: string; desc: string }>
                            ).map((opt) => (
                                <label
                                    key={opt.value}
                                    htmlFor={`export-${opt.value}`}
                                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                                        exportScope === opt.value
                                            ? 'border-primary-500 bg-primary-50'
                                            : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                                    }`}
                                >
                                    <RadioGroupItem
                                        value={opt.value}
                                        id={`export-${opt.value}`}
                                        className="mt-0.5"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-neutral-800">
                                            {opt.label}
                                        </span>
                                        <span className="text-xs text-neutral-500">{opt.desc}</span>
                                    </div>
                                </label>
                            ))}
                        </RadioGroup>
                    </div>
                </MyDialog>

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

type DatePresetKey = '1' | '3' | '5' | '7' | '15' | '30' | 'custom';

const DATE_PRESETS: Array<{ key: DatePresetKey; label: string; days: number }> = [
    { key: '1', label: '1 day', days: 1 },
    { key: '3', label: '3 days', days: 3 },
    { key: '5', label: '5 days', days: 5 },
    { key: '7', label: '7 days', days: 7 },
    { key: '15', label: '15 days', days: 15 },
    { key: '30', label: '30 days', days: 30 },
];

function RangeDateFilter({ range, onChange }: RangeDateFilterProps) {
    const { from, to } = range;
    const [open, setOpen] = useState(false);

    const activePreset: DatePresetKey = useMemo(() => {
        if (!from || !to) return 'custom';
        const today = startOfDay(new Date());
        if (startOfDay(to).getTime() !== today.getTime()) return 'custom';
        const diffDays = Math.round(
            (today.getTime() - startOfDay(from).getTime()) / (1000 * 60 * 60 * 24)
        );
        return DATE_PRESETS.find((p) => p.days === diffDays)?.key ?? 'custom';
    }, [from, to]);

    const hasCustomRange = activePreset === 'custom' && !!(from || to);

    const applyPreset = (days: number) => {
        onChange({ from: startOfDay(subDays(new Date(), days)), to: new Date() });
    };

    const chipBase =
        'rounded-full border px-3 py-1 text-xs font-medium transition whitespace-nowrap';
    const chipActive = 'border-primary-500 bg-primary-50 text-primary-600';
    const chipIdle =
        'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50';

    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-neutral-600">Date range</span>
            <div className="flex flex-wrap items-center gap-2">
                {DATE_PRESETS.map((preset) => (
                    <button
                        key={preset.key}
                        onClick={() => applyPreset(preset.days)}
                        className={`${chipBase} ${
                            activePreset === preset.key ? chipActive : chipIdle
                        }`}
                    >
                        {preset.label}
                    </button>
                ))}

                {/* Custom range — opens a calendar for arbitrary from/to selection */}
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <button
                            className={`${chipBase} inline-flex items-center gap-1 ${
                                hasCustomRange ? chipActive : chipIdle
                            }`}
                        >
                            <CalendarIcon className="size-3.5" />
                            {hasCustomRange && from && to
                                ? `${format(from, 'dd MMM')} – ${format(to, 'dd MMM')}`
                                : 'Custom'}
                            <CaretDownIcon className="size-3" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="start">
                        <h4 className="mb-2 text-xs font-medium text-neutral-500">
                            Pick a custom range
                        </h4>
                        <Calendar
                            mode="range"
                            selected={range as DateRange}
                            onSelect={(sel: { from?: Date; to?: Date } | undefined) =>
                                onChange(sel || {})
                            }
                        />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}

interface BatchDropdownProps {
    label: string;
    options: Array<{ label: string; value: string | null }>;
    selectedValues: string[];
    onChange: (values: string[]) => void;
}

function BatchDropdown({ label, options, selectedValues, onChange }: BatchDropdownProps) {
    const [batchSearch, setBatchSearch] = useState('');

    // Real batches only (drop the synthetic "All Batches" entry — it maps to "none selected").
    const batchOnly = useMemo(() => {
        const seen = new Set<string>();
        return options.filter((opt) => {
            if (opt.value === null) return false;
            const key = `${opt.value}::${opt.label}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [options]);

    const filteredOptions = useMemo(() => {
        const query = batchSearch.trim().toLowerCase();
        if (!query) return batchOnly;
        return batchOnly.filter((opt) => opt.label.toLowerCase().includes(query));
    }, [batchOnly, batchSearch]);

    const triggerLabel = useMemo(() => {
        if (selectedValues.length === 0) return 'All Batches';
        if (selectedValues.length === 1) {
            return batchOnly.find((o) => o.value === selectedValues[0])?.label || '1 selected';
        }
        return `${selectedValues.length} batches selected`;
    }, [selectedValues, batchOnly]);

    const toggle = (value: string) => {
        onChange(
            selectedValues.includes(value)
                ? selectedValues.filter((v) => v !== value)
                : [...selectedValues, value]
        );
    };

    return (
        <div className="w-full">
            <Popover onOpenChange={(open) => { if (!open) setBatchSearch(''); }}>
                <PopoverTrigger asChild>
                    <button
                        className={`flex h-9 w-full items-center justify-between rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm ${selectedValues.length > 0 ? 'text-neutral-900' : 'text-neutral-500'
                            } focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
                    >
                        <span className="truncate">{triggerLabel || label}</span>
                        <CaretDownIcon className="ml-2 size-4 shrink-0 text-neutral-500" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="start">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-medium text-neutral-500">{label}</h4>
                            {selectedValues.length > 0 && (
                                <button
                                    onClick={() => onChange([])}
                                    className="text-xs font-medium text-primary-600 hover:underline"
                                >
                                    Clear ({selectedValues.length})
                                </button>
                            )}
                        </div>
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
                        <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
                            {/* All Batches = clear selection */}
                            <button
                                onClick={() => onChange([])}
                                className={`flex w-full items-center rounded-md border px-3 py-2 text-left text-xs leading-5 ${selectedValues.length === 0
                                        ? 'border-primary-300 bg-primary-50 font-medium text-primary-600'
                                        : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                                    }`}
                            >
                                All Batches
                            </button>
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((opt) => {
                                    const checked = !!opt.value && selectedValues.includes(opt.value);
                                    return (
                                        <button
                                            key={`${opt.value}::${opt.label}`}
                                            onClick={() => opt.value && toggle(opt.value)}
                                            title={opt.label}
                                            className={`flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-xs leading-5 ${checked
                                                    ? 'border-primary-300 bg-primary-50'
                                                    : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                                                }`}
                                        >
                                            <span
                                                className={`mt-px flex size-4 shrink-0 items-center justify-center rounded border ${checked
                                                        ? 'border-primary-500 bg-primary-500 text-white'
                                                        : 'border-neutral-300 bg-white'
                                                    }`}
                                            >
                                                {checked && <Check size={12} weight="bold" />}
                                            </span>
                                            <span
                                                className={`block w-full ${checked ? 'font-medium text-primary-700' : 'text-neutral-700'
                                                    }`}
                                            >
                                                {opt.label}
                                            </span>
                                        </button>
                                    );
                                })
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
