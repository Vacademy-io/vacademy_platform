import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useMemo } from 'react';
import { getPublicUrl } from '@/services/upload_file';
import { getSessionBySessionId } from '../-services/utils';
import type { SessionBySessionIdResponse } from '../-services/utils';
import {
    CalendarRange,
    Timer,
    UsersRound,
    Link2,
    MonitorPlay,
    MapPin,
    Edit,
    ArrowLeft,
    CheckCircle2,
    Copy,
    Bell,
    FileText,
    Share2,
    List,
    Calendar as CalendarIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SessionCalendarView } from '../-components/session-calendar-view';
import { format, addMinutes, isAfter, isBefore, parseISO } from 'date-fns';
import { MyButton } from '@/components/design-system/button';
import { useLiveSessionStore } from '../schedule/-store/sessionIdstore';
import { useSessionDetailsStore } from '../-store/useSessionDetailsStore';
import { toast } from 'sonner';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

export const Route = createFileRoute('/study-library/live-session/view/$sessionId')({
    component: ViewLiveSession,
});

interface GroupedSchedule {
    date: string;
    sessions: Array<{
        time: string;
        duration: string | number;
        link: string;
        id: string;
        status?: 'live' | 'upcoming' | 'past';
        startDate?: Date;
        default_class_link?: string | null;
        defaultClassName?: string | null;
        learner_button_config?: {
            text: string;
            url: string;
            background_color: string;
            text_color: string;
            visible: boolean;
        } | null;
    }>;
}

