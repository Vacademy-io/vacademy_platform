import { useState, useMemo, useCallback, useEffect, Fragment } from 'react';
import {
    CheckCircle,
    XCircle,
    MinusCircle,
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
import type { LiveSessionReport, SessionCustomFieldValue } from '../-services/utils';
import { adminMarkAttendance, getSessionCustomFieldValues } from '../-services/utils';

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
    packageSessionDetails?: Array<{
        package_session_id: string;
        package_name: string;
        level_name?: string;
    }> | null;
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
    packageSessionDetails,
    onSaved,
}: AttendanceMarkingTableProps) {
    const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [sortField, setSortField] = useState<SortField | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    // Custom field values for participants (keyed by participantId)
    const [cfData, setCfData] = useState<Record<string, SessionCustomFieldValue[]>>({});

    useEffect(() => {
        if (sessionId) {
            getSessionCustomFieldValues(sessionId).then((data) => {
                console.log('[AttendanceMarkingTable] Custom field data:', {
                    sessionId,
                    guestCount: Object.keys(data).length,
                    sampleKeys: Object.keys(data).slice(0, 3),
                    sampleData: Object.entries(data).slice(0, 1).map(([k, v]) => ({ guestId: k, fields: v.map(f => ({ name: f.fieldName, key: f.fieldKey, value: f.customFieldValue })) })),
                });
                setCfData(data);
            });
        }
    }, [sessionId]);

    // Extract unique custom field names (excluding name/email/phone which are already columns)
    const customFieldColumns = useMemo(() => {
        // Skip fields that are already shown as standard columns. Match by
        // fieldName (case-insensitive exact match) — NOT by substring on
        // fieldKey, because keys like "name_of_the_school_inst_..." would
        // incorrectly match "name".
        // Only skip fields already shown as standard columns in this table:
        // Name (fullName) and Email. All other custom fields show as columns.
        const SKIP_NAMES = ['full name', 'name', 'email'];
        const fieldMap = new Map<string, string>(); // fieldKey → fieldName
        Object.values(cfData).forEach((fields) => {
            fields.forEach((f) => {
                const nameLC = (f.fieldName || '').toLowerCase();
                if (!SKIP_NAMES.includes(nameLC) && f.fieldName && !fieldMap.has(f.fieldKey)) {
                    fieldMap.set(f.fieldKey, f.fieldName);
                }
            });
        });
        const cols = Array.from(fieldMap.entries()).map(([key, name]) => ({ key, name }));
        console.log('[AttendanceMarkingTable] Custom field columns:', cols);
        return cols;
    }, [cfData]);

    // Extract unique feedback keys
    const feedbackColumns = useMemo(() => {
        const columns = new Set<string>();
        data.forEach((student) => {
            if (student.feedbackDetails) {
                try {
                    const parsed = JSON.parse(student.feedbackDetails);
                    Object.keys(parsed).forEach((k) => columns.add(k));
                } catch (e) {
                    // ignore JSON parse errors
                }
            }
        });
        return Array.from(columns);
    }, [data]);

    const getFeedbackValue = useCallback(
        (student: LiveSessionReport, key: string) => {
            if (!student.feedbackDetails) return '-';
            try {
                const parsed = JSON.parse(student.feedbackDetails);
                return parsed[key] !== undefined ? parsed[key] : '-';
            } catch {
                return '-';
            }
        },
        []
    );

    // Helper: get custom field value for a participant by email (guests) or studentId
    const getCfValue = useCallback(
        (student: LiveSessionReport, fieldKey: string): string => {
            // Try matching by studentId first (for guests, studentId = guestId)
            const byId = cfData[student.studentId];
            if (byId) {
                const match = byId.find((f) => f.fieldKey === fieldKey);
                if (match?.customFieldValue) return match.customFieldValue;
            }
            // Fallback: try matching by email across all entries
            for (const fields of Object.values(cfData)) {
                if (fields.length > 0 && fields[0]?.guestId) {
                    const emailField = fields.find(
                        (f) => f.fieldKey?.toLowerCase().includes('email') && f.customFieldValue === student.email
                    );
                    if (emailField) {
                        const match = fields.find((f) => f.fieldKey === fieldKey);
                        if (match?.customFieldValue) return match.customFieldValue;
                    }
                }
            }
            return '-';
        },
        [cfData]
    );

    const dirtyCount = Object.keys(statusOverrides).length;

    const getOriginalStatus = useCallback(
        (student: LiveSessionReport) => {
            const raw = student.attendanceStatus?.toUpperCase();
            if (raw === 'PRESENT') return 'PRESENT';
            if (raw === 'ABSENT') return 'ABSENT';
            return 'UNMARKED';
        },
        []
    );

    const getStatus = useCallback(
        (student: LiveSessionReport) => {
            if (statusOverrides[student.studentId] !== undefined) {
                return statusOverrides[student.studentId];
            }
            return getOriginalStatus(student);
        },
        [statusOverrides, getOriginalStatus]
    );

    const setStudentStatus = useCallback(
        (student: LiveSessionReport, newStatus: string) => {
            const originalStatus = getOriginalStatus(student);

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
        [getOriginalStatus]
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
                    const statusOrder: Record<string, number> = { PRESENT: 2, ABSENT: 1, UNMARKED: 0 };
                    aVal = statusOrder[getStatus(a) ?? 'UNMARKED'] ?? 0;
                    bVal = statusOrder[getStatus(b) ?? 'UNMARKED'] ?? 0;
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

    const { presentCount, absentCount, unmarkedCount } = useMemo(() => {
        let present = 0;
        let absent = 0;
        let unmarked = 0;
        for (const s of data) {
            const status = getStatus(s);
            if (status === 'PRESENT') present++;
            else if (status === 'ABSENT') absent++;
            else unmarked++;
        }
        return { presentCount: present, absentCount: absent, unmarkedCount: unmarked };
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
        // const batchValue = packageSessionDetails && packageSessionDetails.length > 0
        //     ? packageSessionDetails.map((d) => d.level_name).filter(Boolean).join(' | ')
        //     : '';
        const courseValue = packageSessionDetails && packageSessionDetails.length > 0
            ? packageSessionDetails.map((d) => d.package_name).filter(Boolean).join(' | ')
            : '';

        const csvData = sortedData.map((item, idx) => {
            const engagement = parseEngagement(item.engagementData);
            const duration = item.providerTotalDurationMinutes ?? '';
            const talkTimeMin = engagement?.talkTime ? Math.round(engagement.talkTime / 60) : '';
            const activePoints = computeActivePoints(item) ?? '';

            const row: Record<string, any> = {
                '#': idx + 1,
                'Name': item.fullName,
                'Email': item.email || '',
                // 'Batch': batchValue,
                'Course': courseValue,
                'Status': getStatus(item) === 'PRESENT' ? 'Present' : getStatus(item) === 'ABSENT' ? 'Absent' : 'Unmarked',
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
            customFieldColumns.forEach((cf) => {
                row[cf.name] = getCfValue(item, cf.key);
            });
            feedbackColumns.forEach((fbCol) => {
                const colName = fbCol.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
                row[`Feedback: ${colName}`] = getFeedbackValue(item, fbCol);
            });
            return row;
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
    }, [sortedData, getStatus, sessionId, sessionTitle, packageSessionDetails, customFieldColumns, feedbackColumns, getCfValue, getFeedbackValue]);

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
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
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
                    <span className="flex items-center gap-1 text-gray-400">
                        <span className="h-2 w-2 rounded-full bg-gray-300" />
                        Unmarked: {unmarkedCount}
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
                            <th className="px-3 py-2 w-[120px]">
                                <button
                                    type="button"
                                    onClick={() => handleSort('status')}
                                    className="flex items-center gap-1 hover:text-gray-700"
                                >
                                    Status <SortIcon field="status" />
                                </button>
                            </th>
                            <th className="px-3 py-2">Email</th>
                            {customFieldColumns.map((cf) => (
                                <th key={cf.key} className="px-3 py-2">{cf.name}</th>
                            ))}
                            {feedbackColumns.map((fbCol) => (
                                <th key={`fb-${fbCol}`} className="px-3 py-2 text-purple-600 bg-purple-50/50">
                                    {fbCol.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                </th>
                            ))}
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
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setStudentStatus(student, status === 'PRESENT' ? 'UNMARKED' : 'PRESENT')}
                                                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                                        status === 'PRESENT'
                                                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                            : 'bg-gray-50 text-gray-400 hover:bg-green-50 hover:text-green-600'
                                                    }`}
                                                >
                                                    <CheckCircle size={14} weight={status === 'PRESENT' ? 'fill' : 'regular'} />
                                                    P
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setStudentStatus(student, status === 'ABSENT' ? 'UNMARKED' : 'ABSENT')}
                                                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                                        status === 'ABSENT'
                                                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                            : 'bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600'
                                                    }`}
                                                >
                                                    <XCircle size={14} weight={status === 'ABSENT' ? 'fill' : 'regular'} />
                                                    A
                                                </button>
                                                {status === 'UNMARKED' && (
                                                    <span className="ml-1 text-[10px] text-gray-400">Unmarked</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-gray-500">{student.email}</td>
                                        {customFieldColumns.map((cf) => (
                                            <td key={cf.key} className="px-3 py-2 text-gray-500">
                                                {getCfValue(student, cf.key)}
                                            </td>
                                        ))}
                                        {feedbackColumns.map((fbCol) => (
                                            <td key={`fb-${fbCol}`} className="px-3 py-2 text-gray-500 bg-purple-50/20">
                                                {getFeedbackValue(student, fbCol)}
                                            </td>
                                        ))}
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
