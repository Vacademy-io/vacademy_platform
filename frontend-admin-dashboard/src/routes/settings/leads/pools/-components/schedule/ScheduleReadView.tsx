/**
 * Compact, read-only view of a pool's saved weekly schedule. Renders one
 * screen without scrolling for a typical schedule. Mirrors the OverviewTab
 * pattern: read mode by default once data exists, "Edit" button flips the
 * parent into edit mode.
 *
 * Two shapes depending on schedule_pattern:
 *   - PER_DAY              → 7-column grid, one column per day
 *   - SAME_HOURS_ALL_DAYS  → single column "Same hours every day" with the
 *                            canonical template (overnight blocks merged)
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MyButton } from '@/components/design-system/button';
import {
    DAYS_OF_WEEK,
    DayOfWeek,
    PoolShiftDTO,
    SchedulePattern,
} from '@/services/counselor-pool';
import {
    DAY_LABEL,
    END_OF_DAY,
    groupShiftsByDay,
    reconstructSameHoursTemplate,
    trimToHM,
    type EditableShift,
} from './shared';

interface Props {
    schedule: PoolShiftDTO[];
    pattern: SchedulePattern;
    userNameById: Map<string, string>;
    onEdit: () => void;
}

export default function ScheduleReadView({ schedule, pattern, userNameById, onEdit }: Props) {
    if (pattern === 'SAME_HOURS_ALL_DAYS') {
        const template = reconstructSameHoursTemplate(schedule);
        return (
            <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div>
                        <CardTitle>Weekly Schedule</CardTitle>
                        <CardDescription>Same hours every day</CardDescription>
                    </div>
                    <MyButton buttonType="secondary" scale="small" onClick={onEdit}>
                        Edit
                    </MyButton>
                </CardHeader>
                <CardContent className="space-y-2">
                    {template.map((b) => (
                        <TemplateBlockRow
                            key={b.localId}
                            block={b}
                            userNameById={userNameById}
                        />
                    ))}
                </CardContent>
            </Card>
        );
    }

    // PER_DAY
    const byDay = groupShiftsByDay(schedule);
    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                    <CardTitle>Weekly Schedule</CardTitle>
                    <CardDescription>Custom per day</CardDescription>
                </div>
                <MyButton buttonType="secondary" scale="small" onClick={onEdit}>
                    Edit
                </MyButton>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
                    {DAYS_OF_WEEK.map((day) => (
                        <DayColumn
                            key={day}
                            day={day}
                            shifts={byDay[day]}
                            userNameById={userNameById}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

interface DayColumnProps {
    day: DayOfWeek;
    shifts: PoolShiftDTO[];
    userNameById: Map<string, string>;
}

function DayColumn({ day, shifts, userNameById }: DayColumnProps) {
    return (
        <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-600">
                {DAY_LABEL[day]}
            </p>
            {shifts.length === 0 && (
                <p className="rounded border border-dashed border-neutral-200 p-2 text-xs text-muted-foreground">
                    —
                </p>
            )}
            {shifts.map((s) => (
                <ShiftCell key={s.id} shift={s} userNameById={userNameById} />
            ))}
        </div>
    );
}

interface ShiftCellProps {
    shift: PoolShiftDTO;
    userNameById: Map<string, string>;
}

function ShiftCell({ shift, userNameById }: ShiftCellProps) {
    const end = shift.end_time === END_OF_DAY ? '23:59' : trimToHM(shift.end_time);
    const memberIds = (shift.members ?? []).map((m) => m.counselor_user_id);
    return (
        <div className="rounded border border-neutral-200 bg-neutral-50 p-2">
            <p className="text-xs font-medium text-neutral-700">
                {trimToHM(shift.start_time)} – {end}
            </p>
            {shift.label && (
                <p className="text-xs text-muted-foreground">{shift.label}</p>
            )}
            <div className="mt-1 flex flex-wrap gap-1">
                {memberIds.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No counsellor</span>
                ) : (
                    memberIds.map((id) => (
                        <Badge
                            key={id}
                            className="bg-blue-100 text-blue-700 hover:bg-blue-100"
                        >
                            {userNameById.get(id) ?? id.slice(0, 8) + '…'}
                        </Badge>
                    ))
                )}
            </div>
        </div>
    );
}

interface TemplateBlockRowProps {
    block: EditableShift;
    userNameById: Map<string, string>;
}

function TemplateBlockRow({ block, userNameById }: TemplateBlockRowProps) {
    const end = block.endTime === END_OF_DAY ? '23:59' : trimToHM(block.endTime);
    const isOvernight = block.startTime > block.endTime;
    return (
        <div className="flex items-center justify-between rounded border border-neutral-200 bg-neutral-50 px-3 py-2">
            <div className="flex items-baseline gap-3">
                <p className="text-sm font-medium text-neutral-700">
                    {trimToHM(block.startTime)} – {end}
                    {isOvernight && (
                        <span className="ml-1 text-xs text-muted-foreground">(next day)</span>
                    )}
                </p>
                {block.label && (
                    <p className="text-xs text-muted-foreground">{block.label}</p>
                )}
            </div>
            <div className="flex flex-wrap justify-end gap-1">
                {block.counselorUserIds.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No counsellor</span>
                ) : (
                    block.counselorUserIds.map((id) => (
                        <Badge
                            key={id}
                            className="bg-blue-100 text-blue-700 hover:bg-blue-100"
                        >
                            {userNameById.get(id) ?? id.slice(0, 8) + '…'}
                        </Badge>
                    ))
                )}
            </div>
        </div>
    );
}
