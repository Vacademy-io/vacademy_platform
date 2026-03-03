/* eslint-disable tailwindcss/no-custom-classname */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import { MyButton } from '@/components/design-system/button';
import { zodResolver } from '@hookform/resolvers/zod';
import { Separator } from '@radix-ui/react-separator';
import { Controller, FieldErrors, FormProvider, useForm, useWatch } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { z } from 'zod';
import { MyInput } from '@/components/design-system/input';
import SelectField from '@/components/design-system/select-field';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { useFilterDataForAssesment } from '@/routes/assessment/assessment-list/-utils.ts/useFiltersData';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { MyRadioButton } from '@/components/design-system/radio';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    RecurringType,
    SessionPlatform,
    SessionType,
    StreamingPlatform,
} from '../../-constants/enums';
import { WEEK_DAYS } from '../../-constants/type';
import { sessionFormSchema } from '../-schema/schema';
import { Trash, UploadSimple, X, Plus, Copy, Eye, MusicNote } from '@phosphor-icons/react';
import { MyDialog } from '@/components/design-system/dialog';
// import { MeetLogo, YoutubeLogo, ZoomLogo } from '@/svgs';
import { transformFormToDTOStep1, timeOptions } from '../../-constants/helper';
import { createLiveSessionStep1 } from '../-services/utils';
import { useNavigate } from '@tanstack/react-router';
import { useLiveSessionStore } from '../-store/sessionIdstore';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { UploadFileInS3, getPublicUrl } from '@/services/upload_file';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { XCircle } from '@phosphor-icons/react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useSessionDetailsStore } from '../../-store/useSessionDetailsStore';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime, format as formatTZ } from 'date-fns-tz';
import { TIMEZONE_OPTIONS, STREAMING_OPTIONS, WAITING_ROOM_OPTIONS } from '../-constants/options';
import { DefaultClassLinkInput } from './DefaultClassLinkInput';
import { LearnerButtonConfigInput } from './LearnerButtonConfigInput';
import { ScrollArea } from '@radix-ui/react-scroll-area';
import { LiveClassLinkField } from './LiveClassLinkField';

