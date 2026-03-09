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
import { Sortable, SortableDragHandle, SortableItem } from '@/components/ui/sortable';
import { Switch } from '@/components/ui/switch';
import { MyDialog } from '@/components/design-system/dialog';
import SelectField from '@/components/design-system/select-field';
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
    const { clearSessionId, clearStep1Data } = useLiveSessionStore();
    const { studyLibraryData } = useStudyLibraryStore();
    const [addCustomFieldDialog, setAddCustomFieldDialog] = useState<boolean>(false);
    const queryClient = useQueryClient();
    const [previewDialog, setPreviewDialog] = useState<boolean>(false);
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
        if (!sessionId) {
            navigate({ to: '/study-library/live-session' });
        }
    }, [sessionId, navigate]);

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
                beforeLive: false,
                beforeLiveTime: [] as { time: string }[],
                onLive: false,
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
                mail: true,
                whatsapp: true,
            },
            notifySettings: {
                onCreate: true,
                beforeLive: true,
                beforeLiveTime: [],
                onLive: true,
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
            beforeLive: false,
            beforeLiveTime: [] as { time: string }[],
            onLive: false,
        };

        let mail = false;
        let whatsapp = false;

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
            }

            // Merge mail & whatsapp flags
            mail = mail || notifyBy.mail;
            whatsapp = whatsapp || notifyBy.whatsapp;
        });

        form.setValue('notifySettings', defaultNotifySettings);
        form.setValue('notifyBy', { mail, whatsapp });

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
    useEffect(() => {
        if (isEditState) {
            if (accessType === AccessType.PUBLIC) {
                const fields =
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    sessionDetails?.notifications?.addedFields.map((field: any) => ({
                        id: field.id,
                        label: field.label,
                        required: field.required,
                        isDefault: field.label === 'Full Name' || field.label === 'Email',
                        type: field.type,
                    })) ?? [];

                form.setValue('fields', fields);
                form.setValue(
                    'joinLink',
                    `${BASE_URL_LEARNER_DASHBOARD}/register/live-class?sessionId=${sessionId}`
                );
            } else {
                form.setValue('fields', []);
                form.setValue('joinLink', `${BASE_URL_LEARNER_DASHBOARD}/study-library/live-class`);
            }
            return;
        }
        if (accessType === AccessType.PUBLIC) {
            form.setValue('fields', [
                { label: 'Full Name', required: true, isDefault: true, type: InputType.TEXT },
                { label: 'Email', required: true, isDefault: true, type: InputType.TEXT },
                { label: 'Mobile Number', required: false, isDefault: false, type: InputType.TEXT },
                { label: 'State', required: true, isDefault: false, type: InputType.TEXT },
                { label: 'City/Village', required: true, isDefault: false, type: InputType.TEXT },
            ]);
            form.setValue(
                'joinLink',
                `${BASE_URL_LEARNER_DASHBOARD}/register/live-class?sessionId=${sessionId}`
            );
        } else {
            form.setValue('fields', []);
            form.setValue('joinLink', `${BASE_URL_LEARNER_DASHBOARD}/study-library/live-class`);
        }
    }, [accessType]);
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

            const body = transformFormToDTOStep2(data, sessionId, packageSessionIds);

            const response = await createLiveSessionStep2(body);
            console.log('API Response:', response);

            // Show success toast
            toast.success(
                `${getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession)} created successfully!`
            );

            // Handle potential Zoho meeting creation
            if (step1Data?.sessionPlatform === StreamingPlatform.ZOHO && instituteDetails?.id) {
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

    return (
        <>
            <FormProvider {...form}>
                <form
                    onSubmit={handleSubmit(onSubmitClick, onError)}
                    className="flex flex-col gap-4"
                >
                    <div className="m-0 flex items-center justify-between p-0">
                        <div className="flex items-center gap-4">
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
                        </div>
                        <MyButton
                            type="submit"
                            scale="large"
                            buttonType="primary"
                            disable={isSubmitting}
                        >
                            {isSubmitting ? (
                                <Loader2 className="animate-spin text-white" />
                            ) : (
                                'Create'
                            )}
                        </MyButton>
                    </div>
                    <Separator className="my-4" />

                    {/* Access Type */}

                    <div className="flex flex-col gap-4 font-medium">
                        <div className="font-bold">Participant Access Settings</div>

                        {isEditState && (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <div className="font-bold">{accessType} : </div>
                                {accessType === AccessType.PRIVATE ? (
                                    <div>
                                        Restrict the class to specific participants by assigning it
                                        to institute batches or selecting individual learners.
                                    </div>
                                ) : (
                                    <div>Allow anyone to join this class via a shared link.</div>
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
                                                        Restrict the class to specific participants
                                                        by assigning it to institute batches or
                                                        selecting individual learners.
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
                                                        Allow anyone to join this class via a shared
                                                        link.
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

                    {/* Participant Selection - Available for both Public and Private classes */}
                    <div className="flex flex-col gap-4">
                        <div className="font-bold">Select Participants</div>
                        <div className="w-full sm:max-w-[260px]">
                            <MyDropdown
                                currentValue={currentSession ?? undefined}
                                dropdownList={sessionList}
                                placeholder="Select Session"
                                handleChange={handleSessionChange}
                            />
                        </div>
                        <LiveSessionParticipantsTab
                            form={form}
                            courses={courses}
                            currentSession={currentSession}
                        />
                    </div>

                    {/* Registration Form Fields - Only for Public classes */}
                    {accessType === AccessType.PUBLIC && (
                        <>
                            <div className="flex flex-col gap-4">
                                <div className="font-bold">Registration Form Fields</div>
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
                                                    {!field.isDefault && (
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
                                                    )}
                                                </div>
                                            </SortableItem>
                                        </SortableItem>
                                    ))}
                                </Sortable>

                                {/* adding customs fields and new registration form options */}
                                <div className="flex flex-col gap-4 p-3 sm:flex-row">
                                    <MyButton
                                        buttonType="secondary"
                                        type="button"
                                        onClick={() => {
                                            setAddCustomFieldDialog(!addCustomFieldDialog);
                                        }}
                                        className="w-full sm:w-auto"
                                    >
                                        <Plus></Plus> Add Custom Field
                                    </MyButton>
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
                        </>
                    )}

                    <Separator className="my-4" />
                    <div
                        className="flex flex-col gap-10 font-bold sm:flex-row sm:items-center sm:gap-20"
                        id="join-link-qr-code"
                    >
                        <div className="flex flex-1 flex-col gap-2">
                            <h1>Join Link</h1>
                            <div className="flex w-full items-center gap-8">
                                <div className="flex w-full items-center gap-4">
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
                                        <Copy size={32} />
                                    </MyButton>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <h1>QR Code</h1>
                            <div className="flex items-center gap-8">
                                <div className="flex items-center gap-4">
                                    <FormField
                                        control={control}
                                        name="joinLink"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <QRCode
                                                        value={field.value ?? ''}
                                                        className="size-16"
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
                                        className="h-10 min-w-10"
                                        onClick={() => handleDownloadQRCode('qr-code-svg')}
                                    >
                                        <DownloadSimple size={32} />
                                    </MyButton>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Separator className="my-4" />

                    <div className="flex flex-col gap-4">
                        <div className="font-bold">Notification Settings</div>

                        <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
                            <FormField
                                control={control}
                                name={`notifyBy.mail`}
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
                                            Notify Via Email
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name={`notifyBy.whatsapp`}
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
                                            Notify Via WhatsApp
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="font-bold">Notify Participants</div>

                        <div className="flex flex-col gap-4">
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
                                                    ? 'border-none bg-primary-500 text-white' // Blue background and red tick when checked
                                                    : '' // Default styles when unchecked
                                                    }`}
                                            />
                                        </FormControl>
                                        <FormLabel className="!mb-[3px] font-thin">
                                            When class goes live
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
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
                                {testInputFields.type === 'dropdown' ? (
                                    <SelectField
                                        label={testInputFields.label}
                                        labelStyle="font-normal"
                                        name={testInputFields.label}
                                        options={
                                            testInputFields?.options?.map((option, index) => ({
                                                value: option.name,
                                                label: option.label,
                                                _id: index,
                                            })) || []
                                        }
                                        control={form.control}
                                        className="w-full font-thin"
                                        required={testInputFields.required ? true : false}
                                    />
                                ) : (
                                    <div className="flex w-full flex-col gap-[0.4rem]">
                                        <h1 className="text-sm">
                                            {testInputFields.label}
                                            {testInputFields.required && (
                                                <span className="text-subtitle text-danger-600">
                                                    *
                                                </span>
                                            )}
                                        </h1>
                                        <MyInput
                                            inputType="text"
                                            inputPlaceholder={testInputFields.label}
                                            input=""
                                            onChangeFunction={() => { }}
                                            size="large"
                                            disabled
                                            className="!min-w-full"
                                        />
                                    </div>
                                )}
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
            </FormProvider>
            {/* Add Custom Field Dialog */}
            <MyDialog
                open={addCustomFieldDialog}
                onOpenChange={setAddCustomFieldDialog}
                heading="Custom Field Fields"
            >
                <FormProvider {...addCustomFieldform}>
                    <form onSubmit={handleCustomSubmit(onCustomSubmit, onError)}>
                        <div className="p-2">
                            <div className="flex flex-col gap-4">
                                <div>Select the type of custom field you want to add:</div>
                                <FormField
                                    control={customControl}
                                    name="fieldType"
                                    render={({ field }) => (
                                        <MyRadioButton
                                            name="meetingType"
                                            value={field.value ?? ''}
                                            onChange={field.onChange}
                                            options={[
                                                {
                                                    label: 'Text Field',
                                                    value: 'text',
                                                },
                                                {
                                                    label: 'DropDown',
                                                    value: 'dropdown',
                                                },
                                            ]}
                                            className="flex flex-row gap-4"
                                        />
                                    )}
                                />
                            </div>
                            <div className="mt-4 flex flex-col gap-4">
                                <div>
                                    {filedType === 'text' ? 'Text Field Name' : 'Dropdown Name'}
                                </div>
                                <FormField
                                    control={customControl}
                                    name="fieldName"
                                    render={({ field: { ...field } }) => (
                                        <FormItem>
                                            <FormControl>
                                                <MyInput
                                                    inputType="text"
                                                    inputPlaceholder="Enter Name"
                                                    input={field.value}
                                                    onChangeFunction={field.onChange}
                                                    error={
                                                        addCustomFieldform.formState.errors
                                                            .fieldName?.message
                                                    }
                                                    size="large"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            {filedType === 'dropdown' && (
                                <div>
                                    <Sortable
                                        value={customOptionsFields}
                                        onMove={({ activeIndex, overIndex }) =>
                                            customMove(activeIndex, overIndex)
                                        }
                                    >
                                        {customOptionsFields.map((field, index) => (
                                            <SortableItem key={field.id} value={field.id} asChild>
                                                <div className="flex items-center gap-6 rounded  p-3">
                                                    <div className="flex w-3/4 items-center justify-between rounded-md border bg-neutral-50 p-2 shadow">
                                                        <input
                                                            className="w-full border-none bg-transparent outline-none"
                                                            {...register(
                                                                `options.${index}.optionField`
                                                            )} // <-- use register here
                                                        />
                                                        <SortableDragHandle className="cursor-grab border-none shadow-none">
                                                            <DotsSixVertical />
                                                        </SortableDragHandle>
                                                    </div>
                                                </div>
                                            </SortableItem>
                                        ))}
                                    </Sortable>
                                    <div>
                                        <MyButton
                                            buttonType="text"
                                            className="m-0 p-0 text-primary-500"
                                            type="button"
                                            onClick={() => customAppend({ optionField: '' })}
                                        >
                                            <Plus></Plus> Add
                                        </MyButton>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="mt-2 flex w-full items-center justify-center">
                            <MyButton buttonType="primary" className="m-auto" type="submit">
                                Done
                            </MyButton>
                        </div>
                    </form>
                </FormProvider>
            </MyDialog>
        </>
    );
}
