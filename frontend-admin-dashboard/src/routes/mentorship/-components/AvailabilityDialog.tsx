import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash } from '@phosphor-icons/react';
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
import type {
    DateOverride,
    MentorAvailabilityRequest,
    SessionType,
    WeeklyWindow,
} from '../-types/mentorship-types';

const genId = (): string =>
    typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `st-${Math.floor(Math.random() * 1e9)}`;

/** A date override with a transient client key (stripped before saving). */
type OverrideRow = DateOverride & { _id: string };

const todayYmd = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
    ).padStart(2, '0')}`;
};

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
    const [sessionTypes, setSessionTypes] = useState<SessionType[]>([]);
    const [overrides, setOverrides] = useState<OverrideRow[]>([]);
    const [locationMode, setLocationMode] = useState<'GOOGLE_MEET' | 'CUSTOM_LINK'>('GOOGLE_MEET');
    const [customLink, setCustomLink] = useState('');

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
        setSessionTypes(
            (page.session_types ?? []).map((s) => ({ ...s, id: s.id || genId() }))
        );
        setOverrides(
            (page.availability?.date_overrides ?? []).map((o) => ({ ...o, _id: genId() }))
        );
        const isCustom =
            (page.location_type ?? '').toUpperCase() === 'CUSTOM_LINK' ||
            page.allocate_google_meet === false;
        setLocationMode(isCustom ? 'CUSTOM_LINK' : 'GOOGLE_MEET');
        setCustomLink(page.custom_meeting_link ?? '');
    }, [page]);

    const addOverride = () =>
        setOverrides((prev) => [...prev, { _id: genId(), date: todayYmd(), blocked: true }]);
    const removeOverride = (id: string) =>
        setOverrides((prev) => prev.filter((o) => o._id !== id));
    const patchOverride = (id: string, patch: Partial<OverrideRow>) =>
        setOverrides((prev) => prev.map((o) => (o._id === id ? { ...o, ...patch } : o)));
    const setOverrideMode = (id: string, mode: 'off' | 'custom') =>
        patchOverride(
            id,
            mode === 'off'
                ? { blocked: true, windows: undefined }
                : {
                      blocked: false,
                      windows: [{ day_of_week: '', start_time: '09:00', end_time: '17:00' }],
                  }
        );
    const setOverrideTime = (id: string, patch: Partial<WeeklyWindow>) =>
        setOverrides((prev) =>
            prev.map((o) =>
                o._id === id
                    ? {
                          ...o,
                          windows: [
                              {
                                  ...(o.windows?.[0] ?? {
                                      day_of_week: '',
                                      start_time: '09:00',
                                      end_time: '17:00',
                                  }),
                                  ...patch,
                              },
                          ],
                      }
                    : o
            )
        );

    const setDay = (key: string, patch: Partial<DayRow>) =>
        setRows((prev) => ({ ...prev, [key]: { ...prev[key]!, ...patch } }));

    const addSessionType = () =>
        setSessionTypes((prev) => [...prev, { id: genId(), name: '', duration_minutes: 30 }]);
    const updateSessionType = (id: string, patch: Partial<SessionType>) =>
        setSessionTypes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const removeSessionType = (id: string) =>
        setSessionTypes((prev) => prev.filter((s) => s.id !== id));

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
        if (locationMode === 'CUSTOM_LINK' && !customLink.trim()) {
            toast.error('Add your meeting link (Zoom, BigBlueButton, or other).');
            return;
        }
        const cleanTypes = sessionTypes
            .filter((s) => s.name.trim() && s.duration_minutes > 0)
            .map((s) => ({ id: s.id, name: s.name.trim(), duration_minutes: s.duration_minutes }));
        const cleanOverrides: DateOverride[] = overrides
            .filter((o) => o.date)
            .map((o) =>
                o.blocked
                    ? { date: o.date, blocked: true }
                    : { date: o.date, blocked: false, windows: o.windows }
            );
        const payload: MentorAvailabilityRequest = {
            availability: { weekly_windows, date_overrides: cleanOverrides },
            duration_minutes: duration,
            min_notice_minutes: Math.max(0, minNoticeHours) * 60,
            buffer_before_minutes: Math.max(0, bufferBefore),
            buffer_after_minutes: Math.max(0, bufferAfter),
            booking_horizon_days: Math.max(1, horizonDays),
            session_types: cleanTypes,
            location_type: locationMode,
            allocate_google_meet: locationMode === 'GOOGLE_MEET',
            custom_meeting_link: locationMode === 'CUSTOM_LINK' ? customLink.trim() : '',
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
                <div className="py-8 text-center text-body text-neutral-400">Loading your availability…</div>
            ) : (
                <div className="flex flex-col gap-5">
                    <p className="text-body text-neutral-600">
                        Set when and how learners can book 1:1 sessions with you.
                    </p>
                    {page?.timezone && (
                        <p className="-mt-3 text-caption text-neutral-500">
                            Times below are in <span className="font-medium">{page.timezone}</span>.
                        </p>
                    )}

                    <div>
                        <div className="mb-1 text-caption font-semibold uppercase tracking-wide text-neutral-400">
                            Meeting location
                        </div>
                        <p className="mb-2 text-caption text-neutral-400">
                            Where the video call happens when a learner books a session.
                        </p>
                        <Select
                            value={locationMode}
                            onValueChange={(v) =>
                                setLocationMode(v as 'GOOGLE_MEET' | 'CUSTOM_LINK')
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="GOOGLE_MEET">
                                    Google Meet (auto-generated per booking)
                                </SelectItem>
                                <SelectItem value="CUSTOM_LINK">
                                    Zoom / BigBlueButton / custom link
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        {locationMode === 'CUSTOM_LINK' && (
                            <div className="mt-2">
                                <Label className="text-caption text-neutral-600">
                                    Meeting link
                                </Label>
                                <Input
                                    value={customLink}
                                    placeholder="https://zoom.us/j/… or your BigBlueButton room URL"
                                    onChange={(e) => setCustomLink(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="mb-1 text-caption font-semibold uppercase tracking-wide text-neutral-400">
                            Weekly hours
                        </div>
                        <p className="mb-2 text-caption text-neutral-400">
                            Turn on the days you&apos;re free, and set the hours learners can book
                            within.
                        </p>
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
                        <div className="mb-1 flex items-center justify-between">
                            <span className="text-caption font-semibold uppercase tracking-wide text-neutral-400">
                                Time off &amp; specific dates
                            </span>
                            <MyButton
                                type="button"
                                buttonType="text"
                                scale="small"
                                onClick={addOverride}
                                title="Add a date to block off or give custom hours"
                            >
                                <Plus size={14} /> Add date
                            </MyButton>
                        </div>
                        <p className="mb-2 text-caption text-neutral-400">
                            Block off a day, or give a specific date different hours — these override
                            your weekly hours above.
                        </p>
                        {overrides.length === 0 ? (
                            <p className="text-caption text-neutral-400">No date overrides yet.</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {overrides.map((o) => (
                                    <div key={o._id} className="flex flex-wrap items-center gap-2">
                                        <Input
                                            type="date"
                                            value={o.date}
                                            onChange={(e) =>
                                                patchOverride(o._id, { date: e.target.value })
                                            }
                                            className="w-40"
                                        />
                                        <Select
                                            value={o.blocked ? 'off' : 'custom'}
                                            onValueChange={(v) =>
                                                setOverrideMode(o._id, v as 'off' | 'custom')
                                            }
                                        >
                                            <SelectTrigger className="w-40">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="off">Unavailable</SelectItem>
                                                <SelectItem value="custom">Custom hours</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {!o.blocked && (
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="time"
                                                    value={o.windows?.[0]?.start_time ?? '09:00'}
                                                    onChange={(e) =>
                                                        setOverrideTime(o._id, {
                                                            start_time: e.target.value,
                                                        })
                                                    }
                                                    className="w-28"
                                                />
                                                <span className="text-caption text-neutral-400">
                                                    to
                                                </span>
                                                <Input
                                                    type="time"
                                                    value={o.windows?.[0]?.end_time ?? '17:00'}
                                                    onChange={(e) =>
                                                        setOverrideTime(o._id, {
                                                            end_time: e.target.value,
                                                        })
                                                    }
                                                    className="w-28"
                                                />
                                            </div>
                                        )}
                                        <MyButton
                                            type="button"
                                            buttonType="text"
                                            scale="small"
                                            onClick={() => removeOverride(o._id)}
                                            aria-label="Remove this date override"
                                            title="Remove this date override"
                                        >
                                            <Trash size={16} className="text-danger-500" />
                                        </MyButton>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="mb-1 text-caption font-semibold uppercase tracking-wide text-neutral-400">
                            Session settings
                        </div>
                        <p className="mb-2 text-caption text-neutral-400">
                            Default session length and the scheduling rules around it — notice,
                            buffers, and how far ahead learners can book.
                        </p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <Label className="text-caption text-neutral-600">Default duration</Label>
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

                    <div>
                        <div className="mb-1 flex items-center justify-between">
                            <span className="text-caption font-semibold uppercase tracking-wide text-neutral-400">
                                Session types
                            </span>
                            <MyButton
                                type="button"
                                buttonType="text"
                                scale="small"
                                onClick={addSessionType}
                                title="Offer another bookable session length"
                            >
                                <Plus size={14} /> Add type
                            </MyButton>
                        </div>
                        <p className="mb-2 text-caption text-neutral-400">
                            Optional. Offer more than one bookable length (e.g. “Quick chat” 15
                            min, “Deep dive” 60 min) — the learner picks one when booking. Leave
                            empty to use the default duration above.
                        </p>
                        {sessionTypes.length === 0 ? (
                            <p className="text-caption text-neutral-400">No session types yet.</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {sessionTypes.map((st) => (
                                    <div key={st.id} className="flex items-center gap-2">
                                        <Input
                                            value={st.name}
                                            placeholder="Name (e.g. Career chat)"
                                            onChange={(e) =>
                                                updateSessionType(st.id!, { name: e.target.value })
                                            }
                                            className="flex-1"
                                        />
                                        <Select
                                            value={String(st.duration_minutes)}
                                            onValueChange={(v) =>
                                                updateSessionType(st.id!, {
                                                    duration_minutes: Number(v),
                                                })
                                            }
                                        >
                                            <SelectTrigger className="w-32">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {DURATIONS.map((m) => (
                                                    <SelectItem key={m} value={String(m)}>
                                                        {m} min
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <MyButton
                                            type="button"
                                            buttonType="text"
                                            scale="small"
                                            onClick={() => removeSessionType(st.id!)}
                                            aria-label="Remove this session type"
                                            title="Remove this session type"
                                        >
                                            <Trash size={16} className="text-danger-500" />
                                        </MyButton>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </MyDialog>
    );
}