export default function ScheduleStep1() {
    // Hooks and State
    const navigate = useNavigate();
    const { setSessionId, step1Data, setStep1Data, sessionId, isEdit } = useLiveSessionStore();
    const { sessionDetails } = useSessionDetailsStore();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedMusicFile, setSelectedMusicFile] = useState<File | null>(null);
    const [existingThumbnailId, setExistingThumbnailId] = useState<string | null>(null);
    const [existingMusicId, setExistingMusicId] = useState<string | null>(null);
    const musicFileInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // State for session thumbnails - Map<"dayIndex-sessionIndex", File>
    const [sessionThumbnails, setSessionThumbnails] = useState<Map<string, File>>(new Map());
    const [scheduleType, setScheduleType] = useState<
        'everyday' | 'weekday' | 'exceptSunday' | 'custom' | null
    >(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFormInitialized, setIsFormInitialized] = useState(false);
    const [isLoadingEditData, setIsLoadingEditData] = useState(false);
    // Ref to track if we're in edit mode - this should NEVER change during component lifecycle
    const isEditModeRef = useRef<boolean>(false);
    // State for default link copy dialog
    const [isDefaultLinkDialogOpen, setIsDefaultLinkDialogOpen] = useState(false);
    const [pendingDefaultLink, setPendingDefaultLink] = useState<string>('');
    const [selectedDaysForLink, setSelectedDaysForLink] = useState<string[]>([]);
    // State for copy to days dialog
    const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
    const [copySourceSession, setCopySourceSession] = useState<{
        dayIndex: number;
        sessionIndex: number;
    } | null>(null);
    const [selectedDaysToCopy, setSelectedDaysToCopy] = useState<number[]>([]);
    // State for copy default link dialog
    const [isCopyDefaultLinkDialogOpen, setIsCopyDefaultLinkDialogOpen] = useState(false);
    const [copySourceDefaultLink, setCopySourceDefaultLink] = useState<{
        dayIndex: number;
    } | null>(null);
    const [selectedDaysToCopyDefaultLink, setSelectedDaysToCopyDefaultLink] = useState<number[]>([]);

    // State for link update confirmation
    const [isLinkUpdateDialogOpen, setIsLinkUpdateDialogOpen] = useState(false);
    const [pendingSubmitData, setPendingSubmitData] = useState<z.infer<typeof sessionFormSchema> | null>(null);
    const [changedDayLabel, setChangedDayLabel] = useState<string>('');
    // State to store recurrence scope selected via Apply button (used when Next is clicked)
    const [pendingRecurrenceScope, setPendingRecurrenceScope] = useState<
        'ONLY_THIS' | 'ALL_FUTURE' | 'CURRENT_DAY_ALL_SESSIONS' | 'ALL_FUTURE_ALL_SESSIONS' | null
    >(null);

    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const { SubjectFilterData } = useFilterDataForAssesment(instituteDetails);
    const { showForInstitutes } = useInstituteDetailsStore();

    // Helper function to get browser's timezone
    const getBrowserTimezone = (): string => {
        try {
            const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const timezoneMapping: Record<string, string> = {
                'Asia/Calcutta': 'Asia/Kolkata', // Old name for Kolkata
            };
            const mappedTimezone = timezoneMapping[browserTimezone] || browserTimezone;

            // Check if the detected/mapped timezone is in our available options
            const isValidTimezone = TIMEZONE_OPTIONS.some(
                (option) => option.value === mappedTimezone
            );
            if (isValidTimezone) {
                return mappedTimezone;
            } else {
                return 'Asia/Kolkata';
            }
        } catch (error) {
            console.error('Error detecting browser timezone:', error);
            return 'Asia/Kolkata';
        }
    };

    // Helper function to get current time in selected timezone
    const getCurrentTimeInTimezone = (timezone: string): string => {
        try {
            const now = new Date();
            const zonedTime = toZonedTime(now, timezone);
            return format(zonedTime, "yyyy-MM-dd'T'HH:mm");
        } catch (error) {
            console.error('Error getting current time in timezone:', error);
            return format(new Date(), "yyyy-MM-dd'T'HH:mm");
        }
    };

    // Initialize default values
    const getDefaultValues = useCallback(() => {
        const defaultTimezone = getBrowserTimezone();
        const defaultTime = getCurrentTimeInTimezone(defaultTimezone);

        return {
            title: '',
            meetingType: RecurringType.ONCE,
            recurringSchedule: WEEK_DAYS.map((day) => ({
                day: day.label,
                isSelect: false,
                default_class_link: null, // Day-level default link
                default_class_name: null, // Day-level default class name
                learner_button_config: null, // Day-level custom button
                sessions: [
                    {
                        startTime: '00:00',
                        durationHours: '0',
                        durationMinutes: '30',
                        link: '',
                        countAttendanceDaily: false,
                        thumbnailFileId: '',
                    },
                ],
            })),
            subject: 'none',
            timeZone: defaultTimezone,
            startTime: defaultTime,
            events: '1',
            openWaitingRoomBefore: '15',
            sessionType: SessionType.LIVE,
            streamingType: SessionPlatform.EMBED_IN_APP,
            allowRewind: false,
            allowPause: false,
            enableWaitingRoom: false,
            sessionPlatform: StreamingPlatform.OTHER,
            durationMinutes: '30',
            durationHours: '0',
            defaultLink: '',
        };
    }, []);

    // Form Setup
    const form = useForm<z.infer<typeof sessionFormSchema>>({
        resolver: zodResolver(sessionFormSchema),
        defaultValues: getDefaultValues(),
        mode: 'onChange',
    });
    // Auto-update "Select days" dropdown when days are toggled manually
    const recurringSchedule = useWatch({
        control: form.control,
        name: 'recurringSchedule',
    });
    useEffect(() => {
        if (!recurringSchedule) return;
        const selectedDays = recurringSchedule.filter((day) => day.isSelect).map((day) => day.day);
        const allDays = WEEK_DAYS.map((d) => d.label);
        const weekdays = allDays.slice(0, 5);
        const monToSat = allDays.slice(0, 6);
        let newType: 'everyday' | 'weekday' | 'exceptSunday' | 'custom';
        if (selectedDays.length === allDays.length) {
            newType = 'everyday';
        } else if (monToSat.every((day) => selectedDays.includes(day))) {
            newType = 'exceptSunday';
        } else if (weekdays.every((day) => selectedDays.includes(day))) {
            newType = 'weekday';
        } else {
            newType = 'custom';
        }
        if (scheduleType !== newType) {
            setScheduleType(newType);
        }
    }, [recurringSchedule]);
    // Auto-fill link, duration, and start time for newly selected days
    const prevSelectedDaysRef = useRef<string[]>([]);
    useEffect(() => {
        if (!recurringSchedule) return;

        // NEVER auto-fill in edit mode - user's existing session data should be preserved
        if (isEditModeRef.current) return;

        // Skip if form is still being initialized
        if (!isFormInitialized) return;

        const selectedDays = recurringSchedule.filter((d) => d.isSelect).map((d) => d.day);
        const newDays = selectedDays.filter((d) => !prevSelectedDaysRef.current.includes(d));

        if (newDays.length > 0) {
            const currentStartTime = form.getValues('startTime') || '';
            const timeValue = currentStartTime.split('T')[1] || '';
            const currentDurationHours = form.getValues('durationHours') || '0';
            const currentDurationMinutes = form.getValues('durationMinutes') || '30';
            const currentLink = form.getValues('defaultLink') || '';

            newDays.forEach((dayLabel) => {
                const idx = recurringSchedule.findIndex((d) => d.day === dayLabel);
                if (idx !== -1) {
                    form.setValue(`recurringSchedule.${idx}.sessions.0.startTime`, timeValue);
                    form.setValue(
                        `recurringSchedule.${idx}.sessions.0.durationHours`,
                        currentDurationHours
                    );
                    form.setValue(
                        `recurringSchedule.${idx}.sessions.0.durationMinutes`,
                        currentDurationMinutes
                    );
                    form.setValue(`recurringSchedule.${idx}.sessions.0.link`, currentLink);
                    form.setValue(`recurringSchedule.${idx}.sessions.0.thumbnailFileId`, '');
                }
            });
        }
        prevSelectedDaysRef.current = selectedDays;
    }, [recurringSchedule, form, isFormInitialized]);

    // Watch default link
    const defaultLink = form.watch('defaultLink');

    // Auto-detect platform from link
    useEffect(() => {
        const link = defaultLink?.toLowerCase() || '';

        if (!link) return;

        if (link.includes('youtube.com') || link.includes('youtu.be')) {
            form.setValue('sessionPlatform', StreamingPlatform.YOUTUBE);
        } else if (link.includes('meet.google.com')) {
            form.setValue('sessionPlatform', StreamingPlatform.MEET);
        } else if (link.includes('zoom.us')) {
            form.setValue('sessionPlatform', StreamingPlatform.ZOOM);
        } else {
            form.setValue('sessionPlatform', StreamingPlatform.OTHER);
            form.setValue('streamingType', SessionPlatform.REDIRECT_TO_OTHER_PLATFORM);
        }
    }, [defaultLink, form]);

    // Update start time when timezone changes (only for new sessions)
    const selectedTimezone = form.watch('timeZone');
    useEffect(() => {
        // Only update time if NOT in edit mode and timezone changes
        if (!sessionDetails && selectedTimezone && isFormInitialized) {
            const currentTime = getCurrentTimeInTimezone(selectedTimezone);
            form.setValue('startTime', currentTime);
        }
    }, [selectedTimezone, sessionDetails, form, isFormInitialized]);

    // Populate form when sessionDetails is available (edit mode)
    useEffect(() => {
        if (!sessionDetails) {
            if (!isFormInitialized) {
                setIsFormInitialized(true);
            }
            return;
        }

        // Mark that we're in edit mode - this flag will NEVER change once set
        isEditModeRef.current = true;

        // Set loading flag to prevent auto-fill effects from running
        setIsLoadingEditData(true);

        const schedule = sessionDetails.schedule;
        const savedTimezone = schedule.timezone || 'Asia/Kolkata';

        // --- Compute ALL form values BEFORE resetting the form ---

        // Compute startTime
        let computedStartTime: string;
        if (schedule.start_time) {
            if (schedule.start_time.includes('T')) {
                try {
                    const testDate = new Date(schedule.start_time);
                    if (!isNaN(testDate.getTime())) {
                        // Normalize to datetime-local format (YYYY-MM-DDTHH:mm)
                        const normalized = schedule.start_time.substring(0, 16);
                        computedStartTime = normalized;
                    } else {
                        computedStartTime = schedule.start_time;
                    }
                } catch {
                    computedStartTime = schedule.start_time;
                }
            } else if (schedule.meeting_date) {
                computedStartTime = `${schedule.meeting_date}T${schedule.start_time}`;
            } else {
                const today = format(new Date(), 'yyyy-MM-dd');
                computedStartTime = `${today}T${schedule.start_time}`;
            }
        } else {
            computedStartTime = getCurrentTimeInTimezone(savedTimezone);
        }

        // Compute duration
        let computedDurationHours = '0';
        let computedDurationMinutes = '30';
        if (schedule.start_time && schedule.last_entry_time) {
            const start = new Date(schedule.start_time);
            const end = new Date(schedule.last_entry_time);
            if (end > start) {
                const durationMs = end.getTime() - start.getTime();
                computedDurationHours = String(Math.floor(durationMs / 3600000));
                computedDurationMinutes = String(Math.floor((durationMs % 3600000) / 60000));
            }
        }

        // Compute meeting type, endDate, and recurring schedule
        let computedMeetingType = RecurringType.ONCE;
        let computedEndDate: string | undefined = undefined;
        const getDefaultValuesResult = getDefaultValues();
        let computedRecurringSchedule: typeof getDefaultValuesResult.recurringSchedule =
            getDefaultValuesResult.recurringSchedule;

        if (schedule.recurrence_type === 'weekly') {
            computedMeetingType = RecurringType.WEEKLY;

            // Parse session_end_date to YYYY-MM-DD format for <input type="date">
            const rawEndDate = schedule.session_end_date;
            if (rawEndDate) {
                try {
                    const parsedDate = new Date(rawEndDate);
                    if (!isNaN(parsedDate.getTime())) {
                        computedEndDate = format(parsedDate, 'yyyy-MM-dd');
                    } else if (rawEndDate.includes('T')) {
                        computedEndDate = rawEndDate.split('T')[0] || rawEndDate;
                    } else {
                        computedEndDate = rawEndDate;
                    }
                } catch {
                    if (rawEndDate.includes('T')) {
                        computedEndDate = rawEndDate.split('T')[0] || rawEndDate;
                    } else {
                        computedEndDate = rawEndDate;
                    }
                }
            }

            computedRecurringSchedule = WEEK_DAYS.map((day) => {
                const allMatchingSchedules = schedule.added_schedules.filter(
                    (scheduleItem) => scheduleItem.day.toLowerCase() === day.label.toLowerCase()
                );

                const sessionsByTime = new Map<
                    string,
                    Array<(typeof schedule.added_schedules)[0]>
                >();
                allMatchingSchedules.forEach((session) => {
                    if (!sessionsByTime.has(session.startTime)) {
                        sessionsByTime.set(session.startTime, []);
                    }
                    sessionsByTime.get(session.startTime)!.push(session);
                });

                const matchingSchedules = Array.from(sessionsByTime.entries())
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([, sessions]) => {
                        const firstSession = sessions[0];
                        const allIds = sessions.map((s) => s.id).join(',');
                        return {
                            ...firstSession,
                            id: allIds,
                        };
                    });

                return {
                    day: day.label as typeof day.label,
                    isSelect: matchingSchedules.length > 0,
                    default_class_link:
                        matchingSchedules.length > 0
                            ? (matchingSchedules[0] as any)?.default_class_link ??
                              (matchingSchedules[0] as any)?.defaultClassLink ??
                              null
                            : null,
                    default_class_name:
                        matchingSchedules.length > 0
                            ? (matchingSchedules[0] as any)?.default_class_name ??
                              (matchingSchedules[0] as any)?.defaultClassName ??
                              null
                            : null,
                    learner_button_config:
                        matchingSchedules.length > 0
                            ? (matchingSchedules[0] as any)?.learner_button_config ??
                              (matchingSchedules[0] as any)?.learnerButtonConfig ??
                              null
                            : null,
                    sessions:
                        matchingSchedules.length > 0
                            ? matchingSchedules.map((matchingSchedule) => {
                                  const duration = parseInt(matchingSchedule.duration || '0') || 0;
                                  return {
                                      id: matchingSchedule.id,
                                      startTime: matchingSchedule.startTime || '00:00',
                                      durationHours: String(Math.floor(duration / 60)),
                                      durationMinutes: String(duration % 60),
                                      link: matchingSchedule.link || '',
                                      thumbnailFileId: matchingSchedule.thumbnailFileId || '',
                                      countAttendanceDaily:
                                          matchingSchedule.countAttendanceDaily ?? (matchingSchedule as any).dailyAttendance ?? false,
                                  };
                              })
                            : [
                                  {
                                      startTime: '00:00',
                                      durationHours: '0',
                                      durationMinutes: '30',
                                      link: '',
                                      thumbnailFileId: '',
                                      countAttendanceDaily: false,
                                  },
                              ],
                };
            });
        }

        // Compute waiting room settings
        let computedEnableWaitingRoom = false;
        let computedOpenWaitingRoomBefore = '15';
        if (schedule.waiting_room_time !== null && schedule.waiting_room_time !== undefined) {
            computedEnableWaitingRoom = schedule.waiting_room_time > 0;
            computedOpenWaitingRoomBefore = String(schedule.waiting_room_time);
        }

        // Compute learner button config
        const topLevelLearnerButtonConfig =
            (schedule as any)?.learner_button_config ??
            (schedule as any)?.learnerButtonConfig ??
            null;

        // --- Single form.reset with ALL computed values ---
        // This prevents intermediate states where meetingType/endDate/recurringSchedule
        // are at defaults while other fields are already set
        form.reset({
            id: schedule.session_id,
            title: schedule.title || '',
            subject: schedule.subject || 'none',
            description: schedule.description_html || '',
            timeZone: savedTimezone,
            startTime: computedStartTime,
            durationHours: computedDurationHours,
            durationMinutes: computedDurationMinutes,
            meetingType: computedMeetingType,
            endDate: computedEndDate,
            recurringSchedule: computedRecurringSchedule,
            defaultLink: schedule.default_meet_link || '',
            sessionPlatform: schedule.link_type || StreamingPlatform.OTHER,
            streamingType: schedule.session_streaming_service_type || SessionPlatform.EMBED_IN_APP,
            sessionType: SessionType.LIVE,
            enableWaitingRoom: computedEnableWaitingRoom,
            openWaitingRoomBefore: computedOpenWaitingRoomBefore,
            allowRewind: schedule.allow_rewind ?? false,
            allowPause: schedule.allow_play_pause ?? false,
            events: '1',
            learner_button_config: topLevelLearnerButtonConfig,
        });

        // Set existing file IDs for display
        if (schedule.thumbnail_file_id) {
            setExistingThumbnailId(schedule.thumbnail_file_id);
        }
        if (schedule.background_score_file_id) {
            setExistingMusicId(schedule.background_score_file_id);
        }

        setIsFormInitialized(true);

        // Clear loading flag after a small delay to ensure all form values are set
        setTimeout(() => {
            setIsLoadingEditData(false);
        }, 100);
    }, [sessionDetails, form]);

    // Initialize form with step1Data when available (for non-edit flows)
    useEffect(() => {
        // Only run this for non-edit flows
        if (step1Data && !sessionDetails) {
            form.reset(step1Data);
            setIsFormInitialized(true);
        } else if (!step1Data && !sessionDetails && !isFormInitialized) {
            setIsFormInitialized(true);
        }
    }, [step1Data, sessionDetails, form, isFormInitialized]);

    // Set the form's id field when sessionId exists (coming back from step 2)
    useEffect(() => {
        if (sessionId && !sessionDetails && !form.getValues('id')) {
            form.setValue('id', sessionId);
        }
    }, [sessionId, sessionDetails, form]);

    const { control, watch } = form;
    // Watch the selected streaming platform to conditionally render/disable options
    const sessionPlatformWatch = useWatch({ control, name: 'sessionPlatform' });
    const defaultLinkWatch = useWatch({ control, name: 'defaultLink' });

    const detectedPlatform = useMemo(() => {
        const link = (defaultLinkWatch || '').trim();
        const youtubeRegex = /^(https?:\/\/(www\.)?youtube\.com\/(watch\?v=|@.+\/live))/i;
        const meetRegex = /^(https?:\/\/meet\.google\.com\/(new|[a-zA-Z0-9-]+))/i;
        const zoomRegex = /^(https?:\/\/([\w.-]+\.)?zoom\.us\/)/i;
        if (youtubeRegex.test(link)) return 'youtube';
        if (meetRegex.test(link)) return 'meet';
        if (zoomRegex.test(link)) return 'zoom';
        return 'other';
    }, [defaultLinkWatch]);

    // Effect: set form values based on detected platform
    useEffect(() => {
        switch (detectedPlatform) {
            case 'youtube': {
                form.setValue('sessionPlatform', StreamingPlatform.YOUTUBE);
                form.setValue('streamingType', SessionPlatform.EMBED_IN_APP);
                break;
            }
            case 'meet': {
                form.setValue('sessionPlatform', StreamingPlatform.MEET);
                form.setValue('sessionType', SessionType.LIVE);
                form.setValue('streamingType', SessionPlatform.REDIRECT_TO_OTHER_PLATFORM);
                break;
            }
            case 'zoom': {
                form.setValue('sessionPlatform', StreamingPlatform.ZOOM);
                form.setValue('streamingType', SessionPlatform.REDIRECT_TO_OTHER_PLATFORM);
                break;
            }
            case 'other': {
                form.setValue('sessionPlatform', StreamingPlatform.OTHER);
                break;
            }
        }
    }, [detectedPlatform]);

    const isMeetPlatform = sessionPlatformWatch === StreamingPlatform.MEET;
    const isZoomPlatform = sessionPlatformWatch === StreamingPlatform.ZOOM;

    // Disabled options logic based on current platform selection
    const disabledLiveClassOptions = useMemo(() => {
        if (isMeetPlatform) return [SessionType.PRE_RECORDED];
        return [];
    }, [isMeetPlatform]);

    const sessionTypeWatch = useWatch({ control, name: 'sessionType' });

    const disabledStreamingOptions = useMemo(() => {
        if (isMeetPlatform) {
            return [SessionPlatform.EMBED_IN_APP];
        }
        if (isZoomPlatform && sessionTypeWatch !== SessionType.PRE_RECORDED) {
            return [SessionPlatform.EMBED_IN_APP];
        }
        return [];
    }, [isMeetPlatform, isZoomPlatform, sessionTypeWatch]);

    // Map detectedPlatform string to enum value for comparison
    const detectedEnumPlatform = useMemo(() => {
        switch (detectedPlatform) {
            case 'youtube':
                return StreamingPlatform.YOUTUBE;
            case 'meet':
                return StreamingPlatform.MEET;
            case 'zoom':
                return StreamingPlatform.ZOOM;
            default:
                return StreamingPlatform.OTHER;
        }
    }, [detectedPlatform]);

    const handleSessionPlatformChange = useCallback(
        (value: string) => {
            // If user picks a platform that doesn't match the one inferred from link, clear the link to prevent mismatch
            if (defaultLinkWatch && value !== detectedEnumPlatform) {
                form.setValue('defaultLink', '');
                // Clear dependent selections to avoid inconsistencies
                form.setValue('sessionType', '');
                form.setValue('streamingType', '');
            }
        },
        [defaultLinkWatch, detectedEnumPlatform]
    );

    // When Google Meet is selected, enforce Live session type and Redirect streaming type
    useEffect(() => {
        if (isMeetPlatform) {
            // Enforce only if not already selected to avoid unnecessary re-renders
            if (form.getValues('sessionType') !== SessionType.LIVE) {
                form.setValue('sessionType', SessionType.LIVE);
            }
            if (form.getValues('streamingType') !== SessionPlatform.REDIRECT_TO_OTHER_PLATFORM) {
                form.setValue('streamingType', SessionPlatform.REDIRECT_TO_OTHER_PLATFORM);
            }
        }
    }, [isMeetPlatform]);
    const meetingType = useWatch({ control, name: 'meetingType' });

    // Auth and Institute Data
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = (tokenData?.authorities && Object.keys(tokenData.authorities)[0]) || '';

    // Event Handlers
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        } else {
            toast.error('Please upload a valid image file');
        }
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
    };

    const handleRemoveExistingThumbnail = () => {
        setExistingThumbnailId(null);
        toast.success('Thumbnail removed. Save to confirm changes.');
    };

    const handleRemoveMusicFile = () => {
        setSelectedMusicFile(null);
    };

    const handleRemoveExistingMusic = () => {
        setExistingMusicId(null);
        toast.success('Background music removed. Save to confirm changes.');
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleMusicFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedMusicFile(file);
        }
    };

    const handleMusicUploadClick = () => {
        musicFileInputRef.current?.click();
    };

    const handleViewFile = async (fileId: string, fileType: 'thumbnail' | 'music') => {
        try {
            const url = await getPublicUrl(fileId);
            if (url) {
                window.open(url, '_blank');
            } else {
                toast.error(`Failed to get ${fileType} URL`);
            }
        } catch (error) {
            console.error(`Error getting ${fileType} URL:`, error);
            toast.error(`Failed to load ${fileType}`);
        }
    };

    // Session thumbnail handlers
    const handleSessionThumbnailSelect = (
        dayIndex: number,
        sessionIndex: number,
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (file) {
            const key = `${dayIndex}-${sessionIndex}`;
            setSessionThumbnails((prev) => {
                const newMap = new Map(prev);
                newMap.set(key, file);
                return newMap;
            });
        }
    };

    const handleSessionThumbnailRemove = (dayIndex: number, sessionIndex: number) => {
        const key = `${dayIndex}-${sessionIndex}`;
        setSessionThumbnails((prev) => {
            const newMap = new Map(prev);
            newMap.delete(key);
            return newMap;
        });
        // Also clear the form field
        form.setValue(`recurringSchedule.${dayIndex}.sessions.${sessionIndex}.thumbnailFileId`, '');
    };

    const getSessionThumbnail = (dayIndex: number, sessionIndex: number): File | null => {
        const key = `${dayIndex}-${sessionIndex}`;
        return sessionThumbnails.get(key) || null;
    };

    const checkForLinkChanges = (
        newData: z.infer<typeof sessionFormSchema>,
        oldData: z.infer<typeof sessionFormSchema> | null
    ): string | false => {
        if (!isEdit || !oldData) return false;

        // Check top level default link
        if (newData.defaultLink !== oldData.defaultLink) return 'all days';

        // Map old sessions for easy lookup
        const oldSessionsMap = new Map<string, any>();
        if (oldData.recurringSchedule) {
            oldData.recurringSchedule.forEach((d) => {
                if (d.isSelect) {
                    d.sessions.forEach((s) => {
                        if (s.id) oldSessionsMap.set(s.id, { ...s, day: d.day });
                    });
                }
            });
        }

        // Check recurring schedule
        if (newData.recurringSchedule) {
            for (const day of newData.recurringSchedule) {
                if (!day.isSelect) continue;

                // Check day default link
                const oldDay = oldData.recurringSchedule?.find((d) => d.day === day.day);
                if (
                    oldDay &&
                    oldDay.isSelect &&
                    oldDay.default_class_link !== day.default_class_link
                ) {
                    return day.day;
                }

                for (const session of day.sessions) {
                    // Check if existing session (has ID) has changed link
                    if (session.id && oldSessionsMap.has(session.id)) {
                        const oldSession = oldSessionsMap.get(session.id);
                        if (oldSession.link !== session.link) {
                            return day.day;
                        }
                    }
                }
            }
        }

        return false;
    };

    const executeSubmission = async (
        data: z.infer<typeof sessionFormSchema>,
        updateRecurrenceScope: 'ONLY_THIS' | 'ALL_FUTURE' | 'CURRENT_DAY_ALL_SESSIONS' | 'ALL_FUTURE_ALL_SESSIONS' | null = null
    ) => {
        if (isSubmitting) return; // Prevent multiple submissions

        setIsSubmitting(true);
        let musicFileId = existingMusicId || undefined;
        let thumbnailFileId = existingThumbnailId || undefined;

        try {
            // Override with new uploads if files are selected
            if (selectedMusicFile) {
                try {
                    musicFileId = await UploadFileInS3(selectedMusicFile, () => {}, 'your-user-id');
                } catch (error) {
                    console.error('Error uploading music file:', error);
                    toast.error('Failed to upload background music. Please try again.');
                    setIsSubmitting(false);
                    return;
                }
            }
            if (selectedFile) {
                try {
                    thumbnailFileId = await UploadFileInS3(selectedFile, () => {}, 'your-user-id');
                } catch (error) {
                    console.error('Error uploading thumbnail:', error);
                    toast.error('Failed to upload thumbnail image. Please try again.');
                    setIsSubmitting(false);
                    return;
                }
            }
        } catch (error) {
            console.error('Error uploading files:', error);
            toast.error('Failed to upload files. Please try again.');
            setIsSubmitting(false);
            return;
        }

        // Upload session thumbnails and update form data
        const updatedData = { ...data };
        if (updatedData.recurringSchedule) {
            for (let dayIndex = 0; dayIndex < updatedData.recurringSchedule.length; dayIndex++) {
                const day = updatedData.recurringSchedule[dayIndex];
                if (day?.sessions) {
                    for (let sessionIndex = 0; sessionIndex < day.sessions.length; sessionIndex++) {
                        const sessionThumbnail = getSessionThumbnail(dayIndex, sessionIndex);
                        if (sessionThumbnail) {
                            try {
                                const sessionThumbnailId = await UploadFileInS3(
                                    sessionThumbnail,
                                    () => {},
                                    'your-user-id'
                                );
                                if (
                                    updatedData.recurringSchedule?.[dayIndex]?.sessions?.[
                                        sessionIndex
                                    ]
                                ) {
                                    updatedData.recurringSchedule[dayIndex]!.sessions![
                                        sessionIndex
                                    ]!.thumbnailFileId = sessionThumbnailId;
                                }
                            } catch (error) {
                                console.error(
                                    `Error uploading thumbnail for ${day.day} session ${
                                        sessionIndex + 1
                                    }:`,
                                    error
                                );
                                toast.error(
                                    `Failed to upload thumbnail for ${day.day} session ${
                                        sessionIndex + 1
                                    }`
                                );
                                setIsSubmitting(false);
                                return;
                            }
                        }
                    }
                }
            }
        }

        // Transform function will handle added/updated/deleted schedules
        // by comparing form data (updatedData) with original schedules
        // We pass empty array for originalSchedules - the session IDs in the form data
        // will be used by the backend to determine updates vs additions
        const body = transformFormToDTOStep1(
            updatedData,
            INSTITUTE_ID,
            [], // Empty array - session IDs in form data are sufficient for backend
            musicFileId,
            thumbnailFileId,
            instituteDetails?.institute_logo_file_id,
            updateRecurrenceScope
        );

        try {
            const response = await createLiveSessionStep1(body);
            setSessionId(response.id);
            setStep1Data(data);
            navigate({ to: '/study-library/live-session/schedule/step2' });
        } catch (error) {
            console.error('Error saving session:', error);
            toast.error('Failed to save session. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const executeCopySession = () => {
        if (!copySourceSession || selectedDaysToCopy.length === 0) return;

        const { dayIndex: sourceDayIndex, sessionIndex: sourceSessionIndex } = copySourceSession;
        const recurringSchedule = form.getValues('recurringSchedule');
        const sourceSession = recurringSchedule?.[sourceDayIndex]?.sessions?.[sourceSessionIndex];

        if (!sourceSession) return;

        selectedDaysToCopy.forEach((targetDayIndex) => {
            const targetDay = recurringSchedule[targetDayIndex];
            if (!targetDay) return;

            const sessionData = {
                startTime: sourceSession.startTime,
                durationHours: sourceSession.durationHours,
                durationMinutes: sourceSession.durationMinutes,
                link: sourceSession.link,
                countAttendanceDaily: sourceSession.countAttendanceDaily,
                thumbnailFileId: sourceSession.thumbnailFileId,
            };

            const currentSessions = [...(targetDay.sessions || [])];

            if (currentSessions[sourceSessionIndex]) {
                currentSessions[sourceSessionIndex] = {
                    ...currentSessions[sourceSessionIndex],
                    ...sessionData,
                };
            } else {
                currentSessions.push(sessionData);
            }

            form.setValue(`recurringSchedule.${targetDayIndex}.sessions`, currentSessions, {
                shouldDirty: true,
            });

            if (!targetDay.isSelect) {
                form.setValue(`recurringSchedule.${targetDayIndex}.isSelect`, true);
            }
        });

        toast.success('Session copied successfully');
        setCopySourceSession(null);
        setSelectedDaysToCopy([]);
    };

    const executeCopyDefaultLink = () => {
        if (!copySourceDefaultLink || selectedDaysToCopyDefaultLink.length === 0) return;

        const { dayIndex: sourceDayIndex } = copySourceDefaultLink;
        const recurringSchedule = form.getValues('recurringSchedule');
        const sourceDay = recurringSchedule?.[sourceDayIndex];

        if (!sourceDay) return;

        selectedDaysToCopyDefaultLink.forEach((targetDayIndex) => {
            const targetDay = recurringSchedule[targetDayIndex];
            if (!targetDay) return;

            form.setValue(
                `recurringSchedule.${targetDayIndex}.default_class_link`,
                sourceDay.default_class_link,
                { shouldDirty: true, shouldTouch: true, shouldValidate: true }
            );
            form.setValue(
                `recurringSchedule.${targetDayIndex}.default_class_name`,
                sourceDay.default_class_name,
                { shouldDirty: true, shouldTouch: true, shouldValidate: true }
            );

            if (!targetDay.isSelect) {
                form.setValue(`recurringSchedule.${targetDayIndex}.isSelect`, true);
            }
        });

        toast.success('Default link copied successfully');
        setCopySourceDefaultLink(null);
        setSelectedDaysToCopyDefaultLink([]);
        setIsCopyDefaultLinkDialogOpen(false);
    };

    /**
     * Applies the link from a specific session to other sessions based on the selected scope.
     * This only updates the form on the frontend — no API call or navigation.
     */
    const applyLinkWithScope = (
        scope: 'ONLY_THIS' | 'ALL_FUTURE' | 'CURRENT_DAY_ALL_SESSIONS' | 'ALL_FUTURE_ALL_SESSIONS',
        dayIndex: number,
        sessionIndex: number
    ) => {
        const recurringSchedule = form.getValues('recurringSchedule');
        if (!recurringSchedule) return;

        const currentLink = recurringSchedule[dayIndex]?.sessions?.[sessionIndex]?.link || '';

        switch (scope) {
            case 'ONLY_THIS':
                // Link is already set via field.onChange, nothing else to do
                break;

            case 'CURRENT_DAY_ALL_SESSIONS': {
                // Update all sessions on the current day with this link
                const currentDay = recurringSchedule[dayIndex];
                if (currentDay?.sessions) {
                    currentDay.sessions.forEach((_, idx) => {
                        form.setValue(
                            `recurringSchedule.${dayIndex}.sessions.${idx}.link`,
                            currentLink,
                            { shouldDirty: true }
                        );
                    });
                }
                break;
            }

            case 'ALL_FUTURE': {
                // Update the same session index across all selected days
                recurringSchedule.forEach((day, dIdx) => {
                    if (day.isSelect && day.sessions?.[sessionIndex]) {
                        form.setValue(
                            `recurringSchedule.${dIdx}.sessions.${sessionIndex}.link`,
                            currentLink,
                            { shouldDirty: true }
                        );
                    }
                });
                break;
            }

            case 'ALL_FUTURE_ALL_SESSIONS': {
                // Update all sessions on all selected days
                recurringSchedule.forEach((day, dIdx) => {
                    if (day.isSelect && day.sessions) {
                        day.sessions.forEach((_, sIdx) => {
                            form.setValue(
                                `recurringSchedule.${dIdx}.sessions.${sIdx}.link`,
                                currentLink,
                                { shouldDirty: true }
                            );
                        });
                    }
                });
                break;
            }
        }

        // Store the selected scope so it's included in the payload when Next is clicked
        setPendingRecurrenceScope(scope);
        toast.success('Link updated successfully');
    };

    const onSubmit = (data: z.infer<typeof sessionFormSchema>) => {
        // If scope was already chosen via Apply button, use it directly
        if (isEdit && pendingRecurrenceScope) {
            executeSubmission(data, pendingRecurrenceScope);
            setPendingRecurrenceScope(null);
            return;
        }

        const changedDay = checkForLinkChanges(data, step1Data);
        if (isEdit && changedDay) {
            setPendingSubmitData(data);
            setChangedDayLabel(changedDay.charAt(0).toUpperCase() + changedDay.slice(1));
            setIsLinkUpdateDialogOpen(true);
        } else {
            executeSubmission(data);
        }
    };

    const onError = (errors: FieldErrors<typeof sessionFormSchema>) => {
        console.error('Validation errors:', errors);

        const extractErrors = (obj: any): string[] => {
            const messages: string[] = [];
            if (typeof obj !== 'object' || obj === null) return messages;

            // If the object has a 'message' property that is a string, it's likely a FieldError
            if (obj.message && typeof obj.message === 'string') {
                messages.push(obj.message);
                return messages;
            }

            // Recursively search in values (for nested objects/arrays)
            Object.values(obj).forEach((value) => {
                messages.push(...extractErrors(value));
            });

            return messages;
        };

        const allErrors = extractErrors(errors);
        const uniqueErrors = Array.from(new Set(allErrors));

        if (uniqueErrors.length > 0) {
            toast.error('Please fix the following errors:', {
                description: (
                    <div className="mt-2 flex flex-col gap-1 text-slate-800">
                        {uniqueErrors.slice(0, 5).map((error, index) => (
                            <div key={index} className="flex gap-2 text-sm font-medium">
                                <span className="text-red-500">•</span>
                                <span>{error}</span>
                            </div>
                        ))}
                        {uniqueErrors.length > 5 && (
                            <div className="text-sm opacity-80">
                                ...and {uniqueErrors.length - 5} more
                            </div>
                        )}
                    </div>
                ),
                icon: <XCircle size={20} className="text-red-500" />,
                duration: 5000,
            });
        } else {
            toast.error('Please fill in all required fields.', {
                icon: <XCircle size={20} className="text-red-500" />,
            });
        }
    };

    // Recurring Schedule Handlers
    const addSessionToDay = (dayIndex: number) => {
        const schedule = form.getValues('recurringSchedule');
        const daySchedule = schedule?.[dayIndex];
        if (!daySchedule) return;

        // Get the countAttendanceDaily value from the first session of this day
        const firstSessionAttendance = daySchedule.sessions[0]?.countAttendanceDaily || false;

        // Determine session to copy:
        const defaultSession = {
            startTime: '',
            durationHours: '',
            durationMinutes: '',
            link: '',
            countAttendanceDaily: firstSessionAttendance, // Use the first session's attendance setting
            thumbnailFileId: '',
        };
        // Pick source session (with optional props)
        const rawSession =
            (dayIndex === 0
                ? daySchedule.sessions[0]
                : (schedule[0]?.sessions || [])[daySchedule.sessions.length]) ||
            (dayIndex === 0 ? defaultSession : schedule[0]?.sessions[0]) ||
            defaultSession;
        // Normalize fields to strings
        const sessionToCopy = {
            startTime: rawSession.startTime || '',
            durationHours: rawSession.durationHours || '',
            durationMinutes: rawSession.durationMinutes || '',
            link: rawSession.link || '',
            countAttendanceDaily: firstSessionAttendance, // Ensure new session uses same attendance setting
            thumbnailFileId: rawSession.thumbnailFileId || '',
        };
        const updatedSessions = [...daySchedule.sessions, sessionToCopy];
        form.setValue(`recurringSchedule.${dayIndex}.sessions`, updatedSessions, {
            shouldDirty: true,
            shouldValidate: true,
        });
    };

    const removeSessionFromDay = (dayIndex: number, sessionIndex: number) => {
        const sessions = form.getValues(`recurringSchedule.${dayIndex}.sessions`);
        const updatedSessions = [...(Array.isArray(sessions) ? sessions : [])];
        updatedSessions.splice(sessionIndex, 1);

        form.setValue(`recurringSchedule.${dayIndex}.sessions`, updatedSessions);

        if (updatedSessions.length === 0) {
            form.setValue(`recurringSchedule.${dayIndex}.isSelect`, false);
        }
    };

    const toggleEveryDay = () => {
        const currentSchedule = form.getValues('recurringSchedule');
        if (!currentSchedule) return;

        const allSelected = currentSchedule.every((day) => day.isSelect);
        currentSchedule.forEach((day, index) => {
            const isSelecting = !allSelected;
            form.setValue(`recurringSchedule.${index}.isSelect`, isSelecting);

            const dh = form.getValues('durationHours');
            const dm = form.getValues('durationMinutes');
            const l = form.getValues('defaultLink');

            if (isSelecting && (!day.sessions || day.sessions.length === 0)) {
                form.setValue(`recurringSchedule.${index}.sessions`, [
                    {
                        startTime: '',
                        durationHours: dh,
                        durationMinutes: dm,
                        link: l,
                        countAttendanceDaily: false,
                        thumbnailFileId: '',
                    },
                ]);
            }
        });
    };

    const toggleMonToFri = () => {
        const currentSchedule = form.getValues('recurringSchedule');
        if (!currentSchedule) return;

        currentSchedule.forEach((day, index) => {
            const weekDay = WEEK_DAYS.find((d) => d.label === day.day);
            const isWeekday = weekDay?.value
                ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekDay.value)
                : false;
            form.setValue(`recurringSchedule.${index}.isSelect`, isWeekday);

            const dh = form.getValues('durationHours');
            const dm = form.getValues('durationMinutes');
            const l = form.getValues('defaultLink');

            if (isWeekday && (!day.sessions || day.sessions.length === 0)) {
                form.setValue(`recurringSchedule.${index}.sessions`, [
                    {
                        startTime: '',
                        durationHours: dh,
                        durationMinutes: dm,
                        link: l,
                        countAttendanceDaily: false,
                        thumbnailFileId: '',
                    },
                ]);
            }
        });
    };
    const toggleMonToSat = () => {
        const currentSchedule = form.getValues('recurringSchedule');
        if (!currentSchedule) return;

        currentSchedule.forEach((day, index) => {
            const weekDay = WEEK_DAYS.find((d) => d.label === day.day);
            const isWeekday = weekDay?.value
                ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].includes(weekDay.value)
                : false;
            form.setValue(`recurringSchedule.${index}.isSelect`, isWeekday);

            const dh = form.getValues('durationHours');
            const dm = form.getValues('durationMinutes');
            const l = form.getValues('defaultLink');

            if (isWeekday && (!day.sessions || day.sessions.length === 0)) {
                form.setValue(`recurringSchedule.${index}.sessions`, [
                    {
                        startTime: '',
                        durationHours: dh,
                        durationMinutes: dm,
                        link: l,
                        countAttendanceDaily: false,
                        thumbnailFileId: '',
                    },
                ]);
            }
        });
    };
    const toggleCustom = () => {
        const currentSchedule = form.getValues('recurringSchedule');
        if (!currentSchedule) return;

        currentSchedule.forEach((day, index) => {
            const weekDay = WEEK_DAYS.find((d) => d.label === day.day);
            const isWeekday = weekDay?.value ? [''].includes(weekDay.value) : false;
            form.setValue(`recurringSchedule.${index}.isSelect`, isWeekday);

            const dh = form.getValues('durationHours');
            const dm = form.getValues('durationMinutes');
            const l = form.getValues('defaultLink');

            if (isWeekday && (!day.sessions || day.sessions.length === 0)) {
                form.setValue(`recurringSchedule.${index}.sessions`, [
                    {
                        startTime: '',
                        durationHours: dh,
                        durationMinutes: dm,
                        link: l,
                        countAttendanceDaily: false,
                        thumbnailFileId: '',
                    },
                ]);
            }
        });
    };

    // Open dialog to select days to copy to
    const openCopyDialog = (dayIndex: number, sessionIndex: number) => {
        setCopySourceSession({ dayIndex, sessionIndex });
        // Pre-select all other days that are enabled
        const schedule = form.getValues('recurringSchedule');
        if (schedule) {
            const otherDaysIndices = schedule
                .map((day, idx) => (idx !== dayIndex && day.isSelect ? idx : -1))
                .filter((idx) => idx !== -1);
            setSelectedDaysToCopy(otherDaysIndices);
        }
        setIsCopyDialogOpen(true);
    };

    // Manual copy function to copy session data to selected days
    const applyDefaultLinkToSelectedDays = () => {
        if (!pendingDefaultLink) return;

        const currentSchedule = form.getValues('recurringSchedule') || [];

        selectedDaysForLink.forEach((dayName) => {
            const dayIndex = currentSchedule.findIndex((d) => d.day === dayName);
            if (dayIndex === -1) return;

            const day = currentSchedule[dayIndex];
            if (!day || !day.sessions) return;

            // Update ALL sessions for this day
            day.sessions.forEach((session, sessionIndex) => {
                form.setValue(
                    `recurringSchedule.${dayIndex}.sessions.${sessionIndex}.link`,
                    pendingDefaultLink
                );
            });
        });

        setIsDefaultLinkDialogOpen(false);
        setSelectedDaysForLink([]);
        setPendingDefaultLink('');
    };

    const handleToggleDayForLink = (dayName: string) => {
        setSelectedDaysForLink((prev) =>
            prev.includes(dayName) ? prev.filter((d) => d !== dayName) : [...prev, dayName]
        );
    };

    const copySessionToSelectedDays = () => {
        if (!copySourceSession) return;

        const { dayIndex: sourceDayIndex, sessionIndex } = copySourceSession;
        const schedule = form.getValues('recurringSchedule');
        if (!schedule) return;

        const sourceSession = schedule[sourceDayIndex]?.sessions[sessionIndex];
        const sourceDay = schedule[sourceDayIndex];
        if (!sourceSession || !sourceDay) return;

        // Copy to selected days
        selectedDaysToCopy.forEach((targetDayIndex) => {
            const targetDay = schedule[targetDayIndex];
            if (targetDay && targetDay.isSelect) {
                // Copy day-level configurations
                form.setValue(
                    `recurringSchedule.${targetDayIndex}.default_class_link`,
                    sourceDay.default_class_link || null,
                    { shouldDirty: true }
                );
                form.setValue(
                    `recurringSchedule.${targetDayIndex}.default_class_name`,
                    sourceDay.default_class_name || null,
                    { shouldDirty: true }
                );
                form.setValue(
                    `recurringSchedule.${targetDayIndex}.learner_button_config`,
                    sourceDay.learner_button_config || null,
                    { shouldDirty: true }
                );

                // If target session doesn't exist, create it
                if (!targetDay.sessions[sessionIndex]) {
                    const currentSessions =
                        form.getValues(`recurringSchedule.${targetDayIndex}.sessions`) || [];
                    form.setValue(`recurringSchedule.${targetDayIndex}.sessions`, [
                        ...currentSessions,
                        {
                            startTime: sourceSession.startTime,
                            durationHours: sourceSession.durationHours,
                            durationMinutes: sourceSession.durationMinutes,
                            link: sourceSession.link || '',
                            thumbnailFileId: '',
                            countAttendanceDaily:
                                targetDay.sessions[0]?.countAttendanceDaily || false,
                        },
                    ]);
                } else {
                    // Update existing session
                    form.setValue(
                        `recurringSchedule.${targetDayIndex}.sessions.${sessionIndex}.startTime`,
                        sourceSession.startTime,
                        { shouldDirty: true }
                    );
                    form.setValue(
                        `recurringSchedule.${targetDayIndex}.sessions.${sessionIndex}.durationHours`,
                        sourceSession.durationHours,
                        { shouldDirty: true }
                    );
                    form.setValue(
                        `recurringSchedule.${targetDayIndex}.sessions.${sessionIndex}.durationMinutes`,
                        sourceSession.durationMinutes,
                        { shouldDirty: true }
                    );
                    form.setValue(
                        `recurringSchedule.${targetDayIndex}.sessions.${sessionIndex}.link`,
                        sourceSession.link || '',
                        { shouldDirty: true }
                    );
                }
            }
        });

        toast.success(
            `Session details copied to ${selectedDaysToCopy.length} day${selectedDaysToCopy.length !== 1 ? 's' : ''}`
        );
        setIsCopyDialogOpen(false);
        setCopySourceSession(null);
        setSelectedDaysToCopy([]);
    };

    // Toggle day selection in copy dialog
    const toggleDaySelection = (dayIndex: number) => {
        setSelectedDaysToCopy((prev) =>
            prev.includes(dayIndex) ? prev.filter((idx) => idx !== dayIndex) : [...prev, dayIndex]
        );
    };

    // Render Functions
    const renderBasicInformation = () => (
        <div className="flex flex-col gap-6">
            <div className="flex w-full flex-col items-start justify-start gap-4 sm:flex-row">
                <FormField
                    control={control}
                    name="title"
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormControl>
                                <MyInput
                                    inputType="text"
                                    inputPlaceholder="Add Title"
                                    input={field.value}
                                    labelStyle="font-thin"
                                    onChangeFunction={field.onChange}
                                    error={form.formState.errors.title?.message}
                                    required
                                    size="large"
                                    label="Title"
                                    {...field}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <SelectField
                    label="Subject"
                    name="subject"
                    labelStyle="text-sm font-medium"
                    options={[
                        { value: 'none', label: 'Select Subject', _id: -1 },
                        ...SubjectFilterData.map((option, index) => ({
                            value: option.name,
                            label: option.name,
                            _id: index,
                        })),
                    ]}
                    control={form.control}
                    className="mt-[8px] w-full font-thin sm:w-56"
                />
            </div>

            <div className="flex h-full flex-col gap-6">
                <div className="-mb-5 flex flex-col gap-1">
                    <h1 className="text-sm font-medium">Description</h1>
                    <p className="text-xs font-normal text-neutral-500">
                        (Provide a brief overview of your live class. You can include text, emojis,
                        images, or posters to give participants a quick idea of what the session is
                        about)
                    </p>
                </div>
                <FormField
                    control={control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <RichTextEditor
                                    onChange={field.onChange}
                                    value={field.value || ''}
                                    onBlur={field.onBlur}
                                    minHeight={200}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );

    const renderMeetingTypeSelection = () => (
        <FormField
            control={control}
            name="meetingType"
            render={({ field }) => (
                <MyRadioButton
                    name="meetingType"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={[
                        { label: 'One Time Class', value: RecurringType.ONCE },
                        { label: 'Recurring Class', value: RecurringType.WEEKLY },
                    ]}
                    className="flex flex-col gap-4 sm:flex-row"
                />
            )}
        />
    );

    const renderTimezoneSelection = () => {
        const selectedTimezone = form.watch('timeZone') || 'Asia/Kolkata';

        // Get current time in selected timezone
        const getCurrentTime = (timezone: string) => {
            try {
                const now = new Date();
                const zonedTime = toZonedTime(now, timezone);
                return formatTZ(zonedTime, 'PPp', { timeZone: timezone });
            } catch {
                return '';
            }
        };

        const currentTime = getCurrentTime(selectedTimezone);

        return (
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <SelectField
                        label="Timezone"
                        name="timeZone"
                        labelStyle="text-sm font-medium"
                        options={TIMEZONE_OPTIONS}
                        control={form.control}
                        className="mt-[8px] w-full font-thin sm:w-80"
                        required
                    />
                    {currentTime && (
                        <span className="ml-1 text-xs font-medium">
                            Current time: {currentTime}
                        </span>
                    )}
                </div>
            </div>
        );
    };

    const renderSessionTiming = () => (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
                <FormField
                    control={control}
                    name="startTime"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium">
                                Start Date & Time
                                <span className="text-danger-600">*</span>
                            </FormLabel>
                            <FormControl>
                                <MyInput
                                    required
                                    inputType="datetime-local"
                                    input={field.value}
                                    onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        field.onChange(e);
                                        const dateTime = e.target.value;
                                        const timeValue = dateTime.split('T')[1] || '';
                                        const schedule = form.getValues('recurringSchedule') || [];
                                        schedule.forEach((day, idx) => {
                                            if (day.isSelect) {
                                                form.setValue(
                                                    `recurringSchedule.${idx}.sessions.0.startTime`,
                                                    timeValue
                                                );
                                            }
                                        });
                                    }}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                {meetingType !== RecurringType.WEEKLY && (
                    <div>
                        <FormLabel className="text-sm font-medium">
                            Duration<span className="text-danger-600">*</span>
                        </FormLabel>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <FormField
                                control={control}
                                name="durationHours"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                required
                                                inputType="text"
                                                inputPlaceholder="00"
                                                input={field.value}
                                                onKeyPress={(e) => {
                                                    if (!/[0-9]/.test(e.key)) {
                                                        e.preventDefault();
                                                    }
                                                }}
                                                onChangeFunction={(e) => {
                                                    let inputValue = e.target.value.replace(
                                                        /[^0-9]/g,
                                                        ''
                                                    );
                                                    const numValue = parseInt(inputValue);
                                                    if (numValue > 24) {
                                                        inputValue = '24';
                                                    }
                                                    field.onChange(inputValue);
                                                }}
                                                className="w-11 p-2"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <div>hrs</div>
                            <FormField
                                control={control}
                                name="durationMinutes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                required
                                                inputType="text"
                                                inputPlaceholder="00"
                                                input={field.value}
                                                onKeyPress={(e) => {
                                                    if (!/[0-9]/.test(e.key)) {
                                                        e.preventDefault();
                                                    }
                                                }}
                                                onChangeFunction={(e) => {
                                                    let inputValue = e.target.value.replace(
                                                        /[^0-9]/g,
                                                        ''
                                                    );
                                                    const numValue = parseInt(inputValue);
                                                    if (numValue > 59) {
                                                        inputValue = '59';
                                                    }
                                                    field.onChange(inputValue);
                                                }}
                                                className="w-11 p-2"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <div>mins</div>
                        </div>
                    </div>
                )}
            </div>
            {meetingType === RecurringType.WEEKLY && (
                <div className="flex flex-row gap-6">
                    <FormField
                        control={control}
                        name="endDate"
                        render={({ field }) => {
                            // Compute min date from startTime (end date must be after start date)
                            const startTimeValue = form.getValues('startTime');
                            const minEndDate = startTimeValue
                                ? startTimeValue.split('T')[0]
                                : undefined;
                            // Ensure end date is after start date to satisfy validation
                            const computedMin = minEndDate
                                ? (() => {
                                      const d = new Date(minEndDate);
                                      d.setDate(d.getDate() + 1);
                                      return format(d, 'yyyy-MM-dd');
                                  })()
                                : undefined;
                            return (
                                <FormItem>
                                    <FormLabel className="text-sm font-medium">
                                        End Date
                                        <span className="text-danger-600">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <MyInput
                                            inputType="date"
                                            input={field.value}
                                            onChangeFunction={field.onChange}
                                            min={computedMin}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            );
                        }}
                    />
                </div>
            )}
        </div>
    );

    const renderLiveClassLink = () => (
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:gap-8">
            <FormField
                control={control}
                name="defaultLink"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-sm font-medium">
                            Live Class Link
                            <span className="text-danger-600">*</span>
                        </FormLabel>
                        <FormControl>
                            <MyInput
                                inputType="text"
                                inputPlaceholder="Add Link"
                                input={field.value}
                                labelStyle="font-thin"
                                onChangeFunction={field.onChange}
                                error={form.formState.errors.defaultLink?.message}
                                required
                                size="large"
                                {...field}
                                onBlur={(e) => {
                                    field.onBlur();

                                    // Only in CREATE mode
                                    if (isEditModeRef.current) return;

                                    const newLink = e.target.value;
                                    if (!newLink) return;

                                    const currentSchedule = form.getValues('recurringSchedule');
                                    const activeDays =
                                        currentSchedule?.filter(
                                            (day) => day.isSelect && day.sessions?.length > 0
                                        ) || [];

                                    if (activeDays.length === 0) return;

                                    const needsUpdate = activeDays.some((day) =>
                                        day.sessions.some((session) => session.link !== newLink)
                                    );

                                    if (needsUpdate) {
                                        const dayNames = activeDays.map((day) => day.day);
                                        setSelectedDaysForLink(dayNames);
                                        setPendingDefaultLink(newLink);
                                        setIsDefaultLinkDialogOpen(true);
                                    }
                                }}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
            <SelectField
                label="Live Stream Platform"
                name="sessionPlatform"
                labelStyle="text-sm font-medium"
                options={STREAMING_OPTIONS}
                control={form.control}
                className="mt-[8px] w-full font-thin sm:w-56"
                onSelect={handleSessionPlatformChange}
            />
            <div className="flex h-full flex-col items-start justify-around gap-2">
                <div className="text-sm font-medium">Type of Live Class</div>
                <FormField
                    control={control}
                    name="sessionType"
                    render={({ field }) => (
                        <MyRadioButton
                            name="meetingType"
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            options={[
                                { label: 'Live', value: SessionType.LIVE },
                                { label: 'Pre Recorded', value: SessionType.PRE_RECORDED },
                            ]}
                            disabledOptions={disabledLiveClassOptions}
                            className="flex flex-col gap-4 sm:flex-row"
                        />
                    )}
                />
            </div>
        </div>
    );

    const renderStreamingChoices = () => (
        <div className="flex flex-col items-start gap-8">
            <div className="flex flex-col items-start gap-4">
                <div className="flex h-full flex-col items-start justify-around gap-2">
                    <div className="text-sm font-medium">
                        Live Streaming Platform
                        <span className="ml-1 text-xs font-normal text-neutral-500">
                            (Do you want the students to view the class in the learner app, or do
                            you want to redirect them to the app that is hosting the live session?)
                        </span>
                    </div>
                    <FormField
                        control={control}
                        name="streamingType"
                        render={({ field }) => (
                            <MyRadioButton
                                name="streamingType"
                                value={field.value ?? ''}
                                onChange={field.onChange}
                                options={[
                                    {
                                        label: 'Embed in-app',
                                        value: SessionPlatform.EMBED_IN_APP,
                                    },
                                    {
                                        label:
                                            sessionPlatformWatch === StreamingPlatform.YOUTUBE
                                                ? 'Redirect to YouTube'
                                                : sessionPlatformWatch === StreamingPlatform.MEET
                                                  ? 'Redirect to Google Meet'
                                                  : sessionPlatformWatch === StreamingPlatform.ZOOM
                                                    ? 'Redirect to Zoom'
                                                    : 'Redirect to other platform',
                                        value: SessionPlatform.REDIRECT_TO_OTHER_PLATFORM,
                                    },
                                ]}
                                disabledOptions={disabledStreamingOptions}
                                className="flex flex-col gap-4 sm:flex-row"
                            />
                        )}
                    />
                </div>
            </div>
            {/* Lock video playback settings */}
            <div className="flex flex-col items-start gap-4">
                <h4 className="text-sm font-semibold">Lock video playback settings</h4>
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <Controller
                        control={control}
                        name="allowRewind"
                        render={({ field }) => (
                            <label className="flex items-center gap-2">
                                <span className="text-sm">Allow rewind</span>
                                <Switch
                                    disabled={
                                        watch('streamingType') !== SessionPlatform.EMBED_IN_APP
                                    }
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </label>
                        )}
                    />
                    <Controller
                        control={control}
                        name="allowPause"
                        render={({ field }) => (
                            <label className="flex items-center gap-2">
                                <span className="text-sm">Allow play pause</span>
                                <Switch
                                    disabled={
                                        watch('streamingType') !== SessionPlatform.EMBED_IN_APP
                                    }
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </label>
                        )}
                    />
                </div>
            </div>
            <div>
                <div className="flex h-full flex-col items-start gap-4 sm:flex-row">
                    <Controller
                        control={control}
                        name={`enableWaitingRoom`}
                        render={({ field }) => (
                            <label className="flex items-center gap-2">
                                <span className="text-sm">Enable Waiting Room</span>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </label>
                        )}
                    />
                </div>
            </div>
        </div>
    );

    const renderWaitingRoomAndUpload = () => {
        if (form.watch('enableWaitingRoom')) {
            return (
                <div className="flex flex-col items-start gap-4 sm:flex-row">
                    <SelectField
                        label="Open Waiting Room Before"
                        name="openWaitingRoomBefore"
                        labelStyle="text-sm font-medium"
                        options={WAITING_ROOM_OPTIONS}
                        control={form.control}
                        className="mt-[8px] w-full font-thin sm:w-56"
                    />
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept=".png, .jpg, .jpeg"
                        className="hidden"
                    />
                    <input
                        type="file"
                        ref={musicFileInputRef}
                        onChange={handleMusicFileSelect}
                        accept=".mp3, .wav, .ogg, .m4a, .aac, .flac, .wma, .aiff, .au, .mid, .midi, .mp2, .mp3, .m4a, .aac, .flac, .wma, .aiff, .au, .mid, .midi"
                        className="hidden"
                    />
                    <div className="flex flex-col items-start gap-2">
                        <div className="flex flex-col gap-2">
                            <div>Thumbnail</div>
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                onClick={handleUploadClick}
                                className="flex items-center gap-2"
                            >
                                <UploadSimple size={20} />
                                {existingThumbnailId || selectedFile ? 'Replace' : 'Upload'}
                            </MyButton>
                        </div>
                        {/* Show existing thumbnail */}
                        {existingThumbnailId && !selectedFile && (
                            <div className="mt-2 flex h-fit max-w-[200px] flex-row items-center justify-between gap-2 rounded-md border border-green-500 bg-green-50 p-2 text-sm">
                                <span className="text-xs font-medium text-green-700">
                                    Existing file
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleViewFile(existingThumbnailId, 'thumbnail')
                                        }
                                        className="text-green-600 hover:text-green-800"
                                        title="View file"
                                    >
                                        <Eye size={18} weight="bold" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRemoveExistingThumbnail}
                                        className="text-red-500 hover:text-red-700"
                                        title="Remove file"
                                    >
                                        <X size={18} weight="bold" />
                                    </button>
                                </div>
                            </div>
                        )}
                        {/* Show newly selected file */}
                        {selectedFile && (
                            <div className="mt-2 flex h-fit max-w-[200px] flex-row items-center justify-between gap-2 rounded-md border border-primary-500 p-2 text-sm">
                                <span className="max-w-[140px] truncate text-xs">
                                    {selectedFile.name}
                                </span>
                                <X
                                    className="shrink-0 cursor-pointer text-red-500 hover:text-red-700"
                                    onClick={handleRemoveFile}
                                    size={18}
                                    weight="bold"
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col items-start gap-2">
                        <div className="flex flex-col gap-2">
                            <div>Background Score</div>
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                onClick={handleMusicUploadClick}
                                className="flex items-center gap-2"
                            >
                                <UploadSimple size={20} />
                                {existingMusicId || selectedMusicFile ? 'Replace' : 'Upload'}
                            </MyButton>
                        </div>
                        {/* Show existing music file */}
                        {existingMusicId && !selectedMusicFile && (
                            <div className="mt-2 flex h-fit max-w-[200px] flex-row items-center justify-between gap-2 rounded-md border border-green-500 bg-green-50 p-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <MusicNote size={16} weight="fill" className="text-green-600" />
                                    <span className="text-xs font-medium text-green-700">
                                        Existing file
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleViewFile(existingMusicId, 'music')}
                                        className="text-green-600 hover:text-green-800"
                                        title="Play audio"
                                    >
                                        <Eye size={18} weight="bold" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRemoveExistingMusic}
                                        className="text-red-500 hover:text-red-700"
                                        title="Remove file"
                                    >
                                        <X size={18} weight="bold" />
                                    </button>
                                </div>
                            </div>
                        )}
                        {/* Show newly selected music file */}
                        {selectedMusicFile && (
                            <div className="mt-2 flex h-fit max-w-[200px] flex-row items-center justify-between gap-2 rounded-md border border-primary-500 p-2 text-sm">
                                <span className="max-w-[140px] truncate text-xs">
                                    {selectedMusicFile.name}
                                </span>
                                <X
                                    className="cursor-pointer text-red-500 hover:text-red-700"
                                    onClick={handleRemoveMusicFile}
                                    size={18}
                                    weight="bold"
                                />
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        return <></>;
    };

    const renderRecurringSchedule = () =>
        meetingType === RecurringType.WEEKLY && (
            <>
                {/* Recurring Schedule header with days selector */}
                <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Recurring Schedule</h2>
                    <Select
                        value={scheduleType || ''}
                        onValueChange={(
                            value: 'everyday' | 'weekday' | 'exceptSunday' | 'custom'
                        ) => {
                            setScheduleType(value);
                            if (value === 'everyday') toggleEveryDay();
                            else if (value === 'weekday') toggleMonToFri();
                            else if (value === 'exceptSunday') toggleMonToSat();
                            else if (value === 'custom') toggleCustom();
                        }}
                    >
                        <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Select days" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="everyday">Every day</SelectItem>
                            <SelectItem value="weekday">Mon-Fri</SelectItem>
                            <SelectItem value="exceptSunday">Mon-Sat</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {/* Modern Recurring schedule layout */}
                <div className="space-y-4">
                    {recurringSchedule?.map((dayField, dayIndex) => {
                        const isSelect = watch(`recurringSchedule.${dayIndex}.isSelect`);
                        const dayName =
                            WEEK_DAYS.find((d) => d.label === dayField.day)?.value ?? dayField.day;

                        return (
                            <div key={dayField.day} className="group">
                                {/* Day Header Card */}
                                <div
                                    className={`rounded-xl border-2 transition-all duration-200 ${
                                        isSelect
                                            ? 'border-primary-200 bg-primary-50/50 shadow-sm'
                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                    }`}
                                >
                                    {/* Day Toggle Header */}
                                    <div className="flex flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                form.setValue(
                                                    `recurringSchedule.${dayIndex}.isSelect`,
                                                    !isSelect
                                                )
                                            }
                                            className="flex items-center gap-3 text-left transition-colors duration-200"
                                        >
                                            <div
                                                className={`flex size-5 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                                                    isSelect
                                                        ? 'border-primary-500 bg-primary-500'
                                                        : 'border-gray-300 bg-white group-hover:border-gray-400'
                                                }`}
                                            >
                                                {isSelect && (
                                                    <div className="size-2 rounded-full bg-white"></div>
                                                )}
                                            </div>
                                            <div>
                                                <h3
                                                    className={`text-lg font-semibold transition-colors duration-200 ${
                                                        isSelect
                                                            ? 'text-primary-900'
                                                            : 'text-gray-900'
                                                    }`}
                                                >
                                                    {dayName}
                                                </h3>
                                                <p className="text-sm text-gray-500">
                                                    {isSelect
                                                        ? `${dayField.sessions.length} session${dayField.sessions.length !== 1 ? 's' : ''} scheduled`
                                                        : 'Click to schedule sessions'}
                                                </p>
                                            </div>
                                        </button>

                                        {isSelect && (
                                            <MyButton
                                                type="button"
                                                buttonType="secondary"
                                                onClick={() => addSessionToDay(dayIndex)}
                                                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
                                            >
                                                <Plus size={16} />
                                                Add Session
                                            </MyButton>
                                        )}
                                    </div>

                                    {/* Daily Attendance Setting */}
                                    {isSelect && (
                                        <div className="bg-primary-25 border-t border-primary-100 px-6 py-2">
                                            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <Label className="text-sm font-medium text-gray-900">
                                                        Count attendance daily
                                                    </Label>
                                                </div>
                                                <Controller
                                                    control={control}
                                                    name={`recurringSchedule.${dayIndex}.sessions.0.countAttendanceDaily`}
                                                    render={({ field }) => (
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={(checked) => {
                                                                // Update all sessions for this day
                                                                const currentDay = form.getValues(
                                                                    `recurringSchedule.${dayIndex}`
                                                                );
                                                                if (currentDay?.sessions) {
                                                                    currentDay.sessions.forEach(
                                                                        (_, sessionIdx) => {
                                                                            form.setValue(
                                                                                `recurringSchedule.${dayIndex}.sessions.${sessionIdx}.countAttendanceDaily`,
                                                                                checked
                                                                            );
                                                                        }
                                                                    );
                                                                }
                                                            }}
                                                        />
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Sessions List */}
                                    {isSelect && (
                                        <div className="border-t border-primary-100 bg-white/50">
                                            <div className="space-y-4 p-2">
                                                {dayField.sessions.map((session, sessionIndex) => (
                                                    <div
                                                        key={sessionIndex}
                                                        className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow duration-200 hover:shadow-md"
                                                    >
                                                        <div className="mb-4 flex items-center justify-between">
                                                            <h4 className="text-sm font-semibold text-gray-900">
                                                                Session {sessionIndex + 1}
                                                            </h4>
                                                            {sessionIndex > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        removeSessionFromDay(
                                                                            dayIndex,
                                                                            sessionIndex
                                                                        )
                                                                    }
                                                                    className="flex size-8 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors duration-200 hover:bg-red-100"
                                                                >
                                                                    <Trash size={16} />
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Session Details Grid */}
                                                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                                                            {/* Start Time */}
                                                            <div className="space-y-2">
                                                                <Label className="text-sm font-medium text-gray-700">
                                                                    Start Time
                                                                </Label>
                                                                <SelectField
                                                                    label=""
                                                                    name={`recurringSchedule.${dayIndex}.sessions.${sessionIndex}.startTime`}
                                                                    labelStyle="font-thin"
                                                                    options={timeOptions?.map(
                                                                        (option, idx) => ({
                                                                            value: option,
                                                                            label: option,
                                                                            _id: idx,
                                                                        })
                                                                    )}
                                                                    control={form.control}
                                                                    className="w-full"
                                                                />
                                                            </div>

                                                            {/* Duration */}
                                                            <div className="space-y-2">
                                                                <Label className="text-sm font-medium text-gray-700">
                                                                    Duration
                                                                </Label>
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <FormField
                                                                        control={control}
                                                                        name={`recurringSchedule.${dayIndex}.sessions.${sessionIndex}.durationHours`}
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormControl>
                                                                                    <MyInput
                                                                                        inputType="text"
                                                                                        inputPlaceholder="00"
                                                                                        input={
                                                                                            field.value
                                                                                        }
                                                                                        onKeyPress={(
                                                                                            e
                                                                                        ) => {
                                                                                            if (
                                                                                                !/[0-9]/.test(
                                                                                                    e.key
                                                                                                )
                                                                                            )
                                                                                                e.preventDefault();
                                                                                        }}
                                                                                        onChangeFunction={(
                                                                                            e
                                                                                        ) => {
                                                                                            let val =
                                                                                                e.target.value.replace(
                                                                                                    /[^0-9]/g,
                                                                                                    ''
                                                                                                );
                                                                                            const num =
                                                                                                parseInt(
                                                                                                    val
                                                                                                );
                                                                                            if (
                                                                                                num >
                                                                                                24
                                                                                            )
                                                                                                val =
                                                                                                    '24';
                                                                                            field.onChange(
                                                                                                val
                                                                                            );
                                                                                        }}
                                                                                        className="w-16 text-center"
                                                                                    />
                                                                                </FormControl>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <span className="text-sm text-gray-500">
                                                                        hrs
                                                                    </span>
                                                                    <FormField
                                                                        control={control}
                                                                        name={`recurringSchedule.${dayIndex}.sessions.${sessionIndex}.durationMinutes`}
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormControl>
                                                                                    <MyInput
                                                                                        inputType="text"
                                                                                        inputPlaceholder="00"
                                                                                        input={
                                                                                            field.value
                                                                                        }
                                                                                        onKeyPress={(
                                                                                            e
                                                                                        ) => {
                                                                                            if (
                                                                                                !/[0-9]/.test(
                                                                                                    e.key
                                                                                                )
                                                                                            )
                                                                                                e.preventDefault();
                                                                                        }}
                                                                                        onChangeFunction={(
                                                                                            e
                                                                                        ) => {
                                                                                            let val =
                                                                                                e.target.value.replace(
                                                                                                    /[^0-9]/g,
                                                                                                    ''
                                                                                                );
                                                                                            const num =
                                                                                                parseInt(
                                                                                                    val
                                                                                                );
                                                                                            if (
                                                                                                num >
                                                                                                59
                                                                                            )
                                                                                                val =
                                                                                                    '59';
                                                                                            field.onChange(
                                                                                                val
                                                                                            );
                                                                                        }}
                                                                                        className="w-16 text-center"
                                                                                    />
                                                                                </FormControl>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <span className="text-sm text-gray-500">
                                                                        mins
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Live Class Link */}
                                                            <div className="space-y-2">
                                                                <Label className="text-sm font-medium text-gray-700">
                                                                    Live Class Link
                                                                </Label>
                                                                <FormField
                                                                    control={control}
                                                                    name={`recurringSchedule.${dayIndex}.sessions.${sessionIndex}.link`}
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormControl>
                                                                                <LiveClassLinkField
                                                                                    value={
                                                                                        field.value ||
                                                                                        ''
                                                                                    }
                                                                                    onChange={
                                                                                        field.onChange
                                                                                    }
                                                                                    onApplyWithScope={(
                                                                                        scope
                                                                                    ) => {
                                                                                        applyLinkWithScope(
                                                                                            scope,
                                                                                            dayIndex,
                                                                                            sessionIndex
                                                                                        );
                                                                                    }}
                                                                                    isEdit={
                                                                                        isEdit ||
                                                                                        false
                                                                                    }
                                                                                    dayName={dayField.day.charAt(0).toUpperCase() + dayField.day.slice(1)}
                                                                                />
                                                                            </FormControl>
                                                                            <FormMessage className="text-sm text-red-500" />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </div>
                                                        </div>
                                                        {/* Session Options */}
                                                        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-4">
                                                            <div className="flex flex-wrap items-center gap-4">
                                                                {/* Thumbnail Upload */}
                                                                <div className="flex flex-wrap items-center gap-3">
                                                                    <span className="text-sm font-medium text-gray-700">
                                                                        Thumbnail:
                                                                    </span>
                                                                    <input
                                                                        type="file"
                                                                        accept=".png, .jpg, .jpeg"
                                                                        onChange={(e) =>
                                                                            handleSessionThumbnailSelect(
                                                                                dayIndex,
                                                                                sessionIndex,
                                                                                e
                                                                            )
                                                                        }
                                                                        className="hidden"
                                                                        id={`session-thumbnail-${dayIndex}-${sessionIndex}`}
                                                                    />
                                                                    {getSessionThumbnail(
                                                                        dayIndex,
                                                                        sessionIndex
                                                                    ) ? (
                                                                        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2">
                                                                            <span className="max-w-32 truncate text-nowrap text-sm text-green-700">
                                                                                {
                                                                                    getSessionThumbnail(
                                                                                        dayIndex,
                                                                                        sessionIndex
                                                                                    )?.name
                                                                                }
                                                                            </span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    handleSessionThumbnailRemove(
                                                                                        dayIndex,
                                                                                        sessionIndex
                                                                                    )
                                                                                }
                                                                                className="text-green-600 hover:text-green-800"
                                                                            >
                                                                                <X size={16} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <MyButton
                                                                            type="button"
                                                                            buttonType="secondary"
                                                                            scale="small"
                                                                            onClick={() => {
                                                                                document
                                                                                    .getElementById(
                                                                                        `session-thumbnail-${dayIndex}-${sessionIndex}`
                                                                                    )
                                                                                    ?.click();
                                                                            }}
                                                                            className="flex items-center gap-2"
                                                                        >
                                                                            <UploadSimple
                                                                                size={16}
                                                                            />
                                                                            Upload
                                                                        </MyButton>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Copy to days button */}
                                                            <MyButton
                                                                type="button"
                                                                buttonType="primary"
                                                                scale="small"
                                                                onClick={() =>
                                                                    openCopyDialog(
                                                                        dayIndex,
                                                                        sessionIndex
                                                                    )
                                                                }
                                                                className="flex items-center gap-2"
                                                            >
                                                                <Copy size={16} />
                                                                Copy to days
                                                            </MyButton>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Default Class Link and Custom Button - Day Level */}
                                    {isSelect && (
                                        <div className="mx-4 mb-4 space-y-6 rounded-lg border border-gray-200 bg-white p-4">
                                            <div className="space-y-4">
                                                <Controller
                                                    control={control}
                                                    name={`recurringSchedule.${dayIndex}.default_class_link`}
                                                    render={({ field }) => (
                                                        <Controller
                                                            control={control}
                                                            name={`recurringSchedule.${dayIndex}.default_class_name`}
                                                            render={({ field: classNameField }) => (
                                                                <DefaultClassLinkInput
                                                                    value={field.value}
                                                                    onChange={field.onChange}
                                                                    classNameValue={
                                                                        classNameField.value
                                                                    }
                                                                    onClassNameChange={
                                                                        classNameField.onChange
                                                                    }
                                                                    onCopy={() => {
                                                                        setCopySourceDefaultLink({
                                                                            dayIndex,
                                                                        });
                                                                        setIsCopyDefaultLinkDialogOpen(
                                                                            true
                                                                        );
                                                                        setSelectedDaysToCopyDefaultLink(
                                                                            []
                                                                        );
                                                                    }}
                                                                />
                                                            )}
                                                        />
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </>
        );

    const renderCustomButtonConfig = () => (
        <div className="flex flex-col gap-2">
            <Controller
                control={control}
                name="learner_button_config"
                render={({ field }) => (
                    <LearnerButtonConfigInput value={field.value} onChange={field.onChange} />
                )}
            />
            <p className="px-1 text-xs text-gray-500">
                This button will be visible to learners on the Live Session screen and the Default
                Session screen.
            </p>
        </div>
    );

    return (
        <>
            {!isFormInitialized ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="size-8 animate-spin" />
                </div>
            ) : (
                <FormProvider {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit, onError)}
                        className="flex flex-col gap-5"
                    >
                        <div className="z-[9] m-0 flex items-center justify-between border-b border-neutral-200 bg-white p-0 py-2 text-lg font-semibold">
                            <h1>Live Session Information</h1>
                            <MyButton
                                type="submit"
                                scale="large"
                                buttonType="primary"
                                disable={isSubmitting}
                                className="w-32"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="animate-spin text-white" />
                                ) : (
                                    'Next'
                                )}
                            </MyButton>
                        </div>

                        <div className="flex flex-col gap-8">
                            {renderBasicInformation()}
                            {renderMeetingTypeSelection()}
                            {renderTimezoneSelection()}
                            {renderSessionTiming()}
                            {renderLiveClassLink()}
                            {renderStreamingChoices()}
                            {renderCustomButtonConfig()}
                            {renderWaitingRoomAndUpload()}
                            {renderRecurringSchedule()}
                            <Separator />
                        </div>
                    </form>
                </FormProvider>
            )}

            {/* Default Link Copy Dialog */}
            <MyDialog
                open={isDefaultLinkDialogOpen}
                onOpenChange={setIsDefaultLinkDialogOpen}
                heading="Apply Link to Other Days"
                className="w-[400px]"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Select the days you want to apply this default link to:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {form.getValues('recurringSchedule')?.map((day, index) => {
                            if (!day.isSelect) return null;
                            const currentDayOfWeek = WEEK_DAYS.findIndex(
                                (d) => d.label === day.day
                            );
                            return (
                                <button
                                    key={day.day}
                                    type="button"
                                    onClick={() => {
                                        setSelectedDaysForLink((prev) =>
                                            prev.includes(day.day)
                                                ? prev.filter((d) => d !== day.day)
                                                : [...prev, day.day]
                                        );
                                    }}
                                    className={`rounded-md border p-2 text-sm transition-colors ${
                                        selectedDaysForLink.includes(day.day)
                                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    {day.day}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <MyButton
                            buttonType="secondary"
                            onClick={() => setIsDefaultLinkDialogOpen(false)}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            onClick={() => {
                                applyDefaultLinkToSelectedDays();
                                setIsDefaultLinkDialogOpen(false);
                            }}
                            disable={selectedDaysForLink.length === 0}
                        >
                            Apply Link
                        </MyButton>
                    </div>
                </div>
            </MyDialog>

            {/* Copy Session Dialog */}
            <MyDialog
                open={isCopyDialogOpen}
                onOpenChange={setIsCopyDialogOpen}
                heading="Copy Session to Other Days"
                className="w-[400px]"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Select the days you want to copy this session to:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {form.getValues('recurringSchedule')?.map((day, index) => {
                            if (!day.isSelect || day.day === copySourceSession?.dayIndex.toString())
                                return null;
                            return (
                                <button
                                    key={day.day}
                                    type="button"
                                    onClick={() => {
                                        setSelectedDaysToCopy((prev) =>
                                            prev.includes(index)
                                                ? prev.filter((i) => i !== index)
                                                : [...prev, index]
                                        );
                                    }}
                                    className={`rounded-md border p-2 text-sm transition-colors ${
                                        selectedDaysToCopy.includes(index)
                                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    {day.day}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <MyButton buttonType="secondary" onClick={() => setIsCopyDialogOpen(false)}>
                            Cancel
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            onClick={() => {
                                executeCopySession();
                                setIsCopyDialogOpen(false);
                            }}
                            disable={selectedDaysToCopy.length === 0}
                        >
                            Copy Session
                        </MyButton>
                    </div>
                </div>
            </MyDialog>

            {/* Copy Default Link Dialog */}
            <MyDialog
                open={isCopyDefaultLinkDialogOpen}
                onOpenChange={setIsCopyDefaultLinkDialogOpen}
                heading="Copy Default Link to Other Days"
                className="w-[400px]"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Select the days you want to copy this default link to:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {form.getValues('recurringSchedule')?.map((day, index) => {
                            if (!day.isSelect || index === copySourceDefaultLink?.dayIndex)
                                return null;
                            return (
                                <button
                                    key={day.day}
                                    type="button"
                                    onClick={() => {
                                        setSelectedDaysToCopyDefaultLink((prev) =>
                                            prev.includes(index)
                                                ? prev.filter((i) => i !== index)
                                                : [...prev, index]
                                        );
                                    }}
                                    className={`rounded-md border p-2 text-sm transition-colors ${
                                        selectedDaysToCopyDefaultLink.includes(index)
                                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    {day.day}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <MyButton
                            buttonType="secondary"
                            onClick={() => setIsCopyDefaultLinkDialogOpen(false)}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            onClick={executeCopyDefaultLink}
                            disable={selectedDaysToCopyDefaultLink.length === 0}
                        >
                            Copy Default Link
                        </MyButton>
                    </div>
                </div>
            </MyDialog>

            {/* Link Update Confirmation Dialog */}
            <MyDialog
                open={isLinkUpdateDialogOpen}
                onOpenChange={setIsLinkUpdateDialogOpen}
                heading="You've changed the class link. Where do you want to apply this change?"
                className="w-[500px]"
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                        {/* Option 1: Only this session */}
                        <button
                            type="button"
                            onClick={() => {
                                setIsLinkUpdateDialogOpen(false);
                                if (pendingSubmitData) {
                                    executeSubmission(pendingSubmitData, 'ONLY_THIS');
                                }
                            }}
                            className="group flex items-start gap-4 rounded-xl border border-gray-200 p-4 text-left transition-all hover:border-primary-500 hover:bg-primary-50"
                        >
                            <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 group-hover:border-primary-600 group-hover:bg-primary-600">
                                <div className="h-2 w-2 rounded-full bg-white opacity-0 group-hover:opacity-100" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 group-hover:text-primary-700">
                                    Only This Session
                                </h3>
                                <p className="text-sm text-gray-500 group-hover:text-primary-600/80">
                                    Apply the new link to only this one session on {changedDayLabel}.
                                </p>
                            </div>
                        </button>

                        {/* Option 2: Current day all sessions */}
                        <button
                            type="button"
                            onClick={() => {
                                setIsLinkUpdateDialogOpen(false);
                                if (pendingSubmitData) {
                                    executeSubmission(pendingSubmitData, 'CURRENT_DAY_ALL_SESSIONS');
                                }
                            }}
                            className="group flex items-start gap-4 rounded-xl border border-gray-200 p-4 text-left transition-all hover:border-primary-500 hover:bg-primary-50"
                        >
                            <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 group-hover:border-primary-600 group-hover:bg-primary-600">
                                <div className="h-2 w-2 rounded-full bg-white opacity-0 group-hover:opacity-100" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 group-hover:text-primary-700">
                                    All Sessions on This {changedDayLabel}
                                </h3>
                                <p className="text-sm text-gray-500 group-hover:text-primary-600/80">
                                    Apply the new link for all sessions on this {changedDayLabel}.
                                </p>
                            </div>
                        </button>

                        {/* Option 3: This & all upcoming sessions */}
                        <button
                            type="button"
                            onClick={() => {
                                setIsLinkUpdateDialogOpen(false);
                                if (pendingSubmitData) {
                                    executeSubmission(pendingSubmitData, 'ALL_FUTURE');
                                }
                            }}
                            className="group flex items-start gap-4 rounded-xl border border-gray-200 p-4 text-left transition-all hover:border-primary-500 hover:bg-primary-50"
                        >
                            <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 group-hover:border-primary-600 group-hover:bg-primary-600">
                                <div className="h-2 w-2 rounded-full bg-white opacity-0 group-hover:opacity-100" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 group-hover:text-primary-700">
                                    This Session on Upcoming {changedDayLabel}s
                                </h3>
                                <p className="text-sm text-gray-500 group-hover:text-primary-600/80">
                                    Apply the new link to this session on every upcoming {changedDayLabel}.
                                </p>
                            </div>
                        </button>

                        {/* Option 4: All upcoming days – all sessions */}
                        <button
                            type="button"
                            onClick={() => {
                                setIsLinkUpdateDialogOpen(false);
                                if (pendingSubmitData) {
                                    executeSubmission(
                                        pendingSubmitData,
                                        'ALL_FUTURE_ALL_SESSIONS'
                                    );
                                }
                            }}
                            className="group flex items-start gap-4 rounded-xl border border-gray-200 p-4 text-left transition-all hover:border-primary-500 hover:bg-primary-50"
                        >
                            <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 group-hover:border-primary-600 group-hover:bg-primary-600">
                                <div className="h-2 w-2 rounded-full bg-white opacity-0 group-hover:opacity-100" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 group-hover:text-primary-700">
                                    Upcoming {changedDayLabel}s All Sessions
                                </h3>
                                <p className="text-sm text-gray-500 group-hover:text-primary-600/80">
                                    Apply the new link for all sessions on all upcoming occurrences of this day.
                                    <br />
                                    <span className="italic">Example: All 6 sessions on every future {changedDayLabel} will have the new link.</span>
                                </p>
                            </div>
                        </button>
                    </div>

                    <div className="flex justify-end pt-2">
                        <MyButton
                            buttonType="secondary"
                            onClick={() => setIsLinkUpdateDialogOpen(false)}
                        >
                            Cancel
                        </MyButton>
                    </div>
                </div>
            </MyDialog>
        </>
    );
}
