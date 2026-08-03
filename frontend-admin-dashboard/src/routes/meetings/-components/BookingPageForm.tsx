import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
    BellRinging,
    CalendarBlank,
    Info,
    ListChecks,
    MapPinLine,
    Plus,
    Trash,
} from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import SelectField from '@/components/design-system/select-field';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getUserId, getUserName } from '@/utils/userDetails';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    listTemplates,
    type WhatsAppTemplateDTO,
} from '@/routes/communication/whatsapp-templates/-services/template-api';
import { useCreateBookingPage, useUpdateBookingPage } from '../-hooks/use-meetings';
import {
    BookingFormField,
    BookingPageDTO,
    DayOfWeek,
    ReminderChannel,
    WeeklyWindow,
} from '../-types/meetings-types';
import { browserTimezone, COMMON_TIMEZONES } from '../-utils/meetings-utils';
import { PickedUser, UserSearchCombobox } from './user-search-combobox';

/**
 * Section header used to break the long booking-page form into clearly
 * labelled, scannable groups (Basics, Availability, Location, …). Purely
 * presentational — no effect on the fields rendered underneath it.
 */
const FormSection = ({
    icon: Icon,
    title,
    description,
    action,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}) => (
    <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-start gap-2">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary-500" />
                <div>
                    <h3 className="text-subtitle font-semibold text-neutral-800">{title}</h3>
                    {description && <p className="text-caption text-neutral-500">{description}</p>}
                </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
        {children}
    </div>
);

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

export /** Booking values an admin can map a WhatsApp template variable to. */
const BOOKING_FIELD_OPTIONS: { value: string; label: string }[] = [
    { value: 'invitee_name', label: "Invitee's name" },
    { value: 'meeting_datetime', label: 'Meeting date & time' },
    { value: 'meeting_date', label: 'Meeting date' },
    { value: 'meeting_time', label: 'Meeting time' },
    { value: 'meet_link', label: 'Google Meet / join link' },
    { value: 'host_name', label: "Host's name" },
    { value: 'meeting_title', label: 'Meeting title' },
    { value: 'duration_minutes', label: 'Duration (minutes)' },
];

// Template variables: prefer the template's semantic names, else parse {{n}} tokens.
const templateVars = (t?: WhatsAppTemplateDTO | null): string[] => {
    if (!t) return [];
    if (t.bodyVariableNames && t.bodyVariableNames.length) return t.bodyVariableNames;
    const found = new Set<string>();
    const re = /\{\{(\w+)\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t.bodyText || '')) !== null) if (m[1]) found.add(m[1]);
    return Array.from(found);
};

interface BookingPageFormProps {
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
    const [formFields, setFormFields] = useState<BookingFormField[]>(
        initialPage?.form_fields ?? []
    );
    const initialChannels = initialPage?.reminder_config?.channels;
    const [remindEmail, setRemindEmail] = useState(
        initialChannels ? initialChannels.includes('EMAIL') : true
    );
    const [remindWhatsapp, setRemindWhatsapp] = useState(
        initialChannels ? initialChannels.includes('WHATSAPP') : false
    );
    const [waTemplateName, setWaTemplateName] = useState(
        initialPage?.reminder_config?.whatsapp_template_name ?? ''
    );
    const [waVarMapping, setWaVarMapping] = useState<Record<string, string>>(
        initialPage?.reminder_config?.whatsapp_variable_mapping ?? {}
    );
    const waTemplatesQuery = useQuery({
        queryKey: ['wa-templates-booking', instituteId],
        queryFn: () => listTemplates(instituteId),
        enabled: !!instituteId && remindWhatsapp,
        staleTime: 60_000,
    });
    const waTemplates = (waTemplatesQuery.data ?? []).filter((t) => t.status === 'APPROVED');
    const selectedWaTemplate = waTemplates.find((t) => t.name === waTemplateName) ?? null;
    const waVars = templateVars(selectedWaTemplate);

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

