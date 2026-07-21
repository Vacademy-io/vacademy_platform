import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import SelectField from '@/components/design-system/select-field';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getUserId, getUserName } from '@/utils/userDetails';
import { useCreateBookingPage, useUpdateBookingPage } from '../-hooks/use-meetings';
import {
    BookingPageDTO,
    DayOfWeek,
    ReminderChannel,
    WeeklyWindow,
} from '../-types/meetings-types';
import { browserTimezone, COMMON_TIMEZONES } from '../-utils/meetings-utils';
import { PickedUser, UserSearchCombobox } from './user-search-combobox';

const WEEKDAYS: Array<{ day: DayOfWeek; label: string }> = [
    { day: 'MONDAY', label: 'Monday' },
    { day: 'TUESDAY', label: 'Tuesday' },
    { day: 'WEDNESDAY', label: 'Wednesday' },
    { day: 'THURSDAY', label: 'Thursday' },
    { day: 'FRIDAY', label: 'Friday' },
    { day: 'SATURDAY', label: 'Saturday' },
    { day: 'SUNDAY', label: 'Sunday' },
];

const DEFAULT_ENABLED_DAYS = new Set<DayOfWeek>([
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
]);

interface DayRow {
    day: DayOfWeek;
    enabled: boolean;
    start: string;
    end: string;
}

const DURATION_OPTIONS = [15, 30, 45, 60].map((minutes) => ({
    _id: minutes,
    value: String(minutes),
    label: `${minutes} minutes`,
}));

const MIN_NOTICE_OPTIONS = [
    { _id: 0, value: '0', label: 'No minimum notice' },
    { _id: 1, value: '1', label: '1 hour' },
    { _id: 2, value: '2', label: '2 hours' },
    { _id: 4, value: '4', label: '4 hours' },
    { _id: 12, value: '12', label: '12 hours' },
    { _id: 24, value: '24', label: '1 day' },
    { _id: 48, value: '48', label: '2 days' },
];

const REMINDER_OFFSET_OPTIONS = [
    { _id: 'none', value: 'none', label: 'No pre-meeting reminder' },
    { _id: 30, value: '30', label: '30 minutes before' },
    { _id: 60, value: '60', label: '1 hour before' },
    { _id: 1440, value: '1440', label: '1 day before' },
];

const NO_AUDIENCE_VALUE = '__NONE__';

const bookingPageSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    durationMinutes: z.string().min(1, 'Duration is required'),
    timezone: z.string().min(1, 'Timezone is required'),
    minNoticeHours: z.string(),
    horizonDays: z
        .string()
        .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) > 0), 'Enter a number of days'),
    reminderOffset: z.string(),
    audienceId: z.string().optional(),
});

type BookingPageFormValues = z.infer<typeof bookingPageSchema>;

const buildInitialDays = (windows: WeeklyWindow[] | undefined): DayRow[] =>
    WEEKDAYS.map(({ day }) => {
        const match = windows?.find((w) => w.day_of_week === day);
        return {
            day,
            enabled: windows ? !!match : DEFAULT_ENABLED_DAYS.has(day),
            start: match?.start_time ?? '10:00',
            end: match?.end_time ?? '17:00',
        };
    });

export interface BookingPageFormProps {
    instituteId: string;
    /** Present → edit mode (PUT); absent → create mode (POST). */
    initialPage?: BookingPageDTO;
    /** Locks the audience list (Booking Settings opened from a campaign card). */
    fixedAudienceId?: string;
    defaultTitle?: string;
    /** Optional audience choices for the standalone manager. */
    audienceOptions?: Array<{ id: string; label: string }>;
    onSaved?: (page: BookingPageDTO) => void;
    onCancel?: () => void;
}

