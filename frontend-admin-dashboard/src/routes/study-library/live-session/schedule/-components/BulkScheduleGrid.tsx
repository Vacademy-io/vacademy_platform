import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
    Controller,
    useForm,
    useFieldArray,
    useWatch,
    useFormState,
    type UseFormReturn,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { fromZonedTime, format as formatTZ, toZonedTime } from 'date-fns-tz';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
    Copy,
    Plus,
    Trash,
    Warning,
    Lightning,
    Globe,
    Table as TableIcon,
    Article,
    UsersThree,
    ChatTeardrop,
    Record,
} from '@phosphor-icons/react';
import { Switch } from '@/components/ui/switch';
import { WAITING_ROOM_OPTIONS } from '../-constants/options';
import { UploadFileInS3 } from '@/services/upload_file';
import { UploadSimple, X as XIcon, MusicNote, MagnifyingGlass, CircleNotch, DownloadSimple } from '@phosphor-icons/react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

import { bulkSessionFormSchema, type BulkSessionForm, type BulkSessionRow } from '../-schema/bulkSchema';
import { TIMEZONE_OPTIONS, STREAMING_OPTIONS } from '../-constants/options';
import { useLiveSessionSettings } from '@/hooks/useLiveSessionSettings';
import type { PlatformKey } from '@/services/live-session-settings';
import { transformFormToDTOStep1, transformFormToDTOStep2 } from '../../-constants/helper';
import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';
import { sessionFormSchema } from '../-schema/schema';
import { RecurringType, SessionPlatform, SessionType } from '../../-constants/enums';
import { createLiveSessionsChunked, type BulkLiveSessionRowResult } from '../-services/utils';
import { useLiveSessionStore } from '../-store/sessionIdstore';
import { SectionCard } from './SectionCard';
import { LiveSessionPreviewDialog } from './LiveSessionPreviewDialog';
import { BulkCsvImportDialog } from './BulkCsvImportDialog';
import { downloadScheduleTemplate, downloadBatchReference, downloadResultsCsv } from '../-utils/bulkCsv';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { useFilterDataForAssesment } from '@/routes/assessment/assessment-list/-utils.ts/useFiltersData';
import { useStudyLibraryStore } from '@/stores/study-library/use-study-library-store';
import { useStudyLibraryQuery } from '@/routes/study-library/courses/-services/getStudyLibraryDetails';
import { useQuery } from '@tanstack/react-query';
import {
    DropdownItemType,
} from '@/components/common/students/enroll-manually/dropdownTypesForPackageItems';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MyRadioButton } from '@/components/design-system/radio';
import { MyButton } from '@/components/design-system/button';
import { Checkbox } from '@/components/ui/checkbox';
import { LockKey, BellRinging, UsersThree as UsersThreeIcon } from '@phosphor-icons/react';
import { AccessType } from '../../-constants/enums';
import SelectField from '@/components/design-system/select-field';
import { z } from 'zod';

const TimeOptions = [
    { label: '5 minutes before', value: '5m' },
    { label: '10 minutes before', value: '10m' },
    { label: '30 minutes before', value: '30m' },
    { label: '1 hour before', value: '1h' },
];

/**
 * Compute today's date and the next 15-minute time slot, in the given IANA
 * timezone. Browsers default `new Date().toISOString()` to UTC which causes
 * "tomorrow's date" / "yesterday's date" surprises near midnight; using
 * date-fns-tz lets the cell match the wall-clock the admin sees.
 */
const getDefaultRowDateTime = (timeZone: string) => {
    let zone: string;
    try {
        // Throws on bad input; fall back to browser zone.
        formatTZ(new Date(), 'HH:mm', { timeZone });
        zone = timeZone;
    } catch {
        try {
            zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
        } catch {
            zone = 'Asia/Kolkata';
        }
    }
    const now = toZonedTime(new Date(), zone);
    // Round to next 15-minute slot so the default isn't an awkward 10:07.
    const minutes = now.getMinutes();
    const rounded = Math.ceil(minutes / 15) * 15;
    if (rounded === 60) {
        now.setHours(now.getHours() + 1);
        now.setMinutes(0);
    } else {
        now.setMinutes(rounded);
    }
    const startDate = formatTZ(now, 'yyyy-MM-dd', { timeZone: zone });
    const startTime = formatTZ(now, 'HH:mm', { timeZone: zone });
    return { startDate, startTime };
};

const blankRow = (
    defaultPlatform: string = 'other',
    timeZone: string = 'Asia/Kolkata'
) => {
    const { startDate, startTime } = getDefaultRowDateTime(timeZone);
    return {
        title: '',
        subject: '',
        startDate,
        startTime,
        durationHours: '1',
        durationMinutes: '0',
        platform: defaultPlatform,
        link: '',
        description: '',
        selectedLevels: [] as Array<{
            courseId: string;
            sessionId: string;
            levelId: string;
        }>,
    };
};

// Same list the single-class form ships with — keeps the bulk experience in
// lock-step so admins don't get a different feedback form depending on how
// they created the class.
const BULK_DEFAULT_FEEDBACK_QUESTIONS = [
    {
        id: 'rating',
        type: 'star_rating',
        label: 'How was the session?',
        enabled: true,
        mandatory: true,
        max_stars: 5,
        allow_half: true,
    },
    {
        id: 'learnings',
        type: 'free_text',
        label: 'What did you learn in the session?',
        enabled: true,
        mandatory: false,
    },
    {
        id: 'doubts',
        type: 'free_text',
        label: 'Any doubts or questions you have?',
        enabled: true,
        mandatory: false,
    },
    {
        id: 'feedback',
        type: 'free_text',
        label: 'Feedback for the session',
        enabled: true,
        mandatory: false,
    },
];

/**
 * A row is "ready" once it has a title, date, start time, and either a link or
 * a platform that auto-provisions one (Zoho / BBB). Shared by the live header
 * count badge and the preview dialog so both agree on what's submittable.
 */
const isRowReady = (r: {
    title?: string;
    startDate?: string;
    startTime?: string;
    platform?: string;
    link?: string;
}) =>
    Boolean(
        r?.title &&
            r?.startDate &&
            r?.startTime &&
            (r?.platform === 'zoho' || r?.platform === 'bbb' || r?.link)
    );

// Stable empty fallback so the memoized RowEditor doesn't see a new `courses`
// array identity on every render while the study-library query is in flight.
const EMPTY_COURSES: RowBatchPickerProps['courses'] = [];

