/* eslint-disable @typescript-eslint/no-unused-vars */
import { MyDialog } from '@/components/design-system/dialog';
import {
    ArrowSquareOut,
    CalendarBlank,
    VideoCamera,
    Clock,
    Copy,
    DotsThree,
    DownloadSimple,
    GlobeHemisphereWest,
    PencilSimple,
    QrCode,
    Trash,
    UsersThree,
} from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { copyToClipboard } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-utils/helper';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LiveSession } from '../schedule/-services/utils';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { fetchSessionDetails, SessionDetailsResponse } from '../-hooks/useSessionDetails';
import { useLiveSessionReport } from '../-hooks/useLiveSessionReport';
import { useLiveSessionStore } from '../schedule/-store/sessionIdstore';
import { useNavigate } from '@tanstack/react-router';
import { useSessionDetailsStore } from '../-store/useSessionDetailsStore';
import { DraftSession, getSessionBySessionId } from '../-services/utils';
import { LiveSessionReport } from '../-services/utils';
import {
    buildRegistrationColumns,
    REGISTRATION_WIDTH,
    buildReportColumns,
    REPORT_WIDTH,
} from '../-constants/reportTable';
import { MyTable } from '@/components/design-system/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import DeleteSessionDialog from './delete-session-dialog';
import {
    describeTimeUntilStart,
    getSessionJoinLink,
    isHostWindowOpen,
} from '../-utils/live-sesstions';
import { useHostJoin } from '../-hooks/useHostJoin';
import { UtmLinkMenuItem } from '@/components/common/utm/utm-link-menu-item';
import { UtmBuilderDialog } from '@/components/common/utm/utm-builder-dialog';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import {
    AccessBadge,
    hasAssignedTeacher,
    SessionBatches,
    SessionCardFooter,
    SessionCardHeading,
    SessionCardShell,
    SessionMetaDivider,
    SessionMetaItem,
    SessionMetaRow,
    SessionTeacher,
} from './session-card-shell';
import SessionQrDialog from './session-qr-dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { useServerTime } from '@/hooks/use-server-time';
import { DashboardLoader } from '@/components/core/dashboard-loader';

interface LiveSessionCardProps {
    session: LiveSession;
    isDraft?: boolean;
    /** Resolved once per page by the list, so avatars cost one lookup, not one per card. */
    avatarUrlByFileId?: Record<string, string>;
}