    const genFieldId = (): string =>
        typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `q-${Math.floor(Math.random() * 1e9)}`;
    const addFormField = () =>
        setFormFields((prev) => [
            ...prev,
            { id: genFieldId(), label: '', field_type: 'text', required: false },
        ]);
    const updateFormField = (id: string, patch: Partial<BookingFormField>) =>
        setFormFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    const removeFormField = (id: string) =>
        setFormFields((prev) => prev.filter((f) => f.id !== id));

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
                ...(remindWhatsapp && waTemplateName
                    ? {
                          whatsapp_template_name: waTemplateName,
                          whatsapp_language_code: selectedWaTemplate?.language ?? 'en',
                          whatsapp_variable_mapping: waVars.reduce(
                              (acc, v) => {
                                  acc[v] = waVarMapping[v] ?? '';
                                  return acc;
                              },
                              {} as Record<string, string>
                          ),
                      }
                    : {}),
            },
            form_fields: formFields
                .filter((f) => f.label.trim())
                .map((f) => ({
                    id: f.id,
                    label: f.label.trim(),
                    field_type: f.field_type,
                    required: !!f.required,
                    ...(f.field_type === 'dropdown'
                        ? { options: (f.options ?? []).map((o) => o.trim()).filter(Boolean) }
                        : {}),
                })),
        };

        const callbacks = {
            onSuccess: (page: BookingPageDTO) => {
                toast.success(isEdit ? 'Booking page updated' : 'Booking page created');
                onSaved?.(page);
            },
            onError: () => {
                toast.error(
                    isEdit
                        ? 'Failed to update the booking page'
                        : 'Failed to create the booking page'
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
                <FormSection
                    icon={Info}
                    title="Basics"
                    description="The essentials people see when they book time with you."
                >
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
                        <p className="text-caption text-neutral-500">
                            Who runs this meeting and appears as the point of contact.
                        </p>
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
                </FormSection>

                <FormSection
                    icon={CalendarBlank}
                    title="Availability"
                    description="Choose which days and hours people can book, and how much lead time you need."
                >
                    {/* Weekly availability */}
                    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
                        <div>
                            <p className="text-body font-semibold text-neutral-600">
                                Weekly availability
                            </p>
                            <p className="text-caption text-neutral-500">
                                Tick the days you&apos;re free, then set your hours for each day.
                            </p>
                        </div>
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
                                                    setDayField(row.day, {
                                                        enabled: checked === true,
                                                    })
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
                                            <span className="text-caption text-neutral-500">
                                                to
                                            </span>
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

                    <div className="flex flex-col gap-1">
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
                        <p className="text-caption text-neutral-500">
                            Minimum notice keeps last-minute bookings out; booking horizon caps how
                            far ahead people can book.
                        </p>
                    </div>
                </FormSection>

                <FormSection
                    icon={MapPinLine}
                    title="Location & Booking Rules"
                    description="Decide how the meeting happens, and whether you need to approve bookings first."
                >
                    <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
                        <div>
                            <p className="text-body font-semibold text-neutral-600">
                                Allocate Google Meet
                            </p>
                            <p className="text-caption text-neutral-500">
                                Attach a Google Meet link to every booked meeting
                            </p>
                        </div>
                        <Switch
                            checked={allocateGoogleMeet}
                            onCheckedChange={setAllocateGoogleMeet}
                        />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
                        <div>
                            <p className="text-body font-semibold text-neutral-600">
                                Require approval
                            </p>
                            <p className="text-caption text-neutral-500">
                                New bookings stay pending until the host approves them
                            </p>
                        </div>
                        <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
                    </div>
                </FormSection>

                <FormSection
                    icon={BellRinging}
                    title="Reminders"
                    description="Notify invitees by email or WhatsApp before their meeting."
                >
                    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3">
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
                                    onCheckedChange={(checked) =>
                                        setRemindWhatsapp(checked === true)
                                    }
                                />
                                <span className="text-body text-neutral-600">WhatsApp</span>
                            </label>
                        </div>

                        {remindWhatsapp && (
                            <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                                <div className="flex flex-col gap-1.5">
                                    <Label>WhatsApp template</Label>
                                    <Select
                                        value={waTemplateName || 'NONE'}
                                        onValueChange={(v) =>
                                            setWaTemplateName(v === 'NONE' ? '' : v)
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose an approved template" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NONE">
                                                No template (won’t send WhatsApp)
                                            </SelectItem>
                                            {waTemplates.map((t) => (
                                                <SelectItem key={t.id} value={t.name}>
                                                    {t.name} ({t.language})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {waTemplatesQuery.isLoading && (
                                        <p className="text-caption text-neutral-500">
                                            Loading templates…
                                        </p>
                                    )}
                                    {!waTemplatesQuery.isLoading && waTemplates.length === 0 && (
                                        <p className="text-caption text-warning-600">
                                            No approved WhatsApp templates yet. Create and get one
                                            approved in Communication → WhatsApp Templates first.
                                        </p>
                                    )}
                                </div>

                                {selectedWaTemplate && (
                                    <div className="flex flex-col gap-2">
                                        {selectedWaTemplate.bodyText && (
                                            <p className="rounded bg-white p-2 text-caption text-neutral-600">
                                                {selectedWaTemplate.bodyText}
                                            </p>
                                        )}
                                        {waVars.length > 0 ? (
                                            <>
                                                <Label>Fill the template variables</Label>
                                                {waVars.map((v) => (
                                                    <div
                                                        key={v}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <span className="w-28 shrink-0 truncate text-caption font-medium text-neutral-600">
                                                            {`{{${v}}}`}
                                                        </span>
                                                        <Select
                                                            value={waVarMapping[v] || 'UNSET'}
                                                            onValueChange={(val) =>
                                                                setWaVarMapping((prev) => ({
                                                                    ...prev,
                                                                    [v]: val === 'UNSET' ? '' : val,
                                                                }))
                                                            }
                                                        >
                                                            <SelectTrigger className="flex-1">
                                                                <SelectValue placeholder="Map to…" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="UNSET">
                                                                    — not set —
                                                                </SelectItem>
                                                                {BOOKING_FIELD_OPTIONS.map((o) => (
                                                                    <SelectItem
                                                                        key={o.value}
                                                                        value={o.value}
                                                                    >
                                                                        {o.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                ))}
                                            </>
                                        ) : (
                                            <p className="text-caption text-neutral-500">
                                                This template has no variables — it will send as-is.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex flex-col gap-1">
                            <SelectField
                                label="Remind before meeting"
                                name="reminderOffset"
                                options={REMINDER_OFFSET_OPTIONS}
                                control={form.control}
                                className="w-full sm:w-full"
                            />
                            <p className="text-caption text-neutral-500">
                                Sends an extra reminder this long before the meeting starts, on top
                                of the booking-confirmation message.
                            </p>
                        </div>
                    </div>
                </FormSection>

                <FormSection
                    icon={ListChecks}
                    title="Form Questions"
                    description="Extra questions the invitee answers when booking, on top of name, email and phone."
                    action={
                        <MyButton
                            type="button"
                            buttonType="text"
                            scale="small"
                            onClick={addFormField}
                        >
                            <Plus size={14} /> Add question
                        </MyButton>
                    }
                >
                    <div className="rounded-lg border border-neutral-200 p-4">
                        {formFields.length === 0 ? (
                            <p className="text-caption text-neutral-400">
                                No custom questions yet.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {formFields.map((f) => (
                                    <div
                                        key={f.id}
                                        className="flex flex-col gap-2 rounded-md border border-neutral-100 p-3"
                                    >
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Input
                                                value={f.label}
                                                placeholder="Question (e.g. What do you want help with?)"
                                                onChange={(e) =>
                                                    updateFormField(f.id, { label: e.target.value })
                                                }
                                                className="min-w-0 flex-1"
                                            />
                                            <Select
                                                value={f.field_type}
                                                onValueChange={(v) =>
                                                    updateFormField(f.id, { field_type: v })
                                                }
                                            >
                                                <SelectTrigger className="w-36">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="text">Short text</SelectItem>
                                                    <SelectItem value="textarea">
                                                        Long text
                                                    </SelectItem>
                                                    <SelectItem value="dropdown">
                                                        Dropdown
                                                    </SelectItem>
                                                    <SelectItem value="number">Number</SelectItem>
                                                    <SelectItem value="email">Email</SelectItem>
                                                    <SelectItem value="phone">Phone</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <label className="flex items-center gap-1.5 text-caption text-neutral-600">
                                                <Switch
                                                    checked={!!f.required}
                                                    onCheckedChange={(v) =>
                                                        updateFormField(f.id, { required: v })
                                                    }
                                                />
                                                Required
                                            </label>
                                            <MyButton
                                                type="button"
                                                buttonType="text"
                                                scale="small"
                                                onClick={() => removeFormField(f.id)}
                                            >
                                                <Trash size={16} className="text-danger-500" />
                                            </MyButton>
                                        </div>
                                        {f.field_type === 'dropdown' && (
                                            <Input
                                                value={(f.options ?? []).join(', ')}
                                                placeholder="Options, comma-separated (e.g. Career, Interview, Resume)"
                                                onChange={(e) =>
                                                    updateFormField(f.id, {
                                                        options: e.target.value.split(','),
                                                    })
                                                }
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </FormSection>

                <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
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
                        {isSaving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Booking Page'}
                    </MyButton>
                </div>
            </form>
        </Form>
    );
};
