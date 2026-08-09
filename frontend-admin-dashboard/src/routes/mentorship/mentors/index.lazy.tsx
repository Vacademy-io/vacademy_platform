import { useEffect, useState } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import {
    ArrowSquareOut,
    CalendarCheck,
    CalendarPlus,
    Copy,
    DotsThreeVertical,
    GraduationCap,
    Handshake,
    Plus,
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
    useMentorsPaged,
    useProvisionBookingPage,
} from '../-hooks/use-mentorship';
import { MyPagination } from '@/components/design-system/pagination';

const MENTORS_PAGE_SIZE = 20;
import type { MentorDTO } from '../-types/mentorship-types';
import { AddMentorDialog } from '../-components/AddMentorDialog';
import { AssignMenteesDialog } from '../-components/AssignMenteesDialog';
import { BulkAssignDialog } from '../-components/BulkAssignDialog';
import { MentorAvatar } from '../-components/MentorAvatar';

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

    const [addOpen, setAddOpen] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [assignMentor, setAssignMentor] = useState<MentorDTO | null>(null);
    const [bookingId, setBookingId] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState<MentorDTO | null>(null);

    const mentors = data?.mentors ?? [];

    const remove = async (m: MentorDTO) => {
        if (!instituteId) return;
        try {
            await deleteMentor.mutateAsync({ id: m.id, instituteId });
            toast.success('Mentor removed');
        } catch {
            toast.error('Failed to remove mentor');
        }
    };

    const enableBooking = async (m: MentorDTO) => {
        if (!instituteId) return;
        setBookingId(m.id);
        try {
            await provisionBooking.mutateAsync({ id: m.id, instituteId });
            toast.success('Booking page set up');
        } catch {
            toast.error('Failed to set up booking page');
        } finally {
            setBookingId(null);
        }
    };

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

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col">
                    <h2 className="text-title font-semibold text-neutral-700">Mentors</h2>
                    <p className="text-body text-neutral-500">
                        Add mentors and assign students to them.
                    </p>
                </div>
                <div className="flex gap-2">
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
                    <MyButton type="button" buttonType="primary" scale="medium" onClick={() => setAddOpen(true)}>
                        <Plus size={18} /> Add mentor
                    </MyButton>
                </div>
            </div>

            {/* The flow in one glance — clears up "what do I do here?" for new admins. */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3">
                <HowStep n={1} text="Add a mentor from your team" />
                <HowStep n={2} text="Assign students to them" />
                <HowStep n={3} text="Learners book 1:1s & message them from their app" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Stat
                    icon={<UsersThree size={20} weight="duotone" />}
                    label="Mentors"
                    value={data?.total_mentors ?? 0}
                    hint="Team members mentoring students"
                />
                <Stat
                    icon={<Handshake size={20} weight="duotone" />}
                    label="Active assignments"
                    value={data?.total_active_assignments ?? 0}
                    hint="Mentor–student pairs right now"
                />
                <Stat
                    icon={<GraduationCap size={20} weight="duotone" />}
                    label="Students mentored"
                    value={data?.distinct_mentees ?? 0}
                    hint="Students with at least one mentor"
                />
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
            ) : (mentorsPage.data?.total_elements ?? 0) === 0 ? (
                <EmptyMentors onAdd={() => setAddOpen(true)} />
            ) : (
                <div className="flex flex-col gap-3">
                    {pagedMentors.map((m) => (
                        <div
                            key={m.id}
                            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4"
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <MentorAvatar
                                    fileId={m.profile_image_file_id}
                                    name={m.display_name || m.name}
                                    className="size-10 text-body"
                                />
                                <div className="flex min-w-0 flex-col">
                                    <span className="truncate text-body font-medium text-neutral-700">
                                        {m.display_name || m.name || 'Mentor'}
                                    </span>
                                    <span className="truncate text-caption text-neutral-400">{m.title || m.email || ''}</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span
                                    className="rounded-full bg-neutral-100 px-2.5 py-1 text-caption text-neutral-500"
                                    title="Students currently assigned to this mentor"
                                >
                                    {m.assigned_student_count ?? 0} students
                                </span>
                                {m.booking_page_slug ? (
                                    <span
                                        className="flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-caption text-success-600"
                                        title="Learners can book 1:1 sessions with this mentor"
                                    >
                                        <CalendarCheck size={14} weight="bold" /> Booking enabled
                                    </span>
                                ) : (
                                    <span
                                        className="rounded-full bg-neutral-100 px-2.5 py-1 text-caption text-neutral-400"
                                        title="No 1:1 booking page yet — enable it from the ⋯ menu"
                                    >
                                        Booking off
                                    </span>
                                )}
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() => setAssignMentor(m)}
                                    title="Assign students to this mentor"
                                >
                                    <CalendarPlus size={16} /> Assign students
                                </MyButton>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <MyButton
                                            type="button"
                                            buttonType="secondary"
                                            scale="small"
                                            layoutVariant="icon"
                                            aria-label={`More actions for ${m.display_name || m.name || 'mentor'}`}
                                        >
                                            <DotsThreeVertical size={18} weight="bold" />
                                        </MyButton>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56">
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
                        </div>
                    ))}
                    {(mentorsPage.data?.total_pages ?? 0) > 1 && (
                        <MyPagination
                            currentPage={page}
                            totalPages={mentorsPage.data?.total_pages ?? 1}
                            onPageChange={setPage}
                        />
                    )}
                </div>
            )}

            {instituteId && (
                <AddMentorDialog instituteId={instituteId} open={addOpen} onOpenChange={setAddOpen} />
            )}
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
                            Remove {confirmRemove?.display_name || confirmRemove?.name || 'this mentor'}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmRemove?.assigned_student_count
                                ? `Their ${confirmRemove.assigned_student_count} assigned student${confirmRemove.assigned_student_count === 1 ? '' : 's'} will be unassigned. `
                                : ''}
                            Their account stays untouched.
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

function HowStep({ n, text }: { n: number; text: string }) {
    return (
        <span className="flex items-center gap-2 text-caption text-neutral-500">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-caption font-semibold text-primary-600">
                {n}
            </span>
            {text}
        </span>
    );
}

function Stat({
    icon,
    label,
    value,
    hint,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    hint: string;
}) {
    return (
        <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
                {icon}
            </span>
            <div className="flex min-w-0 flex-col">
                <span className="text-h2 font-semibold leading-tight text-neutral-700">{value}</span>
                <span className="text-caption font-medium text-neutral-600">{label}</span>
                <span className="truncate text-caption text-neutral-400" title={hint}>
                    {hint}
                </span>
            </div>
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
