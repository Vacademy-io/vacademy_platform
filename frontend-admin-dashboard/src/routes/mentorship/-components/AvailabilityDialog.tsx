import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useMyBookingPage, useUpdateMyBookingPage } from '../-hooks/use-mentorship';
import type { MentorAvailabilityRequest, WeeklyWindow } from '../-types/mentorship-types';

const DAYS: { key: string; label: string }[] = [
    { key: 'MONDAY', label: 'Monday' },
    { key: 'TUESDAY', label: 'Tuesday' },
    { key: 'WEDNESDAY', label: 'Wednesday' },
    { key: 'THURSDAY', label: 'Thursday' },
    { key: 'FRIDAY', label: 'Friday' },
    { key: 'SATURDAY', label: 'Saturday' },
    { key: 'SUNDAY', label: 'Sunday' },
];

const DURATIONS = [15, 20, 30, 45, 60, 90];

interface DayRow {
    enabled: boolean;
    start: string;
    end: string;
}

const emptyRows = (): Record<string, DayRow> =>
    Object.fromEntries(DAYS.map((d) => [d.key, { enabled: false, start: '09:00', end: '17:00' }]));

interface AvailabilityDialogProps {
    instituteId: string | undefined;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AvailabilityDialog({ instituteId, open, onOpenChange }: AvailabilityDialogProps) {
    const { data: page, isLoading } = useMyBookingPage(open ? instituteId : undefined);
    const update = useUpdateMyBookingPage();

    const [rows, setRows] = useState<Record<string, DayRow>>(emptyRows());
    const [duration, setDuration] = useState(30);
    const [minNoticeHours, setMinNoticeHours] = useState(2);
    const [bufferBefore, setBufferBefore] = useState(0);
    const [bufferAfter, setBufferAfter] = useState(0);
    const [horizonDays, setHorizonDays] = useState(30);

    // Hydrate the form once the page loads.
    useEffect(() => {
        if (!page) return;
        const next = emptyRows();
        (page.availability?.weekly_windows ?? []).forEach((w) => {
            const row = next[w.day_of_week];
            if (row && !row.enabled) {
                row.enabled = true;
                row.start = w.start_time || row.start;
                row.end = w.end_time || row.end;
            }
        });
        setRows(next);
        setDuration(page.duration_minutes ?? 30);
        setMinNoticeHours(Math.round((page.min_notice_minutes ?? 120) / 60));
        setBufferBefore(page.buffer_before_minutes ?? 0);
        setBufferAfter(page.buffer_after_minutes ?? 0);
        setHorizonDays(page.booking_horizon_days ?? 30);
    }, [page]);

    const setDay = (key: string, patch: Partial<DayRow>) =>
        setRows((prev) => ({ ...prev, [key]: { ...prev[key]!, ...patch } }));

    const save = async () => {
        if (!instituteId) return;
        const weekly_windows: WeeklyWindow[] = [];
        for (const d of DAYS) {
            const r = rows[d.key]!;
            if (!r.enabled) continue;
            if (r.start >= r.end) {
                toast.error(`${d.label}: end time must be after start time.`);
                return;
            }
            weekly_windows.push({ day_of_week: d.key, start_time: r.start, end_time: r.end });
        }
        if (weekly_windows.length === 0) {
            toast.error('Enable at least one day so learners can book.');
            return;
        }
        const payload: MentorAvailabilityRequest = {
            availability: { weekly_windows },
            duration_minutes: duration,
            min_notice_minutes: Math.max(0, minNoticeHours) * 60,
            buffer_before_minutes: Math.max(0, bufferBefore),
            buffer_after_minutes: Math.max(0, bufferAfter),
            booking_horizon_days: Math.max(1, horizonDays),
        };
        try {
            await update.mutateAsync({ instituteId, data: payload });
            toast.success('Availability saved');
            onOpenChange(false);
        } catch {
            toast.error('Failed to save availability');
        }
    };

    return (
        <MyDialog
            heading="Availability"
            open={open}
            onOpenChange={onOpenChange}
            footer={
                <>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="small"
                        onClick={save}
                        disable={update.isPending || isLoading}
                    >
                        {update.isPending ? 'Saving…' : 'Save'}
                    </MyButton>
                </>
            }
        >
            {isLoading ? (
                <div className="py-8 text-center text-body text-neutral-400">Loading…</div>
            ) : (
                <div className="flex flex-col gap-5">
                    {page?.timezone && (
                        <p className="text-caption text-neutral-500">
                            Times are in <span className="font-medium">{page.timezone}</span>.
                        </p>
                    )}

                    <div>
                        <div className="mb-2 text-caption font-semibold uppercase tracking-wide text-neutral-400">
                            Weekly hours
                        </div>
                        <div className="flex flex-col gap-2">
                            {DAYS.map((d) => {
                                const r = rows[d.key]!;
                                return (
                                    <div key={d.key} className="flex items-center gap-3">
                                        <div className="flex w-32 items-center gap-2">
                                            <Switch
                                                checked={r.enabled}
                                                onCheckedChange={(v) => setDay(d.key, { enabled: v })}
                                            />
                                            <span className="text-body text-neutral-700">{d.label}</span>
                                        </div>
                                        {r.enabled ? (
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="time"
                                                    value={r.start}
                                                    onChange={(e) =>
                                                        setDay(d.key, { start: e.target.value })
                                                    }
                                                    className="w-32"
                                                />
                                                <span className="text-caption text-neutral-400">to</span>
                                                <Input
                                                    type="time"
                                                    value={r.end}
                                                    onChange={(e) => setDay(d.key, { end: e.target.value })}
                                                    className="w-32"
                                                />
                                            </div>
                                        ) : (
                                            <span className="text-caption text-neutral-400">Unavailable</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <div className="mb-2 text-caption font-semibold uppercase tracking-wide text-neutral-400">
                            Session settings
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-caption text-neutral-600">Duration</Label>
                                <Select
                                    value={String(duration)}
                                    onValueChange={(v) => setDuration(Number(v))}
                                >
                                    <SelectTrigger className="mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DURATIONS.map((m) => (
                                            <SelectItem key={m} value={String(m)}>
                                                {m} minutes
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-caption text-neutral-600">
                                    Minimum notice (hours)
                                </Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={minNoticeHours}
                                    onChange={(e) => setMinNoticeHours(Number(e.target.value))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-caption text-neutral-600">
                                    Buffer before (min)
                                </Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={bufferBefore}
                                    onChange={(e) => setBufferBefore(Number(e.target.value))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-caption text-neutral-600">
                                    Buffer after (min)
                                </Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={bufferAfter}
                                    onChange={(e) => setBufferAfter(Number(e.target.value))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-caption text-neutral-600">
                                    Booking horizon (days)
                                </Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={horizonDays}
                                    onChange={(e) => setHorizonDays(Number(e.target.value))}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </MyDialog>
    );
}
