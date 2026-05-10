import { useForm, Controller, FormProvider, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Separator } from '@radix-ui/react-separator';
import { MyButton } from '@/components/design-system/button';
import { MyRadioButton } from '@/components/design-system/radio';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { AccessType, InputType, StreamingPlatform } from '../../-constants/enums';
import { useStudyLibraryStore } from '@/stores/study-library/use-study-library-store';
import { useEffect, useState, useRef, useMemo } from 'react';
import { MyDropdown } from '@/components/common/students/enroll-manually/dropdownForPackageItems';
import { DropdownValueType } from '@/components/common/students/enroll-manually/dropdownTypesForPackageItems';
import { DropdownItemType } from '@/components/common/students/enroll-manually/dropdownTypesForPackageItems';
import { MyInput } from '@/components/design-system/input';
import { copyToClipboard } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-utils/helper';
import {
    Copy,
    DotsSixVertical,
    DownloadSimple,
    Plus,
    TrashSimple,
    XCircle,
} from '@phosphor-icons/react';
import QRCode from 'react-qr-code';
import { handleDownloadQRCode } from '@/routes/homework-creation/create-assessment/$assessmentId/$examtype/-utils/helper';
import { Checkbox } from '@/components/ui/checkbox';
import { addCustomFiledSchema, addParticipantsSchema } from '../-schema/schema';
import { fetchInstituteDefaultFields } from '@/services/custom-field-mappings';
import { getInstituteId as getInstId } from '@/constants/helper';
import { Sortable, SortableDragHandle, SortableItem } from '@/components/ui/sortable';
import { Switch } from '@/components/ui/switch';
import { MyDialog } from '@/components/design-system/dialog';
import SelectField from '@/components/design-system/select-field';
import { AddCustomFieldDialog as SharedAddCustomFieldDialog } from '@/components/common/custom-fields/AddCustomFieldDialog';
import { CustomFieldRenderer } from '@/components/common/custom-fields/CustomFieldRenderer';
import { FieldErrors } from 'react-hook-form';
import { transformFormToDTOStep2 } from '../../-constants/helper';
import { createLiveSessionStep2, createProviderMeeting } from '../-services/utils';
import { getSessionBySessionId } from '../../-services/utils';
import { useLiveSessionStore } from '../-store/sessionIdstore';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useSessionDetailsStore } from '../../-store/useSessionDetailsStore';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { LiveSessionParticipantsTab } from './LiveSessionParticipantsTab';
import { SectionCard } from './SectionCard';
import {
    LiveSessionPreviewDialog,
    type PreviewSessionRow,
    type PreviewRecurrenceBanner,
} from './LiveSessionPreviewDialog';
import {
    LockKey,
    UsersThree,
    Article,
    LinkSimple,
    BellRinging,
} from '@phosphor-icons/react';

import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';

const TimeOptions = [
    { label: '5 minutes before', value: '5m' },
    { label: '10 minutes before', value: '10m' },
    { label: '30 minutes before', value: '30m' },
    { label: '1 hour before', value: '1h' },
];

const formatZohoStartTime = (dateStr?: string, timeStr?: string) => {
    if (!dateStr || !timeStr) return '';

    const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;

    let timeParts = timeStr;
    if (timeStr.includes('T')) {
        const afterT = timeStr.split('T')[1];
        if (afterT) {
            timeParts = afterT.split('+')[0] || timeStr;
        }
    }

    const timePart = timeParts?.length === 5 ? `${timeParts}:00` : timeParts || '';

    return `${datePart}T${timePart}+05:30`;
};

