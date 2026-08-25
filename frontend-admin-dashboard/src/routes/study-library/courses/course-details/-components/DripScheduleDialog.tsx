import { useEffect, useMemo, useState } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info } from '@phosphor-icons/react';
import type {
    DripCondition,
    DripConditionBehavior,
    DripConditionContentLevel,
    DripScheduleDefaults,
} from '@/types/course-settings';
import { DEFAULT_DRIP_SCHEDULE } from '@/types/course-settings';
import {
    applyDripSchedule,
    buildDripSchedule,
    clearDripSchedule,
    getLevelDisplayName,
    previewDripSchedule,
    type DripScheduleItem,
} from '@/utils/drip-conditions';

export interface DripScheduleDialogProps {
    open: boolean;
    onClose: () => void;
    /**
     * Content available to schedule, in course order, per level. Levels with no
     * items are not offered.
     */
    itemsByLevel: Partial<Record<DripConditionContentLevel, DripScheduleItem[]>>;
    dripConditions: DripCondition[];
    onSave: (updatedConditions: DripCondition[]) => Promise<void>;
    /** Institute-wide starting point for the form (Settings → Course). */
    defaults?: DripScheduleDefaults;
    dripEnabled?: boolean;
    /** Whether saved rules are actually applied to learners yet. */
    enforcing?: boolean;
}

/**
 * Lay a day-wise release schedule over a whole course in one pass.
 *
 * This is the bulk answer to "30-day course, one chapter a day": picking a
 * level and an interval writes one day-wise rule per item, counted from each
 * learner's own enrollment, so the schedule works for someone who joins today
 * and someone who joins in March alike.
 */
