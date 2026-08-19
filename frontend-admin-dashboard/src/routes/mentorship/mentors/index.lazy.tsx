import { useEffect, useMemo, useState } from 'react';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import {
    ArrowSquareOut,
    CalendarCheck,
    CalendarPlus,
    Copy,
    DotsThreeVertical,
    Eye,
    MagnifyingGlass,
    NotePencil,
    Plus,
    Star,
    Trash,
    UsersThree,
    WarningCircle,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { MyButton } from '@/components/design-system/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';
import {
    useDeleteMentor,
    useMentorDashboard,
    useMentorSessions,
    useMentorsPaged,
    useProvisionBookingPage,
} from '../-hooks/use-mentorship';
import { MyPagination } from '@/components/design-system/pagination';
import { MyTable } from '@/components/design-system/table';
import { StatusChips } from '@/components/design-system/chips';
import type { ColumnDef } from '@tanstack/react-table';
import { reportApiError } from '@/lib/report-api-error';

const MENTORS_PAGE_SIZE = 20;
import type { MentorDTO } from '../-types/mentorship-types';
import { AddMentorDialog } from '../-components/AddMentorDialog';
import { AssignMenteesDialog } from '../-components/AssignMenteesDialog';
import { BulkAssignDialog } from '../-components/BulkAssignDialog';
import { MentorAvatar } from '../-components/MentorAvatar';
import { EditMentorDialog } from '../-components/EditMentorDialog';
import { MentorFeedbackDialog } from '../-components/MentorFeedbackDialog';
import { MentorshipPageHeader } from '../-components/MentorshipPageHeader';
import { CapacityChip, CapacityMeter, RatingChip } from '../-components/MentorChips';
import { MyInput } from '@/components/design-system/input';
import { filterMentors } from '../-utils/filter-mentors';

export const Route = createLazyFileRoute('/mentorship/mentors/')({
    component: MentorsRoute,
});

function MentorsRoute() {
    return (
        <LayoutContainer>
            <MentorsPage />
        </LayoutContainer>
    );
}

function MentorsPage() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Mentorship</h1>);
    }, [setNavHeading]);

    const instituteId = getInstituteId();
    const { data, isLoading, isError, refetch } = useMentorDashboard(instituteId);
    // The visible list is paginated; the dashboard keeps stats + the full list for dialogs.
    const [page, setPage] = useState(0);
    const mentorsPage = useMentorsPaged(instituteId, page, MENTORS_PAGE_SIZE);
    const pagedMentors = mentorsPage.data?.content ?? [];
    const deleteMentor = useDeleteMentor();
    const provisionBooking = useProvisionBookingPage();

    const navigate = useNavigate();
    /** One mentor gets their own URL, so a detail view is shareable and the back button works. */
    const openMentor = (m: MentorDTO) =>
        navigate({ to: '/mentorship/mentors/$mentorId', params: { mentorId: m.id } });

    const [addOpen, setAddOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [editMentor, setEditMentor] = useState<MentorDTO | null>(null);
    const [feedbackMentor, setFeedbackMentor] = useState<MentorDTO | null>(null);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [assignMentor, setAssignMentor] = useState<MentorDTO | null>(null);
    const [bookingId, setBookingId] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState<MentorDTO | null>(null);

    const mentors = data?.mentors ?? [];

    // Searching switches from the server-paginated page to a filter over the full
    // mentor list the dashboard already loaded — a page-local filter would silently
    // hide matches sitting on other pages.
    const searching = search.trim().length > 0;
    const visibleMentors = searching ? filterMentors(mentors, search) : pagedMentors;

    // Upcoming load per mentor, from the sessions endpoint the dashboard already
    // uses. The mentor row is where an admin decides who to assign next, so "how
    // busy are they" belongs here and not one click away.
    const upcomingSessions = useMentorSessions(instituteId, { lifecycle: 'UPCOMING' });
    const upcomingByMentor = useMemo(() => {
        const acc: Record<string, number> = {};
        for (const s of upcomingSessions.data ?? []) {
            if (s.mentor_id) acc[s.mentor_id] = (acc[s.mentor_id] ?? 0) + 1;
        }
        return acc;
    }, [upcomingSessions.data]);

    const remove = async (m: MentorDTO) => {
        if (!instituteId) return;
        try {
            await deleteMentor.mutateAsync({ id: m.id, instituteId });
            toast.success('Mentor removed');
        } catch (error) {
            reportApiError(error, {
                feature: 'mentorship',
                tags: { 'mentorship.action': 'remove-mentor' },
                extra: { mentorId: m.id, assignedStudents: m.assigned_student_count },
                fallbackMessage: 'Failed to remove mentor',
            });
        }
    };

    const enableBooking = async (m: MentorDTO) => {
        if (!instituteId) return;
        setBookingId(m.id);
        try {
            await provisionBooking.mutateAsync({ id: m.id, instituteId });
            toast.success('Booking page set up');
        } catch (error) {
            reportApiError(error, {
                feature: 'mentorship',
                tags: { 'mentorship.action': 'provision-booking-page' },
                extra: { mentorId: m.id },
                fallbackMessage: 'Failed to set up booking page',
            });
        } finally {
            setBookingId(null);
        }
    };

    const totalCount = searching
        ? visibleMentors.length
        : mentorsPage.data?.total_elements ?? visibleMentors.length;
    const rangeStart =
        visibleMentors.length === 0 ? 0 : searching ? 1 : page * MENTORS_PAGE_SIZE + 1;
    const rangeEnd = searching
        ? visibleMentors.length
        : page * MENTORS_PAGE_SIZE + visibleMentors.length;

    /** Public 1:1 booking link an admin can share for this mentor. */
    const bookingUrl = (m: MentorDTO): string =>
        `${BASE_URL_LEARNER_DASHBOARD}/booking-response?instituteId=${instituteId}&slug=${m.booking_page_slug}`;

    const copyBookingLink = async (m: MentorDTO) => {
        try {
            await navigator.clipboard.writeText(bookingUrl(m));
            toast.success('Booking link copied');
        } catch {
            toast.error('Could not copy link');
        }
    };

    const columns = useMemo<ColumnDef<MentorDTO>[]>(
        () => [
            {
                id: 'mentor',
                header: 'Mentor',
                size: 230,
                cell: ({ row }) => {
                    const m = row.original;
                    return (
                        <div className="flex min-w-0 items-center gap-3">
                            <MentorAvatar
                                fileId={m.profile_image_file_id}
                                name={m.display_name || m.name}
                                className="size-9 shrink-0 text-caption"
                            />
                            <div className="flex min-w-0 flex-col">
                                <button
                                    type="button"
                                    onClick={() => openMentor(m)}
                                    className="truncate text-left text-body font-medium text-neutral-700 hover:text-primary-600 hover:underline"
                                    title="Open this mentor's profile, students, availability and sessions"
                                >
                                    {m.display_name || m.name || 'Mentor'}
                                </button>
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate text-caption text-neutral-400">
                                        {m.title || m.email || ''}
                                    </span>
                                    <RatingChip mentor={m} onClick={() => setFeedbackMentor(m)} />
                                </span>
                            </div>
                        </div>
                    );
                },
            },
            {
                id: 'expertise',
                header: 'Expertise',
                size: 150,
                cell: ({ row }) => {
                    const tags = row.original.expertise_tags ?? [];
                    if (tags.length === 0) {
                        return <span className="text-caption text-neutral-300">—</span>;
                    }
                    return (
                        <span
                            className="line-clamp-2 text-caption text-neutral-600"
                            title={tags.join(', ')}
                        >
                            {tags.join(', ')}
                        </span>
                    );
                },
            },
            {
                id: 'assigned',
                header: 'Assigned students',
                size: 130,
                cell: ({ row }) => <CapacityChip mentor={row.original} />,
            },
            {
                id: 'upcoming',
                header: 'Upcoming sessions',
                size: 140,
                cell: ({ row }) => (
                    <span className="text-body tabular-nums text-neutral-700">
                        {upcomingByMentor[row.original.id] ?? 0}
                    </span>
                ),
            },
            {
                id: 'capacity',
                header: 'Capacity',
                size: 130,
                cell: ({ row }) => <CapacityMeter mentor={row.original} />,
            },
            {
                id: 'status',
                header: 'Status',
                size: 100,
                cell: ({ row }) => (
                    <StatusChips
                        status={
                            (row.original.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
                                ? 'ACTIVE'
                                : 'INACTIVE'
                        }
                    >
                        {(row.original.status || 'ACTIVE').toLowerCase()}
                    </StatusChips>
                ),
            },
            {
                id: 'actions',
                header: 'Actions',
                size: 130,
                cell: ({ row }) => {
                    const m = row.original;
                    const label = m.display_name || m.name || 'mentor';
                    return (
                        <div className="flex items-center gap-1">
                            <MyButton
                                type="button"
                                buttonType="text"
                                scale="small"
                                layoutVariant="icon"
                                onClick={() => openMentor(m)}
                                aria-label={`View ${label}`}
                                title="View profile, students, availability and sessions"
                            >
                                <Eye size={18} />
                            </MyButton>
                            <MyButton
                                type="button"
                                buttonType="text"
                                scale="small"
                                layoutVariant="icon"
                                onClick={() => setAssignMentor(m)}
                                aria-label={`Assign students to ${label}`}
                                title="Assign students to this mentor"
                            >
                                <CalendarPlus size={18} />
                            </MyButton>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <MyButton
                                        type="button"
                                        buttonType="text"
                                        scale="small"
                                        layoutVariant="icon"
                                        aria-label={`More actions for ${label}`}
                                    >
                                        <DotsThreeVertical size={18} weight="bold" />
                                    </MyButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuItem
                                        className="gap-2"
                                        onClick={() => setEditMentor(m)}
                                    >
                                        <NotePencil size={16} /> Edit profile
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="gap-2"
                                        onClick={() => setFeedbackMentor(m)}
                                    >
                                        <Star size={16} /> Session feedback
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {m.booking_page_slug ? (
                                        <>
                                            <DropdownMenuItem
                                                className="gap-2"
                                                onClick={() => copyBookingLink(m)}
                                            >
                                                <Copy size={16} /> Copy booking link
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="gap-2"
                                                onClick={() =>
                                                    window.open(
                                                        bookingUrl(m),
                                                        '_blank',
                                                        'noopener,noreferrer'
                                                    )
                                                }
                                            >
                                                <ArrowSquareOut size={16} /> Open booking page
                                            </DropdownMenuItem>
                                        </>
                                    ) : (
                                        <DropdownMenuItem
                                            className="gap-2"
                                            disabled={bookingId === m.id}
                                            onClick={() => enableBooking(m)}
                                        >
                                            <CalendarCheck size={16} /> Enable booking
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="gap-2 text-danger-600 focus:text-danger-600"
                                        onClick={() => setConfirmRemove(m)}
                                    >
                                        <Trash size={16} /> Remove mentor
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    );
                },
            },
        ],
        // The cells close over setState setters and `navigate`, all of which are
        // stable; the values that actually change what a cell renders are listed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [upcomingByMentor, bookingId, instituteId]
    );

    return (
        <div className="flex flex-col gap-6 p-6">
            <MentorshipPageHeader
                title="Mentors"
                subtitle="Manage your mentors and their availability"
            >
                <MyButton
                    type="button"
                    buttonType="secondary"
                    scale="medium"
                    onClick={() => setBulkOpen(true)}
                    disable={mentors.length === 0}
                    title={
                        mentors.length === 0
                            ? 'Add a mentor first to bulk-assign students'
                            : 'Spread many students across mentors at once'
                    }
                >
                    <UsersThree size={18} /> Bulk assign
                </MyButton>
                <MyButton
                    type="button"
                    buttonType="primary"
                    scale="medium"
                    onClick={() => setAddOpen(true)}
                >
                    <Plus size={18} /> Add mentor
                </MyButton>
            </MentorshipPageHeader>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                    <MagnifyingGlass
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-neutral-400"
                    />
                    <MyInput
                        input={search}
                        onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setSearch(e.target.value)
                        }
                        inputType="text"
                        inputPlaceholder="Search mentors by name, title or expertise"
                        className="pl-9 sm:w-full"
                    />
                </div>
                {searching && (
                    <span className="text-caption text-neutral-500">
                        {visibleMentors.length} of {mentors.length} mentors match
                        {' · '}
                        <button
                            type="button"
                            className="font-medium text-primary-500 hover:text-primary-600"
                            onClick={() => setSearch('')}
                        >
                            Clear
                        </button>
                    </span>
                )}
            </div>

            {isLoading || mentorsPage.isLoading ? (
                <div className="flex flex-col gap-3">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4"
                        >
                            <div className="flex items-center gap-3">
                                <Skeleton className="size-10 rounded-full" />
                                <div className="flex flex-col gap-1.5">
                                    <Skeleton className="h-3.5 w-32" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                            </div>
                            <Skeleton className="h-8 w-24" />
                        </div>
                    ))}
                </div>
            ) : isError || mentorsPage.isError ? (
                <div className="flex flex-col items-start gap-3 rounded-lg border border-danger-100 bg-danger-50 p-4">
                    <div className="flex items-center gap-2">
                        <WarningCircle size={18} weight="fill" className="text-danger-600" />
                        <p className="text-body text-danger-600">Couldn&apos;t load mentors.</p>
                    </div>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        onClick={() => {
                            refetch();
                            mentorsPage.refetch();
                        }}
                    >
                        Retry
                    </MyButton>
                </div>
            ) : pagedMentors.length === 0 && mentors.length === 0 ? (
                <EmptyMentors onAdd={() => setAddOpen(true)} />
            ) : visibleMentors.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-200 p-10 text-center">
                    <MagnifyingGlass size={32} className="text-neutral-300" />
                    <p className="text-body font-medium text-neutral-700">
                        No mentors match &ldquo;{search.trim()}&rdquo;
                    </p>
                    <p className="text-caption text-neutral-500">
                        Try a name, title or an expertise topic.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                        <MyTable<MentorDTO>
                            data={{
                                content: visibleMentors,
                                total_pages: searching ? 1 : mentorsPage.data?.total_pages ?? 1,
                                page_no: searching ? 0 : page,
                                page_size: MENTORS_PAGE_SIZE,
                                total_elements: totalCount,
                                last: searching ? true : mentorsPage.data?.last ?? true,
                            }}
                            columns={columns}
                            isLoading={false}
                            error={null}
                            currentPage={searching ? 0 : page}
                            scrollable
                        />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-caption text-neutral-500">
                            Showing {rangeStart} to {rangeEnd} of {totalCount}{' '}
                            {totalCount === 1 ? 'result' : 'results'}
                        </span>
                        {!searching && (mentorsPage.data?.total_pages ?? 0) > 1 && (
                            <MyPagination
                                currentPage={page}
                                totalPages={mentorsPage.data?.total_pages ?? 1}
                                onPageChange={setPage}
                            />
                        )}
                    </div>
                </div>
            )}

            {instituteId && (
                <AddMentorDialog
                    instituteId={instituteId}
                    open={addOpen}
                    onOpenChange={setAddOpen}
                />
            )}
            {instituteId && (
                <EditMentorDialog
                    instituteId={instituteId}
                    mentor={editMentor}
                    open={!!editMentor}
                    onOpenChange={(o) => {
                        if (!o) setEditMentor(null);
                    }}
                />
            )}
            <MentorFeedbackDialog
                mentor={feedbackMentor}
                instituteId={instituteId}
                open={!!feedbackMentor}
                onOpenChange={(o) => {
                    if (!o) setFeedbackMentor(null);
                }}
            />
            {instituteId && (
                <BulkAssignDialog
                    instituteId={instituteId}
                    mentors={mentors}
                    open={bulkOpen}
                    onOpenChange={setBulkOpen}
                />
            )}
            {instituteId && (
                <AssignMenteesDialog
                    instituteId={instituteId}
                    mentor={assignMentor}
                    open={!!assignMentor}
                    onOpenChange={(o) => {
                        if (!o) setAssignMentor(null);
                    }}
                />
            )}

            <AlertDialog
                open={!!confirmRemove}
                onOpenChange={(o) => {
                    if (!o) setConfirmRemove(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Remove{' '}
                            {confirmRemove?.display_name || confirmRemove?.name || 'this mentor'}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmRemove?.assigned_student_count
                                ? `Their ${confirmRemove.assigned_student_count} assigned student${confirmRemove.assigned_student_count === 1 ? '' : 's'} will be unassigned. `
                                : ''}
                            Any learner requests waiting on them are released, so those learners can
                            ask someone else. Their account stays untouched.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-danger-500 hover:bg-danger-600"
                            onClick={() => {
                                if (confirmRemove) void remove(confirmRemove);
                                setConfirmRemove(null);
                            }}
                        >
                            Remove mentor
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function EmptyMentors({ onAdd }: { onAdd: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-200 p-10 text-center">
            <UsersThree size={40} className="text-neutral-300" />
            <div className="flex flex-col gap-1">
                <p className="text-body font-medium text-neutral-700">No mentors yet</p>
                <p className="text-caption text-neutral-500">
                    Add a team member as a mentor, then assign students to them.
                </p>
            </div>
            <MyButton type="button" buttonType="primary" scale="medium" onClick={onAdd}>
                <Plus size={18} /> Add your first mentor
            </MyButton>
        </div>
    );
}
