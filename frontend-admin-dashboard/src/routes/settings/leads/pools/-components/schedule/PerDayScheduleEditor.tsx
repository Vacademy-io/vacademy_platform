/**
 * UI A — "Custom per day" editor. Authors each weekday independently.
 *
 * For each day, the admin picks one of two layouts:
 *   - "Whole day" — one block 00:00:00–23:59:59, ≥1 counsellor
 *   - "Multiple shifts" — N blocks tiling the 24h with no gaps, each ≥1 counsellor
 *
 * Every day must be filled (no empty days), every shift must have ≥1
 * counsellor, and gaps surface inline per-day. Save is disabled until all 7
 * days validate.
 *
 * "Reset schedule" wipes all shifts (POST empty list is rejected by backend
 * for safety; we instead need to send a placeholder that's clearly invalid OR
 * unlock the pattern selector by deleting the saved schedule via a separate
 * flow). For now Reset rewinds the local edits to the saved server state.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MyButton } from '@/components/design-system/button';
import {
    CounselorPoolDTO,
    DAYS_OF_WEEK,
    DayOfWeek,
    PoolShiftDTO,
    ShiftBlockRequest,
    useSetWeeklySchedule,
    useWeeklySchedule,
} from '@/services/counselor-pool';
import ScheduleReadView from './ScheduleReadView';
import ShiftBlockEditor from './ShiftBlockEditor';
import ShiftCountPicker from './ShiftCountPicker';
import {
    DAY_LABEL,
    END_OF_DAY,
    START_OF_DAY,
    cryptoRandom,
    extractError,
    fetchCounselors,
    normalizeEndOfDay,
    validateDayCoverage,
    type EditableShift,
} from './shared';

interface Props {
    pool: CounselorPoolDTO;
}

type DayLayout = 'WHOLE_DAY' | 'MULTIPLE_SHIFTS';

export default function PerDayScheduleEditor({ pool }: Props) {
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

    const poolCounselorOptions = useMemo(() => {
        const ids = new Set((pool.members ?? []).map((m) => m.counselor_user_id));
        return [...ids].map((id) => ({
            id,
            name: userNameById.get(id) ?? id.slice(0, 8) + '…',
        }));
    }, [pool.members, userNameById]);

    const [schedule, setSchedule] = useState<Record<DayOfWeek, EditableShift[]>>(() =>
        emptySchedule()
    );
    /** Read/edit mode toggle — mirrors OverviewTab. Auto-starts in edit when nothing's saved. */
    const [editing, setEditing] = useState(false);

    const hydrateFromServer = useCallback((rows: PoolShiftDTO[]) => {
        const next = emptySchedule();
        for (const s of rows) {
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
    }, []);

    useEffect(() => {
        if (!serverSchedule) return;
        hydrateFromServer(serverSchedule);
        // If nothing's saved yet, drop the admin straight into the editor.
        setEditing((curr) => curr || serverSchedule.length === 0);
    }, [serverSchedule, hydrateFromServer]);

    const updateDay = (day: DayOfWeek, mutate: (shifts: EditableShift[]) => EditableShift[]) => {
        setSchedule((prev) => ({ ...prev, [day]: mutate([...prev[day]]) }));
    };

    /** Switch a day to Whole-day layout: collapse to one 00:00–23:59 block, preserving the union of counsellors. */
    const setWholeDay = (day: DayOfWeek) =>
        updateDay(day, (shifts) => {
            const unionIds = Array.from(
                new Set(shifts.flatMap((s) => s.counselorUserIds))
            );
            return [
                {
                    localId: cryptoRandom(),
                    startTime: START_OF_DAY,
                    endTime: END_OF_DAY,
                    counselorUserIds: unionIds,
                },
            ];
        });

    /**
     * Switch a day to Multiple-shifts layout. If it was a whole-day block, drop it
     * so the ShiftCountPicker shows. If it was already multi-shift, leave existing
     * shifts in place.
     */
    const setMultipleShifts = (day: DayOfWeek) =>
        updateDay(day, (shifts) => {
            if (shifts.length === 0) return shifts;
            const onlyWholeDay =
                shifts.length === 1 &&
                shifts[0]!.startTime === START_OF_DAY &&
                shifts[0]!.endTime === END_OF_DAY;
            return onlyWholeDay ? [] : shifts;
        });

    /** Replace a day's shifts wholesale — used by ShiftCountPicker. */
    const replaceDayShifts = (day: DayOfWeek, shifts: EditableShift[]) =>
        updateDay(day, () => shifts);

    const addShift = (day: DayOfWeek) =>
        updateDay(day, (shifts) => [...shifts, defaultShift()]);

    const removeShift = (day: DayOfWeek, idx: number) =>
        updateDay(day, (shifts) => shifts.filter((_, i) => i !== idx));

    const updateShift = (day: DayOfWeek, idx: number, patch: Partial<EditableShift>) =>
        updateDay(day, (shifts) => shifts.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

    const dayValidations = useMemo(() => {
        const out: Record<DayOfWeek, ReturnType<typeof validateDayCoverage>> = {} as never;
        for (const day of DAYS_OF_WEEK) {
            out[day] = validateDayCoverage(schedule[day]);
        }
        return out;
    }, [schedule]);

    const allValid = DAYS_OF_WEEK.every((d) => dayValidations[d].ok);

    const handleSave = () => {
        if (!allValid) {
            toast.error('Fix the highlighted days before saving.');
            return;
        }
        const flatShifts: ShiftBlockRequest[] = [];
        for (const day of DAYS_OF_WEEK) {
            for (const s of schedule[day]) {
                flatShifts.push({
                    day_of_week: day,
                    start_time: s.startTime,
                    // Bump minute-precision EOD (23:59:00) to second-precision so the
                    // backend's coverage rule and routing engine see full coverage.
                    end_time: normalizeEndOfDay(s.endTime),
                    label: s.label,
                    counselor_user_ids: s.counselorUserIds,
                });
            }
        }
        saveSchedule(
            { shifts: flatShifts },
            {
                onSuccess: () => {
                    toast.success('Schedule saved');
                    setEditing(false);
                },
                onError: (err) => toast.error(extractError(err) ?? 'Failed to save schedule'),
            }
        );
    };

    const handleCancel = () => {
        if (serverSchedule) hydrateFromServer(serverSchedule);
        setEditing(false);
    };

    if (poolCounselorOptions.length === 0) {
        return (
            <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">
                    Add at least one counsellor to this pool before configuring the schedule.
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return <div className="p-4 text-sm text-muted-foreground">Loading schedule…</div>;
    }

    // Read mode: compact view, with "Edit" button. Only when there's something saved.
    if (!editing && serverSchedule && serverSchedule.length > 0) {
        return (
            <ScheduleReadView
                schedule={serverSchedule}
                pattern="PER_DAY"
                userNameById={userNameById}
                onEdit={() => setEditing(true)}
            />
        );
    }

    return (
        <div className="space-y-4">
            <Card className={allValid ? 'border-green-300' : 'border-red-300'}>
                <CardHeader>
                    <CardTitle>Coverage Status</CardTitle>
                    <CardDescription>
                        Each day must cover 00:00–23:59 with no gaps, and every shift must have
                        at least one counsellor.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {allValid ? (
                        <p className="text-sm text-green-700">✓ All 7 days are valid</p>
                    ) : (
                        <ul className="space-y-1 text-sm text-red-700">
                            {DAYS_OF_WEEK.filter((d) => !dayValidations[d].ok).map((d) => (
                                <li key={d}>• {DAY_LABEL[d]} — see errors below</li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {DAYS_OF_WEEK.map((day) => {
                const shifts = schedule[day];
                const layout: DayLayout =
                    shifts.length === 1 &&
                    shifts[0]!.startTime === START_OF_DAY &&
                    shifts[0]!.endTime === END_OF_DAY
                        ? 'WHOLE_DAY'
                        : 'MULTIPLE_SHIFTS';
                const validation = dayValidations[day];

                return (
                    <Card
                        key={day}
                        className={validation.ok ? undefined : 'border-red-300'}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                            <CardTitle className="text-base">{DAY_LABEL[day]}</CardTitle>
                            <div className="flex items-center gap-2">
                                <LayoutToggle
                                    layout={layout}
                                    onChange={(next) =>
                                        next === 'WHOLE_DAY'
                                            ? setWholeDay(day)
                                            : setMultipleShifts(day)
                                    }
                                />
                                {layout === 'MULTIPLE_SHIFTS' && (
                                    <MyButton
                                        buttonType="secondary"
                                        scale="small"
                                        onClick={() => addShift(day)}
                                    >
                                        + Add Shift
                                    </MyButton>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {shifts.length === 0 && layout === 'MULTIPLE_SHIFTS' && (
                                <ShiftCountPicker
                                    onPick={(generated) => replaceDayShifts(day, generated)}
                                />
                            )}
                            {shifts.length === 0 && layout === 'WHOLE_DAY' && (
                                <p className="text-xs text-red-700">
                                    No shifts configured. Add one to cover this day.
                                </p>
                            )}
                            {shifts.map((s, idx) => {
                                const shiftErr = validation.shiftErrors.find(
                                    (e) => e.localId === s.localId
                                );
                                return (
                                    <ShiftBlockEditor
                                        key={s.localId}
                                        shift={s}
                                        counselorOptions={poolCounselorOptions}
                                        error={shiftErr?.message}
                                        canRemove={layout === 'MULTIPLE_SHIFTS' && shifts.length > 1}
                                        onRemove={() => removeShift(day, idx)}
                                        onUpdate={(patch) => updateShift(day, idx, patch)}
                                    />
                                );
                            })}
                            {validation.coverageErrors.length > 0 && (
                                <ul className="space-y-1 text-xs text-red-700">
                                    {validation.coverageErrors.map((e, i) => (
                                        <li key={i}>• {e}</li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                );
            })}

            <div className="flex justify-end gap-2">
                {serverSchedule && serverSchedule.length > 0 && (
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={handleCancel}
                        disable={saving}
                    >
                        Cancel
                    </MyButton>
                )}
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={handleSave}
                    disable={saving || !allValid}
                >
                    {saving ? 'Saving…' : 'Save Schedule'}
                </MyButton>
            </div>
        </div>
    );
}

interface LayoutToggleProps {
    layout: DayLayout;
    onChange: (next: DayLayout) => void;
}

function LayoutToggle({ layout, onChange }: LayoutToggleProps) {
    const opt = (value: DayLayout, label: string) => (
        <button
            type="button"
            onClick={() => onChange(value)}
            className={
                'rounded-sm px-3 py-1 text-xs transition ' +
                (layout === value
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-neutral-600 hover:bg-neutral-100')
            }
        >
            {label}
        </button>
    );
    return (
        <div className="inline-flex rounded-md border border-neutral-200 p-0.5">
            {opt('WHOLE_DAY', 'Whole day')}
            {opt('MULTIPLE_SHIFTS', 'Multiple shifts')}
        </div>
    );
}

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

function defaultShift(): EditableShift {
    return {
        localId: cryptoRandom(),
        startTime: '09:00:00',
        endTime: '12:00:00',
        counselorUserIds: [],
    };
}
