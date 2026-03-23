import { useState, useMemo, useCallback, Fragment } from 'react';
import { CheckCircle, XCircle, CaretDown, CaretUp, Clock, ChatCircle, Microphone } from '@phosphor-icons/react';
import { toast } from 'sonner';
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
    onSaved?: () => void;
}

export function AttendanceMarkingTable({
    data,
    sessionId,
    scheduleId,
    onSaved,
}: AttendanceMarkingTableProps) {
    // Track local status overrides (dirty rows)
    const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);

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
                    // Toggled back to original — remove from dirty set
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

    const parseEngagement = (json: string | null): EngagementData | null => {
        if (!json) return null;
        try {
            return JSON.parse(json);
        } catch {
            return null;
        }
    };

    const hasEngagementOrDuration = (student: LiveSessionReport) => {
        return student.providerTotalDurationMinutes || student.engagementData;
    };

    return (
        <div className="space-y-3">
            {/* Summary */}
            <div className="flex items-center gap-4 text-sm">
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

            {/* Table */}
            <div className="max-h-[400px] overflow-auto rounded-md border">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50">
                        <tr className="border-b text-left text-xs font-medium text-gray-500">
                            <th className="px-3 py-2 w-[50px]">#</th>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Email</th>
                            <th className="px-3 py-2 w-[120px]">Status</th>
                            <th className="px-3 py-2 w-[80px]">Mode</th>
                            <th className="px-3 py-2 w-[40px]"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((student, index) => {
                            const status = getStatus(student);
                            const isPresent = status === 'PRESENT';
                            const isDirty = statusOverrides[student.studentId] !== undefined;
                            const isExpanded = expandedRows.has(student.studentId);
                            const engagement = parseEngagement(student.engagementData);
                            const canExpand = hasEngagementOrDuration(student);

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
                                            <td colSpan={6} className="px-6 py-3">
                                                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                                                    {student.providerTotalDurationMinutes != null && (
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={14} className="text-gray-400" />
                                                            Duration: {student.providerTotalDurationMinutes} min
                                                        </span>
                                                    )}
                                                    {engagement && (
                                                        <>
                                                            {engagement.chats != null && engagement.chats > 0 && (
                                                                <span className="flex items-center gap-1">
                                                                    <ChatCircle size={14} className="text-gray-400" />
                                                                    Chats: {engagement.chats}
                                                                </span>
                                                            )}
                                                            {engagement.talkTime != null && engagement.talkTime > 0 && (
                                                                <span className="flex items-center gap-1">
                                                                    <Microphone size={14} className="text-gray-400" />
                                                                    Talk: {Math.round(engagement.talkTime / 60)} min
                                                                </span>
                                                            )}
                                                            {engagement.talks != null && engagement.talks > 0 && (
                                                                <span className="flex items-center gap-1">
                                                                    <Microphone size={14} className="text-gray-400" />
                                                                    Talk segments: {engagement.talks}
                                                                </span>
                                                            )}
                                                            {engagement.raisehand != null && engagement.raisehand > 0 && (
                                                                <span className="flex items-center gap-1 text-gray-600">
                                                                    Raise hands: {engagement.raisehand}
                                                                </span>
                                                            )}
                                                            {engagement.emojis != null && engagement.emojis > 0 && (
                                                                <span className="flex items-center gap-1 text-gray-600">
                                                                    Emojis: {engagement.emojis}
                                                                </span>
                                                            )}
                                                            {engagement.pollVotes != null && engagement.pollVotes > 0 && (
                                                                <span className="flex items-center gap-1 text-gray-600">
                                                                    Poll votes: {engagement.pollVotes}
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                    {!student.providerTotalDurationMinutes && !engagement && (
                                                        <span className="text-gray-400 italic">No engagement data available</span>
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
                    <MyButton
                        buttonType="primary"
                        onClick={handleSave}
                        disabled={saving}
                    >
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