export default function LiveSessionCard({
    session,
    isDraft = false,
    avatarUrlByFileId,
}: LiveSessionCardProps) {
    const { t: tCard } = useTranslation('studyLibraryLiveSessionCard');
    const { t: tReportTable } = useTranslation('studyLibraryLiveSessionReportTable');
    const reportColumns = useMemo(() => buildReportColumns(tReportTable), [tReportTable]);
    const registrationColumns = useMemo(
        () => buildRegistrationColumns(tReportTable),
        [tReportTable]
    );
    const [openDialog, setOpenDialog] = useState<boolean>(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState<boolean>(false);
    const [openUtmDialog, setOpenUtmDialog] = useState<boolean>(false);
    const [openQrDialog, setOpenQrDialog] = useState<boolean>(false);
    const [confirmEarlyStart, setConfirmEarlyStart] = useState<boolean>(false);
    const [selectedTab, setSelectedTab] = useState<string>('Registration');
    const [isRegistrationExporting, setIsRegistrationExporting] = useState<boolean>(false);
    const [isAttendanceExporting, setIsAttendanceExporting] = useState<boolean>(false);
    // using Sonner toast for notifications

    const [scheduledSessionDetails, setScheduleSessionDetails] =
        useState<SessionDetailsResponse | null>(null);
    const { instituteDetails } = useInstituteDetailsStore();

    // Use server time hook for accurate time reference
    const { getUserTimezone } = useServerTime();

    const normalizeTime = (t: string) => {
        if (t.includes('T')) {
            const afterT = t.split('T')[1] || t;
            return afterT.replace(/[+-]\d{2}:\d{2}$|Z$/, '');
        }
        return t.replace(/[+-]\d{2}:\d{2}$|Z$/, '');
    };

    const getSessionTimeInfo = useCallback(() => {
        const sessionTimezone = session.timezone || 'Asia/Kolkata';
        const userTimezone = getUserTimezone();

        const sessionStartString = `${session.meeting_date}T${normalizeTime(session.start_time)}`;
        const sessionEndString = `${session.meeting_date}T${normalizeTime(session.last_entry_time)}`;

        const sessionStartTime = fromZonedTime(sessionStartString, sessionTimezone);
        const sessionEndTime = fromZonedTime(sessionEndString, sessionTimezone);

        // Format times for display
        const sessionTimeFormatted = formatInTimeZone(
            sessionStartTime,
            sessionTimezone,
            'yyyy-dd-MM h:mm a'
        );
        const localTimeFormatted = formatInTimeZone(
            sessionStartTime,
            userTimezone,
            'yyyy-dd-MM h:mm a'
        );
        const sessionEndTimeFormatted = formatInTimeZone(sessionEndTime, sessionTimezone, 'h:mm a');
        const localEndTimeFormatted = formatInTimeZone(sessionEndTime, userTimezone, 'h:mm a');

        // Card-facing labels. The card used to print the date and time ONLY when
        // the session's timezone differed from the viewer's — so for the common
        // case (both Asia/Kolkata) a session card showed no date or time at all.
        const dateLabel = formatInTimeZone(sessionStartTime, sessionTimezone, 'EEE, dd MMM yyyy');
        const timeRangeLabel = `${formatInTimeZone(sessionStartTime, sessionTimezone, 'h:mm a')} – ${sessionEndTimeFormatted}`;

        return {
            sessionTimezone,
            userTimezone,
            // Absolute instants, for the "can I start this now?" gate. The
            // formatted strings above are zone-local and cannot be compared.
            startInstant: sessionStartTime,
            endInstant: sessionEndTime,
            sessionTimeFormatted,
            localTimeFormatted,
            sessionEndTimeFormatted,
            localEndTimeFormatted,
            dateLabel,
            timeRangeLabel,
            isLocalTime: sessionTimezone === userTimezone,
        };
    }, [session, getUserTimezone]);

    const timeInfo = getSessionTimeInfo();
    // Use mutateAsync to ensure data is fetched before opening dialog
    const {
        mutateAsync: fetchReportAsync,
        data: reportResponse,
        isPending,
        error,
    } = useLiveSessionReport();

    const joinLink = getSessionJoinLink(session, instituteDetails?.learner_portal_base_url ?? '');
    const liveSessionTerm = getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession);
    const batchesTerm = getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch);
    const teacherTerm = getTerminology(RoleTerms.Teacher, SystemTerms.Teacher);
    const batchNames = (session.package_session_details ?? [])
        .map((d) => `${d.level_name} ${d.package_name}`.trim())
        .filter(Boolean);

    /**
     * The card's primary button.
     *
     * Opening the session page is NOT worth a button — clicking the card
     * already does that. So the slot goes to the thing you cannot otherwise do
     * from the list: start the class. It only appears inside the session's host
     * window (its own waiting-room lead, else 15 minutes) because on BBB and
     * Zoom "start" genuinely creates the meeting room.
     */
    const { resolveHostAction } = useHostJoin();
    const hostAction = useMemo(
        () =>
            resolveHostAction({
                sessionId: session.session_id,
                scheduleId: session.schedule_id,
                linkType: session.link_type,
                meetingLink: session.meeting_link,
                defaultClassLink: session.default_class_link,
            }),
        [resolveHostAction, session]
    );
    const hostWindowOpen = isHostWindowOpen(
        timeInfo.startInstant,
        timeInfo.endInstant,
        session.waiting_room_time
    );

    /**
     * Starting a BBB/Zoom class really does create the meeting room, so doing it
     * days early is a mistake worth catching — but hiding the button was worse:
     * it left the list with no way to start a class at all. So the button is
     * always here, and only the early case has to answer for itself.
     *
     * An external link opens a URL and creates nothing, so it never prompts.
     */
    const timeUntilStart = describeTimeUntilStart(timeInfo.startInstant);
    const runHostAction = async () => {
        if (!hostAction) return;
        if (hostAction.kind === 'host' && !hostWindowOpen) {
            setConfirmEarlyStart(true);
            return;
        }
        await hostAction.run();
    };

    const navigate = useNavigate();
    const { setSessionId, setIsEdit } = useLiveSessionStore();
    const { setSessionDetails } = useSessionDetailsStore();

    const handleTabChange = (value: string) => {
        setSelectedTab(value);
    };

    const handleEditSession = async () => {
        try {
            const details = await getSessionBySessionId(session?.session_id || '');
            setSessionId(details.sessionId);
            setSessionDetails(details);
            setIsEdit(true);
            console.log('Session Details:', details);
            navigate({ to: `/study-library/live-session/schedule/step1` });
        } catch (error) {
            console.error('Failed to fetch session details:', error);
        }
    };

    const handleDeleteSuccess = () => {
        // Close the confirmation dialog automatically
        setOpenDeleteDialog(false);
    };

    const convertToReportTableData = (data: LiveSessionReport[]) => {
        return data.map((item, idx) => ({
            index: idx + 1,
            username: item.fullName,
            phoneNumber: item.mobileNumber,
            email: item.email,
        }));
    };

    const tableData = {
        content: reportResponse ? convertToReportTableData(reportResponse) : [],
        total_pages: 0,
        page_no: 0,
        page_size: 10,
        total_elements: 0,
        last: true,
    };

    const convertToReportTableAttedanceData = (data: LiveSessionReport[]) => {
        return data.map((item, idx) => ({
            index: idx + 1,
            username: item.fullName,
            attendanceStatus: item.attendanceStatus,
        }));
    };

    const tableAttendanceData = {
        content: reportResponse ? convertToReportTableAttedanceData(reportResponse) : [],
        total_pages: 0,
        page_no: 0,
        page_size: 10,
        total_elements: 0,
        last: true,
    };

    // Fetch details and report, then open dialog
    const handleOpenDialog = async () => {
        try {
            const details = await fetchSessionDetails(session.schedule_id);
            setScheduleSessionDetails(details);
            await fetchReportAsync({
                sessionId: session.session_id,
                scheduleId: session.schedule_id,
                accessType: session.access_level,
            });
            setOpenDialog(true);
        } catch (err) {
            console.error('Error loading participant details:', err);
        }
    };

    const handleOpenDeleteDialog = () => {
        setOpenDeleteDialog(!openDeleteDialog);
    };
    // Adding export handlers
    const handleExportRegistration = () => {
        setIsRegistrationExporting(true);
        const csv = Papa.unparse(tableData.content);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `registrations_session_${session.session_id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsRegistrationExporting(false);
        toast.success('Registrations downloaded successfully.');
    };
    const handleExportAttendance = () => {
        setIsAttendanceExporting(true);
        const csvData = (reportResponse || []).map((item, idx) => {
            const engagement = item.engagementData
                ? (() => {
                      try {
                          return JSON.parse(item.engagementData);
                      } catch {
                          return null;
                      }
                  })()
                : null;
            const duration = item.providerTotalDurationMinutes ?? '';
            const talkTimeMin = engagement?.talkTime ? Math.round(engagement.talkTime / 60) : '';
            const talks = engagement?.talks ?? '';
            const raiseHands = engagement?.raisehand ?? '';
            const emojis = engagement?.emojis ?? '';
            const chats = engagement?.chats ?? '';
            const pollVotes = engagement?.pollVotes ?? '';

            // Active points formula
            let activePoints: number | string = '';
            if (duration !== '' || engagement) {
                let score = 0;
                if (typeof duration === 'number') score += duration;
                if (engagement) {
                    score += ((engagement.talkTime ?? 0) / 60) * 2;
                    score += (engagement.talks ?? 0) * 0.5;
                    score += (engagement.raisehand ?? 0) * 3;
                    score += (engagement.emojis ?? 0) * 1;
                    score += (engagement.chats ?? 0) * 1.5;
                    score += (engagement.pollVotes ?? 0) * 2;
                }
                activePoints = Math.round(score);
            }

            return {
                '#': idx + 1,
                Name: item.fullName,
                Email: item.email || '',
                Status:
                    item.attendanceStatus === 'PRESENT'
                        ? 'Present'
                        : item.attendanceStatus === 'ABSENT'
                          ? 'Absent'
                          : 'Unmarked',
                Mode: item.statusType || '',
                'Duration (min)': duration,
                'Active Points': activePoints,
                'Talk Time (min)': talkTimeMin,
                'Talk Segments': talks,
                'Raise Hands': raiseHands,
                Emojis: emojis,
                Chats: chats,
                'Poll Votes': pollVotes,
            };
        });
        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `attendance_session_${session.session_id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsAttendanceExporting(false);
        toast.success('Attendance report downloaded successfully.');
    };

    const cardRef = useRef<HTMLDivElement>(null);

    // MyDialog portals to document.body, but Radix re-bubbles synthetic events
    // through the React tree — so clicks on the dialog's X button, header,
    // footer, or backdrop would otherwise fire this handler and navigate away.
    // Guard by checking the click's DOM target actually lives inside the card.
    const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current?.contains(e.target as Node)) return;
        navigate({
            to: '/study-library/live-session/view/$sessionId',
            params: { sessionId: session?.session_id || '' },
        });
    };

    return (
        <>
            <SessionCardShell cardRef={cardRef} onClick={handleCardClick}>
                <SessionCardHeading
                    title={session.title}
                    subtitle={session.subject || session.defaultClassName || null}
                    badge={<AccessBadge accessLevel={session.access_level} />}
                    actions={
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <MyButton
                                    type="button"
                                    scale="medium"
                                    buttonType="secondary"
                                    layoutVariant="icon"
                                    aria-label={tCard('actions.viewDetails')}
                                >
                                    <DotsThree size={20} weight="bold" />
                                </MyButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem
                                    className="cursor-pointer gap-2"
                                    onClick={() => setOpenQrDialog(true)}
                                >
                                    <QrCode size={16} />
                                    {tCard('actions.generateQrCode')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="cursor-pointer gap-2"
                                    onClick={() => copyToClipboard(joinLink)}
                                >
                                    <Copy size={16} />
                                    {tCard('actions.copyJoinLink')}
                                </DropdownMenuItem>
                                {/* Private sessions hand out an embed link that
                                    only an already-enrolled learner can open —
                                    there is no campaign traffic to attribute, so
                                    the builder is offered on public registration
                                    links only. */}
                                <UtmLinkMenuItem
                                    hidden={session.access_level === 'private' || !joinLink}
                                    onSelect={() => setOpenUtmDialog(true)}
                                />
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="cursor-pointer gap-2"
                                    onClick={handleOpenDialog}
                                >
                                    <UsersThree size={16} />
                                    {tCard('actions.viewParticipants')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="cursor-pointer gap-2"
                                    onClick={() => {
                                        navigate({
                                            to: '/study-library/live-session/view/$sessionId',
                                            params: { sessionId: session?.session_id || '' },
                                        });
                                    }}
                                >
                                    <ArrowSquareOut size={16} />
                                    {tCard('actions.viewDetails')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="cursor-pointer gap-2"
                                    onClick={handleEditSession}
                                >
                                    <PencilSimple size={16} />
                                    {tCard('actions.editSession', { term: liveSessionTerm })}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="cursor-pointer gap-2 text-danger-600 focus:text-danger-600"
                                    onClick={handleOpenDeleteDialog}
                                >
                                    <Trash size={16} />
                                    {tCard('actions.deleteSession', { term: liveSessionTerm })}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    }
                />

                <SessionMetaRow>
                    <SessionMetaItem
                        icon={<CalendarBlank size={16} />}
                        tone="primary"
                        value={timeInfo.dateLabel}
                    />
                    <SessionMetaItem
                        icon={<Clock size={16} />}
                        tone="info"
                        value={timeInfo.timeRangeLabel}
                    />
                    <SessionMetaItem
                        icon={<GlobeHemisphereWest size={16} />}
                        tone="success"
                        value={timeInfo.sessionTimezone}
                    />
                    <SessionMetaDivider />
                    <SessionMetaItem
                        icon={<VideoCamera size={16} />}
                        tone="warning"
                        label={tCard('meta.meetingType')}
                        value={<span className="capitalize">{session.recurrence_type}</span>}
                    />
                </SessionMetaRow>

                <SessionCardFooter>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-8 gap-y-3">
                        <SessionTeacher
                            instructors={session.instructors}
                            label={teacherTerm}
                            unassignedLabel={tCard('meta.teacherUnassigned')}
                            unknownLabel={tCard('meta.teacherUnknown')}
                            avatarUrlByFileId={avatarUrlByFileId}
                        />
                        {hasAssignedTeacher(session.instructors) && batchNames.length ? (
                            <SessionMetaDivider />
                        ) : null}
                        {batchNames.length ? (
                            <SessionBatches
                                batches={batchNames}
                                maxVisible={2}
                                label={batchesTerm}
                                moreLabel={(count) => tCard('batches.more', { count })}
                                lessLabel={tCard('batches.less')}
                            />
                        ) : null}
                    </div>
                    <div
                        className="flex shrink-0 items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {hostAction ? (
                            <MyButton
                                type="button"
                                scale="medium"
                                buttonType="primary"
                                className="w-full sm:w-auto sm:!min-w-0 sm:px-5"
                                onAsyncClick={runHostAction}
                            >
                                {hostAction.kind === 'host' ? (
                                    <>
                                        <VideoCamera size={16} weight="fill" className="mr-2" />
                                        {tCard('actions.startAsHost')}
                                    </>
                                ) : (
                                    <>
                                        <ArrowSquareOut size={16} className="mr-2" />
                                        {tCard('actions.openClassLink')}
                                    </>
                                )}
                            </MyButton>
                        ) : (
                            <MyButton
                                type="button"
                                scale="medium"
                                buttonType="secondary"
                                className="w-full sm:w-auto sm:!min-w-0 sm:px-5"
                                onClick={() => {
                                    navigate({
                                        to: '/study-library/live-session/view/$sessionId',
                                        params: { sessionId: session?.session_id || '' },
                                    });
                                }}
                            >
                                <ArrowSquareOut size={16} className="mr-2" />
                                {tCard('actions.openSession')}
                            </MyButton>
                        )}
                    </div>
                </SessionCardFooter>
            </SessionCardShell>
            <MyDialog
                heading="Participant Details"
                open={openDialog}
                onOpenChange={(open) => setOpenDialog(open)}
                className="w-dialog-lg"
            >
                <div className="flex h-full flex-col gap-3 p-4 text-sm">
                    {/* Registration Count Display */}
                    <div className="flex flex-col gap-3 rounded-lg bg-primary-50 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                            <div className="text-lg font-semibold text-primary-500">
                                Total Registrations: {reportResponse?.length || 0}
                            </div>
                            {reportResponse && reportResponse.length > 0 && (
                                <>
                                    <div className="h-6 w-px bg-neutral-300" />
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="font-medium text-success-500">
                                            Present:{' '}
                                            {
                                                reportResponse.filter(
                                                    (item) => item.attendanceStatus === 'PRESENT'
                                                ).length
                                            }
                                        </div>
                                        <div className="font-medium text-danger-500">
                                            Absent:{' '}
                                            {
                                                reportResponse.filter(
                                                    (item) => item.attendanceStatus === 'ABSENT'
                                                ).length
                                            }
                                        </div>
                                        <div className="font-medium text-neutral-400">
                                            Unmarked:{' '}
                                            {
                                                reportResponse.filter(
                                                    (item) =>
                                                        item.attendanceStatus !== 'PRESENT' &&
                                                        item.attendanceStatus !== 'ABSENT'
                                                ).length
                                            }
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="text-sm text-neutral-600">
                            {reportResponse && reportResponse.length > 0
                                ? 'Participants summary for this session'
                                : 'No registrations yet'}
                        </div>
                    </div>
                    <div className="mt-4 h-full rounded-lg">
                        <Tabs value={selectedTab} onValueChange={handleTabChange}>
                            <div className="flex flex-row justify-between">
                                <TabsList className="inline-flex h-auto justify-start gap-4 rounded-none border-b !bg-transparent p-0">
                                    <TabsTrigger
                                        key={'Registration'}
                                        value={'Registration'}
                                        className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                                            selectedTab === 'Registration'
                                                ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                                : 'border-none bg-transparent'
                                        }`}
                                    >
                                        Registered Users
                                    </TabsTrigger>
                                    <TabsTrigger
                                        key={'Attendance'}
                                        value={'Attendance'}
                                        className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                                            selectedTab === 'Attendance'
                                                ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                                : 'border-none bg-transparent'
                                        }`}
                                    >
                                        Attendance
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value={'Registration'} className="space-y-4">
                                {isPending ? (
                                    <DashboardLoader />
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <h3 className="mb-2 text-lg font-semibold">
                                                Registrations
                                            </h3>
                                            <MyButton
                                                type="button"
                                                scale="large"
                                                buttonType="secondary"
                                                className="flex items-center font-medium"
                                                onClick={handleExportRegistration}
                                            >
                                                {isRegistrationExporting ? (
                                                    <>
                                                        <div className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                                        <span>Exporting...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <DownloadSimple
                                                            size={20}
                                                            className="mr-2"
                                                        />
                                                        Export
                                                    </>
                                                )}
                                            </MyButton>
                                        </div>
                                        <MyTable
                                            data={tableData}
                                            columns={registrationColumns}
                                            isLoading={isPending}
                                            error={error as Error | null}
                                            columnWidths={REGISTRATION_WIDTH}
                                            currentPage={0}
                                            className="!h-2/3 !w-fit"
                                        />
                                    </>
                                )}
                            </TabsContent>
                            <TabsContent value={'Attendance'} className="space-y-4">
                                {isPending ? (
                                    <DashboardLoader />
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <h3 className="mb-2 text-lg font-semibold">
                                                Attendance
                                            </h3>
                                            <MyButton
                                                type="button"
                                                scale="large"
                                                buttonType="secondary"
                                                className="flex items-center font-medium"
                                                onClick={handleExportAttendance}
                                            >
                                                {isAttendanceExporting ? (
                                                    <>
                                                        <div className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                                        <span>Exporting...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <DownloadSimple
                                                            size={20}
                                                            className="mr-2"
                                                        />
                                                        Export
                                                    </>
                                                )}
                                            </MyButton>
                                        </div>
                                        <MyTable
                                            data={tableAttendanceData}
                                            columns={reportColumns}
                                            isLoading={isPending}
                                            error={error as Error | null}
                                            columnWidths={REPORT_WIDTH}
                                            currentPage={0}
                                            className="!h-2/3 !w-fit"
                                        />
                                    </>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </MyDialog>
            <UtmBuilderDialog
                open={openUtmDialog}
                onOpenChange={setOpenUtmDialog}
                baseUrl={joinLink}
                sourceType="LIVE_SESSION"
                entityName={session.title}
            />
            <DeleteSessionDialog
                open={openDeleteDialog}
                onOpenChange={setOpenDeleteDialog}
                sessionId={session.session_id}
                scheduleId={session.schedule_id}
                isRecurring={session.recurrence_type !== 'once'}
                onSuccess={handleDeleteSuccess}
            />
            <AlertDialog open={confirmEarlyStart} onOpenChange={setConfirmEarlyStart}>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{tCard('earlyStart.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {timeUntilStart
                                ? tCard('earlyStart.bodyWithTime', { time: timeUntilStart })
                                : tCard('earlyStart.body')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tCard('earlyStart.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                setConfirmEarlyStart(false);
                                await hostAction?.run();
                            }}
                        >
                            {tCard('earlyStart.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <SessionQrDialog
                open={openQrDialog}
                onOpenChange={setOpenQrDialog}
                joinLink={joinLink}
                sessionId={session.session_id}
                heading={tCard('qrHeading')}
                accessLevel={session.access_level}
            />
        </>
    );
}
