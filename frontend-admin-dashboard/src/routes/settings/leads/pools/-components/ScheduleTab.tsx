/**
 * Weekly shift schedule editor. Active only when the pool's assignment_mode
 * is TIME_BASED. Admin draws shift blocks for each of the 7 days, assigning
 * one or more counselors to each block.
 *
 * On save, the entire schedule is sent as one replacement (PUT /schedule).
 * Backend validates 24/7 coverage across all days; this UI also runs the same
 * validation client-side and surfaces gaps before the request goes out.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSTITUTE_USERS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MyButton } from '@/components/design-system/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    CounselorPoolDTO,
    DAYS_OF_WEEK,
    DayOfWeek,
    ShiftBlockRequest,
    useSetWeeklySchedule,
    useWeeklySchedule,
} from '@/services/counselor-pool';

interface ScheduleTabProps {
    pool: CounselorPoolDTO;
}

const DAY_LABEL: Record<DayOfWeek, string> = {
    MON: 'Monday',
    TUE: 'Tuesday',
    WED: 'Wednesday',
    THU: 'Thursday',
    FRI: 'Friday',
    SAT: 'Saturday',
    SUN: 'Sunday',
};

interface EditableShift {
    /** Local-only client id for React keys. */
    localId: string;
    startTime: string; // "HH:mm:ss"
    endTime: string;
    label?: string;
    counselorUserIds: string[];
}

interface InstituteUser {
    id: string;
    full_name: string;
}

const fetchCounselors = async (): Promise<InstituteUser[]> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_INSTITUTE_USERS,
        params: { instituteId, pageNumber: 0, pageSize: 500 },
        data: { roles: ['COUNSELLOR', 'ADMIN'], status: ['ACTIVE'] },
    });
    const raw = Array.isArray(response.data) ? response.data : response.data?.content || [];
    return raw.map((u: Record<string, unknown>) => ({
        id: u.id as string,
        full_name: u.full_name as string,
    }));
};