export function BulkScheduleGrid() {
    const navigate = useNavigate();
    const { setBulkSessionIds, setStep1Data } = useLiveSessionStore();
    const { settings: liveSessionSettings } = useLiveSessionSettings();
    const filteredStreamingOptions = useMemo(
        () =>
            STREAMING_OPTIONS.filter(
                (opt) =>
                    liveSessionSettings.allowedPlatforms[opt.value as PlatformKey] !== false
            ),
        [liveSessionSettings.allowedPlatforms]
    );

    // Same subject source the single-class form uses, so the bulk grid offers
    // the institute's curated subject list instead of free text.
    // Use plain useQuery (not useSuspenseQuery) so the component doesn't throw
    // a Promise when the institute fetch is still in flight. The route gate
    // only waits for live-session settings, so on a cold load (deep link /
    // refresh) the institute query may still be pending here. With no
    // <Suspense> boundary above this component, a throw would bubble to the
    // route errorComponent and render the "System Crashed" page. Guarding
    // with isLoading + an early return preserves the same behaviour minus
    // the crash.
    const { data: instituteDetails, isLoading: instituteLoading } = useQuery(
        useInstituteQuery()
    );
    const { SubjectFilterData } = useFilterDataForAssesment(
        instituteDetails as never
    );
    const subjectOptions = useMemo(
        () =>
            (SubjectFilterData ?? []).map((s: { name: string }) => ({
                value: s.name,
                label: s.name,
            })),
        [SubjectFilterData]
    );
    const [submitting, setSubmitting] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [resultDialog, setResultDialog] = useState<{
        open: boolean;
        created: number;
        failed: number;
        results: BulkLiveSessionRowResult[];
    } | null>(null);
    const [csvImportOpen, setCsvImportOpen] = useState(false);
    // Live "Creating X/Y…" progress while the throttled chunks run.
    const [createProgress, setCreateProgress] = useState<{
        done: number;
        total: number;
    } | null>(null);

    const browserTz = useMemo(() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
        } catch {
            return 'Asia/Kolkata';
        }
    }, []);

    const initialTimeZone = liveSessionSettings.defaultTimeZone || browserTz;

    const form = useForm<BulkSessionForm>({
        resolver: zodResolver(bulkSessionFormSchema),
        mode: 'onChange',
        defaultValues: {
            timeZone: initialTimeZone,
            rows: [blankRow('other', initialTimeZone)],
            sharedOptions: {
                enableWaitingRoom: false,
                waitingRoomMinutes: '5',
                waitingRoomThumbnailFileId: undefined,
                waitingRoomMusicFileId: undefined,
                allowRewind: true,
                allowPause: true,
                enableFeedback: false,
                feedbackCompulsory: liveSessionSettings.defaultFeedbackCompulsory ?? false,
                feedbackQuestions: BULK_DEFAULT_FEEDBACK_QUESTIONS,
                recordSession: false,
                autoStartRecording: false,
                muteOnStart: true,
                webcamsOnlyForModerator: false,
                guestPolicy: 'ALWAYS_ACCEPT' as const,
                defaultPlatform: 'other',
                defaultDescription: '',
            },
            accessType: AccessType.PRIVATE,
            notifyBy: {
                mail: false,
                whatsapp: false,
                push_notification: false,
                system_notification: false,
            },
            notifySettings: {
                onCreate: false,
                beforeLive: false,
                beforeLiveTime: [],
                onLive: true,
                onAttendance: false,
            },
        },
    });

    const {
        fields: beforeLiveFields,
        append: beforeLiveAppend,
        remove: beforeLiveRemove,
    } = useFieldArray({
        control: form.control,
        name: 'notifySettings.beforeLiveTime',
    });

    // Course / session list for the batch picker (same source step 2 uses).
    // Trigger the same query single-class step 2 implicitly relies on so the
    // store is populated even when admins land directly on the schedule page.
    useQuery(useStudyLibraryQuery());
    const { studyLibraryData } = useStudyLibraryStore();
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
    const accessType = form.watch('accessType');

    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [musicFile, setMusicFile] = useState<File | null>(null);
    const [thumbnailUploading, setThumbnailUploading] = useState(false);
    const [musicUploading, setMusicUploading] = useState(false);
    const thumbInputRef = useMemo(
        () => ({ current: null as HTMLInputElement | null }),
        []
    );
    const musicInputRef = useMemo(
        () => ({ current: null as HTMLInputElement | null }),
        []
    );

    const handleSharedThumbnail = async (file: File | null) => {
        setThumbnailFile(file);
        if (!file) {
            form.setValue('sharedOptions.waitingRoomThumbnailFileId', undefined, {
                shouldDirty: true,
            });
            return;
        }
        try {
            setThumbnailUploading(true);
            const fileId = await UploadFileInS3(file, () => {}, 'your-user-id');
            form.setValue('sharedOptions.waitingRoomThumbnailFileId', fileId, {
                shouldDirty: true,
            });
        } catch (err) {
            console.error('Thumbnail upload failed', err);
            toast.error('Failed to upload thumbnail. Please try again.');
            setThumbnailFile(null);
        } finally {
            setThumbnailUploading(false);
        }
    };

    const handleSharedMusic = async (file: File | null) => {
        setMusicFile(file);
        if (!file) {
            form.setValue('sharedOptions.waitingRoomMusicFileId', undefined, {
                shouldDirty: true,
            });
            return;
        }
        try {
            setMusicUploading(true);
            const fileId = await UploadFileInS3(file, () => {}, 'your-user-id');
            form.setValue('sharedOptions.waitingRoomMusicFileId', fileId, {
                shouldDirty: true,
            });
        } catch (err) {
            console.error('Music upload failed', err);
            toast.error('Failed to upload background music. Please try again.');
            setMusicFile(null);
        } finally {
            setMusicUploading(false);
        }
    };

    const { fields, append, remove, insert } = useFieldArray({
        control: form.control,
        name: 'rows',
    });

    // NOTE: intentionally NOT subscribing to `rows` here. Watching the whole
    // rows array re-rendered this large component (and its child editors /
    // rich-text fields) on every keystroke in any cell, which accumulated DOM
    // churn until the tab ran out of memory on long editing sessions. Per-row
    // state now lives in the memoized <RowEditor>; the header count uses a
    // scoped <ReadyCountBadge>; the preview reads a non-reactive snapshot.
    const watchedTimeZone = form.watch('timeZone');

    // If settings load after the form mounted and the admin hasn't picked a
    // different timezone yet, snap to the institute default.
    useEffect(() => {
        const adminDefault = liveSessionSettings.defaultTimeZone;
        if (!adminDefault) return;
        if (form.getFieldState('timeZone').isDirty) return;
        if (form.getValues('timeZone') !== adminDefault) {
            form.setValue('timeZone', adminDefault);
        }
    }, [liveSessionSettings.defaultTimeZone, form]);

    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID =
        (tokenData?.authorities && Object.keys(tokenData.authorities)[0]) || '';

    const addRow = () =>
        append(
            blankRow(
                form.getValues('sharedOptions.defaultPlatform') ?? 'other',
                form.getValues('timeZone') ?? initialTimeZone
            ) as never
        );
    const duplicateRow = useCallback(
        (idx: number) => {
            const current = form.getValues(`rows.${idx}`);
            if (!current) return;
            insert(idx + 1, { ...current });
        },
        [form, insert]
    );

    const handleBulkPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        // Tab-separated rows from spreadsheet, mapping columns:
        // Title \t Date(YYYY-MM-DD) \t Time(HH:mm) \t Hours \t Minutes \t Platform \t Link
        const text = e.clipboardData.getData('text');
        if (!text || !text.includes('\t')) return;
        e.preventDefault();
        const lines = text
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
        if (lines.length === 0) return;
        const parsed = lines.map((line) => {
            const cols = line.split('\t');
            return {
                title: cols[0] ?? '',
                startDate: cols[1] ?? new Date().toISOString().slice(0, 10),
                startTime: cols[2] ?? '10:00',
                durationHours: cols[3] ?? '1',
                durationMinutes: cols[4] ?? '0',
                platform: (cols[5] ?? 'other').toLowerCase(),
                link: cols[6] ?? '',
                subject: '',
                description: '',
            };
        });
        // Replace if grid only has the empty starter row
        const isStarter =
            fields.length === 1 && !form.getValues('rows.0.title') && !form.getValues('rows.0.link');
        if (isStarter) {
            form.setValue('rows', parsed as never, { shouldValidate: true });
        } else {
            for (const row of parsed) append(row as never);
        }
        toast.success(`Pasted ${parsed.length} row${parsed.length === 1 ? '' : 's'}`);
    };

    // Imported CSV rows replace a lone empty starter row, otherwise append —
    // same rule as paste, so admins can stack imports onto manual rows.
    const applyImportedRows = (rows: BulkSessionRow[]) => {
        if (rows.length === 0) return;
        const isStarter =
            fields.length === 1 &&
            !form.getValues('rows.0.title') &&
            !form.getValues('rows.0.link');
        if (isStarter) {
            form.setValue('rows', rows as never, { shouldValidate: true });
        } else {
            for (const row of rows) append(row as never);
        }
        toast.success(`Imported ${rows.length} row${rows.length === 1 ? '' : 's'}`);
    };

    const onSubmit = async (data: BulkSessionForm) => {
        if (!INSTITUTE_ID) {
            toast.error('Could not resolve institute. Please re-login.');
            return;
        }
        setSubmitting(true);
        try {
            // Build a step-1 DTO per row by reusing the existing transformer.
            // Shared options apply to every row (waiting room, playback locks,
            // feedback, recording). File uploads happen once and the resulting
            // ids are stamped onto every row's DTO.
            const shared = data.sharedOptions;
            const sessions = data.rows.map((row) => {
                const startTimeISO = `${row.startDate}T${row.startTime}`;
                const isBbb = row.platform === 'bbb';
                const isMeet = row.platform === 'google meet';
                // Mirror the single-class auto-set rules: BBB rows must use
                // embed-in-app (the host iframes the meeting); Google Meet
                // rows redirect; everything else defaults to embed.
                const computedStreamingType = isMeet
                    ? SessionPlatform.REDIRECT_TO_OTHER_PLATFORM
                    : SessionPlatform.EMBED_IN_APP;
                // Compose a sessionFormSchema-shaped object so we can reuse the
                // mature transformer without duplicating ISO/duration logic.
                // NOTE: in the form schema, `sessionPlatform` is the streaming
                // platform name ('bbb', 'youtube', etc.) and maps to backend
                // `link_type`; `streamingType` is the embed/redirect flag and
                // maps to backend `session_streaming_service_type`. Earlier
                // versions of this code had these two reversed, which produced
                // payloads like `link_type: "embed"` + `session_streaming_service_type: "bbb"`
                // that broke BBB auto-provisioning.
                // Resolve waiting-room values: row override wins over shared.
                const rowWaitingEnabled =
                    row.waitingRoomEnabled ?? shared.enableWaitingRoom;
                const rowWaitingMinutes =
                    row.waitingRoomMinutes ?? shared.waitingRoomMinutes;
                const rowWaitingThumbnail =
                    row.waitingRoomThumbnailFileId ??
                    shared.waitingRoomThumbnailFileId;
                const rowWaitingMusic =
                    row.waitingRoomMusicFileId ?? shared.waitingRoomMusicFileId;

                const synthetic: z.infer<typeof sessionFormSchema> = {
                    title: row.title,
                    subject: row.subject ?? '',
                    openWaitingRoomBefore: rowWaitingEnabled
                        ? rowWaitingMinutes
                        : '',
                    sessionType: SessionType.LIVE,
                    sessionPlatform: row.platform || 'other',
                    enableWaitingRoom: rowWaitingEnabled,
                    streamingType: computedStreamingType,
                    allowRewind: shared.allowRewind,
                    allowPause: shared.allowPause,
                    startTime: startTimeISO,
                    timeZone: data.timeZone,
                    events: '0',
                    description: row.description ?? '',
                    durationMinutes: row.durationMinutes || '0',
                    durationHours: row.durationHours || '0',
                    defaultLink: row.link ?? '',
                    meetingType: RecurringType.ONCE,
                    recurringSchedule: [],
                    learner_button_config: null,
                    feedbackEnabled: shared.enableFeedback,
                    feedbackCompulsory: shared.enableFeedback ? shared.feedbackCompulsory : false,
                    feedbackQuestions: shared.enableFeedback
                        ? shared.feedbackQuestions ?? BULK_DEFAULT_FEEDBACK_QUESTIONS
                        : undefined,
                    // BBB-specific recording & moderation. Harmless on non-BBB
                    // rows because the backend only persists bbb_config when
                    // the row platform is bbb.
                    bbbRecord: isBbb ? shared.recordSession : undefined,
                    bbbAutoStartRecording:
                        isBbb && shared.recordSession ? shared.autoStartRecording : undefined,
                    bbbMuteOnStart: isBbb ? shared.muteOnStart : undefined,
                    bbbWebcamsOnlyForModerator: isBbb
                        ? shared.webcamsOnlyForModerator
                        : undefined,
                    bbbGuestPolicy: isBbb ? shared.guestPolicy : undefined,
                };
                const dto = transformFormToDTOStep1(
                    synthetic,
                    INSTITUTE_ID,
                    [],
                    rowWaitingMusic,
                    rowWaitingThumbnail,
                    undefined,
                    null
                );

                // Override start_time and last_entry_time with a *real* UTC
                // timestamp computed from the user's typed wall-clock and the
                // institute timezone. The shared transformer's date math
                // assumes browser-local timezone, which produces a 5:30h drift
                // on the server when the user is in IST and the institute is
                // also in IST. Using fromZonedTime makes the computation
                // timezone-aware and round-trips correctly.
                const totalDurationMinutes =
                    Number(row.durationHours || '0') * 60 +
                    Number(row.durationMinutes || '0');
                // Bulk must match the single-class wire convention: send the
                // user's wall-clock at the session's timezone, *labeled* as
                // UTC ('Z'). The backend extracts meeting_date / start_time
                // via Timestamp.toLocalDateTime() (no timezone awareness),
                // so a real UTC instant for an IST wall-clock value would
                // shift the stored date by the tz offset (e.g.
                // 2026-05-10 00:45 IST → 2026-05-09 in the DB), and the
                // search "today in session tz" filter would miss the row.
                const startUtc = fromZonedTime(
                    `${row.startDate}T${row.startTime}:00`,
                    data.timeZone
                );
                const endUtc = new Date(
                    startUtc.getTime() + totalDurationMinutes * 60_000
                );
                const wireFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'";
                dto.start_time = formatTZ(startUtc, wireFormat, {
                    timeZone: data.timeZone,
                });
                dto.last_entry_time = formatTZ(endUtc, wireFormat, {
                    timeZone: data.timeZone,
                });
                return dto;
            });

            // Build the per-row step-2 payloads up front so we can ship
            // EVERYTHING — sessions and their access/participants/notifications
            // — to the backend in a single /create/bulk call. The backend's
            // BulkLiveSessionService loops the `step2_per_row` array in lock
            // step with `sessions` and applies each row's step-2 to the
            // freshly-created session id.
            const beforeLiveTimes = data.notifySettings.beforeLiveTime ?? [];
            const buildPackageSessionIds = (
                rowLevels: Array<{ courseId: string; sessionId: string; levelId: string }>
            ) =>
                rowLevels.map((level) => {
                    if (!instituteDetails) return '';
                    const matchingBatch = instituteDetails.batches_for_sessions.find(
                        (batch) =>
                            batch.package_dto.id === level.courseId &&
                            batch.session.id === level.sessionId &&
                            batch.level.id === level.levelId
                    );
                    return matchingBatch?.id || '';
                });

            // Mirror the single-class step 2 join_link logic so bulk-created
            // sessions also get a clickable join link on the view page (and
            // the BBB Meeting card renders correctly). The backend overrides
            // each entry's session_id, but we still build a per-row link
            // shape so PUBLIC sessions get the registration URL (the
            // sessionId placeholder is harmless until the backend sees the
            // real id and we don't need it in the link for the private path).
            const rawPortalUrl = instituteDetails?.learner_portal_base_url;
            const learnerBaseUrl = rawPortalUrl
                ? rawPortalUrl.startsWith('http')
                    ? rawPortalUrl
                    : `https://${rawPortalUrl}`
                : BASE_URL_LEARNER_DASHBOARD;

            const step2PerRow = data.rows.map((row) => {
                const joinLinkForRow =
                    data.accessType === AccessType.PUBLIC
                        ? `${learnerBaseUrl}/register/live-class?sessionId={{SESSION_ID}}`
                        : `${learnerBaseUrl}/study-library/live-class`;
                const syntheticStep2Form = {
                    accessType: data.accessType,
                    batchSelectionType: 'batch',
                    selectedLevels: row.selectedLevels ?? [],
                    selectedLearners: [],
                    joinLink: joinLinkForRow,
                    notifyBy: data.notifyBy,
                    notifySettings: {
                        onCreate: data.notifySettings.onCreate,
                        beforeLive: beforeLiveTimes.length > 0,
                        beforeLiveTime: beforeLiveTimes,
                        onLive: data.notifySettings.onLive,
                        onAttendance: data.notifySettings.onAttendance,
                    },
                    fields: [],
                } as unknown as Parameters<typeof transformFormToDTOStep2>[0];

                // Pass an empty session_id; backend's BulkLiveSessionService
                // overwrites it with the real id from each created session.
                return transformFormToDTOStep2(
                    syntheticStep2Form,
                    '',
                    buildPackageSessionIds(row.selectedLevels ?? [])
                );
            });

            // Throttled creation: send rows in small chunks with a short pause
            // between each so the server isn't hit with everything at once.
            const response = await createLiveSessionsChunked(sessions, step2PerRow, {
                // One session per request so the UI can count progress per class
                // ("Scheduling 1/200…"). Total time is backend-bound, so this
                // doesn't slow things down meaningfully vs larger chunks.
                chunkSize: 1,
                onProgress: (done, total) => setCreateProgress({ done, total }),
            });

            const successfulResults = response.results.filter(
                (r) => r.success && r.session_id
            );
            const createdIds = successfulResults.map(
                (r) => r.session_id as string
            );

            // The bulk endpoint reports per-row outcomes via `success` /
            // `error` (step1+step2 are atomic on the server now — a step2
            // failure rolls back the row's session and surfaces the real
            // error message). All we need to do here is render whatever the
            // server returned.
            const failures = response.results
                .filter((r) => !r.success)
                .map((r) => ({ index: r.index, title: r.title, error: r.error }));

            if (createdIds.length > 0) {
                // Clear any leftover bulk state — step 2 is no longer part of
                // the bulk flow now that everything is on a single sheet.
                setBulkSessionIds([]);
                setStep1Data({
                    title: data.rows[0]?.title ?? '',
                    subject: data.rows[0]?.subject ?? '',
                    openWaitingRoomBefore: '',
                    sessionType: SessionType.LIVE,
                    sessionPlatform: data.rows[0]?.platform || 'other',
                    enableWaitingRoom: false,
                    streamingType:
                        data.rows[0]?.platform === 'google meet'
                            ? SessionPlatform.REDIRECT_TO_OTHER_PLATFORM
                            : SessionPlatform.EMBED_IN_APP,
                    allowRewind: true,
                    allowPause: true,
                    startTime: `${data.rows[0]?.startDate}T${data.rows[0]?.startTime}`,
                    timeZone: data.timeZone,
                    events: '0',
                    description: data.rows[0]?.description ?? '',
                    durationMinutes: data.rows[0]?.durationMinutes ?? '30',
                    durationHours: data.rows[0]?.durationHours ?? '0',
                    defaultLink: data.rows[0]?.link ?? '',
                    meetingType: RecurringType.ONCE,
                    recurringSchedule: [],
                    learner_button_config: null,
                });
            }

            // Always show the results dialog so the admin gets a row-wise
            // outcome and can download the Success/Failed + remarks report,
            // whether or not anything failed. Navigation is via its Done button.
            setResultDialog({
                open: true,
                created: createdIds.length,
                failed: failures.length,
                results: response.results,
            });
            if (failures.length === 0) {
                toast.success(
                    `${createdIds.length} ${
                        createdIds.length === 1 ? 'session' : 'sessions'
                    } created`
                );
            }
        } catch (err) {
            console.error('Bulk create failed', err);
            toast.error('Failed to create sessions. Please try again.');
        } finally {
            setSubmitting(false);
            setCreateProgress(null);
        }
    };

    const totalRows = fields.length;
    // Non-reactive snapshot for the (modal) preview dialog. The grid can't be
    // edited while the dialog is open, and opening it re-renders this component
    // (via `previewOpen` state), so reading current values here — instead of
    // subscribing to every row — stays accurate without re-rendering the whole
    // form on each keystroke. The live header count uses <ReadyCountBadge>.
    const previewRows = form.getValues('rows') ?? [];
    const previewValidCount = previewRows.filter(isRowReady).length;

    // Wait for the institute to load before mounting the grid. `instituteDetails`
    // is consumed by onSubmit (batches_for_sessions, learner_portal_base_url),
    // and downstream submit code assumes it is defined. Showing a loader here
    // also avoids the previous crash where useSuspenseQuery would throw a
    // pending Promise without a Suspense boundary above and trip the
    // route-level errorComponent ("System Crashed").
    if (instituteLoading || !instituteDetails) {
        return (
            <div className="flex h-64 items-center justify-center">
                <CircleNotch className="size-8 animate-spin text-neutral-400" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5 pb-20">
            <SectionCard
                icon={<Globe size={18} />}
                title="Configuration"
                description="Shared settings applied to every row in the grid below."
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-neutral-700">
                            Timezone <span className="text-danger-600">*</span>
                        </label>
                        <Select
                            value={watchedTimeZone}
                            onValueChange={(v) =>
                                form.setValue('timeZone', v, { shouldValidate: true })
                            }
                        >
                            <SelectTrigger className="h-9 w-full">
                                <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent>
                                {TIMEZONE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt._id} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Controller
                        control={form.control}
                        name="sharedOptions.defaultPlatform"
                        render={({ field }) => (
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-neutral-700">
                                    Default platform
                                </label>
                                <Select
                                    value={field.value ?? 'other'}
                                    onValueChange={(v) => {
                                        field.onChange(v);
                                        // Apply to existing empty / "other" rows so admins
                                        // don't have to retype per row when they switch
                                        // platforms after adding a few rows.
                                        const rows = form.getValues('rows') ?? [];
                                        rows.forEach((r, i) => {
                                            if (!r.platform || r.platform === 'other') {
                                                form.setValue(
                                                    `rows.${i}.platform` as const,
                                                    v,
                                                    { shouldDirty: true }
                                                );
                                            }
                                        });
                                    }}
                                >
                                    <SelectTrigger className="h-9 w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredStreamingOptions.map((opt) => (
                                            <SelectItem
                                                key={opt._id}
                                                value={opt.value}
                                            >
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <span className="text-[11px] text-neutral-500">
                                    Used for newly added rows. Picking it now also fills any
                                    existing rows still set to “Other.”
                                </span>
                            </div>
                        )}
                    />
                </div>
            </SectionCard>

            <SectionCard
                icon={<UsersThree size={18} />}
                title="Shared session settings"
                description="Applied to every row created from this grid. You can edit any individual class after creation."
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    {/* Waiting room */}
                    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-sm font-medium text-neutral-800">
                                    Enable Waiting Room
                                </div>
                                <div className="mt-0.5 text-xs text-neutral-500">
                                    Hold learners in a waiting room before each class.
                                </div>
                            </div>
                            <Controller
                                control={form.control}
                                name="sharedOptions.enableWaitingRoom"
                                render={({ field }) => (
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                )}
                            />
                        </div>
                        {form.watch('sharedOptions.enableWaitingRoom') && (
                            <div className="mt-3 space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-neutral-600">
                                        Open waiting room before
                                    </label>
                                    <Controller
                                        control={form.control}
                                        name="sharedOptions.waitingRoomMinutes"
                                        render={({ field }) => (
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger className="mt-1 h-8 w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {WAITING_ROOM_OPTIONS.map((opt) => (
                                                        <SelectItem
                                                            key={opt._id}
                                                            value={opt.value}
                                                        >
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-neutral-600">
                                        Thumbnail
                                    </label>
                                    <input
                                        ref={(el) => {
                                            thumbInputRef.current = el;
                                        }}
                                        type="file"
                                        accept=".png,.jpg,.jpeg"
                                        className="hidden"
                                        onChange={(e) =>
                                            handleSharedThumbnail(e.target.files?.[0] ?? null)
                                        }
                                    />
                                    <div className="mt-1 flex items-center gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => thumbInputRef.current?.click()}
                                            disabled={thumbnailUploading}
                                        >
                                            <UploadSimple size={14} className="mr-1" />
                                            {thumbnailFile ? 'Replace' : 'Upload'}
                                        </Button>
                                        {thumbnailUploading && (
                                            <span className="text-xs text-neutral-500">
                                                Uploading…
                                            </span>
                                        )}
                                        {thumbnailFile && !thumbnailUploading && (
                                            <span className="flex max-w-[160px] items-center gap-1 truncate rounded border border-primary-300 bg-primary-50 px-2 py-1 text-xs text-primary-700">
                                                <span className="truncate">
                                                    {thumbnailFile.name}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSharedThumbnail(null)}
                                                    className="text-danger-500"
                                                    aria-label="Remove thumbnail"
                                                >
                                                    <XIcon size={12} />
                                                </button>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-neutral-600">
                                        Background score
                                    </label>
                                    <input
                                        ref={(el) => {
                                            musicInputRef.current = el;
                                        }}
                                        type="file"
                                        accept=".mp3,.wav,.ogg,.m4a,.aac,.flac"
                                        className="hidden"
                                        onChange={(e) =>
                                            handleSharedMusic(e.target.files?.[0] ?? null)
                                        }
                                    />
                                    <div className="mt-1 flex items-center gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => musicInputRef.current?.click()}
                                            disabled={musicUploading}
                                        >
                                            <UploadSimple size={14} className="mr-1" />
                                            {musicFile ? 'Replace' : 'Upload'}
                                        </Button>
                                        {musicUploading && (
                                            <span className="text-xs text-neutral-500">
                                                Uploading…
                                            </span>
                                        )}
                                        {musicFile && !musicUploading && (
                                            <span className="flex max-w-[160px] items-center gap-1 truncate rounded border border-primary-300 bg-primary-50 px-2 py-1 text-xs text-primary-700">
                                                <MusicNote size={12} />
                                                <span className="truncate">{musicFile.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSharedMusic(null)}
                                                    className="text-danger-500"
                                                    aria-label="Remove music"
                                                >
                                                    <XIcon size={12} />
                                                </button>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Lock playback */}
                    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <div className="text-sm font-medium text-neutral-800">
                            Lock playback controls
                        </div>
                        <div className="mt-0.5 text-xs text-neutral-500">
                            Applies when the class is embedded in-app.
                        </div>
                        <div className="mt-3 flex flex-col gap-2">
                            <Controller
                                control={form.control}
                                name="sharedOptions.allowRewind"
                                render={({ field }) => (
                                    <label className="flex items-center justify-between text-sm">
                                        <span>Allow rewind</span>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </label>
                                )}
                            />
                            <Controller
                                control={form.control}
                                name="sharedOptions.allowPause"
                                render={({ field }) => (
                                    <label className="flex items-center justify-between text-sm">
                                        <span>Allow play / pause</span>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </label>
                                )}
                            />
                        </div>
                    </div>

                    {/* Feedback */}
                    {liveSessionSettings.feedbackEnabled && (
                        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 sm:col-span-2">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2">
                                    <ChatTeardrop
                                        size={18}
                                        className="mt-0.5 text-primary-500"
                                    />
                                    <div>
                                        <div className="text-sm font-medium text-neutral-800">
                                            Collect learner feedback
                                        </div>
                                        <div className="mt-0.5 text-xs text-neutral-500">
                                            Shows the feedback form to learners after each
                                            bulk-created session ends.
                                        </div>
                                    </div>
                                </div>
                                <Controller
                                    control={form.control}
                                    name="sharedOptions.enableFeedback"
                                    render={({ field }) => (
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    )}
                                />
                            </div>

                            {form.watch('sharedOptions.enableFeedback') && (
                                <div className="mt-3 space-y-2">
                                    <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2">
                                        <div>
                                            <div className="text-xs font-medium text-neutral-700">
                                                Make feedback compulsory
                                            </div>
                                            <div className="mt-0.5 text-[11px] text-neutral-500">
                                                Learners cannot skip the form — all required
                                                questions must be answered.
                                            </div>
                                        </div>
                                        <Controller
                                            control={form.control}
                                            name="sharedOptions.feedbackCompulsory"
                                            render={({ field }) => (
                                                <Switch
                                                    checked={field.value ?? false}
                                                    onCheckedChange={field.onChange}
                                                />
                                            )}
                                        />
                                    </div>
                                    <div className="text-xs font-medium text-neutral-600">
                                        Questions
                                    </div>
                                    {(
                                        form.watch('sharedOptions.feedbackQuestions') ??
                                        BULK_DEFAULT_FEEDBACK_QUESTIONS
                                    ).map((q, idx) => (
                                        <div
                                            key={q.id}
                                            className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Controller
                                                    control={form.control}
                                                    name={
                                                        `sharedOptions.feedbackQuestions.${idx}.enabled` as const
                                                    }
                                                    render={({ field }) => (
                                                        <Checkbox
                                                            checked={field.value ?? true}
                                                            onCheckedChange={field.onChange}
                                                            className={cn(
                                                                'size-4 rounded-sm border-2 shadow-none',
                                                                field.value
                                                                    ? 'border-none bg-primary-500 text-white'
                                                                    : ''
                                                            )}
                                                        />
                                                    )}
                                                />
                                                <span className="text-sm">
                                                    {q.label}
                                                    <span className="ml-1 text-xs text-neutral-400">
                                                        (
                                                        {q.type === 'star_rating'
                                                            ? '⭐ rating'
                                                            : 'text'}
                                                        )
                                                    </span>
                                                </span>
                                            </div>
                                            <Controller
                                                control={form.control}
                                                name={
                                                    `sharedOptions.feedbackQuestions.${idx}.mandatory` as const
                                                }
                                                render={({ field }) => (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            field.onChange(!field.value)
                                                        }
                                                        className={cn(
                                                            'w-fit rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                                                            field.value
                                                                ? 'bg-primary-100 text-primary-700'
                                                                : 'bg-neutral-100 text-neutral-500'
                                                        )}
                                                    >
                                                        {field.value ? 'Required' : 'Optional'}
                                                    </button>
                                                )}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Recording — Vacademy Meet only */}
                    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 sm:col-span-2">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2">
                                <Record size={18} className="mt-0.5 text-primary-500" />
                                <div>
                                    <div className="text-sm font-medium text-neutral-800">
                                        Vacademy Meet recording &amp; controls
                                    </div>
                                    <div className="mt-0.5 text-xs text-neutral-500">
                                        These options apply to rows whose platform is Vacademy
                                        Meet. Other platforms ignore them.
                                    </div>
                                </div>
                            </div>
                            <Controller
                                control={form.control}
                                name="sharedOptions.recordSession"
                                render={({ field }) => (
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                )}
                            />
                        </div>
                        {form.watch('sharedOptions.recordSession') && (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <Controller
                                    control={form.control}
                                    name="sharedOptions.autoStartRecording"
                                    render={({ field }) => (
                                        <label className="flex items-center justify-between text-sm">
                                            <span>Auto-start recording</span>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </label>
                                    )}
                                />
                                <Controller
                                    control={form.control}
                                    name="sharedOptions.muteOnStart"
                                    render={({ field }) => (
                                        <label className="flex items-center justify-between text-sm">
                                            <span>Mute participants on join</span>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </label>
                                    )}
                                />
                                <Controller
                                    control={form.control}
                                    name="sharedOptions.webcamsOnlyForModerator"
                                    render={({ field }) => (
                                        <label className="flex items-center justify-between text-sm">
                                            <span>Only host can share webcam</span>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </label>
                                    )}
                                />
                                <div className="flex flex-col gap-1 text-sm">
                                    <span>Guest admission policy</span>
                                    <Controller
                                        control={form.control}
                                        name="sharedOptions.guestPolicy"
                                        render={({ field }) => (
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger className="h-8">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ALWAYS_ACCEPT">
                                                        Always accept
                                                    </SelectItem>
                                                    <SelectItem value="ASK_MODERATOR">
                                                        Ask moderator to approve
                                                    </SelectItem>
                                                    <SelectItem value="ALWAYS_DENY">
                                                        Always deny guests
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </SectionCard>

            {liveSessionSettings.descriptionEnabled && (
            <SectionCard
                icon={<Article size={18} />}
                title="Description"
                description="Provide a brief overview shared across the live classes you create below. You can include text, emojis, images, or posters to give participants a quick idea of what the sessions are about."
            >
                <div className="flex flex-col gap-3">
                    <Controller
                        control={form.control}
                        name="sharedOptions.defaultDescription"
                        render={({ field }) => (
                            <RichTextEditor
                                onChange={field.onChange}
                                value={field.value || ''}
                                onBlur={field.onBlur}
                                minHeight={180}
                            />
                        )}
                    />
                    <div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const raw = form.getValues('sharedOptions.defaultDescription') ?? '';
                                // Strip HTML to detect "really empty" rich-text (e.g., "<p></p>").
                                const plain = raw.replace(/<[^>]*>/g, '').trim();
                                if (!plain) {
                                    toast.error('Add a description first.');
                                    return;
                                }
                                const rows = form.getValues('rows');
                                let applied = 0;
                                rows.forEach((r, i) => {
                                    const existing = (r.description ?? '').replace(/<[^>]*>/g, '').trim();
                                    if (!existing) {
                                        form.setValue(`rows.${i}.description` as const, raw, {
                                            shouldDirty: true,
                                        });
                                        applied += 1;
                                    }
                                });
                                if (applied === 0) {
                                    toast('All rows already have descriptions — nothing to fill.');
                                } else {
                                    toast.success(
                                        `Default description applied to ${applied} row${applied === 1 ? '' : 's'}.`
                                    );
                                }
                            }}
                        >
                            Apply to empty rows
                        </Button>
                        <span className="ml-2 text-xs text-neutral-500">
                            Per-row descriptions remain editable below.
                        </span>
                    </div>
                </div>
            </SectionCard>
            )}

            <SectionCard
                icon={<TableIcon size={18} />}
                title="Sessions"
                description="One row per class. Paste tab-separated rows from a spreadsheet to bulk-fill."
                headerRight={
                    <div className="flex items-center gap-2">
                        <ReadyCountBadge
                            control={form.control}
                            totalRows={totalRows}
                        />
                    </div>
                }
                contentClassName="p-0 sm:p-0"
            >
                <div
                    className="overflow-hidden rounded-b-xl"
                    onPaste={handleBulkPaste}
                >
                    <div className="max-h-[520px] overflow-auto">
                        <Table className="min-w-[1200px]">
                            <TableHeader className="sticky top-0 z-10 bg-neutral-50">
                                <TableRow className="border-neutral-200">
                                    <TableHead className="w-10 text-center text-[11px] uppercase tracking-wide text-neutral-500">
                                        #
                                    </TableHead>
                                    <TableHead className="min-w-[180px] text-[11px] uppercase tracking-wide text-neutral-500">
                                        Title *
                                    </TableHead>
                                    <TableHead className="min-w-[130px] text-[11px] uppercase tracking-wide text-neutral-500">
                                        Subject
                                    </TableHead>
                                    <TableHead className="min-w-[150px] text-[11px] uppercase tracking-wide text-neutral-500">
                                        Date *
                                    </TableHead>
                                    <TableHead className="min-w-[110px] text-[11px] uppercase tracking-wide text-neutral-500">
                                        Start *
                                    </TableHead>
                                    <TableHead className="min-w-[80px] text-[11px] uppercase tracking-wide text-neutral-500">
                                        Hrs
                                    </TableHead>
                                    <TableHead className="min-w-[80px] text-[11px] uppercase tracking-wide text-neutral-500">
                                        Mins
                                    </TableHead>
                                    <TableHead className="min-w-[140px] text-[11px] uppercase tracking-wide text-neutral-500">
                                        Platform
                                    </TableHead>
                                    <TableHead className="min-w-[220px] text-[11px] uppercase tracking-wide text-neutral-500">
                                        Link
                                    </TableHead>
                                    <TableHead className="min-w-[160px] text-[11px] uppercase tracking-wide text-neutral-500">
                                        Batches
                                    </TableHead>
                                    <TableHead className="min-w-[160px] text-[11px] uppercase tracking-wide text-neutral-500">
                                        Waiting room
                                    </TableHead>
                                    {liveSessionSettings.descriptionEnabled && (
                                        <TableHead className="min-w-[140px] text-[11px] uppercase tracking-wide text-neutral-500">
                                            Description
                                        </TableHead>
                                    )}
                                    <TableHead className="w-20 text-right text-[11px] uppercase tracking-wide text-neutral-500">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => (
                                <RowEditor
                                    key={field.id}
                                    index={index}
                                    form={form}
                                    subjectOptions={subjectOptions}
                                    filteredStreamingOptions={filteredStreamingOptions}
                                    courses={courses ?? EMPTY_COURSES}
                                    sessionList={sessionList}
                                    descriptionEnabled={liveSessionSettings.descriptionEnabled}
                                    disableRemove={fields.length === 1}
                                    onDuplicate={duplicateRow}
                                    onRemove={remove}
                                />
                            ))}
                        </TableBody>
                    </Table>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50/60 px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addRow}
                                className="h-8 gap-1.5"
                            >
                                <Plus size={14} /> Add row
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setCsvImportOpen(true)}
                                className="h-8 gap-1.5"
                            >
                                <UploadSimple size={14} /> Import CSV
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    downloadScheduleTemplate(
                                        instituteDetails?.batches_for_sessions ?? []
                                    )
                                }
                                className="h-8 gap-1.5"
                            >
                                <DownloadSimple size={14} /> Template
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    downloadBatchReference(
                                        instituteDetails?.batches_for_sessions ?? []
                                    )
                                }
                                className="h-8 gap-1.5"
                            >
                                <DownloadSimple size={14} /> Batch reference
                            </Button>
                        </div>
                        <span className="hidden text-xs text-neutral-500 sm:inline">
                            Tip: paste tab-separated rows, or import a CSV.
                        </span>
                    </div>
                </div>
            </SectionCard>

            <SectionCard
                icon={<LockKey size={18} />}
                title="Participant Access"
                description="Applies to every session created from the grid above."
            >
                <Controller
                    control={form.control}
                    name="accessType"
                    render={({ field }) => (
                        <MyRadioButton
                            name="accessType"
                            value={field.value ?? AccessType.PRIVATE}
                            onChange={field.onChange}
                            options={[
                                {
                                    label: (
                                        <div className="flex flex-row gap-1">
                                            <div className="font-bold">Private:</div>
                                            Restrict to selected institute batches or learners.
                                        </div>
                                    ),
                                    value: AccessType.PRIVATE,
                                },
                                {
                                    label: (
                                        <div className="flex flex-row gap-1">
                                            <div className="font-bold">Public:</div>
                                            Anyone with the join link can attend.
                                        </div>
                                    ),
                                    value: AccessType.PUBLIC,
                                },
                            ]}
                            className="flex flex-col gap-3"
                        />
                    )}
                />
            </SectionCard>

            <SectionCard
                icon={<BellRinging size={18} />}
                title="Notifications"
                description="Channels and triggers applied to every bulk-created session."
            >
                <div className="flex flex-col gap-5">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            Channels
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            {(
                                [
                                    ['notifyBy.mail', 'Notify Via Email'],
                                    ['notifyBy.whatsapp', 'Notify Via WhatsApp'],
                                    [
                                        'notifyBy.push_notification',
                                        'Notify Via Push Notification',
                                    ],
                                    [
                                        'notifyBy.system_notification',
                                        'Notify Via System Notification',
                                    ],
                                ] as const
                            ).map(([name, label]) => (
                                <Controller
                                    key={name}
                                    control={form.control}
                                    name={name}
                                    render={({ field }) => (
                                        <label className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
                                            <Checkbox
                                                checked={!!field.value}
                                                onCheckedChange={field.onChange}
                                                className={cn(
                                                    'size-4 rounded-sm border-2 shadow-none',
                                                    field.value
                                                        ? 'border-none bg-primary-500 text-white'
                                                        : ''
                                                )}
                                            />
                                            <span className="text-sm">{label}</span>
                                        </label>
                                    )}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            Triggers
                        </div>
                        <p className="mt-0.5 text-xs text-neutral-500">
                            Pick when notifications should fire on the channels above.
                        </p>
                        <div className="mt-3 flex flex-col gap-2">
                            <Controller
                                control={form.control}
                                name="notifySettings.onCreate"
                                render={({ field }) => (
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            className={cn(
                                                'size-4 rounded-sm border-2 shadow-none',
                                                field.value
                                                    ? 'border-none bg-primary-500 text-white'
                                                    : ''
                                            )}
                                        />
                                        When the live class is created
                                    </label>
                                )}
                            />

                            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                                <div className="text-sm font-medium text-neutral-800">
                                    Notify before
                                </div>
                                <div className="mt-2 flex flex-col gap-2">
                                    {beforeLiveFields.map((bf, index) => (
                                        <div
                                            key={bf.id}
                                            className="flex items-center gap-2"
                                        >
                                            <SelectField
                                                label=""
                                                name={`notifySettings.beforeLiveTime.${index}.time`}
                                                labelStyle="font-thin"
                                                options={TimeOptions.map((opt, i) => ({
                                                    value: opt.value,
                                                    label: opt.label,
                                                    _id: i,
                                                }))}
                                                control={form.control}
                                                className="w-56 font-thin"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="text-danger-500"
                                                onClick={() => beforeLiveRemove(index)}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => beforeLiveAppend({ time: '5m' })}
                                        className="w-fit gap-1"
                                    >
                                        <Plus size={14} /> Add reminder
                                    </Button>
                                </div>
                            </div>

                            <Controller
                                control={form.control}
                                name="notifySettings.onLive"
                                render={({ field }) => (
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            className={cn(
                                                'size-4 rounded-sm border-2 shadow-none',
                                                field.value
                                                    ? 'border-none bg-primary-500 text-white'
                                                    : ''
                                            )}
                                        />
                                        When class goes live
                                    </label>
                                )}
                            />
                            <Controller
                                control={form.control}
                                name="notifySettings.onAttendance"
                                render={({ field }) => (
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            className={cn(
                                                'size-4 rounded-sm border-2 shadow-none',
                                                field.value
                                                    ? 'border-none bg-primary-500 text-white'
                                                    : ''
                                            )}
                                        />
                                        When attendance is marked (present/absent)
                                    </label>
                                )}
                            />
                        </div>
                    </div>
                </div>
            </SectionCard>

            <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-0 sm:rounded-lg sm:border sm:px-4">
                <MyButton
                    type="button"
                    buttonType="primary"
                    onClick={form.handleSubmit(
                        () => setPreviewOpen(true),
                        () =>
                            toast.error(
                                'Some rows have errors. Please fix them before previewing.'
                            )
                    )}
                    disable={submitting}
                >
                    {submitting
                        ? createProgress
                            ? `Scheduling ${createProgress.done}/${createProgress.total}…`
                            : 'Scheduling…'
                        : 'Preview & create'}
                </MyButton>
            </div>

            <BulkCsvImportDialog
                open={csvImportOpen}
                onOpenChange={setCsvImportOpen}
                batches={instituteDetails?.batches_for_sessions ?? []}
                allowedPlatforms={filteredStreamingOptions.map((o) => o.value)}
                onImport={applyImportedRows}
            />

            <LiveSessionPreviewDialog
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                submitting={submitting}
                submittingLabel={
                    createProgress
                        ? `Scheduling ${createProgress.done}/${createProgress.total}…`
                        : 'Scheduling…'
                }
                onConfirm={async () => {
                    await form.handleSubmit(onSubmit, () =>
                        toast.error('Some rows have errors. Please fix them.')
                    )();
                    setPreviewOpen(false);
                }}
                timeZone={watchedTimeZone}
                accessType={accessType}
                sessionFeatures={{
                    enableWaitingRoom: form.watch('sharedOptions.enableWaitingRoom'),
                    waitingRoomMinutes: form.watch('sharedOptions.waitingRoomMinutes'),
                    allowRewind: form.watch('sharedOptions.allowRewind'),
                    allowPause: form.watch('sharedOptions.allowPause'),
                    enableFeedback: form.watch('sharedOptions.enableFeedback'),
                    recordSession: form.watch('sharedOptions.recordSession'),
                }}
                notifications={{
                    notifyBy: {
                        mail: form.watch('notifyBy.mail'),
                        whatsapp: form.watch('notifyBy.whatsapp'),
                        push_notification: form.watch('notifyBy.push_notification'),
                        system_notification: form.watch('notifyBy.system_notification'),
                    },
                    notifySettings: {
                        onCreate: form.watch('notifySettings.onCreate'),
                        beforeLiveTime: form.watch('notifySettings.beforeLiveTime'),
                        onLive: form.watch('notifySettings.onLive'),
                        onAttendance: form.watch('notifySettings.onAttendance'),
                    },
                }}
                sessions={previewRows}
                validCount={previewValidCount}
                courses={courses ?? []}
                sessionList={sessionList}
            />
            <Dialog
                open={!!resultDialog?.open}
                onOpenChange={(o) => setResultDialog((s) => (s ? { ...s, open: o } : null))}
            >
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {resultDialog && resultDialog.failed > 0
                                ? 'Bulk creation finished with errors'
                                : 'Bulk scheduling complete'}
                        </DialogTitle>
                        <DialogDescription>
                            {resultDialog?.created} created · {resultDialog?.failed} failed.{' '}
                            {resultDialog && resultDialog.failed > 0
                                ? 'Successful sessions already have participants & notifications applied. Download the report for a row-wise status, fix the failed rows, and retry.'
                                : 'Download the report for a row-wise record of every session.'}
                        </DialogDescription>
                    </DialogHeader>
                    {resultDialog && resultDialog.failed > 0 && (
                        <ScrollArea className="max-h-60 w-full overflow-x-hidden rounded border border-neutral-200 sm:max-h-72">
                            <ul className="divide-y divide-neutral-100 text-sm">
                                {resultDialog.results
                                    .filter((r) => !r.success)
                                    .map((f) => (
                                        <li key={f.index} className="px-3 py-2">
                                            <div className="break-words font-medium text-neutral-800">
                                                Row {f.index + 1}
                                                {f.title ? `: ${f.title}` : ''}
                                            </div>
                                            <div className="whitespace-pre-wrap break-words text-xs text-danger-600">
                                                {f.error || 'Unknown error'}
                                            </div>
                                        </li>
                                    ))}
                            </ul>
                        </ScrollArea>
                    )}
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() =>
                                resultDialog && downloadResultsCsv(resultDialog.results)
                            }
                        >
                            <DownloadSimple size={16} className="mr-1.5" />
                            Download results (CSV)
                        </Button>
                        {resultDialog && resultDialog.failed > 0 && (
                            <Button
                                variant="outline"
                                className="w-full sm:w-auto"
                                onClick={() => setResultDialog(null)}
                            >
                                Stay & retry
                            </Button>
                        )}
                        <Button
                            onClick={() =>
                                navigate({ to: '/study-library/live-session' })
                            }
                            disabled={!resultDialog || resultDialog.created === 0}
                            className="w-full bg-primary-500 hover:bg-primary-600 sm:w-auto"
                        >
                            Done — view sessions
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

type SelectedLevel = { courseId: string; sessionId: string; levelId: string };

interface RowBatchPickerProps {
    value: SelectedLevel[];
    onChange: (next: SelectedLevel[]) => void;
    courses: Array<{
        courseName: string;
        courseId: string;
        sessionId: string;
        levels: Array<{ name: string; id: string }>;
    }>;
    sessionList: DropdownItemType[];
}

const RowBatchPicker = ({ value, onChange, courses, sessionList }: RowBatchPickerProps) => {
    const [activeSessionId, setActiveSessionId] = useState<string | undefined>(
        () => sessionList[0]?.id
    );
    const [search, setSearch] = useState('');
    useEffect(() => {
        if (!activeSessionId && sessionList.length > 0) {
            setActiveSessionId(sessionList[0]!.id);
        }
    }, [sessionList, activeSessionId]);

    const sessionCourses = useMemo(
        () => courses.filter((c) => c.sessionId === activeSessionId),
        [courses, activeSessionId]
    );

    // When the admin types in the search box, filter both course names and
    // level names. A course matches if the query is in its name (all levels
    // remain visible) or if any level under it matches (only the matching
    // levels are shown).
    const visibleCourses = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return sessionCourses;
        return sessionCourses
            .map((course) => {
                const courseMatches = course.courseName.toLowerCase().includes(q);
                const matchedLevels = courseMatches
                    ? course.levels
                    : course.levels.filter((l) => l.name.toLowerCase().includes(q));
                if (matchedLevels.length === 0) return null;
                return { ...course, levels: matchedLevels };
            })
            .filter(Boolean) as typeof sessionCourses;
    }, [sessionCourses, search]);

    const sameLevel = (a: SelectedLevel, b: SelectedLevel) =>
        a.courseId === b.courseId && a.sessionId === b.sessionId && a.levelId === b.levelId;

    const toggleLevel = (item: SelectedLevel, checked: boolean) => {
        const next = [...value];
        if (checked) {
            if (!next.some((s) => sameLevel(s, item))) next.push(item);
        } else {
            const idx = next.findIndex((s) => sameLevel(s, item));
            if (idx > -1) next.splice(idx, 1);
        }
        onChange(next);
    };

    const toggleCourse = (course: (typeof courses)[number], checked: boolean) => {
        const keys = course.levels.map((l) => ({
            courseId: course.courseId,
            sessionId: course.sessionId,
            levelId: l.id,
        }));
        let next = [...value];
        if (checked) {
            for (const k of keys) {
                if (!next.some((s) => sameLevel(s, k))) next.push(k);
            }
        } else {
            next = next.filter((s) => !keys.some((k) => sameLevel(s, k)));
        }
        onChange(next);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                        'h-8 w-full justify-start gap-1.5 truncate text-xs',
                        value.length > 0 && 'border-primary-300 bg-primary-50'
                    )}
                >
                    <UsersThreeIcon size={14} />
                    {value.length === 0
                        ? 'Assign batches'
                        : `${value.length} batch${value.length === 1 ? '' : 'es'}`}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-80 p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className="space-y-2 border-b border-neutral-200 p-3">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            Session
                        </div>
                        <Select
                            value={activeSessionId ?? ''}
                            onValueChange={(v) => setActiveSessionId(v)}
                        >
                            <SelectTrigger className="mt-1 h-8 w-full">
                                <SelectValue placeholder="Select session" />
                            </SelectTrigger>
                            <SelectContent>
                                {sessionList.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="relative">
                        <MagnifyingGlass
                            size={14}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
                        />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search courses or batches…"
                            className="h-8 pl-7 pr-7 text-xs"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-400 hover:text-neutral-600"
                                aria-label="Clear search"
                            >
                                <XIcon size={12} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                    <div className="p-3">
                        {visibleCourses.length === 0 && (
                            <div className="py-6 text-center text-xs text-neutral-500">
                                {search.trim()
                                    ? 'No courses or batches match your search.'
                                    : 'No courses available for this session.'}
                            </div>
                        )}
                        <div className="flex flex-col gap-3">
                            {visibleCourses.map((course) => {
                                const total = course.levels.length;
                                const selectedInCourse = course.levels.filter((l) =>
                                    value.some(
                                        (s) =>
                                            s.courseId === course.courseId &&
                                            s.sessionId === course.sessionId &&
                                            s.levelId === l.id
                                    )
                                ).length;
                                const allSelected = total > 0 && selectedInCourse === total;
                                const indeterminate =
                                    selectedInCourse > 0 && !allSelected;
                                return (
                                    <div key={course.courseId} className="flex flex-col gap-1">
                                        <label className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
                                            <Checkbox
                                                checked={
                                                    allSelected
                                                        ? true
                                                        : indeterminate
                                                          ? 'indeterminate'
                                                          : false
                                                }
                                                onCheckedChange={(c) =>
                                                    toggleCourse(course, c === true)
                                                }
                                                className={cn(
                                                    'size-4 rounded-sm border-2 shadow-none',
                                                    allSelected || indeterminate
                                                        ? 'border-none bg-primary-500 text-white'
                                                        : ''
                                                )}
                                            />
                                            <span className="truncate">{course.courseName}</span>
                                            <span className="ml-auto text-[10px] font-normal text-neutral-500">
                                                {selectedInCourse}/{total}
                                            </span>
                                        </label>
                                        <div className="ml-5 flex flex-col gap-1">
                                            {course.levels.map((level) => {
                                                const item = {
                                                    courseId: course.courseId,
                                                    sessionId: course.sessionId,
                                                    levelId: level.id,
                                                };
                                                const checked = value.some((s) =>
                                                    sameLevel(s, item)
                                                );
                                                return (
                                                    <label
                                                        key={level.id}
                                                        className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-neutral-50"
                                                    >
                                                        <Checkbox
                                                            checked={checked}
                                                            onCheckedChange={(c) =>
                                                                toggleLevel(item, c === true)
                                                            }
                                                            className={cn(
                                                                'size-3.5 rounded-sm border-2 shadow-none',
                                                                checked
                                                                    ? 'border-none bg-primary-500 text-white'
                                                                    : ''
                                                            )}
                                                        />
                                                        {level.name}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                {value.length > 0 && (
                    <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-2">
                        <span className="text-xs text-neutral-500">
                            {value.length} batch{value.length === 1 ? '' : 'es'} selected
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-danger-600"
                            onClick={() => onChange([])}
                        >
                            Clear
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
};

interface WaitingRoomSharedSnapshot {
    enableWaitingRoom: boolean;
    waitingRoomMinutes: string;
    waitingRoomThumbnailFileId?: string;
    waitingRoomMusicFileId?: string;
}

interface RowWaitingRoomChange {
    enabled?: boolean;
    minutes?: string;
    thumbnailFileId?: string;
    musicFileId?: string;
    reset?: boolean;
}

interface RowWaitingRoomPickerProps {
    rowIndex: number;
    row: {
        waitingRoomEnabled?: boolean;
        waitingRoomMinutes?: string;
        waitingRoomThumbnailFileId?: string;
        waitingRoomMusicFileId?: string;
    } | null;
    shared: WaitingRoomSharedSnapshot;
    onChange: (patch: RowWaitingRoomChange) => void;
}

const RowWaitingRoomPicker = ({ row, shared, onChange }: RowWaitingRoomPickerProps) => {
    // Resolved (effective) values shown in the cell summary and pre-filled in
    // the popover. If the row hasn't customised a field, fall back to shared.
    const effectiveEnabled = row?.waitingRoomEnabled ?? shared.enableWaitingRoom;
    const effectiveMinutes = row?.waitingRoomMinutes ?? shared.waitingRoomMinutes;
    const effectiveThumb =
        row?.waitingRoomThumbnailFileId ?? shared.waitingRoomThumbnailFileId;
    const effectiveMusic =
        row?.waitingRoomMusicFileId ?? shared.waitingRoomMusicFileId;

    const isOverridden =
        row?.waitingRoomEnabled !== undefined ||
        row?.waitingRoomMinutes !== undefined ||
        row?.waitingRoomThumbnailFileId !== undefined ||
        row?.waitingRoomMusicFileId !== undefined;

    const [uploading, setUploading] = useState(false);
    const [musicUploading, setMusicUploading] = useState(false);
    const fileRef = useMemo(
        () => ({ current: null as HTMLInputElement | null }),
        []
    );
    const musicRef = useMemo(
        () => ({ current: null as HTMLInputElement | null }),
        []
    );

    const handleThumbUpload = async (file: File | null) => {
        if (!file) {
            onChange({ thumbnailFileId: undefined });
            return;
        }
        try {
            setUploading(true);
            const fileId = await UploadFileInS3(file, () => {}, 'your-user-id');
            onChange({ thumbnailFileId: fileId });
        } catch (err) {
            console.error('Per-row thumbnail upload failed', err);
            toast.error('Failed to upload thumbnail. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleMusicUpload = async (file: File | null) => {
        if (!file) {
            onChange({ musicFileId: undefined });
            return;
        }
        try {
            setMusicUploading(true);
            const fileId = await UploadFileInS3(file, () => {}, 'your-user-id');
            onChange({ musicFileId: fileId });
        } catch (err) {
            console.error('Per-row background music upload failed', err);
            toast.error('Failed to upload background score. Please try again.');
        } finally {
            setMusicUploading(false);
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                        'h-8 w-full justify-start gap-1.5 truncate text-xs',
                        effectiveEnabled && isOverridden &&
                            'border-primary-300 bg-primary-50 text-primary-700',
                        !effectiveEnabled && 'text-neutral-500'
                    )}
                >
                    <UsersThreeIcon size={14} />
                    {!effectiveEnabled ? (
                        <span>Off</span>
                    ) : (
                        <span className="flex items-center gap-1">
                            {effectiveMinutes}m
                            {effectiveThumb && (
                                <span title="Thumbnail attached">·🖼</span>
                            )}
                            {isOverridden && (
                                <span
                                    className="ml-1 rounded-full bg-primary-100 px-1.5 text-[9px] font-semibold text-primary-700"
                                    title="This row overrides the shared default"
                                >
                                    OVR
                                </span>
                            )}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-80 p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className="border-b border-neutral-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-medium text-neutral-800">
                                Waiting room
                            </div>
                            <div className="mt-0.5 text-xs text-neutral-500">
                                Override the shared default for this row.
                            </div>
                        </div>
                        <Switch
                            checked={effectiveEnabled}
                            onCheckedChange={(v) => onChange({ enabled: v })}
                        />
                    </div>
                </div>
                {effectiveEnabled && (
                    <div className="space-y-3 p-3">
                        <div>
                            <label className="text-xs font-medium text-neutral-600">
                                Open before start
                            </label>
                            <Select
                                value={effectiveMinutes}
                                onValueChange={(v) => onChange({ minutes: v })}
                            >
                                <SelectTrigger className="mt-1 h-8 w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {WAITING_ROOM_OPTIONS.map((opt) => (
                                        <SelectItem key={opt._id} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-neutral-600">
                                Thumbnail
                            </label>
                            <input
                                ref={(el) => {
                                    fileRef.current = el;
                                }}
                                type="file"
                                accept=".png,.jpg,.jpeg"
                                className="hidden"
                                onChange={(e) =>
                                    handleThumbUpload(e.target.files?.[0] ?? null)
                                }
                            />
                            <div className="mt-1 flex items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => fileRef.current?.click()}
                                    disabled={uploading}
                                    className="h-8"
                                >
                                    <UploadSimple size={14} className="mr-1" />
                                    {effectiveThumb ? 'Replace' : 'Upload'}
                                </Button>
                                {uploading && (
                                    <span className="text-xs text-neutral-500">
                                        Uploading…
                                    </span>
                                )}
                                {effectiveThumb && !uploading && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onChange({ thumbnailFileId: undefined })
                                        }
                                        className="text-xs text-danger-600"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                            {!row?.waitingRoomThumbnailFileId &&
                                shared.waitingRoomThumbnailFileId && (
                                    <p className="mt-1 text-[11px] text-neutral-400">
                                        Using shared thumbnail. Upload here to override
                                        for this row only.
                                    </p>
                                )}
                        </div>
                        <div>
                            <label className="text-xs font-medium text-neutral-600">
                                Background score
                            </label>
                            <input
                                ref={(el) => {
                                    musicRef.current = el;
                                }}
                                type="file"
                                accept=".mp3,.wav,.ogg,.m4a,.aac,.flac"
                                className="hidden"
                                onChange={(e) =>
                                    handleMusicUpload(e.target.files?.[0] ?? null)
                                }
                            />
                            <div className="mt-1 flex items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => musicRef.current?.click()}
                                    disabled={musicUploading}
                                    className="h-8"
                                >
                                    <UploadSimple size={14} className="mr-1" />
                                    {effectiveMusic ? 'Replace' : 'Upload'}
                                </Button>
                                {musicUploading && (
                                    <span className="text-xs text-neutral-500">
                                        Uploading…
                                    </span>
                                )}
                                {effectiveMusic && !musicUploading && (
                                    <span className="flex items-center gap-1 text-xs text-neutral-700">
                                        <MusicNote size={12} />
                                        attached
                                    </span>
                                )}
                                {effectiveMusic && !musicUploading && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onChange({ musicFileId: undefined })
                                        }
                                        className="text-xs text-danger-600"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                            {!row?.waitingRoomMusicFileId &&
                                shared.waitingRoomMusicFileId && (
                                    <p className="mt-1 text-[11px] text-neutral-400">
                                        Using shared background score. Upload here to
                                        override for this row only.
                                    </p>
                                )}
                        </div>
                    </div>
                )}
                {isOverridden && (
                    <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-2">
                        <span className="text-[11px] text-neutral-500">
                            Row overrides shared default
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-neutral-600"
                            onClick={() => onChange({ reset: true })}
                        >
                            Reset to default
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
};

type RowEditorProps = {
    index: number;
    form: UseFormReturn<BulkSessionForm>;
    subjectOptions: Array<{ value: string; label: string }>;
    filteredStreamingOptions: typeof STREAMING_OPTIONS;
    courses: RowBatchPickerProps['courses'];
    sessionList: DropdownItemType[];
    descriptionEnabled: boolean;
    disableRemove: boolean;
    onDuplicate: (index: number) => void;
    onRemove: (index: number) => void;
};

/**
 * A single grid row, isolated behind React.memo so editing one row never
 * re-renders its siblings. It subscribes (via scoped `useWatch` /
 * `useFormState`) ONLY to the fields it renders against: this row's platform,
 * its waiting-room overrides, the shared waiting-room defaults, and its own
 * validation errors. Plain text/number inputs stay uncontrolled
 * (`form.register`), so typing in them re-renders nothing at all. That is what
 * stops a large grid from accumulating render/DOM churn (and eventually
 * crashing the tab) during a long editing session.
 */
const RowEditor = memo(function RowEditor({
    index,
    form,
    subjectOptions,
    filteredStreamingOptions,
    courses,
    sessionList,
    descriptionEnabled,
    disableRemove,
    onDuplicate,
    onRemove,
}: RowEditorProps) {
    const { control } = form;
    const { errors } = useFormState({ control, name: `rows.${index}` as const });
    const rowErrors = errors.rows?.[index];
    const hasError = Boolean(rowErrors);

    const platform = useWatch({ control, name: `rows.${index}.platform` as const });
    const linkRequired = platform !== 'zoho' && platform !== 'bbb';

    const [
        waitingRoomEnabled,
        waitingRoomMinutes,
        waitingRoomThumbnailFileId,
        waitingRoomMusicFileId,
    ] = useWatch({
        control,
        name: [
            `rows.${index}.waitingRoomEnabled`,
            `rows.${index}.waitingRoomMinutes`,
            `rows.${index}.waitingRoomThumbnailFileId`,
            `rows.${index}.waitingRoomMusicFileId`,
        ] as const,
    });
    const sharedOptions = useWatch({ control, name: 'sharedOptions' });

    return (
        <TableRow className={cn(hasError && 'bg-danger-50/40')}>
            <TableCell className="text-center text-xs text-neutral-500">
                {index + 1}
                {hasError && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Warning
                                    size={14}
                                    className="ml-1 inline text-danger-600"
                                />
                            </TooltipTrigger>
                            <TooltipContent>Row has validation errors</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </TableCell>
            <TableCell>
                <Input
                    {...form.register(`rows.${index}.title` as const)}
                    placeholder="e.g. Algebra Recap"
                    className="h-8"
                />
                {rowErrors?.title && (
                    <p className="mt-1 text-[11px] text-danger-600">
                        {rowErrors.title.message as string}
                    </p>
                )}
            </TableCell>
            <TableCell>
                <Controller
                    control={control}
                    name={`rows.${index}.subject` as const}
                    render={({ field }) => (
                        <Select
                            value={field.value || '__none__'}
                            onValueChange={(v) =>
                                field.onChange(v === '__none__' ? '' : v)
                            }
                        >
                            <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {subjectOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
            </TableCell>
            <TableCell>
                <Input
                    type="date"
                    {...form.register(`rows.${index}.startDate` as const)}
                    className="h-8"
                />
                {rowErrors?.startDate && (
                    <p className="mt-1 text-[11px] text-danger-600">
                        {rowErrors.startDate.message as string}
                    </p>
                )}
            </TableCell>
            <TableCell>
                <Input
                    type="time"
                    {...form.register(`rows.${index}.startTime` as const)}
                    className="h-8"
                />
                {rowErrors?.startTime && (
                    <p className="mt-1 text-[11px] text-danger-600">
                        {rowErrors.startTime.message as string}
                    </p>
                )}
            </TableCell>
            <TableCell>
                <Input
                    type="number"
                    min={0}
                    max={24}
                    {...form.register(`rows.${index}.durationHours` as const)}
                    className="h-8"
                />
            </TableCell>
            <TableCell>
                <Input
                    type="number"
                    min={0}
                    max={59}
                    {...form.register(`rows.${index}.durationMinutes` as const)}
                    className="h-8"
                />
                {rowErrors?.durationMinutes && (
                    <p className="mt-1 text-[11px] text-danger-600">
                        {rowErrors.durationMinutes.message as string}
                    </p>
                )}
            </TableCell>
            <TableCell>
                <Select
                    value={platform ?? 'other'}
                    onValueChange={(v) =>
                        form.setValue(`rows.${index}.platform` as const, v, {
                            shouldValidate: true,
                        })
                    }
                >
                    <SelectTrigger className="h-8">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {filteredStreamingOptions.map((opt) => (
                            <SelectItem key={opt._id} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </TableCell>
            <TableCell>
                <Input
                    {...form.register(`rows.${index}.link` as const)}
                    placeholder={linkRequired ? 'https://…' : 'Auto-generated'}
                    disabled={!linkRequired}
                    className="h-8"
                />
                {rowErrors?.link && (
                    <p className="mt-1 text-[11px] text-danger-600">
                        {rowErrors.link.message as string}
                    </p>
                )}
            </TableCell>
            <TableCell>
                <Controller
                    control={control}
                    name={`rows.${index}.selectedLevels` as const}
                    render={({ field }) => (
                        <RowBatchPicker
                            value={field.value ?? []}
                            onChange={field.onChange}
                            courses={courses}
                            sessionList={sessionList}
                        />
                    )}
                />
            </TableCell>
            <TableCell>
                <RowWaitingRoomPicker
                    rowIndex={index}
                    row={{
                        waitingRoomEnabled,
                        waitingRoomMinutes,
                        waitingRoomThumbnailFileId,
                        waitingRoomMusicFileId,
                    }}
                    shared={sharedOptions}
                    onChange={(patch) => {
                        if ('enabled' in patch) {
                            form.setValue(
                                `rows.${index}.waitingRoomEnabled` as const,
                                patch.enabled,
                                { shouldDirty: true }
                            );
                        }
                        if ('minutes' in patch) {
                            form.setValue(
                                `rows.${index}.waitingRoomMinutes` as const,
                                patch.minutes,
                                { shouldDirty: true }
                            );
                        }
                        if ('thumbnailFileId' in patch) {
                            form.setValue(
                                `rows.${index}.waitingRoomThumbnailFileId` as const,
                                patch.thumbnailFileId,
                                { shouldDirty: true }
                            );
                        }
                        if ('musicFileId' in patch) {
                            form.setValue(
                                `rows.${index}.waitingRoomMusicFileId` as const,
                                patch.musicFileId,
                                { shouldDirty: true }
                            );
                        }
                        if (patch.reset) {
                            form.setValue(
                                `rows.${index}.waitingRoomEnabled` as const,
                                undefined,
                                { shouldDirty: true }
                            );
                            form.setValue(
                                `rows.${index}.waitingRoomMinutes` as const,
                                undefined,
                                { shouldDirty: true }
                            );
                            form.setValue(
                                `rows.${index}.waitingRoomThumbnailFileId` as const,
                                undefined,
                                { shouldDirty: true }
                            );
                            form.setValue(
                                `rows.${index}.waitingRoomMusicFileId` as const,
                                undefined,
                                { shouldDirty: true }
                            );
                        }
                    }}
                />
            </TableCell>
            {descriptionEnabled && (
                <TableCell>
                    <Controller
                        control={control}
                        name={`rows.${index}.description` as const}
                        render={({ field }) => {
                            const plain = (field.value ?? '')
                                .replace(/<[^>]*>/g, '')
                                .trim();
                            return (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className={cn(
                                                'h-8 w-full justify-start gap-1.5 truncate text-xs',
                                                plain &&
                                                    'border-primary-300 bg-primary-50'
                                            )}
                                        >
                                            <Article size={14} />
                                            <span className="truncate">
                                                {plain
                                                    ? plain.slice(0, 28) +
                                                      (plain.length > 28 ? '…' : '')
                                                    : 'Add description'}
                                            </span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        align="start"
                                        className="w-[420px] p-3"
                                        onOpenAutoFocus={(e) => e.preventDefault()}
                                    >
                                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                            Description for row {index + 1}
                                        </div>
                                        <RichTextEditor
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            minHeight={140}
                                        />
                                        {plain && (
                                            <div className="mt-2 flex justify-end">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-xs text-neutral-500"
                                                    onClick={() => field.onChange('')}
                                                >
                                                    Clear
                                                </Button>
                                            </div>
                                        )}
                                    </PopoverContent>
                                </Popover>
                            );
                        }}
                    />
                </TableCell>
            )}
            <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    onClick={() => onDuplicate(index)}
                                >
                                    <Copy size={14} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Duplicate row</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-danger-500 hover:text-danger-700"
                                    disabled={disableRemove}
                                    onClick={() => onRemove(index)}
                                >
                                    <Trash size={14} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remove row</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </TableCell>
        </TableRow>
    );
});

function ReadyCountBadge({
    control,
    totalRows,
}: {
    control: UseFormReturn<BulkSessionForm>['control'];
    totalRows: number;
}) {
    const rows = useWatch({ control, name: 'rows' });
    const validRowCount = (rows ?? []).filter(isRowReady).length;
    return (
        <Badge
            variant="secondary"
            className={cn(
                'rounded-full px-2.5 py-1 text-xs',
                validRowCount === totalRows && totalRows > 0
                    ? 'bg-primary-100 text-primary-600'
                    : ''
            )}
        >
            {validRowCount}/{totalRows} ready
        </Badge>
    );
}
