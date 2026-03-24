import { useState, useMemo, useCallback, Fragment } from 'react';
import {
    CheckCircle,
    XCircle,
    CaretDown,
    CaretUp,
    Clock,
    ChatCircle,
    Microphone,
    ArrowUp,
    ArrowDown,
    HandWaving,
    Smiley,
    ChartBar,
    DownloadSimple,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { MyButton } from '@/components/design-system/button';
import { Badge } from '@/components/ui/badge';
import type { LiveSessionReport } from '../-services/utils';
import { adminMarkAttendance } from '../-services/utils';

interface EngagementData {
    chats?: number;
    talks?: number;
    talkTime?: number;
    raisehand?: number;
    emojis?: number;
    pollVotes?: number;
}

interface AttendanceMarkingTableProps {
    data: LiveSessionReport[];
    sessionId: string;
    scheduleId: string;
    accessType: string;
    sessionTitle?: string;
    onSaved?: () => void;
}

type SortField = 'status' | 'duration' | 'activePoints';
type SortDir = 'asc' | 'desc';

function parseEngagement(json: string | null): EngagementData | null {
    if (!json) return null;
    try {
        return JSON.parse(json);
    } catch {
        return null;
    }
}

/**
 * Active Points formula:
 *   - Duration weight: 1 point per minute attended
 *   - Talk time: 2 points per minute of talk
 *   - Talk segments: 0.5 point per segment (shows frequency of participation)
 *   - Raise hand: 3 points each (active engagement signal)
 *   - Emojis: 1 point each
 *   - Chats: 1.5 points each
 *   - Poll votes: 2 points each
 *
 * Result is rounded to nearest integer.
 */
function computeActivePoints(student: LiveSessionReport): number | null {
    const duration = student.providerTotalDurationMinutes;
    const engagement = parseEngagement(student.engagementData);

    if (duration == null && !engagement) return null;

    let score = 0;
    if (duration != null) score += duration * 1;
    if (engagement) {
        score += ((engagement.talkTime ?? 0) / 60) * 2;
        score += (engagement.talks ?? 0) * 0.5;
        score += (engagement.raisehand ?? 0) * 3;
        score += (engagement.emojis ?? 0) * 1;
        score += (engagement.chats ?? 0) * 1.5;
        score += (engagement.pollVotes ?? 0) * 2;
    }
    return Math.round(score);
}

function getActivePointsBadge(points: number | null) {
    if (points == null) return null;
    if (points >= 80) return { label: 'High', color: 'border-green-200 bg-green-50 text-green-700' };
    if (points >= 30) return { label: 'Medium', color: 'border-yellow-200 bg-yellow-50 text-yellow-700' };
    return { label: 'Low', color: 'border-red-200 bg-red-50 text-red-600' };
}

export function AttendanceMarkingTable({
    data,
    sessionId,
    scheduleId,
    sessionTitle,
    onSaved,
}: AttendanceMarkingTableProps) {
    const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [sortField, setSortField] = useState<SortField | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const dirtyCount = Object.keys(statusOverrides).length;

    const getStatus = useCallback(
        (student: LiveSessionReport) => {
            if (statusOverrides[student.studentId] !== undefined) {
                return statusOverrides[student.studentId];
            }
            return student.attendanceStatus?.toUpperCase() === 'PRESENT' ? 'PRESENT' : 'ABSENT';
        },
        [statusOverrides]
    );

    const toggleStatus = useCallback(
        (student: LiveSessionReport) => {
            const currentStatus = getStatus(student);
            const originalStatus =
                student.attendanceStatus?.toUpperCase() === 'PRESENT' ? 'PRESENT' : 'ABSENT';
            const newStatus = currentStatus === 'PRESENT' ? 'ABSENT' : 'PRESENT';

            setStatusOverrides((prev) => {
                const next = { ...prev };
                if (newStatus === originalStatus) {
                    delete next[student.studentId];
                } else {
                    next[student.studentId] = newStatus;
                }
                return next;
            });
        },
        [getStatus]
    );

    const toggleExpand = useCallback((studentId: string) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(studentId)) {
                next.delete(studentId);
            } else {
                next.add(studentId);
            }
            return next;
        });
    }, []);

    const handleSort = useCallback(
        (field: SortField) => {
            if (sortField === field) {
                setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
            } else {
                setSortField(field);
                setSortDir('desc');
            }
        },
        [sortField]
    );

    // Sorted data
    const sortedData = useMemo(() => {
        if (!sortField) return data;

        const sorted = [...data].sort((a, b) => {
            let aVal: number;
            let bVal: number;

            switch (sortField) {
                case 'status': {
                    aVal = getStatus(a) === 'PRESENT' ? 1 : 0;
                    bVal = getStatus(b) === 'PRESENT' ? 1 : 0;
                    break;
                }
                case 'duration': {
                    aVal = a.providerTotalDurationMinutes ?? -1;
                    bVal = b.providerTotalDurationMinutes ?? -1;
                    break;
                }
                case 'activePoints': {
                    aVal = computeActivePoints(a) ?? -1;
                    bVal = computeActivePoints(b) ?? -1;
                    break;
                }
                default:
                    return 0;
            }

            return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        });

        return sorted;
    }, [data, sortField, sortDir, getStatus]);

    const { presentCount, absentCount } = useMemo(() => {
        let present = 0;
        let absent = 0;
        for (const s of data) {
            const status = getStatus(s);
            if (status === 'PRESENT') present++;
            else absent++;
        }
        return { presentCount: present, absentCount: absent };
    }, [data, getStatus]);

    const handleSave = async () => {
        if (dirtyCount === 0) return;
        setSaving(true);
        try {
            const entries = Object.entries(statusOverrides).map(([studentId, status]) => {
                const student = data.find((s) => s.studentId === studentId);
                return {
                    userSourceId: studentId,
                    userSourceType: student?.enrollmentStatus ? 'USER' : 'EXTERNAL_USER',
                    status,
                };
            });

            await adminMarkAttendance({ sessionId, scheduleId, entries });
            toast.success(`Attendance saved for ${entries.length} student(s)`);
            setStatusOverrides({});
            onSaved?.();
        } catch (err) {
            console.error('Failed to save attendance:', err);
            toast.error('Failed to save attendance. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleExportCSV = useCallback(() => {
        const csvData = sortedData.map((item, idx) => {
            const engagement = parseEngagement(item.engagementData);
            const duration = item.providerTotalDurationMinutes ?? '';
            const talkTimeMin = engagement?.talkTime ? Math.round(engagement.talkTime / 60) : '';
            const activePoints = computeActivePoints(item) ?? '';

            return {
                '#': idx + 1,
                'Name': item.fullName,
                'Email': item.email || '',
                'Status': getStatus(item) === 'PRESENT' ? 'Present' : 'Absent',
                'Mode': item.statusType || '',
                'Duration (min)': duration,
                'Active Points': activePoints,
                'Talk Time (min)': talkTimeMin,
                'Talk Segments': engagement?.talks ?? '',
                'Raise Hands': engagement?.raisehand ?? '',
                'Emojis': engagement?.emojis ?? '',
                'Chats': engagement?.chats ?? '',
                'Poll Votes': engagement?.pollVotes ?? '',
            };
        });
        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const filename = sessionTitle
            ? `attendance_${sessionTitle.replace(/[^a-zA-Z0-9]/g, '_')}.csv`
            : `attendance_${sessionId}.csv`;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Attendance CSV downloaded');
    }, [sortedData, getStatus, sessionId, sessionTitle]);

    const hasEngagementOrDuration = (student: LiveSessionReport) => {
        return student.providerTotalDurationMinutes || student.engagementData;
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) {
            return <ArrowDown size={12} className="text-gray-300" />;
        }
        return sortDir === 'asc' ? (
            <ArrowUp size={12} className="text-gray-700" />
        ) : (
            <ArrowDown size={12} className="text-gray-700" />
        );
    };

    return (
        <div className="space-y-3">
            {/* Summary */}
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                    <span className="font-medium">Attendance</span>
                    <span className="flex items-center gap-1 text-green-600">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Present: {presentCount}
                    </span>
                    <span className="flex items-center gap-1 text-red-500">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        Absent: {absentCount}
                    </span>
                    <span className="text-gray-500">Total: {data.length}</span>
                </div>
                <button
                    type="button"
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                    <DownloadSimple size={14} />
                    Export CSV
                </button>
            </div>

            {/* Table */}
            <div className="max-h-[400px] overflow-auto rounded-md border">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50">
                        <tr className="border-b text-left text-xs font-medium text-gray-500">
                            <th className="px-3 py-2 w-[50px]">#</th>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Email</th>
                            <th className="px-3 py-2 w-[120px]">
                                <button
                                    type="button"
                                    onClick={() => handleSort('status')}
                                    className="flex items-center gap-1 hover:text-gray-700"
                                >
                                    Status <SortIcon field="status" />
                                </button>
                            </th>
                            <th className="px-3 py-2 w-[100px]">
                                <button
                                    type="button"
                                    onClick={() => handleSort('duration')}
                                    className="flex items-center gap-1 hover:text-gray-700"
                                >
                                    Duration <SortIcon field="duration" />
                                </button>
                            </th>
                            <th className="px-3 py-2 w-[120px]">
                                <button
                                    type="button"
                                    onClick={() => handleSort('activePoints')}
                                    className="flex items-center gap-1 hover:text-gray-700"
                                >
                                    Active Pts <SortIcon field="activePoints" />
                                </button>
                            </th>
                            <th className="px-3 py-2 w-[80px]">Mode</th>
                            <th className="px-3 py-2 w-[40px]"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map((student, index) => {
                            const status = getStatus(student);
                            const isPresent = status === 'PRESENT';
                            const isDirty = statusOverrides[student.studentId] !== undefined;
                            const isExpanded = expandedRows.has(student.studentId);
                            const engagement = parseEngagement(student.engagementData);
                            const canExpand = hasEngagementOrDuration(student);
                            const activePoints = computeActivePoints(student);
                            const pointsBadge = getActivePointsBadge(activePoints);

                            return (
                                <Fragment key={student.studentId}>
                                    <tr
                                        className={`border-b transition-colors ${isDirty ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}
                                    >
                                        <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                                        <td className="px-3 py-2 font-medium">{student.fullName}</td>
                                        <td className="px-3 py-2 text-gray-500">{student.email}</td>
                                        <td className="px-3 py-2">
                                            <button
                                                type="button"
                                                onClick={() => toggleStatus(student)}
                                                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                                    isPresent
                                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                }`}
                                            >
                                                {isPresent ? (
                                                    <CheckCircle size={16} weight="fill" />
                                                ) : (
                                                    <XCircle size={16} weight="fill" />
                                                )}
                                                {isPresent ? 'Present' : 'Absent'}
                                            </button>
                                        </td>
                                        <td className="px-3 py-2 text-gray-600">
                                            {student.providerTotalDurationMinutes != null ? (
                                                <span className="flex items-center gap-1">
                                                    <Clock size={14} className="text-gray-400" />
                                                    {student.providerTotalDurationMinutes} min
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">--</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            {activePoints != null && pointsBadge ? (
                                                <span className="flex items-center gap-1.5">
                                                    <span className="font-medium text-gray-700">{activePoints}</span>
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[10px] ${pointsBadge.color}`}
                                                    >
                                                        {pointsBadge.label}
                                                    </Badge>
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">--</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            {student.statusType && (
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] ${
                                                        student.statusType === 'ONLINE'
                                                            ? 'border-blue-200 bg-blue-50 text-blue-600'
                                                            : 'border-gray-200 bg-gray-50 text-gray-500'
                                                    }`}
                                                >
                                                    {student.statusType}
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            {canExpand && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpand(student.studentId)}
                                                    className="text-gray-400 hover:text-gray-600"
                                                >
                                                    {isExpanded ? (
                                                        <CaretUp size={16} />
                                                    ) : (
                                                        <CaretDown size={16} />
                                                    )}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {isExpanded && canExpand && (
                                        <tr key={`${student.studentId}-detail`} className="border-b bg-gray-50">
                                            <td colSpan={8} className="px-6 py-3">
                                                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                                                    {student.providerTotalDurationMinutes != null && (
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={14} className="text-gray-400" />
                                                            Duration: {student.providerTotalDurationMinutes} min
                                                        </span>
                                                    )}
                                                    {engagement && (
                                                        <>
                                                            {engagement.talkTime != null && engagement.talkTime > 0 && (
                                                                <span className="flex items-center gap-1">
                                                                    <Microphone size={14} className="text-blue-400" />
                                                                    Talk time: {Math.round(engagement.talkTime / 60)} min
                                                                </span>
                                                            )}
                                                            {engagement.talks != null && engagement.talks > 0 && (
                                                                <span className="flex items-center gap-1">
                                                                    <Microphone size={14} className="text-gray-400" />
                                                                    Talk segments: {engagement.talks}
                                                                </span>
                                                            )}
                                                            {engagement.raisehand != null && engagement.raisehand > 0 && (
                                                                <span className="flex items-center gap-1">
                                                                    <HandWaving size={14} className="text-yellow-500" />
                                                                    Raise hands: {engagement.raisehand}
                                                                </span>
                                                            )}
                                                            {engagement.emojis != null && engagement.emojis > 0 && (
                                                                <span className="flex items-center gap-1">
                                                                    <Smiley size={14} className="text-orange-400" />
                                                                    Emojis: {engagement.emojis}
                                                                </span>
                                                            )}
                                                            {engagement.chats != null && engagement.chats > 0 && (
                                                                <span className="flex items-center gap-1">
                                                                    <ChatCircle size={14} className="text-purple-400" />
                                                                    Chats: {engagement.chats}
                                                                </span>
                                                            )}
                                                            {engagement.pollVotes != null && engagement.pollVotes > 0 && (
                                                                <span className="flex items-center gap-1">
                                                                    <ChartBar size={14} className="text-teal-400" />
                                                                    Poll votes: {engagement.pollVotes}
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                    {!student.providerTotalDurationMinutes && !engagement && (
                                                        <span className="text-gray-400 italic">
                                                            No engagement data available
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Save button */}
            {dirtyCount > 0 && (
                <div className="flex items-center gap-3">
                    <MyButton buttonType="primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : `Save Attendance (${dirtyCount} changed)`}
                    </MyButton>
                    <button
                        type="button"
                        onClick={() => setStatusOverrides({})}
                        className="text-sm text-gray-500 hover:text-gray-700"
                    >
                        Discard changes
                    </button>
                </div>
            )}
        </div>
    );
}