function ViewLiveSession() {
    const { sessionId } = Route.useParams();
    const navigate = useNavigate();
    const [sessionData, setSessionData] = useState<SessionBySessionIdResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const [coverUrl, setCoverUrl] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const { setSessionId, setIsEdit } = useLiveSessionStore();
    const { setSessionDetails } = useSessionDetailsStore();

    useEffect(() => {
        const fetchSessionDetails = async () => {
            try {
                setLoading(true);
                const data = await getSessionBySessionId(sessionId);
                setSessionData(data);
            } catch (err) {
                console.error('Error fetching session details:', err);
                setError('Failed to load session details');
            } finally {
                setLoading(false);
            }
        };

        fetchSessionDetails();
    }, [sessionId]);

    useEffect(() => {
        const fetchMediaUrls = async () => {
            if (sessionData?.schedule) {
                if (sessionData.schedule.thumbnail_file_id) {
                    try {
                        const url = await getPublicUrl(sessionData.schedule.thumbnail_file_id);
                        setThumbnailUrl(url);
                    } catch (e) {
                        console.error('Failed to load thumbnail url', e);
                    }
                }
                if (sessionData.schedule.cover_file_id) {
                    try {
                        const url = await getPublicUrl(sessionData.schedule.cover_file_id);
                        setCoverUrl(url);
                    } catch (e) {
                        console.error('Failed to load cover url', e);
                    }
                }
            }
        };
        fetchMediaUrls();
    }, [sessionData]);

    const handleEditSession = async () => {
        try {
            // If sessionData is already loaded, use it. Otherwise fetch it.
            const details = sessionData || (await getSessionBySessionId(sessionId));
            setSessionId(details.schedule.session_id);
            setSessionDetails(details);
            setIsEdit(true);
            navigate({ to: '/study-library/live-session/schedule/step1' });
        } catch (err) {
            console.error('Failed to load session for editing:', err);
            toast.error('Failed to load session for editing');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    // Group schedules by date for calendar view
    const groupedSchedules = useMemo(() => {
        if (!sessionData?.schedule?.added_schedules) return [];

        const grouped = new Map<string, GroupedSchedule['sessions']>();

        sessionData.schedule.added_schedules.forEach((schedule) => {
            const date = (schedule as { meetingDate?: string }).meetingDate || '';
            if (!date) return;

            if (!grouped.has(date)) {
                grouped.set(date, []);
            }

            // Calculate status
            const now = new Date();
            // Assuming startTime is in HH:mm format and date is YYYY-MM-DD
            const startDateTime = new Date(`${date}T${schedule.startTime}`);
            const endDateTime = addMinutes(startDateTime, Number(schedule.duration));

            let status: 'live' | 'upcoming' | 'past' = 'past';
            if (isAfter(now, startDateTime) && isBefore(now, endDateTime)) {
                status = 'live';
            } else if (isBefore(now, startDateTime)) {
                status = 'upcoming';
            }

            grouped.get(date)!.push({
                time: schedule.startTime,
                duration: schedule.duration,
                link: schedule.link,
                id: schedule.id,
                status,
                startDate: startDateTime,
                default_class_link: schedule.default_class_link,
                defaultClassName: schedule.default_class_name,
                learner_button_config: schedule.learner_button_config,
            });
        });

        // Convert to array and sort by date
        return Array.from(grouped.entries())
            .map(([date, sessions]) => ({
                date,
                sessions: sessions.sort((a, b) => a.time.localeCompare(b.time)),
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [sessionData]);

    const uniqueNotifications = useMemo(() => {
        if (!sessionData?.notifications?.addedNotificationActions) return [];
        const seen = new Set();
        return sessionData.notifications.addedNotificationActions.filter((notification) => {
            if (!notification.notify) return false;

            // Create a unique key based on type and time of day (HH:mm)
            // We ignore the date/month/year to deduplicate recurring sessions at the same time
            let timeKey = 'no-time';
            if (notification.time) {
                const date = new Date(notification.time);
                timeKey = `${date.getHours()}:${date.getMinutes()}`;
            }
            const key = `${notification.type}-${timeKey}`;

            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }, [sessionData]);

    if (loading) {
        return (
            <LayoutContainer>
                <div className="mx-auto max-w-5xl space-y-6 p-6">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                    <Skeleton className="h-12 w-1/2" />
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div className="space-y-6 lg:col-span-2">
                            <Skeleton className="h-64 w-full rounded-xl" />
                            <Skeleton className="h-32 w-full rounded-xl" />
                        </div>
                        <div className="space-y-6">
                            <Skeleton className="h-48 w-full rounded-xl" />
                            <Skeleton className="h-32 w-full rounded-xl" />
                        </div>
                    </div>
                </div>
            </LayoutContainer>
        );
    }

    if (error || !sessionData) {
        return (
            <LayoutContainer>
                <div className="flex h-[calc(100vh-100px)] items-center justify-center">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-destructive">Error</h2>
                        <p className="mt-2 text-muted-foreground">
                            {error || 'Session not found'}
                        </p>
                        <MyButton
                            onClick={() => navigate({ to: '/study-library/live-session' })}
                            className="mt-4"
                            buttonType="secondary"
                        >
                            Go Back to Sessions
                        </MyButton>
                    </div>
                </div>
            </LayoutContainer>
        );
    }

    const { schedule, notifications } = sessionData;
    const isRecurring = schedule.recurrence_type === 'weekly';

    return (
        <LayoutContainer>
            <div className="flex w-full flex-col gap-6 p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header Section */}
                <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <button
                            onClick={() => navigate({ to: '/study-library/live-session' })}
                            className="group flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <div className="flex size-6 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-transform group-hover:-translate-x-1">
                                <ArrowLeft className="size-3" />
                            </div>
                            Back to Sessions
                        </button>
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                                    {schedule.title}
                                </h1>
                            </div>
                            {schedule.subject && schedule.subject !== 'none' && (
                                <p className="text-base text-muted-foreground">
                                    Subject: <span className="font-medium text-foreground">{schedule.subject}</span>
                                </p>
                            )}
                        </div>
                    </div>
                    <MyButton onClick={handleEditSession} className="shrink-0 shadow-sm" scale="medium">
                        <Edit className="mr-2 size-4" />
                        Edit Session
                    </MyButton>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    {/* Main Content Column */}
                    <div className="space-y-6 lg:col-span-8 xl:col-span-9">
                        {/* Session Details Card */}
                        <Card className="overflow-hidden border-border/60 shadow-sm transition-all hover:border-border/80">
                            <CardHeader className="bg-muted/40 px-6 py-4">
                                <CardTitle className="flex items-center gap-3 text-lg font-semibold">
                                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                                        <MonitorPlay className="size-5" />
                                    </div>
                                    Session Details
                                </CardTitle>
                            </CardHeader>
                            <Separator />
                            <CardContent className="grid gap-x-8 gap-y-6 p-6 sm:grid-cols-2 xhl:grid-cols-3">
                                <InfoItem
                                    icon={<CalendarRange className="size-4 text-primary" />}
                                    label="Session Type"
                                    value={isRecurring ? 'Weekly Recurring' : 'One-Time Session'}
                                />
                                <InfoItem
                                    icon={<MapPin className="size-4 text-primary" />}
                                    label="Timezone"
                                    value={schedule.timezone || 'Not specified'}
                                />
                                <InfoItem
                                    icon={<Timer className="size-4 text-primary" />}
                                    label="Start Date & Time"
                                    value={format(new Date(schedule.start_time), 'PPP p')}
                                />
                                {schedule.last_entry_time && (
                                    <InfoItem
                                        icon={<Timer className="size-4 text-primary" />}
                                        label="Last Entry Time"
                                        value={format(new Date(schedule.last_entry_time), 'PPP p')}
                                    />
                                )}
                                {isRecurring && schedule.session_end_date && (
                                    <InfoItem
                                        icon={<CalendarRange className="size-4 text-primary" />}
                                        label="End Date"
                                        value={format(new Date(schedule.session_end_date), 'PPP')}
                                    />
                                )}

                                <div className="sm:col-span-2 space-y-4 pt-2">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <InfoItem
                                            icon={<MonitorPlay className="size-4 text-primary" />}
                                            label="Platform"
                                            value={schedule.link_type || 'Other'}
                                        />
                                        <InfoItem
                                            icon={<UsersRound className="size-4 text-primary" />}
                                            label="Access Type"
                                            value={
                                                <span className="capitalize">{schedule.access_type}</span>
                                            }
                                        />
                                    </div>

                                    {/* Links Section */}
                                    <div className="flex flex-col gap-4 pt-4 border-t mt-2">
                                        {schedule.default_meet_link && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    <Link2 className="size-3.5 text-primary" />
                                                    Default Meeting Link
                                                </div>
                                                <div className="flex items-center gap-2 rounded-md border bg-muted/20 p-2 pr-2 transition-all hover:bg-muted/40 hover:border-border/80">
                                                    <a
                                                        href={schedule.default_meet_link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 truncate text-sm font-medium text-blue-600 hover:underline underline-offset-2"
                                                        title={schedule.default_meet_link}
                                                    >
                                                        {schedule.default_meet_link}
                                                    </a>
                                                    <MyButton
                                                        onClick={() => copyToClipboard(schedule.default_meet_link)}
                                                        buttonType="text"
                                                        scale="small"
                                                        className="h-6 w-6 p-0 hover:bg-background shadow-none shrink-0"
                                                        type="button"
                                                        title="Copy link"
                                                    >
                                                        <Copy className="size-3.5 text-muted-foreground" />
                                                    </MyButton>
                                                </div>
                                            </div>
                                        )}

                                        {schedule.join_link && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    <Share2 className="size-3.5 text-primary" />
                                                    Join Link
                                                </div>
                                                <div className="flex items-center gap-2 rounded-md border bg-muted/20 p-2 pr-2 transition-all hover:bg-muted/40 hover:border-border/80">
                                                    <a
                                                        href={schedule.join_link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 truncate text-sm font-medium text-blue-600 hover:underline underline-offset-2"
                                                        title={schedule.join_link}
                                                    >
                                                        {schedule.join_link}
                                                    </a>
                                                    <MyButton
                                                        onClick={() => copyToClipboard(schedule.join_link)}
                                                        buttonType="text"
                                                        scale="small"
                                                        className="h-6 w-6 p-0 hover:bg-background shadow-none shrink-0"
                                                        type="button"
                                                        title="Copy link"
                                                    >
                                                        <Copy className="size-3.5 text-muted-foreground" />
                                                    </MyButton>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Description Card */}
                        {schedule.description_html &&
                            schedule.description_html.replace(/<[^>]*>/g, '').trim().length > 0 && (
                                <Card className="overflow-hidden border-border/60 shadow-sm">
                                    <CardHeader className="bg-muted/40 px-6 py-4">
                                        <CardTitle className="text-lg font-semibold">Description</CardTitle>
                                    </CardHeader>
                                    <Separator />
                                    <CardContent className="p-6">
                                        <div
                                            className="prose prose-sm max-w-none text-muted-foreground prose-headings:font-semibold prose-headings:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
                                            dangerouslySetInnerHTML={{ __html: schedule.description_html }}
                                        />
                                    </CardContent>
                                </Card>
                            )}

                        {/* Registration Fields */}
                        {notifications?.addedFields && notifications.addedFields.length > 0 && (
                            <Card className="overflow-hidden border-border/60 shadow-sm">
                                <CardHeader className="bg-muted/40 px-6 py-4">
                                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                                        <FileText className="size-5" />
                                        Registration Form Details
                                    </CardTitle>
                                </CardHeader>
                                <Separator />
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                <TableHead className="pl-6 w-[50%]">Field Label</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead className="text-right pr-6">Required</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {notifications.addedFields.map((field) => (
                                                <TableRow key={field.id} className="hover:bg-muted/5">
                                                    <TableCell className="pl-6 font-medium text-foreground">
                                                        {field.label}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
                                                            {field.type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        {field.required ? (
                                                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-medium uppercase tracking-wider">
                                                                Required
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">Optional</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )}

                        {/* Calendar View for Recurring Sessions */}
                        {isRecurring && groupedSchedules.length > 0 && (
                            <Card className="overflow-hidden border-border/60 shadow-sm">
                                <CardHeader className="bg-muted/40 px-6 py-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg font-semibold">Scheduled Sessions</CardTitle>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
                                                <MyButton
                                                    onClick={() => setViewMode('list')}
                                                    buttonType="text"
                                                    scale="small"
                                                    className={cn(
                                                        "h-7 w-7 p-0 transition-all",
                                                        viewMode === 'list'
                                                            ? "bg-muted text-foreground shadow-sm"
                                                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                    )}
                                                    title="List View"
                                                >
                                                    <List className="size-4" />
                                                </MyButton>
                                                <MyButton
                                                    onClick={() => setViewMode('calendar')}
                                                    buttonType="text"
                                                    scale="small"
                                                    className={cn(
                                                        "h-7 w-7 p-0 transition-all",
                                                        viewMode === 'calendar'
                                                            ? "bg-muted text-foreground shadow-sm"
                                                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                    )}
                                                    title="Calendar View"
                                                >
                                                    <CalendarIcon className="size-4" />
                                                </MyButton>
                                            </div>
                                            <Badge variant="secondary" className="px-3 py-1 text-xs font-medium">
                                                {groupedSchedules.length} days
                                            </Badge>
                                        </div>
                                    </div>
                                </CardHeader>
                                <Separator />
                                <CardContent className="space-y-4 p-6">
                                    {viewMode === 'list' ? (
                                        <>
                                            <Accordion type="multiple" className="w-full">
                                                {groupedSchedules
                                                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                                    .map((daySchedule) => (
                                                        <AccordionItem value={daySchedule.date} key={daySchedule.date} className="border-b last:border-0">
                                                            <AccordionTrigger className="hover:no-underline py-3">
                                                                <div className="flex flex-1 items-center justify-between mr-4">
                                                                    <h3 className="font-semibold text-foreground">
                                                                        {format(new Date(daySchedule.date), 'EEEE, MMMM d, yyyy')}
                                                                    </h3>
                                                                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
                                                                        {daySchedule.sessions.length} session{daySchedule.sessions.length !== 1 ? 's' : ''}
                                                                    </span>
                                                                </div>
                                                            </AccordionTrigger>
                                                            <AccordionContent>
                                                                <div className="space-y-4 pt-2">
                                                                    {/* Day Level Info */}
                                                                    {(() => {
                                                                        const firstSession = daySchedule.sessions[0];
                                                                        const defaultLink = firstSession?.default_class_link;
                                                                        const defaultClassName = firstSession?.defaultClassName;
                                                                        const learnerButton = firstSession?.learner_button_config;

                                                                        if (defaultLink || (learnerButton && learnerButton.visible)) {
                                                                            return (
                                                                                <div className="rounded-lg border border-blue-100 bg-gradient-to-br from-blue-50/50 to-white p-4 shadow-sm">
                                                                                    <div className="mb-2 flex items-center gap-2">
                                                                                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500 shadow-sm">
                                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                                                            </svg>
                                                                                        </div>
                                                                                        <h5 className="text-sm font-semibold text-gray-900">Default Class Information</h5>
                                                                                    </div>
                                                                                    <div className="space-y-2.5 text-sm">
                                                                                        {defaultClassName && (
                                                                                            <div className="flex items-start gap-2">
                                                                                                <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                                                                </svg>
                                                                                                <div className="flex-1">
                                                                                                    <span className="font-medium text-gray-700">Class Name: </span>
                                                                                                    <span className="font-semibold text-gray-900">{defaultClassName}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                        {defaultLink && (
                                                                                            <div className="flex items-start gap-2">
                                                                                                <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                                                                </svg>
                                                                                                <div className="flex-1">
                                                                                                    <span className="font-medium text-gray-700">Link: </span>
                                                                                                    <a
                                                                                                        href={defaultLink}
                                                                                                        target="_blank"
                                                                                                        rel="noopener noreferrer"
                                                                                                        className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700 hover:underline break-all"
                                                                                                    >
                                                                                                        {defaultLink}
                                                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                                                                        </svg>
                                                                                                    </a>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                        {learnerButton && learnerButton.visible && (
                                                                                            <div className="flex items-start gap-2 pt-1">
                                                                                                <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                                                                                </svg>
                                                                                                <div className="flex-1">
                                                                                                    <span className="font-medium text-gray-700">Custom Button: </span>
                                                                                                    <span
                                                                                                        style={{
                                                                                                            backgroundColor: learnerButton.background_color,
                                                                                                            color: learnerButton.text_color,
                                                                                                        }}
                                                                                                        className="inline-block rounded-md px-2.5 py-1 text-xs font-semibold shadow-sm"
                                                                                                    >
                                                                                                        {learnerButton.text}
                                                                                                    </span>
                                                                                                    <span className="ml-2 text-xs text-gray-600 break-all">
                                                                                                        → {learnerButton.url}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    })()}

                                                                    <div className="space-y-2">
                                                                        {daySchedule.sessions.map((session) => (
                                                                            <div
                                                                                key={session.id}
                                                                                className="rounded-md border bg-muted/30 p-3"
                                                                            >
                                                                                {/* Session Time and Duration */}
                                                                                <div className="flex items-center justify-between">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <div className="flex items-center gap-2 text-sm">
                                                                                            <Timer className="size-4 text-primary" />
                                                                                            <span className="font-medium">{session.time}</span>
                                                                                        </div>
                                                                                        <span className="text-xs text-muted-foreground">
                                                                                            {session.duration} mins
                                                                                        </span>
                                                                                    </div>
                                                                                    <a
                                                                                        href={session.link}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="text-xs font-medium text-primary hover:underline"
                                                                                    >
                                                                                        Join →
                                                                                    </a>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    ))}
                                            </Accordion>

                                            {groupedSchedules.length > itemsPerPage && (() => {
                                                const totalPages = Math.ceil(groupedSchedules.length / itemsPerPage);
                                                // Build truncated page number list: 1 ... (current-1) current (current+1) ... last
                                                const getPageNumbers = (): (number | 'ellipsis')[] => {
                                                    const pages: (number | 'ellipsis')[] = [];
                                                    if (totalPages <= 7) {
                                                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                                                        return pages;
                                                    }
                                                    // Always show first page
                                                    pages.push(1);
                                                    if (currentPage > 3) pages.push('ellipsis');
                                                    // Pages around current
                                                    const start = Math.max(2, currentPage - 1);
                                                    const end = Math.min(totalPages - 1, currentPage + 1);
                                                    for (let i = start; i <= end; i++) pages.push(i);
                                                    if (currentPage < totalPages - 2) pages.push('ellipsis');
                                                    // Always show last page
                                                    pages.push(totalPages);
                                                    return pages;
                                                };
                                                return (
                                                    <div className="mt-4 flex justify-center">
                                                        <Pagination>
                                                            <PaginationContent>
                                                                <PaginationItem>
                                                                    <PaginationPrevious
                                                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                                                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                                                    />
                                                                </PaginationItem>

                                                                {getPageNumbers().map((page, idx) =>
                                                                    page === 'ellipsis' ? (
                                                                        <PaginationItem key={`ellipsis-${idx}`}>
                                                                            <PaginationEllipsis />
                                                                        </PaginationItem>
                                                                    ) : (
                                                                        <PaginationItem key={page}>
                                                                            <PaginationLink
                                                                                isActive={currentPage === page}
                                                                                onClick={() => setCurrentPage(page)}
                                                                                className="cursor-pointer"
                                                                            >
                                                                                {page}
                                                                            </PaginationLink>
                                                                        </PaginationItem>
                                                                    )
                                                                )}

                                                                <PaginationItem>
                                                                    <PaginationNext
                                                                        onClick={() =>
                                                                            setCurrentPage((p) =>
                                                                                Math.min(totalPages, p + 1)
                                                                            )
                                                                        }
                                                                        className={
                                                                            currentPage === totalPages
                                                                                ? 'pointer-events-none opacity-50'
                                                                                : 'cursor-pointer'
                                                                        }
                                                                    />
                                                                </PaginationItem>
                                                            </PaginationContent>
                                                        </Pagination>
                                                    </div>
                                                );
                                            })()}
                                        </>
                                    ) : (
                                        <SessionCalendarView schedules={groupedSchedules} />
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Sidebar Column */}
                    <div className="space-y-6 lg:col-span-4 xl:col-span-3">
                        {/* Settings Card */}
                        <Card className="overflow-hidden border-border/60 shadow-sm">
                            <CardHeader className="bg-muted/40 px-6 py-4">
                                <CardTitle className="text-lg font-semibold">Settings</CardTitle>
                            </CardHeader>
                            <Separator />
                            <CardContent className="grid gap-4 p-6">
                                <SettingItem
                                    label="Waiting Room"
                                    value={
                                        schedule.waiting_room_time && Number(schedule.waiting_room_time) > 0
                                            ? `${schedule.waiting_room_time} mins before`
                                            : 'Disabled'
                                    }
                                />
                                <Separator />
                                <SettingItem
                                    label="Allow Rewind"
                                    value={schedule.allow_rewind ? 'Yes' : 'No'}
                                />
                                <Separator />
                                <SettingItem
                                    label="Allow Pause"
                                    value={schedule.allow_play_pause ? 'Yes' : 'No'}
                                />
                                <Separator />
                                <SettingItem
                                    label="Streaming Type"
                                    value={
                                        schedule.session_streaming_service_type === 'embed'
                                            ? 'Embed in App'
                                            : 'Redirect'
                                    }
                                />
                            </CardContent>
                        </Card>

                        {/* Notifications Card */}
                        {uniqueNotifications.length > 0 && (
                            <Card className="overflow-hidden border-border/60 shadow-sm">
                                <CardHeader className="bg-muted/40 px-6 py-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                                            <Bell className="size-5" />
                                            Notifications
                                        </CardTitle>
                                        <Badge variant="secondary" className="rounded-full px-2 text-xs">
                                            {uniqueNotifications.length}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <Separator />
                                <CardContent className="space-y-3 p-6">
                                    {uniqueNotifications.map((notification: any, index: number) => (
                                        <div
                                            key={`${notification.type}-${index}`}
                                            className="group flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm transition-all hover:bg-muted/40"
                                        >
                                            <div className="flex items-center justify-between">
                                                <Badge
                                                    variant="outline"
                                                    className="border-primary/20 bg-primary/5 text-[10px] font-semibold uppercase tracking-wider text-primary"
                                                >
                                                    {notification.type.replace(/_/g, ' ')}
                                                </Badge>
                                                {notification.time && (
                                                    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                                        <Timer className="size-3" />
                                                        {format(new Date(notification.time), 'p')}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {notification.notifyBy.mail && (
                                                    <Badge variant="secondary" className="gap-1.5 px-2 py-0.5 text-[10px] font-medium">
                                                        <div className="size-1.5 rounded-full bg-blue-500" />
                                                        Email
                                                    </Badge>
                                                )}
                                                {notification.notifyBy.whatsapp && (
                                                    <Badge variant="secondary" className="gap-1.5 px-2 py-0.5 text-[10px] font-medium">
                                                        <div className="size-1.5 rounded-full bg-green-500" />
                                                        WhatsApp
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* Media Card */}
                        {(schedule.thumbnail_file_id || schedule.background_score_file_id || schedule.cover_file_id) && (
                            <Card className="overflow-hidden border-border/60 shadow-sm">
                                <CardHeader className="bg-muted/40 px-6 py-4">
                                    <CardTitle className="text-lg font-semibold">Media Files</CardTitle>
                                </CardHeader>
                                <Separator />
                                <CardContent className="space-y-6 p-6">


                                    {schedule.thumbnail_file_id && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thumbnail</span>
                                                <Badge variant="outline" className="text-[10px] text-green-600 border-green-200 bg-green-50">Attached</Badge>
                                            </div>
                                            {thumbnailUrl ? (
                                                <div className="group relative aspect-video w-full overflow-hidden rounded-md border bg-muted shadow-sm">
                                                    <img
                                                        src={thumbnailUrl}
                                                        alt="Session Thumbnail"
                                                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                    />
                                                </div>
                                            ) : (
                                                <Skeleton className="aspect-video w-full rounded-md" />
                                            )}
                                        </div>
                                    )}

                                    {schedule.background_score_file_id && (
                                        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-200/50 dark:bg-green-800/50">
                                                <CheckCircle2 className="size-4" />
                                            </div>
                                            <div className="text-sm font-medium">Background music attached</div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Associatd Batches */}
                        {schedule.package_session_ids && schedule.package_session_ids.length > 0 && (
                            <Card className="overflow-hidden border-border/60 shadow-sm">
                                <CardHeader className="bg-muted/40 px-6 py-4">
                                    <CardTitle className="text-lg font-semibold">Associated Batches</CardTitle>
                                </CardHeader>
                                <Separator />
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 p-4 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                                        <span className="font-medium">Linked Batches</span>
                                        <Badge className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600">
                                            {schedule.package_session_ids.length}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </LayoutContainer >
    );
}

// Helper Components
function InfoItem({
    icon,
    label,
    value,
    className,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`flex items-start gap-4 ${className} group`}>
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground/70 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                {icon}
            </div>
            <div className="flex-1 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 transition-colors group-hover:text-muted-foreground">
                    {label}
                </div>
                <div className="text-sm font-medium text-foreground">{value}</div>
            </div>
        </div>
    );
}

function SettingItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium text-foreground">{value}</span>
        </div>
    );
}
