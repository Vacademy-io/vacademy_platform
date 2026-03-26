/* eslint-disable @typescript-eslint/no-unused-vars */
import QRCode from 'react-qr-code';
import { MyDialog } from '@/components/design-system/dialog';
import { Copy, DownloadSimple, LockSimple, DotsThree } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { MyButton } from '@/components/design-system/button';
import { copyToClipboard } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-utils/helper';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LiveSession } from '../schedule/-services/utils';
import { handleDownloadQRCode } from '@/routes/homework-creation/create-assessment/$assessmentId/$examtype/-utils/helper';
import { useQueryClient } from '@tanstack/react-query';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useState, useCallback } from 'react';
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
    registrationColumns,
    REGISTRATION_WIDTH,
    reportColumns,
    REPORT_WIDTH,
} from '../-constants/reportTable';
import { MyTable } from '@/components/design-system/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import DeleteSessionDialog from './delete-session-dialog';
import { getSessionJoinLink } from '../-utils/live-sesstions';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { useServerTime } from '@/hooks/use-server-time';
import { DashboardLoader } from '@/components/core/dashboard-loader';

interface LiveSessionCardProps {
    session: LiveSession;
    isDraft?: boolean;
}

export default function LiveSessionCard({ session, isDraft = false }: LiveSessionCardProps) {
    const [openDialog, setOpenDialog] = useState<boolean>(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState<boolean>(false);
    const [selectedTab, setSelectedTab] = useState<string>('Registration');
    const [isRegistrationExporting, setIsRegistrationExporting] = useState<boolean>(false);
    const [isAttendanceExporting, setIsAttendanceExporting] = useState<boolean>(false);
    // using Sonner toast for notifications

    const [scheduledSessionDetails, setScheduleSessionDetails] =
        useState<SessionDetailsResponse | null>(null);
    const { instituteDetails } = useInstituteDetailsStore();

    // Use server time hook for accurate time reference
    const { getUserTimezone } = useServerTime();

    // Simple helper to get session time info using server time utilities
    const getSessionTimeInfo = useCallback(() => {
        const sessionTimezone = session.timezone || 'Asia/Kolkata';
        const userTimezone = getUserTimezone();

        // Create session date-time strings
        const sessionStartString = `${session.meeting_date}T${session.start_time}`;
        const sessionEndString = `${session.meeting_date}T${session.last_entry_time}`;

        // Parse session times
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

        return {
            sessionTimezone,
            userTimezone,
            sessionTimeFormatted,
            localTimeFormatted,
            sessionEndTimeFormatted,
            localEndTimeFormatted,
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
    const formattedDateTime = `${session.meeting_date} ${session.start_time}`;

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
            const engagement = item.engagementData ? (() => { try { return JSON.parse(item.engagementData); } catch { return null; } })() : null;
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
                'Name': item.fullName,
                'Email': item.email || '',
                'Status': item.attendanceStatus === 'PRESENT' ? 'Present' : item.attendanceStatus === 'ABSENT' ? 'Absent' : 'Unmarked',
                'Mode': item.statusType || '',
                'Duration (min)': duration,
                'Active Points': activePoints,
                'Talk Time (min)': talkTimeMin,
                'Talk Segments': talks,
                'Raise Hands': raiseHands,
                'Emojis': emojis,
                'Chats': chats,
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

    const handleCardClick = () => {
        navigate({
            to: '/study-library/live-session/view/$sessionId',
            params: { sessionId: session?.session_id || '' },
        });
    };

    return (
        <>
            <div
                className="my-6 flex cursor-pointer flex-col gap-4 rounded-xl border bg-neutral-50 p-4 transition-shadow hover:shadow-md"
                onClick={handleCardClick}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="font-semibold">{session.title}</h1>
                        <Badge className="rounded-md border border-neutral-300 bg-primary-50 py-1.5 shadow-none">
                            <LockSimple size={16} className="mr-2" />
                            {session.access_level}
                        </Badge>
                    </div>

                    <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger>
                                <MyButton
                                    type="button"
                                    scale="small"
                                    buttonType="secondary"
                                    className="w-6 !min-w-6"
                                >
                                    <DotsThree size={32} />
                                </MyButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={handleOpenDeleteDialog}
                                >
                                    Delete Live Session
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => {
                                        handleOpenDialog();
                                    }}
                                >
                                    View Participant details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => {
                                        navigate({
                                            to: '/study-library/live-session/view/$sessionId',
                                            params: { sessionId: session?.session_id || '' },
                                        });
                                    }}
                                >
                                    View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={handleEditSession}
                                >
                                    Edit Live Session
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="flex w-full flex-wrap items-center justify-start gap-x-6 gap-y-1 text-sm text-neutral-500 sm:gap-x-8">
                    <div className="flex items-center gap-2">
                        <span className="text-black">
                            {getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)}:
                        </span>
                        <span>{session.subject}</span>
                    </div>
                    {!timeInfo.isLocalTime && (
                        <div className="flex items-center gap-2">
                            <span className="text-black">Start Date & Time:</span>
                            <span className="">
                                {timeInfo.localTimeFormatted} ({timeInfo.userTimezone})
                            </span>
                        </div>
                    )}
                    {!timeInfo.isLocalTime && (
                        <div className="flex items-center gap-2">
                            <span className="text-black">End Time:</span>
                            <span className="">{timeInfo.localEndTimeFormatted}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="text-black">Meeting Type:</span>
                        <span>{session.recurrence_type}</span>
                    </div>
                    {session.package_session_details && session.package_session_details.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-black">Batches:</span>
                            <span>
                                {session.package_session_details
                                    .map((d) => `${d.level_name} ${d.package_name}`)
                                    .join(', ')}
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2 overflow-hidden text-sm text-neutral-500 sm:gap-4">
                        <h1 className="shrink-0 !font-normal text-black">Join Link:</h1>
                        <span className="min-w-0 flex-1 truncate px-1 py-1 text-sm underline sm:px-2" title={joinLink}>
                            {joinLink}
                        </span>
                        <MyButton
                            type="button"
                            scale="small"
                            buttonType="secondary"
                            className="h-8 min-w-8 shrink-0 sm:mr-4"
                            onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(joinLink);
                            }}
                        >
                            <Copy size={32} />
                        </MyButton>
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                        <QRCode
                            value={joinLink}
                            className="size-16"
                            id={`qr-code-svg-live-session-${session.session_id}`}
                        />
                        <MyButton
                            type="button"
                            scale="small"
                            buttonType="secondary"
                            className="h-8 min-w-8"
                            onClick={() =>
                                handleDownloadQRCode(`qr-code-svg-live-session-${session.session_id}`)
                            }
                        >
                            <DownloadSimple size={32} />
                        </MyButton>
                    </div>
                </div>
            </div>
            <MyDialog
                heading="Participant Details"
                open={openDialog}
                onOpenChange={(open) => setOpenDialog(open)}
                className="w-[95vw] max-w-4xl sm:w-[80vw]"
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
                                        <div className="font-medium text-neutral-500">
                                            Absent:{' '}
                                            {
                                                reportResponse.filter(
                                                    (item) => item.attendanceStatus !== 'PRESENT'
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
                                        className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${selectedTab === 'Registration'
                                                ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                                : 'border-none bg-transparent'
                                            }`}
                                    >
                                        Registered Users
                                    </TabsTrigger>
                                    <TabsTrigger
                                        key={'Attendance'}
                                        value={'Attendance'}
                                        className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${selectedTab === 'Attendance'
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
                                            className="!h-[70%] !w-fit"
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
                                            className="!h-[70%] !w-fit"
                                        />
                                    </>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </MyDialog>
            <DeleteSessionDialog
                open={openDeleteDialog}
                onOpenChange={setOpenDeleteDialog}
                sessionId={session.session_id}
                scheduleId={session.schedule_id}
                isRecurring={session.recurrence_type !== 'once'}
                onSuccess={handleDeleteSuccess}
            />
        </>
    );
}
