/**
 * UI B — "Same hours every day" editor.
 *
 * Admin defines one canonical 24h template (N blocks tiling 00:00–23:59:59).
 * That template is applied to all 7 days on save: the frontend emits N × 7
 * shift rows, expanding overnight blocks (start > end) into two halves at
 * midnight per day so the backend's strict start < end check is satisfied.
 *
 * On load, we read Monday's shifts (the schedule_pattern column told the
 * Schedule tab to render this editor, so we trust that all 7 days are
 * identical) and merge any (00:00–T) + (T'–23:59:59) pair with the same
 * member set back into one overnight block.
 *
 * Every block must have ≥1 counsellor; the canonical template must tile 24h.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MyButton } from '@/components/design-system/button';
import {
    CounselorPoolDTO,
    DAYS_OF_WEEK,
    PoolShiftDTO,
    ShiftBlockRequest,
    useSetWeeklySchedule,
    useWeeklySchedule,
} from '@/services/counselor-pool';
import ScheduleReadView from './ScheduleReadView';
import ShiftBlockEditor from './ShiftBlockEditor';
import ShiftCountPicker from './ShiftCountPicker';
import {
    END_OF_DAY,
    START_OF_DAY,
    cryptoRandom,
    extractError,
    fetchCounselors,
    normalizeEndOfDay,
    reconstructSameHoursTemplate,
    validateDayCoverage,
    type EditableShift,
    type ShiftError,
} from './shared';

interface Props {
    pool: CounselorPoolDTO;
}

export default function SameHoursAllDaysEditor({ pool }: Props) {
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

    /**
     * The single canonical 24h template. Each block applies to all 7 days.
     * Overnight blocks (start > end) are stored as one logical row here and
     * split at midnight on save.
     */
    const [template, setTemplate] = useState<EditableShift[]>([]);
    /** Read/edit mode toggle — auto-starts in edit when nothing's saved. */
    const [editing, setEditing] = useState(false);

    const hydrateFromServer = useCallback((rows: PoolShiftDTO[]) => {
        setTemplate(reconstructSameHoursTemplate(rows));
    }, []);

    useEffect(() => {
        if (!serverSchedule) return;
        hydrateFromServer(serverSchedule);
        setEditing((curr) => curr || serverSchedule.length === 0);
    }, [serverSchedule, hydrateFromServer]);

    const updateTemplate = (mutate: (rows: EditableShift[]) => EditableShift[]) =>
        setTemplate((prev) => mutate([...prev]));

    const addBlock = () =>
        updateTemplate((rows) => [
            ...rows,
            {
                localId: cryptoRandom(),
                startTime: '09:00:00',
                endTime: '12:00:00',
                counselorUserIds: [],
            },
        ]);

    const removeBlock = (idx: number) =>
        updateTemplate((rows) => rows.filter((_, i) => i !== idx));

    const updateBlock = (idx: number, patch: Partial<EditableShift>) =>
        updateTemplate((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

    const validation = useMemo(() => validateTemplate(template), [template]);

    const handleSave = () => {
        if (!validation.ok) {
            toast.error('Fix the highlighted blocks before saving.');
            return;
        }
        const flatShifts: ShiftBlockRequest[] = [];
        const expanded = expandOvernight(template);
        for (const day of DAYS_OF_WEEK) {
            for (const block of expanded) {
                flatShifts.push({
                    day_of_week: day,
                    start_time: block.startTime,
                    // Bump minute-precision EOD (23:59:00) to second-precision so the
                    // backend's coverage rule and routing engine see full coverage.
                    end_time: normalizeEndOfDay(block.endTime),
                    label: block.label,
                    counselor_user_ids: block.counselorUserIds,
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

    if (!editing && serverSchedule && serverSchedule.length > 0) {
        return (
            <ScheduleReadView
                schedule={serverSchedule}
                pattern="SAME_HOURS_ALL_DAYS"
                userNameById={userNameById}
                onEdit={() => setEditing(true)}
            />
        );
    }

    return (
        <div className="space-y-4">
            <Card className={validation.ok ? 'border-green-300' : 'border-red-300'}>
                <CardHeader>
                    <CardTitle>Coverage Status</CardTitle>
                    <CardDescription>
                        Define blocks that tile 24 hours. The same set of blocks is applied to
                        Monday through Sunday. Blocks crossing midnight (e.g. 18:00–09:00) are
                        allowed.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {validation.ok ? (
                        <p className="text-sm text-green-700">✓ 24h covered, all blocks valid</p>
                    ) : (
                        <ul className="space-y-1 text-sm text-red-700">
                            {validation.coverageErrors.map((e, i) => (
                                <li key={i}>• {e}</li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div>
                        <CardTitle className="text-base">Daily Template</CardTitle>
                        <CardDescription>Applied to all 7 days</CardDescription>
                    </div>
                    <MyButton buttonType="secondary" scale="small" onClick={addBlock}>
                        + Add Block
                    </MyButton>
                </CardHeader>
                <CardContent className="space-y-3">
                    {template.length === 0 && (
                        <ShiftCountPicker onPick={(generated) => setTemplate(generated)} />
                    )}
                    {template.map((b, idx) => {
                        const shiftErr = validation.shiftErrors.find((e) => e.localId === b.localId);
                        const isOvernight = b.startTime > b.endTime;
                        return (
                            <ShiftBlockEditor
                                key={b.localId}
                                shift={b}
                                counselorOptions={poolCounselorOptions}
                                error={shiftErr?.message}
                                endLabel={isOvernight ? 'next day' : undefined}
                                onRemove={() => removeBlock(idx)}
                                onUpdate={(patch) => updateBlock(idx, patch)}
                            />
                        );
                    })}
                </CardContent>
            </Card>

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
                    disable={saving || !validation.ok}
                >
                    {saving ? 'Saving…' : 'Save Schedule'}
                </MyButton>
            </div>
        </div>
    );
}

// ─── Validation ────────────────────────────────────────────────────────────

function validateTemplate(template: EditableShift[]): {
    ok: boolean;
    coverageErrors: string[];
    shiftErrors: ShiftError[];
} {
    const shiftErrors: ShiftError[] = [];

    for (const b of template) {
        if (b.counselorUserIds.length === 0) {
            shiftErrors.push({ localId: b.localId, message: 'Add at least one counsellor.' });
        }
        if (b.startTime === b.endTime) {
            shiftErrors.push({ localId: b.localId, message: 'Duration must be greater than zero.' });
        }
    }

    if (template.length === 0) {
        return { ok: false, coverageErrors: ['No blocks configured.'], shiftErrors };
    }

    // Reuse the per-day coverage validator on the midnight-expanded view.
    // It checks gaps and "first block must start at 00:00" / "must reach 23:59:59".
    const expanded = expandOvernight(template);
    const { coverageErrors } = validateDayCoverage(expanded);

    return {
        ok: coverageErrors.length === 0 && shiftErrors.length === 0,
        coverageErrors,
        shiftErrors,
    };
}

// ─── Overnight expansion / template reconstruction ──────────────────────────

/**
 * Split overnight blocks (start > end) into two halves: [start, 23:59:59] and
 * [00:00, end]. Non-overnight blocks pass through. Both halves carry the same
 * label and counsellors. The localId is suffixed so the halves don't collide
 * if the caller looks them up.
 */
function expandOvernight(blocks: EditableShift[]): EditableShift[] {
    const out: EditableShift[] = [];
    for (const b of blocks) {
        if (b.startTime > b.endTime) {
            out.push({
                ...b,
                localId: `${b.localId}:eve`,
                startTime: b.startTime,
                endTime: END_OF_DAY,
            });
            out.push({
                ...b,
                localId: `${b.localId}:morn`,
                startTime: START_OF_DAY,
                endTime: b.endTime,
            });
        } else {
            out.push(b);
        }
    }
    return out;
}