export default function ScheduleStep2() {
    const { clearSessionId, clearStep1Data, clearBulkSessionIds } = useLiveSessionStore();
    const bulkSessionIds = useLiveSessionStore((state) => state.bulkSessionIds);
    const isBulkFlow = bulkSessionIds.length > 0;
    const { studyLibraryData } = useStudyLibraryStore();
    const [addCustomFieldDialog, setAddCustomFieldDialog] = useState<boolean>(false);
    const queryClient = useQueryClient();
    const [previewDialog, setPreviewDialog] = useState<boolean>(false);
    const [previewOpen, setPreviewOpen] = useState<boolean>(false);
    const { sessionId, step1Data } = useLiveSessionStore();
    const isEditState = useLiveSessionStore((state) => state.isEdit);
    const { sessionDetails } = useSessionDetailsStore();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const navigate = useNavigate();

    // Get the institute details at component level
    const { instituteDetails } = useInstituteDetailsStore();

    /**
     * This ref helps us ensure that the heavy edit-mode form pre-population
     * logic executes only ONCE. Without this, `form.setValue` & `setCurrentSession`
     * could run on every re-render if any object reference in `sessionDetails` or
     * `instituteDetails` changes (even when the actual data is identical), leading
     * to an infinite render-refresh cycle in dev (observed as the app “refreshing
     * again and again”).
     */
    const hasInitialisedEditState = useRef(false);

    useEffect(() => {
        // Allow either a single sessionId (normal flow) or a list of bulk
        // sessionIds. Without either we can't link participants to anything.
        if (!sessionId && bulkSessionIds.length === 0) {
            navigate({ to: '/study-library/live-session' });
        }
    }, [sessionId, bulkSessionIds.length, navigate]);

    useEffect(() => {
        if (sessionDetails && !hasInitialisedEditState.current) {
            form.setValue(
                'accessType',
                sessionDetails?.schedule?.access_type === 'public'
                    ? AccessType.PUBLIC
                    : AccessType.PRIVATE
            );
            const defaultNotifySettings = {
                onCreate: false,
                onEdit: false,
                beforeLive: false,
                beforeLiveTime: [] as { time: string }[],
                onLive: false,
                onAttendance: false,
            };

            let mail = false;
            let whatsapp = false;

            sessionDetails?.notifications?.addedNotificationActions.forEach((action) => {
                const { type, notify, notifyBy, time } = action;

                if (type === 'ON_CREATE') {
                    defaultNotifySettings.onCreate = notify;
                } else if (type === 'ON_LIVE') {
                    defaultNotifySettings.onLive = notify;
                } else if (type === 'BEFORE_LIVE') {
                    defaultNotifySettings.beforeLive = notify;
                    if (time) {
                        defaultNotifySettings.beforeLiveTime = [{ time }];
                    }
                }

                // Merge mail & whatsapp flags
                mail = mail || notifyBy.mail;
                whatsapp = whatsapp || notifyBy.whatsapp;
            });

            form.setValue('notifySettings', defaultNotifySettings);

            // ------------------------------------------------------------------
            // NEW: Pre-populate selected levels (batches) when editing classes (both PRIVATE and PUBLIC)
            // ------------------------------------------------------------------
            if (instituteDetails && sessionDetails.schedule.package_session_ids?.length > 0) {
                const selectedLevelsFromPackages = sessionDetails.schedule.package_session_ids
                    .map((pkgId) => {
                        const batch = instituteDetails.batches_for_sessions.find(
                            (b) => b.id === pkgId
                        );
                        if (!batch) return null;
                        return {
                            courseId: batch.package_dto.id,
                            sessionId: batch.session.id,
                            levelId: batch.level.id,
                        };
                    })
                    .filter(Boolean) as {
                        courseId: string;
                        sessionId: string;
                        levelId: string;
                    }[];

                if (selectedLevelsFromPackages.length) {
                    form.setValue('selectedLevels', selectedLevelsFromPackages);

                    // Also set the currentSession dropdown so that UI immediately shows relevant levels
                    const firstSessionId = selectedLevelsFromPackages[0]!.sessionId;
                    const matchingSession = sessionList.find((s) => s.id === firstSessionId);
                    if (matchingSession) {
                        setCurrentSession(matchingSession);
                    }
                }
            }

            // Mark initialisation done so this block never runs again
            hasInitialisedEditState.current = true;
        }
    }, [sessionDetails, instituteDetails]);

    // Prepare session data first
    const sessionList: DropdownItemType[] = useMemo(
        () =>
            Array.from(
                new Map(
                    (
                        studyLibraryData?.flatMap((item) =>
                            item.sessions.map((session) => ({
                                name: session.session_dto.session_name,
                                id: session.session_dto.id,
                            }))
                        ) ?? []
                    ).map((item) => [item.id, item])
                ).values()
            ),
        [studyLibraryData]
    );

    const courses = useMemo(
        () =>
            studyLibraryData?.flatMap((item) =>
                item.sessions.map((session) => ({
                    courseName: item.course.package_name,
                    courseId: item.course.id,
                    sessionId: session.session_dto.id,
                    levels: session.level_with_details.map((level) => ({
                        name: level.name,
                        id: level.id,
                    })),
                }))
            ),
        [studyLibraryData]
    );

    // Initialize form with default values
    const form = useForm<z.infer<typeof addParticipantsSchema>>({
        resolver: zodResolver(addParticipantsSchema),
        defaultValues: {
            accessType:
                sessionDetails?.schedule?.access_type === 'private'
                    ? AccessType.PRIVATE
                    : AccessType.PUBLIC,
            batchSelectionType: 'batch',
            selectedLevels: [],
            selectedLearners: [],
            joinLink: '',
            notifyBy: {
                mail: false,
                whatsapp: false,
                push_notification: false,
                system_notification: false,
            },
            notifySettings: {
                onCreate: false,
                onEdit: false,
                beforeLive: false,
                beforeLiveTime: [],
                onLive: true,
                onAttendance: false,
            },
            fields: [],
        },
    });

    // Set up current session
    const [currentSession, setCurrentSession] = useState<DropdownItemType | undefined>(() =>
        sessionList.length > 0 ? sessionList[0] : undefined
    );

    // Update form when session details are available
    useEffect(() => {
        if (!sessionDetails || !instituteDetails) return;

        // Set access type
        form.setValue(
            'accessType',
            sessionDetails.schedule.access_type === 'public'
                ? AccessType.PUBLIC
                : AccessType.PRIVATE
        );

        // Set notification settings
        const defaultNotifySettings = {
            onCreate: false,
            onEdit: false,
            beforeLive: false,
            beforeLiveTime: [] as { time: string }[],
            onLive: false,
            onAttendance: false,
        };

        let mail = false;
        let whatsapp = false;
        let push_notification = false;
        let system_notification = false;

        sessionDetails.notifications?.addedNotificationActions.forEach((action) => {
            const { type, notify, notifyBy, time } = action;

            if (type === 'ON_CREATE') {
                defaultNotifySettings.onCreate = notify;
            } else if (type === 'ON_LIVE') {
                defaultNotifySettings.onLive = notify;
            } else if (type === 'BEFORE_LIVE') {
                defaultNotifySettings.beforeLive = notify;
                if (time) {
                    defaultNotifySettings.beforeLiveTime = [{ time }];
                }
            } else if (type === 'ATTENDANCE') {
                defaultNotifySettings.onAttendance = notify;
            }

            // Merge channel flags
            mail = mail || notifyBy.mail;
            whatsapp = whatsapp || notifyBy.whatsapp;
            push_notification = push_notification || (notifyBy as any).push_notification || false;
            system_notification = system_notification || (notifyBy as any).system_notification || false;
        });

        form.setValue('notifySettings', defaultNotifySettings);
        form.setValue('notifyBy', { mail, whatsapp, push_notification, system_notification });

        // Load previously selected levels for both PRIVATE and PUBLIC sessions
        if (
            sessionDetails.schedule.package_session_ids &&
            sessionDetails.schedule.package_session_ids.length > 0
        ) {
            // Initialize array for selected levels
            const selectedLevels: { courseId: string; sessionId: string; levelId: string }[] = [];

            // Process each package_session_id
            sessionDetails.schedule.package_session_ids.forEach((packageSessionId) => {
                // Find the matching batch in institute details
                const matchingBatch = instituteDetails.batches_for_sessions.find(
                    (batch) => batch.id === packageSessionId
                );

                if (matchingBatch) {
                    selectedLevels.push({
                        courseId: matchingBatch.package_dto.id,
                        sessionId: matchingBatch.session.id,
                        levelId: matchingBatch.level.id,
                    });
                }
            });

            // Set the selected levels in the form
            if (selectedLevels.length > 0) {
                form.setValue('selectedLevels', selectedLevels);

                // If we have any selections, set the current session to match the first selected level
                const firstSelectedLevel = selectedLevels[0];
                const matchingSession = sessionList.find(
                    (session) => session.id === firstSelectedLevel?.sessionId
                );
                if (matchingSession) {
                    setCurrentSession(matchingSession);
                }
            }
        }
    }, [sessionDetails, instituteDetails, sessionList, form]);

    const addCustomFieldform = useForm<z.infer<typeof addCustomFiledSchema>>({
        resolver: zodResolver(addCustomFiledSchema),
        defaultValues: {
            fieldType: 'text',
            options: [],
        },
    });

    const {
        control: customControl,
        watch: customWatch,
        register,
        handleSubmit: handleCustomSubmit,
    } = addCustomFieldform;

    const filedType = customWatch('fieldType');
    const {
        fields: customOptionsFields,
        move: customMove,
        append: customAppend,
    } = useFieldArray({
        control: customControl,
        name: 'options',
    });

    const { control, handleSubmit, watch, getValues } = form;
    const { fields, move, append, remove } = useFieldArray({
        control,
        name: 'fields',
    });

    const accessType = watch('accessType');
    const rawPortalUrl = instituteDetails?.learner_portal_base_url;
    const learnerBaseUrl = rawPortalUrl
        ? (rawPortalUrl.startsWith('http') ? rawPortalUrl : `https://${rawPortalUrl}`)
        : BASE_URL_LEARNER_DASHBOARD;
    useEffect(() => {
        if (isEditState) {
            if (accessType === AccessType.PUBLIC) {
                const SEEDED_LABELS = ['full name', 'email', 'phone number', 'mobile number'];
                const fields =
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    sessionDetails?.notifications?.addedFields.map((field: any) => ({
                        id: field.id,
                        label: field.label,
                        required: field.required,
                        isDefault: SEEDED_LABELS.includes((field.label || '').toLowerCase()),
                        type: field.type,
                    })) ?? [];

                form.setValue('fields', fields);
                form.setValue(
                    'joinLink',
                    `${learnerBaseUrl}/register/live-class?sessionId=${sessionId}`
                );
            } else {
                form.setValue('fields', []);
                form.setValue('joinLink', `${learnerBaseUrl}/study-library/live-class`);
            }
            return;
        }
        if (accessType === AccessType.PUBLIC) {
            form.setValue('fields', []);
            form.setValue(
                'joinLink',
                `${learnerBaseUrl}/register/live-class?sessionId=${sessionId}`
            );

            const SEEDED = ['full name', 'email', 'phone number', 'mobile number'];
            const loadFields = async () => {
                const instId = getInstId();
                if (!instId) return;
                const defaults = await fetchInstituteDefaultFields(instId);
                if (defaults && defaults.length > 0) {
                    const allFields = defaults.map((entry) => {
                        const cf = entry.custom_field;
                        const nameLC = cf.fieldName.toLowerCase();
                        // Multi-input revamp: forward the real field type so the
                        // form schema / learner registration renders date pickers,
                        // file upload, checkboxes, etc. Options are parsed for
                        // both dropdown and radio.
                        const rawType = (cf.fieldType || 'text').toLowerCase();
                        const resolvedType = (rawType === 'textfield' ? 'text' : rawType) as InputType;
                        const hasOptions =
                            resolvedType === InputType.DROPDOWN || resolvedType === InputType.RADIO;
                        return {
                            label: cf.fieldName,
                            required: cf.isMandatory || SEEDED.includes(nameLC),
                            isDefault: SEEDED.includes(nameLC),
                            type: resolvedType,
                            ...(hasOptions && cf.config ? (() => {
                                try {
                                    const parsed = JSON.parse(cf.config);
                                    if (Array.isArray(parsed)) {
                                        return { options: parsed.map((o: any) => ({ label: o.value || o.label, name: o.value || o.name })) };
                                    }
                                    // New object-format config: { options: [...], defaultValue, ... }
                                    if (Array.isArray(parsed?.options)) {
                                        return { options: parsed.options.map((o: any) => ({ label: o.value || o.label, name: o.value || o.name })) };
                                    }
                                    if (parsed.coommaSepartedOptions) {
                                        return { options: parsed.coommaSepartedOptions.split(',').map((v: string) => ({ label: v.trim(), name: v.trim() })) };
                                    }
                                } catch { /* ignore */ }
                                return {};
                            })() : {}),
                        };
                    });
                    form.setValue('fields', allFields);
                }
            };
            loadFields();
        } else {
            form.setValue('fields', []);
            form.setValue('joinLink', `${learnerBaseUrl}/study-library/live-class`);
        }
    }, [accessType, learnerBaseUrl]);
    const {
        fields: beforeLiveFields,
        append: beforeLiveAppend,
        remove: beforeLiveRemove,
    } = useFieldArray({
        control,
        name: 'notifySettings.beforeLiveTime',
    });

    const handleSessionChange = (value: DropdownValueType) => {
        if (value && typeof value === 'object' && 'id' in value && 'name' in value) {
            setCurrentSession(value as DropdownItemType);
        }
    };

    const onSubmitClick = async (data: z.infer<typeof addParticipantsSchema>) => {
        if (isSubmitting) return; // Prevent multiple submissions

        setIsSubmitting(true);
        try {
            const packageSessionIds = data.selectedLevels.map((level) => {
                if (!instituteDetails) return '';

                const matchingBatch = instituteDetails.batches_for_sessions.find(
                    (batch) =>
                        batch.package_dto.id === level.courseId &&
                        batch.session.id === level.sessionId &&
                        batch.level.id === level.levelId
                );

                return matchingBatch?.id || '';
            });

            // In bulk flow we fan out the same access/notification payload to
            // every session created in step 1. Failures are tolerated per row
            // so the user gets partial success feedback.
            const targetSessionIds = isBulkFlow ? bulkSessionIds : [sessionId];
            const fanOutResults: { id: string; ok: boolean; error?: unknown }[] = [];

            for (const targetId of targetSessionIds) {
                try {
                    const body = transformFormToDTOStep2(data, targetId, packageSessionIds);
                    await createLiveSessionStep2(body);
                    fanOutResults.push({ id: targetId, ok: true });
                } catch (err) {
                    console.error(`Step 2 failed for sessionId=${targetId}`, err);
                    fanOutResults.push({ id: targetId, ok: false, error: err });
                }
            }

            const okCount = fanOutResults.filter((r) => r.ok).length;
            const failCount = fanOutResults.length - okCount;

            if (isBulkFlow) {
                if (okCount > 0 && failCount === 0) {
                    toast.success(
                        `Participants & access applied to ${okCount} ${getTerminology(
                            ContentTerms.LiveSession,
                            SystemTerms.LiveSession
                        )}${okCount === 1 ? '' : 's'}.`
                    );
                } else if (okCount > 0 && failCount > 0) {
                    toast.error(
                        `Applied to ${okCount} session${okCount === 1 ? '' : 's'}, but ${failCount} failed. Check console for details.`
                    );
                } else {
                    throw new Error('All bulk step 2 calls failed');
                }
            } else {
                toast.success(
                    `${getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession)} created successfully!`
                );
            }

            // Handle potential Zoho meeting creation
            // Skipped in bulk flow because per-row platforms/timings vary and
            // the Zoho meeting creation is keyed off step1Data which is only
            // representative in bulk mode.
            if (!isBulkFlow && step1Data?.sessionPlatform === StreamingPlatform.ZOHO && instituteDetails?.id) {
                try {
                    const sessionDetailsPayload = await getSessionBySessionId(sessionId);
                    const schedules = sessionDetailsPayload?.schedule?.added_schedules || [];

                    for (const schedule of schedules) {
                        try {
                            const durationMinutes = Number(schedule.duration) ||
                                (Number(step1Data.durationHours) * 60 + Number(step1Data.durationMinutes));

                            const sessionStartDate = schedule.meetingDate || schedule.meeting_date || (step1Data as any)?.startDate || new Date().toISOString().split('T')[0];
                            const formattedStartTime = formatZohoStartTime(sessionStartDate, schedule.startTime || schedule.start_time);

                            await createProviderMeeting({
                                instituteId: instituteDetails.id,
                                sessionId: sessionId,
                                scheduleId: schedule.id,
                                topic: step1Data.title || sessionDetailsPayload?.schedule?.title || 'Live Class',
                                agenda: step1Data.description || 'Live Subject Class',
                                startTime: formattedStartTime,
                                durationMinutes: durationMinutes > 0 ? durationMinutes : 30,
                                timezone: step1Data.timeZone || sessionDetailsPayload?.schedule?.timezone || 'Asia/Kolkata',
                                provider: 'ZOHO_MEETING'
                            });
                        } catch (err) {
                            console.error(`Error creating Zoho meeting for schedule ${schedule.id}:`, err);
                        }
                    }
                } catch (err) {
                    console.error('Error fetching session details to create Zoho meeting:', err);
                }
            }

            await queryClient.invalidateQueries({ queryKey: ['liveSessions'] });
            await queryClient.invalidateQueries({ queryKey: ['upcomingSessions'] });
            await queryClient.invalidateQueries({ queryKey: ['pastSessions'] });
            await queryClient.invalidateQueries({ queryKey: ['draftSessions'] });
            clearSessionId();
            clearStep1Data();
            clearBulkSessionIds();
            navigate({ to: '/study-library/live-session' });
        } catch (error) {
            console.error('Error submitting form:', error);

            // Show error toast
            toast.error('Failed to create live session. Please try again.', {
                icon: <XCircle size={20} className="text-red-500" />,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const onCustomSubmit = (data: z.infer<typeof addCustomFiledSchema>) => {
        append({
            label: data.fieldName,
            isDefault: false,
            required: true,
            type: data.options.length > 0 ? InputType.DROPDOWN : InputType.TEXT,
            options:
                data.fieldType === 'dropdown'
                    ? data.options.map((option) => ({
                        name: option.optionField,
                        label: option.optionField,
                    }))
                    : [],
        });
        setAddCustomFieldDialog(false);
    };

    const onError = (errors: FieldErrors<typeof addParticipantsSchema>) => {
        console.log('Validation errors:', errors);

        // Show validation error toast
        toast.error('Please fix the validation errors and try again.', {
            icon: <XCircle size={20} className="text-red-500" />,
        });
    };

    const previewSelectedLevels = watch('selectedLevels');
    const isWeeklyRecurring =
        (step1Data?.meetingType as string | undefined) === 'weekly' &&
        !!step1Data?.recurringSchedule?.length;
    const dayShort: Record<string, string> = {
        monday: 'Mon',
        tuesday: 'Tue',
        wednesday: 'Wed',
        thursday: 'Thu',
        friday: 'Fri',
        saturday: 'Sat',
        sunday: 'Sun',
    };
    const recurrenceUntilLabel = step1Data?.endDate
        ? (() => {
              try {
                  return new Date(step1Data.endDate).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                  });
              } catch {
                  return step1Data.endDate;
              }
          })()
        : undefined;

    let previewSessions: PreviewSessionRow[] = [];
    let previewRecurrenceBanner: PreviewRecurrenceBanner | undefined;

    if (isWeeklyRecurring && step1Data?.recurringSchedule) {
        const selectedDays: string[] = [];
        const rows: PreviewSessionRow[] = [];
        for (const day of step1Data.recurringSchedule) {
            if (!day?.isSelect) continue;
            const dayName = dayShort[day.day] ?? day.day;
            selectedDays.push(dayName);
            for (const s of day.sessions ?? []) {
                rows.push({
                    title: day.default_class_name?.trim() || step1Data?.title,
                    subject: step1Data?.subject,
                    whenLabel: dayName,
                    whenSubLabel: s.startTime || '—',
                    durationHours: s.durationHours ?? step1Data?.durationHours,
                    durationMinutes: s.durationMinutes ?? step1Data?.durationMinutes,
                    link: s.link || day.default_class_link || step1Data?.defaultLink,
                    platform: step1Data?.sessionPlatform,
                    selectedLevels: previewSelectedLevels,
                });
            }
        }
        if (rows.length > 0) {
            previewSessions = rows;
            previewRecurrenceBanner = {
                pattern: 'Recurring weekly',
                days: selectedDays,
                until: recurrenceUntilLabel ? `Until ${recurrenceUntilLabel}` : undefined,
                totalLabel: `${rows.length} slot${rows.length === 1 ? '' : 's'}/week`,
            };
        }
    }

    if (previewSessions.length === 0) {
        const rawStartTime = step1Data?.startTime ?? '';
        const [datePart, timePart] = rawStartTime.includes('T')
            ? rawStartTime.split('T')
            : ['', rawStartTime];
        previewSessions = [
            {
                title: step1Data?.title,
                subject: step1Data?.subject,
                startDate: datePart,
                startTime: timePart,
                durationHours: step1Data?.durationHours,
                durationMinutes: step1Data?.durationMinutes,
                link: step1Data?.defaultLink,
                platform: step1Data?.sessionPlatform,
                selectedLevels: previewSelectedLevels,
            },
        ];
    }

    return (
        <>
            <FormProvider {...form}>
                <form
                    onSubmit={handleSubmit(() => setPreviewOpen(true), onError)}
                    className="flex flex-col gap-5"
                >
                    <div className="sticky top-0 z-[9] -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3 sm:-mx-0 sm:px-0">
                        <div className="flex items-center gap-3">
                            <MyButton
                                type="button"
                                scale="large"
                                buttonType="secondary"
                                onClick={() =>
                                    navigate({ to: '/study-library/live-session/schedule/step1' })
                                }
                            >
                                Back
                            </MyButton>
                            <div>
                                <h1 className="text-lg font-semibold text-neutral-800">
                                    Participants & Access
                                </h1>
                                <p className="text-xs text-neutral-500">
                                    Choose who can join and how they get notified.
                                </p>
                            </div>
                        </div>
                        <MyButton
                            type="button"
                            scale="large"
                            buttonType="primary"
                            disable={isSubmitting}
                            onClick={handleSubmit(
                                () => setPreviewOpen(true),
                                onError
                            )}
                        >
                            {isSubmitting ? (
                                <Loader2 className="animate-spin text-white" />
                            ) : (
                                'Preview & create'
                            )}
                        </MyButton>
                    </div>

                    {isBulkFlow && (
                        <div className="flex items-start gap-2 rounded-md border border-primary-200 bg-primary-50/60 px-3 py-2 text-sm text-neutral-700">
                            <span className="font-medium">
                                Bulk mode:
                            </span>
                            <span>
                                These access & notification settings will be applied to all{' '}
                                {bulkSessionIds.length} sessions you just created.
                            </span>
                        </div>
                    )}

                    <SectionCard
                        icon={<LockKey size={18} />}
                        title="Participant Access"
                        description="Who can join this class — restricted to selected learners or open via a shared link."
                    >
                        <div className="flex flex-col gap-4 font-medium">
                            {isEditState && (
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <div className="font-bold">{accessType} : </div>
                                    {accessType === AccessType.PRIVATE ? (
                                        <div>
                                            Restrict the class to specific participants by
                                            assigning it to institute batches or selecting
                                            individual learners.
                                        </div>
                                    ) : (
                                        <div>
                                            Allow anyone to join this class via a shared link.
                                        </div>
                                    )}
                                </div>
                            )}
                            {!isEditState && (
                                <FormField
                                    control={control}
                                    name="accessType"
                                    render={({ field }) => (
                                        <MyRadioButton
                                            name="meetingType"
                                            value={field.value ?? ''}
                                            onChange={field.onChange}
                                            disabled={isEditState}
                                            options={[
                                                {
                                                    label: (
                                                        <div className="flex flex-row gap-1">
                                                            <div className="font-bold">
                                                                Private Class:
                                                            </div>
                                                            Restrict the class to specific
                                                            participants by assigning it to
                                                            institute batches or selecting
                                                            individual learners.
                                                        </div>
                                                    ),
                                                    value: AccessType.PRIVATE,
                                                },
                                                {
                                                    label: (
                                                        <div className="flex flex-row gap-1">
                                                            <div className="font-bold">
                                                                Public Class:
                                                            </div>
                                                            Allow anyone to join this class via a
                                                            shared link.
                                                        </div>
                                                    ),
                                                    value: AccessType.PUBLIC,
                                                },
                                            ]}
                                            className="flex flex-col gap-4"
                                        />
                                    )}
                                />
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard
                        icon={<UsersThree size={18} />}
                        title="Select Participants"
                        description="Pick a session, then choose batches or individual learners to enroll."
                    >
                        <div className="flex flex-col gap-4">
                            <div className="w-full sm:max-w-[280px]">
                                <MyDropdown
                                    currentValue={currentSession ?? undefined}
                                    dropdownList={sessionList}
                                    placeholder={`Select ${getTerminology(ContentTerms.Session, SystemTerms.Session)}`}
                                    handleChange={handleSessionChange}
                                />
                            </div>
                            <LiveSessionParticipantsTab
                                form={form}
                                courses={courses}
                                currentSession={currentSession}
                            />
                        </div>
                    </SectionCard>

                    {/* Registration Form Fields - Only for Public classes */}
                    {accessType === AccessType.PUBLIC && (
                        <SectionCard
                            icon={<Article size={18} />}
                            title="Registration Form"
                            description="Fields shown to learners on the public registration form. Drag to reorder."
                        >
                            <div className="flex flex-col gap-3">
                                <Sortable
                                    value={fields}
                                    onMove={({ activeIndex, overIndex }) =>
                                        move(activeIndex, overIndex)
                                    }
                                >
                                    {fields.map((field, index) => (
                                        <SortableItem key={field.id} value={field.id} asChild>
                                            <SortableItem key={field.id} value={field.id} asChild>
                                                <div className="flex flex-col gap-3 rounded p-3 sm:flex-row sm:items-center sm:gap-6">
                                                    <div className="flex w-full items-center justify-between rounded-md border bg-neutral-50 p-2 shadow sm:w-3/4">
                                                        {field.isDefault ? (
                                                            <div className="w-full text-neutral-600">
                                                                {field.label}
                                                            </div>
                                                        ) : (
                                                            <Controller
                                                                control={control}
                                                                name={`fields.${index}.label`}
                                                                render={({ field }) => (
                                                                    <input
                                                                        {...field}
                                                                        className="w-full border-none bg-transparent outline-none"
                                                                        placeholder="Enter label"
                                                                    />
                                                                )}
                                                            />
                                                        )}
                                                        {!field.isDefault && (
                                                            <div
                                                                className="mr-2 cursor-pointer rounded border-2 p-1 text-red-300"
                                                                onClick={() => remove(index)}
                                                            >
                                                                <TrashSimple />
                                                            </div>
                                                        )}
                                                        <SortableDragHandle className="cursor-grab border-none shadow-none">
                                                            <DotsSixVertical />
                                                        </SortableDragHandle>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <Controller
                                                            control={control}
                                                            name={`fields.${index}.required`}
                                                            render={({ field }) => (
                                                                <label className="flex items-center gap-2">
                                                                    <span className="text-sm">
                                                                        Required
                                                                    </span>
                                                                    <Switch
                                                                        checked={field.value}
                                                                        onCheckedChange={
                                                                            field.onChange
                                                                        }
                                                                    />
                                                                </label>
                                                            )}
                                                        />
                                                    </div>
                                                </div>
                                            </SortableItem>
                                        </SortableItem>
                                    ))}
                                </Sortable>

                                {/* adding customs fields and new registration form options */}
                                <div className="flex flex-col gap-4 p-3 sm:flex-row">
                                    <SharedAddCustomFieldDialog
                                        trigger={
                                            <MyButton
                                                buttonType="secondary"
                                                type="button"
                                                className="w-full sm:w-auto"
                                            >
                                                <Plus></Plus> Add Custom Field
                                            </MyButton>
                                        }
                                        onAddField={(type, name, _oldKey, options) => {
                                            // Multi-input revamp (2026-04): forward the actual
                                            // field type instead of collapsing to TEXT/DROPDOWN so
                                            // the learner-facing live session registration form
                                            // can render date pickers, file upload, checkboxes,
                                            // etc. InputType was broadened to include all 11 types.
                                            const normalized = (type || 'text').toLowerCase();
                                            const resolvedType =
                                                normalized === 'textfield'
                                                    ? InputType.TEXT
                                                    : (normalized as InputType);
                                            const hasOptions =
                                                (resolvedType === InputType.DROPDOWN ||
                                                    resolvedType === InputType.RADIO) &&
                                                !!options;
                                            append({
                                                label: name,
                                                isDefault: false,
                                                required: true,
                                                type: resolvedType,
                                                options: hasOptions
                                                    ? options!.map((opt) => ({
                                                          name: opt.value,
                                                          label: opt.value,
                                                      }))
                                                    : [],
                                            });
                                        }}
                                        existingFieldNames={fields
                                            .filter((f) => (f as any).status !== 'DELETED')
                                            .map((f) => f.label)}
                                    />
                                    <MyButton
                                        buttonType="secondary"
                                        type="button"
                                        onClick={() => {
                                            setPreviewDialog(true);
                                        }}
                                        className="w-full sm:w-auto"
                                    >
                                        Preview Registration Form
                                    </MyButton>
                                </div>
                            </div>
                        </SectionCard>
                    )}

                    <SectionCard
                        icon={<LinkSimple size={18} />}
                        title="Join Link"
                        description="Share this link or QR code with learners — it's auto-generated and read-only."
                    >
                        <div
                            className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10"
                            id="join-link-qr-code"
                        >
                            <div className="flex flex-1 flex-col gap-2">
                                <div className="text-xs font-medium text-neutral-500">
                                    Share link
                                </div>
                                <div className="flex w-full items-center gap-2">
                                    <FormField
                                        control={control}
                                        name="joinLink"
                                        render={({ field: { ...field } }) => (
                                            <FormItem className="w-full">
                                                <FormControl>
                                                    <MyInput
                                                        inputType="text"
                                                        inputPlaceholder="Join Link"
                                                        input={field.value}
                                                        onChangeFunction={field.onChange}
                                                        error={
                                                            form.formState.errors.joinLink?.message
                                                        }
                                                        readOnly
                                                        size="large"
                                                        className="!w-full min-w-0"
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <MyButton
                                        type="button"
                                        scale="small"
                                        buttonType="secondary"
                                        className="h-10 min-w-10 shrink-0"
                                        onClick={() => copyToClipboard(getValues('joinLink'))}
                                    >
                                        <Copy size={20} />
                                    </MyButton>
                                </div>
                            </div>
                            <div className="flex flex-col items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                                <div className="text-xs font-medium text-neutral-500">QR Code</div>
                                <div className="flex items-center gap-3">
                                    <FormField
                                        control={control}
                                        name="joinLink"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <QRCode
                                                        value={field.value ?? ''}
                                                        className="size-20 rounded bg-white p-1"
                                                        id="qr-code-svg"
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <MyButton
                                        type="button"
                                        scale="small"
                                        buttonType="secondary"
                                        className="h-9"
                                        onClick={() => handleDownloadQRCode('qr-code-svg')}
                                    >
                                        <DownloadSimple size={16} />
                                        <span className="ml-1 text-xs">Download</span>
                                    </MyButton>
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard
                        icon={<BellRinging size={18} />}
                        title="Notifications"
                        description="Choose channels and the moments when participants get notified."
                    >
                        <div className="flex flex-col gap-5">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                    Channels
                                </div>
                                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            <FormField
                                control={control}
                                name={`notifyBy.mail`}
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                className={`size-4 rounded-sm border-2 shadow-none ${field.value
                                                    ? 'border-none bg-primary-500 text-white'
                                                    : ''
                                                    }`}
                                            />
                                        </FormControl>
                                        <FormLabel className="!m-0 text-sm font-normal">
                                            Notify Via Email
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name={`notifyBy.whatsapp`}
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                className={`size-4 rounded-sm border-2 shadow-none ${field.value
                                                    ? 'border-none bg-primary-500 text-white'
                                                    : ''
                                                    }`}
                                            />
                                        </FormControl>
                                        <FormLabel className="!m-0 text-sm font-normal">
                                            Notify Via WhatsApp
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name={`notifyBy.push_notification`}
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                className={`size-4 rounded-sm border-2 shadow-none ${field.value
                                                    ? 'border-none bg-primary-500 text-white'
                                                    : ''
                                                    }`}
                                            />
                                        </FormControl>
                                        <FormLabel className="!m-0 text-sm font-normal">
                                            Notify Via Push Notification
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name={`notifyBy.system_notification`}
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                className={`size-4 rounded-sm border-2 shadow-none ${field.value
                                                    ? 'border-none bg-primary-500 text-white'
                                                    : ''
                                                    }`}
                                            />
                                        </FormControl>
                                        <FormLabel className="!m-0 text-sm font-normal">
                                            Notify Via System Notification
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                    Triggers
                                </div>
                                <p className="mt-0.5 text-xs text-neutral-500">
                                    Pick when notifications should fire on the channels above.
                                </p>
                                <div className="mt-3 flex flex-col gap-2">
                            <FormField
                                control={control}
                                name={`notifySettings.onCreate`}
                                render={({ field }) => (
                                    <FormItem className="flex items-end gap-2">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                className={`size-5 rounded-sm border-2 shadow-none ${field.value
                                                    ? 'border-none bg-primary-500 text-white' // Blue background and red tick when checked
                                                    : '' // Default styles when unchecked
                                                    }`}
                                            />
                                        </FormControl>
                                        <FormLabel className="!mb-[3px] font-thin">
                                            When Live Class is created
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />

                            {isEditState && (
                                <FormField
                                    control={control}
                                    name={`notifySettings.onEdit`}
                                    render={({ field }) => (
                                        <FormItem className="flex items-end gap-2">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value ?? false}
                                                    onCheckedChange={field.onChange}
                                                    className={`size-5 rounded-sm border-2 shadow-none ${field.value
                                                        ? 'border-none bg-primary-500 text-white'
                                                        : ''
                                                        }`}
                                                />
                                            </FormControl>
                                            <FormLabel className="!mb-[3px] font-thin">
                                                Send Reschedule/Edit Email
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />
                            )}

                            <div>
                                <div className="text-sm font-medium">Notify Before</div>

                                {beforeLiveFields.map((field, index) => (
                                    <div key={field.id} className="flex items-center">
                                        <SelectField
                                            label=""
                                            name={`notifySettings.beforeLiveTime.${index}.time`}
                                            labelStyle="font-thin"
                                            options={TimeOptions.map((option, index) => ({
                                                value: option.value,
                                                label: option.label,
                                                _id: index,
                                            }))}
                                            control={form.control}
                                            className="mt-[8px] w-56 font-thin"
                                        />
                                        <MyButton
                                            type="button"
                                            buttonType="text"
                                            onClick={() => beforeLiveRemove(index)}
                                            className="text-red-500"
                                        >
                                            Remove
                                        </MyButton>
                                    </div>
                                ))}

                                <MyButton
                                    type="button"
                                    buttonType="text"
                                    onClick={() => beforeLiveAppend({ time: '' })}
                                    className="m-0 flex justify-start gap-2 p-0 text-primary-500"
                                >
                                    <Plus size={16} /> Add
                                </MyButton>
                            </div>

                            <FormField
                                control={control}
                                name={`notifySettings.onLive`}
                                render={({ field }) => (
                                    <FormItem className="flex items-end gap-2">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                className={`size-5 rounded-sm border-2 shadow-none ${field.value
                                                    ? 'border-none bg-primary-500 text-white'
                                                    : ''
                                                    }`}
                                            />
                                        </FormControl>
                                        <FormLabel className="!mb-[3px] font-thin">
                                            When class goes live
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={control}
                                name={`notifySettings.onAttendance`}
                                render={({ field }) => (
                                    <FormItem className="flex items-end gap-2">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                className={`size-5 rounded-sm border-2 shadow-none ${field.value
                                                    ? 'border-none bg-primary-500 text-white'
                                                    : ''
                                                    }`}
                                            />
                                        </FormControl>
                                        <FormLabel className="!mb-[3px] font-thin">
                                            When attendance is marked (present/absent)
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                </form>
                {/* Preview Registration Form */}
                <MyDialog
                    heading="Preview Registration Form"
                    onOpenChange={setPreviewDialog}
                    open={previewDialog}
                >
                    {fields?.map((testInputFields, idx) => {
                        return (
                            <div className="flex flex-col items-start gap-4" key={idx}>
                                <div className="flex w-full flex-col gap-[0.4rem]">
                                    <h1 className="text-sm">
                                        {testInputFields.label}
                                        {testInputFields.required && (
                                            <span className="text-subtitle text-danger-600">
                                                *
                                            </span>
                                        )}
                                    </h1>
                                    <CustomFieldRenderer
                                        type={testInputFields.type}
                                        name={testInputFields.label}
                                        value=""
                                        disabled={true}
                                        options={testInputFields.options?.map(
                                            (o) => o.name ?? o.label
                                        )}
                                        required={testInputFields.required}
                                    />
                                </div>
                            </div>
                        );
                    })}

                    <div className="mb-6 flex justify-center">
                        <MyButton
                            type="button"
                            scale="medium"
                            buttonType="primary"
                            className="mt-4 w-fit"
                            disable
                        >
                            Register Now
                        </MyButton>
                    </div>
                </MyDialog>
                <LiveSessionPreviewDialog
                    open={previewOpen}
                    onOpenChange={setPreviewOpen}
                    submitting={isSubmitting}
                    onConfirm={async () => {
                        await handleSubmit(onSubmitClick, onError)();
                        setPreviewOpen(false);
                    }}
                    timeZone={step1Data?.timeZone}
                    accessType={accessType}
                    sessionFeatures={{
                        enableWaitingRoom: step1Data?.enableWaitingRoom,
                        waitingRoomMinutes: step1Data?.openWaitingRoomBefore,
                        allowRewind: step1Data?.allowRewind,
                        allowPause: step1Data?.allowPause,
                        enableFeedback: step1Data?.feedbackEnabled,
                        recordSession: step1Data?.bbbRecord,
                    }}
                    notifications={{
                        notifyBy: watch('notifyBy'),
                        notifySettings: {
                            onCreate: watch('notifySettings.onCreate'),
                            beforeLiveTime: watch('notifySettings.beforeLiveTime'),
                            onLive: watch('notifySettings.onLive'),
                            onAttendance: watch('notifySettings.onAttendance'),
                        },
                    }}
                    sessions={previewSessions}
                    recurrenceBanner={previewRecurrenceBanner}
                    topLevelDescription={step1Data?.description}
                    courses={courses ?? []}
                    sessionList={sessionList}
                />
            </FormProvider>
            {/* Add Custom Field Dialog is now embedded inline via SharedAddCustomFieldDialog */}
        </>
    );
}