export const BookingPageForm = ({
    instituteId,
    initialPage,
    fixedAudienceId,
    defaultTitle,
    audienceOptions,
    onSaved,
    onCancel,
}: BookingPageFormProps) => {
    const createPage = useCreateBookingPage();
    const updatePage = useUpdateBookingPage();
    const isEdit = !!initialPage?.id;
    const isSaving = createPage.isPending || updatePage.isPending;

    const currentUserId = getUserId();
    const currentUserName = getUserName();

    const [host, setHost] = useState<PickedUser[]>(() => {
        if (initialPage?.host_user_id) {
            return [
                {
                    id: initialPage.host_user_id,
                    fullName: initialPage.host_name || 'Selected host',
                    email: '',
                },
            ];
        }
        return currentUserId
            ? [{ id: currentUserId, fullName: currentUserName || 'Me', email: '' }]
            : [];
    });
    const [days, setDays] = useState<DayRow[]>(() =>
        buildInitialDays(initialPage?.availability?.weekly_windows)
    );
    const [allocateGoogleMeet, setAllocateGoogleMeet] = useState(
        initialPage?.allocate_google_meet ?? true
    );
    const [requireApproval, setRequireApproval] = useState(initialPage?.require_approval ?? false);
    const initialChannels = initialPage?.reminder_config?.channels;
    const [remindEmail, setRemindEmail] = useState(
        initialChannels ? initialChannels.includes('EMAIL') : true
    );
    const [remindWhatsapp, setRemindWhatsapp] = useState(
        initialChannels ? initialChannels.includes('WHATSAPP') : false
    );

    const timezoneOptions = useMemo(() => {
        const zones = new Set<string>(COMMON_TIMEZONES);
        zones.add(browserTimezone());
        if (initialPage?.timezone) zones.add(initialPage.timezone);
        return [...zones].map((zone) => ({ _id: zone, value: zone, label: zone }));
    }, [initialPage?.timezone]);

    const form = useForm<BookingPageFormValues>({
        resolver: zodResolver(bookingPageSchema),
        defaultValues: {
            title: initialPage?.title ?? defaultTitle ?? '',
            durationMinutes: String(initialPage?.duration_minutes ?? 30),
            timezone: initialPage?.timezone ?? browserTimezone(),
            minNoticeHours: String(
                initialPage?.min_notice_minutes != null
                    ? Math.round(initialPage.min_notice_minutes / 60)
                    : 2
            ),
            horizonDays: String(initialPage?.booking_horizon_days ?? 30),
            reminderOffset: initialPage?.reminder_config
                ? String(initialPage.reminder_config.before_meeting_offsets_minutes?.[0] ?? 'none')
                : '60',
            audienceId: initialPage?.audience_id ?? NO_AUDIENCE_VALUE,
        },
    });

    const setDayField = (day: DayOfWeek, patch: Partial<DayRow>) => {
        setDays((prev) => prev.map((row) => (row.day === day ? { ...row, ...patch } : row)));
    };

    const onSubmit = (values: BookingPageFormValues) => {
        const enabledDays = days.filter((d) => d.enabled);
        if (enabledDays.length === 0) {
            toast.error('Enable at least one day of weekly availability');
            return;
        }

        const channels: ReminderChannel[] = [];
        if (remindEmail) channels.push('EMAIL');
        if (remindWhatsapp) channels.push('WHATSAPP');

        // On UPDATE the backend treats '' as an explicit audience detach while
        // null/undefined leaves the audience unchanged — so "None" must map to
        // '' when editing, and stay omitted when creating.
        const pickedAudienceId =
            fixedAudienceId ??
            (values.audienceId && values.audienceId !== NO_AUDIENCE_VALUE
                ? values.audienceId
                : undefined);
        const audienceId = pickedAudienceId ?? (isEdit ? '' : undefined);

        const payload: BookingPageDTO = {
            institute_id: instituteId,
            audience_id: audienceId,
            host_user_id: host[0]?.id ?? currentUserId ?? undefined,
            title: values.title,
            duration_minutes: Number(values.durationMinutes),
            min_notice_minutes: Number(values.minNoticeHours) * 60,
            booking_horizon_days: values.horizonDays ? Number(values.horizonDays) : undefined,
            timezone: values.timezone,
            allocate_google_meet: allocateGoogleMeet,
            require_approval: requireApproval,
            availability: {
                weekly_windows: enabledDays.map((d) => ({
                    day_of_week: d.day,
                    start_time: d.start,
                    end_time: d.end,
                })),
            },
            reminder_config: {
                on_booking_confirmation: true,
                channels,
                before_meeting_offsets_minutes:
                    values.reminderOffset === 'none' ? [] : [Number(values.reminderOffset)],
            },
        };

        const callbacks = {
            onSuccess: (page: BookingPageDTO) => {
                toast.success(isEdit ? 'Booking page updated' : 'Booking page created');
                onSaved?.(page);
            },
            onError: () => {
                toast.error(
                    isEdit ? 'Failed to update the booking page' : 'Failed to create the booking page'
                );
            },
        };

        if (isEdit && initialPage?.id) {
            updatePage.mutate({ id: initialPage.id, instituteId, data: payload }, callbacks);
        } else {
            createPage.mutate(payload, callbacks);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <MyInput
                                    label="Title"
                                    required
                                    inputType="text"
                                    inputPlaceholder="e.g. Counselling Call"
                                    className="w-full sm:w-full"
                                    input={field.value}
                                    onChangeFunction={field.onChange}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex flex-col gap-1">
                    <Label className="text-subtitle font-regular">Host</Label>
                    <UserSearchCombobox
                        instituteId={instituteId}
                        value={host}
                        onChange={setHost}
                        mode="single"
                    />
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                    <SelectField
                        label="Duration"
                        name="durationMinutes"
                        options={DURATION_OPTIONS}
                        control={form.control}
                        required
                        className="w-full flex-1 sm:w-full"
                    />
                    <SelectField
                        label="Timezone"
                        name="timezone"
                        options={timezoneOptions}
                        control={form.control}
                        required
                        className="w-full flex-1 sm:w-full"
                    />
                </div>

                {!fixedAudienceId && audienceOptions && audienceOptions.length > 0 && (
                    <SelectField
                        label="Audience List (optional)"
                        name="audienceId"
                        options={[
                            { _id: NO_AUDIENCE_VALUE, value: NO_AUDIENCE_VALUE, label: 'None' },
                            ...audienceOptions.map((option) => ({
                                _id: option.id,
                                value: option.id,
                                label: option.label,
                            })),
                        ]}
                        control={form.control}
                        className="w-full sm:w-full"
                    />
                )}

                {/* Weekly availability */}
                <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
                    <p className="text-body font-semibold text-neutral-600">Weekly availability</p>
                    <div className="flex flex-col gap-2">
                        {days.map((row) => {
                            const meta = WEEKDAYS.find((w) => w.day === row.day)!;
                            return (
                                <div
                                    key={row.day}
                                    className="flex flex-wrap items-center gap-2 sm:gap-3"
                                >
                                    <label className="flex w-32 cursor-pointer items-center gap-2">
                                        <Checkbox
                                            checked={row.enabled}
                                            onCheckedChange={(checked) =>
                                                setDayField(row.day, { enabled: checked === true })
                                            }
                                        />
                                        <span className="text-body text-neutral-600">
                                            {meta.label}
                                        </span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="time"
                                            value={row.start}
                                            disabled={!row.enabled}
                                            onChange={(e) =>
                                                setDayField(row.day, { start: e.target.value })
                                            }
                                            className="h-9 w-28"
                                        />
                                        <span className="text-caption text-neutral-500">to</span>
                                        <Input
                                            type="time"
                                            value={row.end}
                                            disabled={!row.enabled}
                                            onChange={(e) =>
                                                setDayField(row.day, { end: e.target.value })
                                            }
                                            className="h-9 w-28"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                    <SelectField
                        label="Minimum notice"
                        name="minNoticeHours"
                        options={MIN_NOTICE_OPTIONS}
                        control={form.control}
                        className="w-full flex-1 sm:w-full"
                    />
                    <FormField
                        control={form.control}
                        name="horizonDays"
                        render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormControl>
                                    <MyInput
                                        label="Booking horizon (days)"
                                        inputType="number"
                                        inputPlaceholder="30"
                                        className="w-full sm:w-full"
                                        input={field.value}
                                        onChangeFunction={field.onChange}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
                    <div>
                        <p className="text-body font-semibold text-neutral-600">
                            Allocate Google Meet
                        </p>
                        <p className="text-caption text-neutral-500">
                            Attach a Google Meet link to every booked meeting
                        </p>
                    </div>
                    <Switch checked={allocateGoogleMeet} onCheckedChange={setAllocateGoogleMeet} />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
                    <div>
                        <p className="text-body font-semibold text-neutral-600">Require approval</p>
                        <p className="text-caption text-neutral-500">
                            New bookings stay pending until the host approves them
                        </p>
                    </div>
                    <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
                </div>

                {/* Reminders */}
                <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3">
                    <p className="text-body font-semibold text-neutral-600">Reminders</p>
                    <div className="flex flex-wrap items-center gap-4">
                        <label className="flex cursor-pointer items-center gap-2">
                            <Checkbox
                                checked={remindEmail}
                                onCheckedChange={(checked) => setRemindEmail(checked === true)}
                            />
                            <span className="text-body text-neutral-600">Email</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2">
                            <Checkbox
                                checked={remindWhatsapp}
                                onCheckedChange={(checked) => setRemindWhatsapp(checked === true)}
                            />
                            <span className="text-body text-neutral-600">WhatsApp</span>
                        </label>
                    </div>
                    <SelectField
                        label="Remind before meeting"
                        name="reminderOffset"
                        options={REMINDER_OFFSET_OPTIONS}
                        control={form.control}
                        className="w-full sm:w-full"
                    />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                    {onCancel && (
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="medium"
                            onClick={onCancel}
                            disable={isSaving}
                        >
                            Cancel
                        </MyButton>
                    )}
                    <MyButton type="submit" buttonType="primary" scale="medium" disable={isSaving}>
                        {isSaving
                            ? 'Saving...'
                            : isEdit
                              ? 'Save Changes'
                              : 'Create Booking Page'}
                    </MyButton>
                </div>
            </form>
        </Form>
    );
};