export function DripScheduleDialog({
    open,
    onClose,
    itemsByLevel,
    dripConditions,
    onSave,
    defaults = DEFAULT_DRIP_SCHEDULE,
    dripEnabled = true,
    enforcing = false,
}: DripScheduleDialogProps) {
    const availableLevels = useMemo(
        () =>
            (['subject', 'module', 'chapter', 'slide'] as DripConditionContentLevel[]).filter(
                (level) => (itemsByLevel[level]?.length ?? 0) > 0
            ),
        [itemsByLevel]
    );

    const [level, setLevel] = useState<DripConditionContentLevel>(defaults.level);
    const [startDay, setStartDay] = useState(defaults.startDay);
    const [intervalDays, setIntervalDays] = useState(defaults.intervalDays);
    const [behavior, setBehavior] = useState<DripConditionBehavior>(defaults.behavior);
    const [anchor, setAnchor] = useState(defaults.anchor);
    const [unlockTime, setUnlockTime] = useState(defaults.unlockTime);
    const [saving, setSaving] = useState(false);

    // Reset to the institute's defaults each time the dialog opens, falling back
    // to a level that actually has content in this course.
    useEffect(() => {
        if (!open) return;
        setLevel(
            availableLevels.includes(defaults.level)
                ? defaults.level
                : (availableLevels[0] ?? 'chapter')
        );
        setStartDay(defaults.startDay);
        setIntervalDays(defaults.intervalDays);
        setBehavior(defaults.behavior);
        setAnchor(defaults.anchor);
        setUnlockTime(defaults.unlockTime);
    }, [open, defaults, availableLevels]);

    const items = itemsByLevel[level] ?? [];
    const preview = useMemo(
        () => previewDripSchedule(items, { startDay, intervalDays }),
        [items, startDay, intervalDays]
    );
    const lastDay = preview.length > 0 ? preview[preview.length - 1]!.day : 0;

    const existingCount = useMemo(
        () =>
            dripConditions.filter(
                (c) => c.level === level && items.some((item) => item.id === c.level_id)
            ).length,
        [dripConditions, level, items]
    );

    const currentOptions: DripScheduleDefaults = {
        level,
        startDay,
        intervalDays,
        behavior,
        anchor,
        unlockTime,
    };

    const handleApply = async () => {
        try {
            setSaving(true);
            const generated = buildDripSchedule(items, level, currentOptions);
            await onSave(applyDripSchedule(dripConditions, level, generated));
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const handleClear = async () => {
        // Deletes every rule at this level in one action and opens the whole
        // course — too far-reaching to do on a single stray click.
        if (
            !window.confirm(
                `Remove ${existingCount} unlock rule${existingCount === 1 ? '' : 's'} from this course? Every ${getLevelDisplayName(level).toLowerCase()} opens for all learners immediately.`
            )
        ) {
            return;
        }
        try {
            setSaving(true);
            await onSave(
                clearDripSchedule(
                    dripConditions,
                    level,
                    items.map((item) => item.id)
                )
            );
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <MyDialog open={open} onOpenChange={onClose} heading="Schedule day-wise unlock">
            <div className="space-y-4">
                {!dripEnabled && (
                    <Alert className="border-amber-200 bg-amber-50">
                        <Info className="size-4 text-amber-600" />
                        <AlertDescription className="text-sm text-amber-900">
                            Drip conditions are switched off for this institute. The schedule will
                            save but nothing locks until you enable them in Settings → Course →
                            Drip Conditions.
                        </AlertDescription>
                    </Alert>
                )}

                {dripEnabled && !enforcing && (
                    <Alert className="border-neutral-200 bg-neutral-50">
                        <Info className="size-4 text-neutral-500" />
                        <AlertDescription className="text-sm">
                            Preview mode: the schedule saves, but nothing locks for learners until
                            &ldquo;Apply unlock rules to learners&rdquo; is switched on in
                            Settings → Course → Drip Conditions.
                        </AlertDescription>
                    </Alert>
                )}

                {availableLevels.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
                        This course has no content to schedule yet.
                    </div>
                ) : (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                                <Label>Release one</Label>
                                <Select
                                    value={level}
                                    onValueChange={(v) =>
                                        setLevel(v as DripConditionContentLevel)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableLevels.map((option) => (
                                            <SelectItem key={option} value={option}>
                                                {getLevelDisplayName(option)} (
                                                {itemsByLevel[option]?.length ?? 0})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Every … days</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={intervalDays}
                                    onChange={(e) =>
                                        setIntervalDays(
                                            Math.max(1, parseInt(e.target.value, 10) || 1)
                                        )
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>First one opens on day</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={startDay}
                                    onChange={(e) =>
                                        setStartDay(Math.max(1, parseInt(e.target.value, 10) || 1))
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Counted from</Label>
                                <Select
                                    value={anchor}
                                    onValueChange={(v) =>
                                        setAnchor(v as DripScheduleDefaults['anchor'])
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="enrollment">
                                            Each learner&apos;s enrollment date
                                        </SelectItem>
                                        <SelectItem value="session_start">
                                            The batch start date
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Opens at</Label>
                                <Input
                                    type="time"
                                    value={unlockTime}
                                    onChange={(e) => setUnlockTime(e.target.value || '00:00')}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Until then</Label>
                                <Select
                                    value={behavior}
                                    onValueChange={(v) => setBehavior(v as DripConditionBehavior)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="lock">Show locked</SelectItem>
                                        <SelectItem value="hide">Hide completely</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Alert className="border-blue-200 bg-blue-50">
                            <Info className="size-4 text-blue-600" />
                            <AlertDescription className="text-sm text-blue-900">
                                {preview.length} {getLevelDisplayName(level).toLowerCase()}
                                {preview.length === 1 ? '' : 's'} released over {lastDay} day
                                {lastDay === 1 ? '' : 's'}, per learner.
                                {existingCount > 0 && (
                                    <span className="block text-xs">
                                        {existingCount} existing rule
                                        {existingCount === 1 ? '' : 's'} at this level will be
                                        replaced.
                                    </span>
                                )}
                            </AlertDescription>
                        </Alert>

                        <div className="max-h-64 overflow-y-auto rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-neutral-50 text-left">
                                    <tr>
                                        <th className="w-24 px-3 py-2 font-medium">Day</th>
                                        <th className="px-3 py-2 font-medium">
                                            {getLevelDisplayName(level)}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.map((entry) => (
                                        <tr key={entry.id} className="border-t">
                                            <td className="px-3 py-1.5">
                                                <Badge variant="outline">Day {entry.day}</Badge>
                                            </td>
                                            <td className="px-3 py-1.5 text-neutral-700">
                                                {entry.name}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between border-t pt-4">
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={handleClear}
                                disabled={saving || existingCount === 0}
                            >
                                Clear schedule
                            </MyButton>
                            <div className="flex gap-2">
                                <MyButton
                                    buttonType="secondary"
                                    onClick={onClose}
                                    disabled={saving}
                                >
                                    Cancel
                                </MyButton>
                                <MyButton
                                    onClick={handleApply}
                                    disabled={saving || preview.length === 0}
                                >
                                    {saving ? 'Saving…' : 'Apply schedule'}
                                </MyButton>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </MyDialog>
    );
}