export default function ScheduleTab({ pool }: ScheduleTabProps) {
    const { data: serverSchedule, isLoading } = useWeeklySchedule(pool.id);
    const { mutate: saveSchedule, isPending: saving } = useSetWeeklySchedule(pool.id);

    const { data: instituteUsers = [] } = useQuery({
        queryKey: ['institute-counselors-for-schedule'],
        queryFn: fetchCounselors,
        staleTime: 60 * 1000,
    });
    const userNameById = useMemo(() => {
        const map = new Map<string, string>();
        instituteUsers.forEach((u) => map.set(u.id, u.full_name));
        return map;
    }, [instituteUsers]);

    /** Counselors selectable for shifts: those who are members of this pool. */
    const poolCounselorOptions = useMemo(() => {
        const ids = new Set((pool.members ?? []).map((m) => m.counselor_user_id));
        return [...ids].map((id) => ({ id, name: userNameById.get(id) ?? id.slice(0, 8) + '…' }));
    }, [pool.members, userNameById]);

    /** Editable schedule: day → list of shift blocks. */
    const [schedule, setSchedule] = useState<Record<DayOfWeek, EditableShift[]>>(() =>
        emptySchedule()
    );

    useEffect(() => {
        if (!serverSchedule) return;
        const next = emptySchedule();
        for (const s of serverSchedule) {
            next[s.day_of_week].push({
                localId: s.id,
                startTime: s.start_time,
                endTime: s.end_time,
                label: s.label,
                counselorUserIds: (s.members ?? []).map((m) => m.counselor_user_id),
            });
        }
        for (const day of DAYS_OF_WEEK) {
            next[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
        }
        setSchedule(next);
    }, [serverSchedule]);

    const updateDay = (day: DayOfWeek, mutate: (shifts: EditableShift[]) => EditableShift[]) => {
        setSchedule((prev) => ({ ...prev, [day]: mutate([...prev[day]]) }));
    };

    const addShift = (day: DayOfWeek) =>
        updateDay(day, (shifts) => [
            ...shifts,
            {
                localId: cryptoRandom(),
                startTime: '09:00:00',
                endTime: '12:00:00',
                counselorUserIds: [],
            },
        ]);

    const removeShift = (day: DayOfWeek, idx: number) =>
        updateDay(day, (shifts) => shifts.filter((_, i) => i !== idx));

    const updateShift = (day: DayOfWeek, idx: number, patch: Partial<EditableShift>) =>
        updateDay(day, (shifts) => shifts.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

    const validation = useMemo(() => validateCoverage(schedule), [schedule]);

    const handleSave = () => {
        if (!validation.ok) {
            toast.error('Fix the schedule before saving: ' + validation.errors[0]);
            return;
        }
        const flatShifts: ShiftBlockRequest[] = [];
        for (const day of DAYS_OF_WEEK) {
            for (const s of schedule[day]) {
                flatShifts.push({
                    day_of_week: day,
                    start_time: s.startTime,
                    end_time: s.endTime,
                    label: s.label,
                    counselor_user_ids: s.counselorUserIds,
                });
            }
        }
        saveSchedule(
            { shifts: flatShifts },
            {
                onSuccess: () => toast.success('Schedule saved'),
                onError: (err) =>
                    toast.error(extractError(err) ?? 'Failed to save schedule'),
            }
        );
    };

    if (pool.assignment_mode !== 'TIME_BASED') {
        return (
            <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">
                    This tab is only used when the pool's assignment mode is{' '}
                    <strong>Time-based</strong>. Switch the mode in the Overview tab to configure
                    a weekly shift schedule.
                </CardContent>
            </Card>
        );
    }

    if (poolCounselorOptions.length === 0) {
        return (
            <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">
                    Add at least one counselor to this pool before configuring the schedule.
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return <div className="p-4 text-sm text-muted-foreground">Loading schedule…</div>;
    }

    return (
        <div className="space-y-4">
            <Card className={validation.ok ? 'border-green-300' : 'border-red-300'}>
                <CardHeader>
                    <CardTitle>Coverage Status</CardTitle>
                    <CardDescription>
                        The schedule must cover every minute of every day. Overlapping shifts are
                        allowed.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {validation.ok ? (
                        <p className="text-sm text-green-700">
                            ✓ All 7 days are covered 24/7
                        </p>
                    ) : (
                        <ul className="space-y-1 text-sm text-red-700">
                            {validation.errors.map((e, i) => (
                                <li key={i}>• {e}</li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {DAYS_OF_WEEK.map((day) => (
                <DayCard
                    key={day}
                    day={day}
                    shifts={schedule[day]}
                    counselorOptions={poolCounselorOptions}
                    onAdd={() => addShift(day)}
                    onRemove={(idx) => removeShift(day, idx)}
                    onUpdate={(idx, patch) => updateShift(day, idx, patch)}
                />
            ))}

            <div className="flex justify-end">
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={handleSave}
                    disable={saving || !validation.ok}
                >
                    {saving ? 'Saving…' : 'Save Schedule'}
                </MyButton>
            </div>
        </div>
    );
}

interface DayCardProps {
    day: DayOfWeek;
    shifts: EditableShift[];
    counselorOptions: { id: string; name: string }[];
    onAdd: () => void;
    onRemove: (idx: number) => void;
    onUpdate: (idx: number, patch: Partial<EditableShift>) => void;
}

function DayCard({ day, shifts, counselorOptions, onAdd, onRemove, onUpdate }: DayCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base">{DAY_LABEL[day]}</CardTitle>
                <MyButton buttonType="secondary" scale="small" onClick={onAdd}>
                    + Add Shift
                </MyButton>
            </CardHeader>
            <CardContent className="space-y-3">
                {shifts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                        No shifts configured. Add a shift to cover this day.
                    </p>
                ) : (
                    shifts.map((s, idx) => (
                        <ShiftBlockEditor
                            key={s.localId}
                            shift={s}
                            counselorOptions={counselorOptions}
                            onRemove={() => onRemove(idx)}
                            onUpdate={(patch) => onUpdate(idx, patch)}
                        />
                    ))
                )}
            </CardContent>
        </Card>
    );
}

interface ShiftBlockEditorProps {
    shift: EditableShift;
    counselorOptions: { id: string; name: string }[];
    onRemove: () => void;
    onUpdate: (patch: Partial<EditableShift>) => void;
}

function ShiftBlockEditor({ shift, counselorOptions, onRemove, onUpdate }: ShiftBlockEditorProps) {
    const availableToAdd = counselorOptions.filter(
        (c) => !shift.counselorUserIds.includes(c.id)
    );

    return (
        <div className="rounded border bg-neutral-50 p-3">
            <div className="flex items-end gap-3">
                <div className="space-y-1">
                    <Label className="text-xs">Start</Label>
                    <Input
                        type="time"
                        step={1}
                        value={trimToHM(shift.startTime)}
                        onChange={(e) =>
                            onUpdate({ startTime: padToFullTime(e.target.value) })
                        }
                        className="w-32"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">End</Label>
                    <Input
                        type="time"
                        step={1}
                        value={trimToHM(shift.endTime)}
                        onChange={(e) =>
                            onUpdate({ endTime: padToFullTime(e.target.value) })
                        }
                        className="w-32"
                    />
                </div>
                <div className="flex-1 space-y-1">
                    <Label className="text-xs">Label (optional)</Label>
                    <Input
                        value={shift.label ?? ''}
                        onChange={(e) => onUpdate({ label: e.target.value })}
                        placeholder="e.g. Morning shift"
                    />
                </div>
                <button
                    type="button"
                    className="self-end pb-2 text-xs text-red-600 hover:underline"
                    onClick={onRemove}
                >
                    Remove
                </button>
            </div>

            <div className="mt-3 space-y-2">
                <Label className="text-xs">Counselors on this shift</Label>
                <div className="flex flex-wrap gap-2">
                    {shift.counselorUserIds.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                            None selected — add at least one
                        </span>
                    )}
                    {shift.counselorUserIds.map((id) => (
                        <Badge
                            key={id}
                            className="cursor-pointer bg-blue-100 text-blue-700 hover:bg-red-100 hover:text-red-700"
                            onClick={() =>
                                onUpdate({
                                    counselorUserIds: shift.counselorUserIds.filter((c) => c !== id),
                                })
                            }
                        >
                            {counselorOptions.find((c) => c.id === id)?.name ?? id} ×
                        </Badge>
                    ))}
                </div>
                {availableToAdd.length > 0 && (
                    <Select
                        value=""
                        onValueChange={(v) =>
                            onUpdate({ counselorUserIds: [...shift.counselorUserIds, v] })
                        }
                    >
                        <SelectTrigger className="w-64">
                            <SelectValue placeholder="+ Add counselor" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableToAdd.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function emptySchedule(): Record<DayOfWeek, EditableShift[]> {
    return {
        MON: [],
        TUE: [],
        WED: [],
        THU: [],
        FRI: [],
        SAT: [],
        SUN: [],
    };
}

const START_OF_DAY = '00:00:00';
const END_OF_DAY = '23:59:59';

function validateCoverage(schedule: Record<DayOfWeek, EditableShift[]>): {
    ok: boolean;
    errors: string[];
} {
    const errors: string[] = [];
    for (const day of DAYS_OF_WEEK) {
        const dayShifts = schedule[day];
        if (dayShifts.length === 0) {
            errors.push(`${DAY_LABEL[day]} has no shifts.`);
            continue;
        }

        // Validate each shift: counsellor count, start < end
        for (const s of dayShifts) {
            if (s.counselorUserIds.length === 0) {
                errors.push(`${DAY_LABEL[day]} ${s.startTime}–${s.endTime}: needs at least one counselor.`);
            }
            if (s.startTime >= s.endTime) {
                errors.push(`${DAY_LABEL[day]} ${s.startTime}–${s.endTime}: end must be after start.`);
            }
        }

        // Coverage walk
        const sorted = [...dayShifts].sort((a, b) => a.startTime.localeCompare(b.startTime));
        const first = sorted[0]!;
        if (first.startTime !== START_OF_DAY) {
            errors.push(`${DAY_LABEL[day]} does not start at 00:00:00 (first block: ${first.startTime}).`);
        }
        let coveredUntil = first.endTime;
        for (let i = 1; i < sorted.length; i++) {
            const next = sorted[i]!;
            if (next.startTime > coveredUntil) {
                errors.push(
                    `${DAY_LABEL[day]} has a gap between ${coveredUntil} and ${next.startTime}.`
                );
            }
            if (next.endTime > coveredUntil) coveredUntil = next.endTime;
        }
        if (coveredUntil < END_OF_DAY) {
            errors.push(`${DAY_LABEL[day]} does not cover up to 23:59:59 (covered until ${coveredUntil}).`);
        }
    }
    return { ok: errors.length === 0, errors };
}

function trimToHM(t: string): string {
    // "HH:mm:ss" → "HH:mm" for <input type="time"> default render
    return t?.slice(0, 5) ?? '';
}

function padToFullTime(hm: string): string {
    // "HH:mm" → "HH:mm:00"
    return hm.length === 5 ? `${hm}:00` : hm;
}

function cryptoRandom(): string {
    return Math.random().toString(36).slice(2, 10);
}

function extractError(err: unknown): string | undefined {
    return (
        (err as { response?: { data?: { ex?: string; message?: string } } })?.response?.data?.ex ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    );
}
