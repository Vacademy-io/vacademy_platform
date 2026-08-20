import { useEffect, useMemo, useState } from 'react';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import {
    CalendarCheck,
    CalendarPlus,
    ChatCircle,
    CheckCircle,
    Clock,
    Copy,
    GoogleLogo,
    LinkSimple,
    MagnifyingGlass,
    NotePencil,
    UsersThree,
    WarningCircle,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { MyButton } from '@/components/design-system/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';
import { createDirectConversation } from '@/services/chat/chatApi';
import { useMyMenteesPaged, useMyMentorProfile } from '../-hooks/use-mentorship';
import { MyPagination } from '@/components/design-system/pagination';
import { MyTable } from '@/components/design-system/table';
import { MyInput } from '@/components/design-system/input';
import type { ColumnDef } from '@tanstack/react-table';

const MENTEES_PAGE_SIZE = 20;
import { initiateMyGoogle } from '../-services/mentorship-service';
import type { MenteeDTO } from '../-types/mentorship-types';
import { MenteeDetailSheet } from '../-components/MenteeDetailSheet';
import { ScheduleSessionDialog } from '../-components/ScheduleSessionDialog';
import { AvailabilityDialog } from '../-components/AvailabilityDialog';
import { MyScheduleCard } from '../-components/MyScheduleCard';
import { MentorshipPageHeader } from '../-components/MentorshipPageHeader';
import { MentorAvatar } from '../-components/MentorAvatar';
import { RecordSessionDialog } from '../-components/RecordSessionDialog';
import { useMyAwaitingReview } from '../-hooks/use-mentorship';
import type { MentorSessionDTO } from '../-types/mentorship-types';
import { reportApiError } from '@/lib/report-api-error';

export const Route = createLazyFileRoute('/mentorship/my-mentorship/')({
    component: MyMentorshipRoute,
});

function MyMentorshipRoute() {
    return (
        <LayoutContainer>
            <MyMentorshipPage />
        </LayoutContainer>
    );
}

function MyMentorshipPage() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">My Mentorship</h1>);
    }, [setNavHeading]);

    const navigate = useNavigate();
    const instituteId = getInstituteId();
    const [menteePage, setMenteePage] = useState(0);
    const { data, isLoading, isError, refetch } = useMyMenteesPaged(
        instituteId,
        menteePage,
        MENTEES_PAGE_SIZE
    );
    const profileQuery = useMyMentorProfile(instituteId);
    const [messagingId, setMessagingId] = useState<string | null>(null);
    const [detailMentee, setDetailMentee] = useState<MenteeDTO | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [availabilityOpen, setAvailabilityOpen] = useState(false);
    const [recordSession, setRecordSession] = useState<MentorSessionDTO | null>(null);
    const [menteeSearch, setMenteeSearch] = useState('');
    const [scheduleFor, setScheduleFor] = useState<MenteeDTO | null>(null);
    const awaitingReview = useMyAwaitingReview(instituteId);

    const profile = profileQuery.data;

    // Search filters the loaded page rather than asking the server: the mentee endpoint
    // takes no query, and a mentor's list is small enough that the page in hand is the
    // list. The count below always says which of the two the numbers refer to.
    const allMentees = useMemo(() => data?.content ?? [], [data?.content]);
    const menteeQuery = menteeSearch.trim().toLowerCase();
    const mentees = useMemo(
        () =>
            menteeQuery
                ? allMentees.filter((m) =>
                      [m.name, m.email, m.mobile_number].some((f) =>
                          (f ?? '').toLowerCase().includes(menteeQuery)
                      )
                  )
                : allMentees,
        [allMentees, menteeQuery]
    );

    const connectGoogle = async () => {
        if (!instituteId) return;
        setConnecting(true);
        try {
            const { oauth_url } = await initiateMyGoogle(instituteId);
            window.location.href = oauth_url;
        } catch (error) {
            reportApiError(error, {
                feature: 'mentorship',
                tags: { 'mentorship.action': 'connect-google' },
                fallbackMessage: "Couldn't start Google connect. Please try again.",
            });
            setConnecting(false);
        }
    };

    const myBookingUrl = profile?.booking_page_slug
        ? `${BASE_URL_LEARNER_DASHBOARD}/booking-response?instituteId=${instituteId}&slug=${profile.booking_page_slug}`
        : null;

    const copyMyBookingLink = async () => {
        if (!myBookingUrl) return;
        try {
            await navigator.clipboard.writeText(myBookingUrl);
            toast.success('Booking link copied');
        } catch {
            toast.error('Could not copy link');
        }
    };

    const message = async (mentee: MenteeDTO) => {
        setMessagingId(mentee.student_user_id);
        try {
            const conv = await createDirectConversation({
                targetUserId: mentee.student_user_id,
                targetUserName: mentee.name ?? undefined,
                targetUserRole: 'STUDENT',
            });
            navigate({ to: '/chat', search: { conversationId: conv.id } });
        } catch (error) {
            reportApiError(error, {
                feature: 'mentorship',
                tags: { 'mentorship.action': 'open-mentee-chat' },
                extra: { studentUserId: mentee.student_user_id },
                fallbackMessage: "Couldn't open the chat. Please try again.",
            });
        } finally {
            setMessagingId(null);
        }
    };

    const menteeColumns = useMemo<ColumnDef<MenteeDTO>[]>(
        () => [
            {
                id: 'student',
                header: 'Student',
                size: 240,
                cell: ({ row }) => {
                    const m = row.original;
                    return (
                        <div className="flex min-w-0 items-center gap-3">
                            <MentorAvatar
                                fileId={m.profile_pic_file_id}
                                name={m.name}
                                className="size-9 shrink-0 text-caption"
                            />
                            <div className="flex min-w-0 flex-col">
                                <button
                                    type="button"
                                    onClick={() => setDetailMentee(m)}
                                    className="truncate text-left text-body font-medium text-neutral-700 hover:text-primary-600 hover:underline"
                                    title="Open this student's profile"
                                >
                                    {m.name || m.student_user_id}
                                </button>
                                {m.email && (
                                    <span className="truncate text-caption text-neutral-400">
                                        {m.email}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                },
            },
            {
                id: 'contact',
                header: 'Phone',
                size: 140,
                cell: ({ row }) => (
                    <span className="text-body tabular-nums text-neutral-600">
                        {row.original.mobile_number || '—'}
                    </span>
                ),
            },
            {
                id: 'assigned',
                header: 'Assigned',
                size: 120,
                cell: ({ row }) => (
                    <span className="text-caption text-neutral-500">
                        {row.original.assignment_method === 'ROUND_ROBIN'
                            ? 'Auto-assigned'
                            : 'Assigned'}
                    </span>
                ),
            },
            {
                id: 'actions',
                header: 'Actions',
                size: 150,
                cell: ({ row }) => {
                    const m = row.original;
                    const label = m.name || 'this student';
                    return (
                        <div className="flex items-center gap-1">
                            <MyButton
                                type="button"
                                buttonType="text"
                                scale="small"
                                layoutVariant="icon"
                                onClick={() => setScheduleFor(m)}
                                aria-label={`Schedule a 1:1 with ${label}`}
                                title="Book a 1:1 — the student doesn't have to do anything"
                            >
                                <CalendarPlus size={18} />
                            </MyButton>
                            <MyButton
                                type="button"
                                buttonType="text"
                                scale="small"
                                layoutVariant="icon"
                                onClick={() => message(m)}
                                disable={messagingId === m.student_user_id}
                                aria-label={`Message ${label}`}
                                title="Send this student a direct message"
                            >
                                <ChatCircle size={18} />
                            </MyButton>
                            <MyButton
                                type="button"
                                buttonType="text"
                                scale="small"
                                layoutVariant="icon"
                                onClick={() => setDetailMentee(m)}
                                aria-label={`Open ${label}`}
                                title="Learning progress, notes and scheduled calls"
                            >
                                <NotePencil size={18} />
                            </MyButton>
                        </div>
                    );
                },
            },
        ],
        // `message` and the setters are stable for the row's purposes; only the
        // in-flight message id changes what a cell renders.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [messagingId]
    );

    return (
        <div className="flex flex-col gap-6 p-6">
            <MentorshipPageHeader
                title="My Mentorship"
                subtitle="Your mentees, availability and booking link"
            />

            {profileQuery.isLoading && (
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-16 w-full rounded-lg" />
                    <Skeleton className="h-16 w-full rounded-lg" />
                </div>
            )}

            {!profileQuery.isLoading && profileQuery.isError && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-danger-100 bg-danger-50 p-4">
                    <div className="flex items-center gap-2">
                        <WarningCircle size={18} weight="fill" className="text-danger-600" />
                        <p className="text-body text-danger-600">
                            Couldn&apos;t load your mentor profile.
                        </p>
                    </div>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        onClick={() => profileQuery.refetch()}
                    >
                        Retry
                    </MyButton>
                </div>
            )}

            {profile && (
                <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {/* Who learners see when they open the booking link. */}
                    <div className="flex h-full items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4">
                        <MentorAvatar
                            fileId={profile.profile_image_file_id}
                            name={profile.display_name || profile.name}
                            className="size-12 shrink-0 text-body"
                        />
                        <div className="flex min-w-0 flex-col">
                            <span className="truncate text-body font-medium text-neutral-700">
                                {profile.display_name || profile.name || 'You'}
                            </span>
                            <span className="truncate text-caption text-neutral-500">
                                {profile.title || 'Mentor'}
                            </span>
                            <span className="truncate text-caption text-neutral-400">
                                {(profile.assigned_student_count ?? 0) === 1
                                    ? '1 mentee assigned'
                                    : `${profile.assigned_student_count ?? 0} mentees assigned`}
                            </span>
                        </div>
                    </div>

                    {/* Stacked, not side-by-side: at a third of the row an inline
                        layout cannot shrink a Google address or a booking URL, and
                        both were being cut off mid-word. */}
                    <div className="flex h-full flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
                        <div className="flex items-center gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                                <GoogleLogo size={20} weight="bold" className="text-primary-600" />
                            </span>
                            <span className="min-w-0 flex-1 text-body font-medium text-neutral-700">
                                Google Calendar
                            </span>
                            {profile.google_connected && (
                                <span className="flex shrink-0 items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-caption text-success-600">
                                    <CheckCircle size={14} weight="fill" /> Connected
                                </span>
                            )}
                        </div>
                        <p className="text-caption text-neutral-500">
                            {profile.google_connected
                                ? 'Your bookings appear on your own calendar with a Meet link.'
                                : 'Optional. Connect your Google Calendar so your 1:1 bookings land on your own calendar with a Meet link.'}
                        </p>
                        {profile.google_connected ? (
                            profile.google_email && (
                                <span className="truncate text-caption text-neutral-400">
                                    {profile.google_email}
                                </span>
                            )
                        ) : (
                            <MyButton
                                type="button"
                                buttonType="primary"
                                scale="small"
                                className="mt-auto w-fit"
                                onClick={connectGoogle}
                                disable={connecting}
                            >
                                {connecting ? 'Redirecting…' : 'Connect Google'}
                            </MyButton>
                        )}
                    </div>

                    <div className="flex h-full flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
                        <div className="flex items-center gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                                <CalendarCheck
                                    size={20}
                                    weight="bold"
                                    className="text-primary-600"
                                />
                            </span>
                            <span className="min-w-0 flex-1 text-body font-medium text-neutral-700">
                                Your 1:1 booking link
                            </span>
                        </div>
                        <p className="text-caption text-neutral-500">
                            {myBookingUrl
                                ? 'Share this link so learners can book a session with you.'
                                : 'Booking isn’t set up yet. Ask your admin to enable your booking page.'}
                        </p>
                        {myBookingUrl && (
                            <span className="flex min-w-0 items-center gap-1 text-caption text-neutral-400">
                                <LinkSimple size={12} className="shrink-0" />
                                <span className="truncate" title={myBookingUrl}>
                                    {myBookingUrl}
                                </span>
                            </span>
                        )}
                        <div className="mt-auto flex flex-wrap items-center gap-2">
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="small"
                                onClick={() => setAvailabilityOpen(true)}
                                title="Set your weekly hours, meeting location and session types"
                            >
                                <Clock size={16} /> Edit availability
                            </MyButton>
                            {myBookingUrl && (
                                <>
                                    <MyButton
                                        type="button"
                                        buttonType="secondary"
                                        scale="small"
                                        onClick={copyMyBookingLink}
                                        title="Copy your booking link to share with learners"
                                    >
                                        <Copy size={16} /> Copy link
                                    </MyButton>
                                    <a
                                        href={myBookingUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-caption font-medium text-primary-500 hover:text-primary-600"
                                        title="Open your booking page in a new tab"
                                    >
                                        Open
                                    </a>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <MyScheduleCard instituteId={instituteId} />

            {(awaitingReview.data?.length ?? 0) > 0 && (
                <div className="flex flex-col gap-3 rounded-lg border border-warning-200 bg-warning-50 p-4">
                    <div className="flex flex-col">
                        <span className="text-body font-medium text-neutral-700">
                            {awaitingReview.data?.length} session
                            {(awaitingReview.data?.length ?? 0) === 1 ? '' : 's'} to record
                        </span>
                        <span className="text-caption text-neutral-500">
                            Until you record it, a session doesn&apos;t count as delivered anywhere.
                        </span>
                    </div>
                    <div className="flex flex-col gap-2">
                        {(awaitingReview.data ?? []).slice(0, 5).map((session) => (
                            <div
                                key={session.booking_instance_id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white p-3"
                            >
                                <div className="flex min-w-0 flex-col">
                                    <span className="truncate text-body text-neutral-700">
                                        {session.student_name || 'Mentee'}
                                    </span>
                                    <span className="truncate text-caption text-neutral-400">
                                        {session.scheduled_start_utc
                                            ? new Date(session.scheduled_start_utc).toLocaleString()
                                            : ''}
                                    </span>
                                </div>
                                <MyButton
                                    type="button"
                                    buttonType="primary"
                                    scale="small"
                                    onClick={() => setRecordSession(session)}
                                >
                                    Record
                                </MyButton>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col">
                    <h3 className="flex items-center gap-2 text-title font-semibold text-neutral-700">
                        Mentees
                        {!isLoading && !isError && (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-medium text-neutral-500">
                                {menteeQuery
                                    ? `${mentees.length} of ${allMentees.length}`
                                    : data?.total_elements ?? allMentees.length}
                            </span>
                        )}
                    </h3>
                    <p className="text-caption text-neutral-500">
                        Students assigned to you for mentorship.
                    </p>
                </div>
                <div className="relative w-full sm:w-72">
                    <MagnifyingGlass
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-neutral-400"
                    />
                    <MyInput
                        input={menteeSearch}
                        onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setMenteeSearch(e.target.value)
                        }
                        inputType="text"
                        inputPlaceholder="Search by name, email or phone"
                        className="pl-9 sm:w-full"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col gap-3">
                    {[1, 2].map((i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4"
                        >
                            <div className="flex items-center gap-3">
                                <Skeleton className="size-10 rounded-full" />
                                <div className="flex flex-col gap-1.5">
                                    <Skeleton className="h-3.5 w-32" />
                                    <Skeleton className="h-3 w-24" />
                                </div>
                            </div>
                            <Skeleton className="h-8 w-40" />
                        </div>
                    ))}
                </div>
            ) : isError ? (
                <div className="flex flex-col items-start gap-3 rounded-lg border border-danger-100 bg-danger-50 p-4">
                    <div className="flex items-center gap-2">
                        <WarningCircle size={18} weight="fill" className="text-danger-600" />
                        <p className="text-body text-danger-600">
                            Couldn&apos;t load your mentees.
                        </p>
                    </div>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        onClick={() => refetch()}
                    >
                        Retry
                    </MyButton>
                </div>
            ) : allMentees.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-200 p-10 text-center">
                    <UsersThree size={40} className="text-neutral-300" />
                    <div className="flex flex-col gap-1">
                        <p className="text-body font-medium text-neutral-700">
                            No students assigned yet
                        </p>
                        <p className="text-caption text-neutral-500">
                            Your admin will assign students to you here.
                        </p>
                    </div>
                </div>
            ) : mentees.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-200 p-10 text-center">
                    <MagnifyingGlass size={32} className="text-neutral-300" />
                    <p className="text-body font-medium text-neutral-700">
                        No mentees match &ldquo;{menteeSearch.trim()}&rdquo;
                    </p>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        onClick={() => setMenteeSearch('')}
                    >
                        Clear search
                    </MyButton>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                        <MyTable<MenteeDTO>
                            data={{
                                content: mentees,
                                total_pages: data?.total_pages ?? 1,
                                page_no: menteePage,
                                page_size: MENTEES_PAGE_SIZE,
                                total_elements: data?.total_elements ?? mentees.length,
                                last: data?.last ?? true,
                            }}
                            columns={menteeColumns}
                            isLoading={false}
                            error={null}
                            currentPage={menteePage}
                            scrollable
                        />
                    </div>
                    {!menteeQuery && (data?.total_pages ?? 0) > 1 && (
                        <MyPagination
                            currentPage={menteePage}
                            totalPages={data?.total_pages ?? 1}
                            onPageChange={setMenteePage}
                        />
                    )}
                </div>
            )}

            <MenteeDetailSheet
                mentee={detailMentee}
                instituteId={instituteId}
                open={!!detailMentee}
                onOpenChange={(o) => {
                    if (!o) setDetailMentee(null);
                }}
                asMentor
                mentorSlug={profile?.booking_page_slug}
            />

            <ScheduleSessionDialog
                instituteId={instituteId}
                open={!!scheduleFor}
                onOpenChange={(o) => {
                    if (!o) setScheduleFor(null);
                }}
                asMentor
                mentorSlug={profile?.booking_page_slug}
                student={
                    scheduleFor
                        ? { user_id: scheduleFor.student_user_id, name: scheduleFor.name }
                        : null
                }
            />

            <RecordSessionDialog
                session={recordSession}
                instituteId={instituteId}
                open={!!recordSession}
                onOpenChange={(o) => {
                    if (!o) setRecordSession(null);
                }}
            />

            <AvailabilityDialog
                instituteId={instituteId}
                open={availabilityOpen}
                onOpenChange={setAvailabilityOpen}
            />
        </div>
    );
}
