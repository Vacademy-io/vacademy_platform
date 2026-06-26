/**
 * Schedule tab — routes between three views for a TIME_BASED pool:
 *
 *   1. ScheduleEmptyState        — pool has no shifts AND no pattern picked yet
 *   2. PerDayScheduleEditor      — pattern = PER_DAY (or legacy data without pattern)
 *   3. SameHoursAllDaysEditor    — pattern = SAME_HOURS_ALL_DAYS
 *
 * Pattern decision rules:
 *   - If schedule has saved shifts AND pool.schedule_pattern is null → fall
 *     back to PER_DAY (legacy data created before the schedule_pattern
 *     column existed).
 *   - If shifts exist, the pattern is effectively locked. The backend
 *     rejects pattern changes while shifts are present.
 *   - If no shifts AND no pattern → show the empty-state chooser.
 *   - If no shifts AND pattern set (admin picked but hasn't saved) → show
 *     the matching editor; admin can click "Change pattern" to go back.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MyButton } from '@/components/design-system/button';
import {
    CounselorPoolDTO,
    SchedulePattern,
    useWeeklySchedule,
} from '@/services/counselor-pool';
import PerDayScheduleEditor from './schedule/PerDayScheduleEditor';
import SameHoursAllDaysEditor from './schedule/SameHoursAllDaysEditor';
import ScheduleEmptyState from './schedule/ScheduleEmptyState';

interface ScheduleTabProps {
    pool: CounselorPoolDTO;
}

export default function ScheduleTab({ pool }: ScheduleTabProps) {
    const { data: serverSchedule = [], isLoading } = useWeeklySchedule(pool.id);

    // Local toggle that lets admin reopen the chooser BEFORE any shifts are
    // saved. Once shifts exist, this is ignored — pattern is locked.
    const [forceChooser, setForceChooser] = useState(false);

    // Used by TIME_BASED pools, and by ROUND_ROBIN pools that turned on the
    // "only assign to counsellors on shift" option (shift_aware) — both route
    // off the same weekly shift schedule.
    const usesSchedule =
        pool.assignment_mode === 'TIME_BASED' ||
        (pool.assignment_mode === 'ROUND_ROBIN' && !!pool.shift_aware);

    if (!usesSchedule) {
        return (
            <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">
                    This tab is used when the pool is <strong>Time-based</strong>, or when a{' '}
                    <strong>Round-robin</strong> pool has &ldquo;only assign to counsellors on
                    shift&rdquo; turned on. Enable one of those in the Overview tab to configure a
                    weekly shift schedule.
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return <div className="p-4 text-sm text-muted-foreground">Loading schedule…</div>;
    }

    const hasShifts = serverSchedule.length > 0;
    const pattern: SchedulePattern | null =
        (pool.schedule_pattern as SchedulePattern | undefined) ?? null;

    // Empty state: shown when nothing is saved and admin hasn't picked, OR
    // when admin clicks "Change pattern" before saving shifts.
    if (!hasShifts && (pattern === null || forceChooser)) {
        return (
            <ScheduleEmptyState
                poolId={pool.id}
                onPatternChosen={() => setForceChooser(false)}
            />
        );
    }

    // Pattern set (either explicitly or legacy fallback to PER_DAY).
    const effectivePattern: SchedulePattern = pattern ?? 'PER_DAY';

    return (
        <div className="space-y-3">
            {!hasShifts && (
                <div className="flex items-center justify-between rounded border border-neutral-200 bg-neutral-50 p-3 text-xs text-muted-foreground">
                    <span>
                        Authoring as <strong>{prettyPattern(effectivePattern)}</strong>. Save
                        below to lock this choice.
                    </span>
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={() => setForceChooser(true)}
                    >
                        Change pattern
                    </MyButton>
                </div>
            )}
            {effectivePattern === 'SAME_HOURS_ALL_DAYS' ? (
                <SameHoursAllDaysEditor pool={pool} />
            ) : (
                <PerDayScheduleEditor pool={pool} />
            )}
        </div>
    );
}

function prettyPattern(p: SchedulePattern): string {
    return p === 'SAME_HOURS_ALL_DAYS' ? 'Same hours every day' : 'Custom per day';
}
