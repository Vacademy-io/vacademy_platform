import { useEffect, useState } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import {
    CalendarCheck,
    CalendarPlus,
    Copy,
    Plus,
    Trash,
    UsersThree,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { MyButton } from '@/components/design-system/button';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';
import { useDeleteMentor, useMentorDashboard, useProvisionBookingPage } from '../-hooks/use-mentorship';
import type { MentorDTO } from '../-types/mentorship-types';
import { AddMentorDialog } from '../-components/AddMentorDialog';
import { AssignMenteesDialog } from '../-components/AssignMenteesDialog';
import { BulkAssignDialog } from '../-components/BulkAssignDialog';

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

function initials(name?: string | null): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] ?? '').concat(parts.length > 1 ? (parts[1]?.[0] ?? '') : '').toUpperCase() || '?';
}

function MentorsPage() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Mentorship</h1>);
    }, [setNavHeading]);

    const instituteId = getInstituteId();
    const { data, isLoading, isError, refetch } = useMentorDashboard(instituteId);
    const deleteMentor = useDeleteMentor();
    const provisionBooking = useProvisionBookingPage();

    const [addOpen, setAddOpen] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [assignMentor, setAssignMentor] = useState<MentorDTO | null>(null);
    const [bookingId, setBookingId] = useState<string | null>(null);

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
                    <p className="text-body text-neutral-500">Promote users to mentors and assign students.</p>
                </div>
                <div className="flex gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => setBulkOpen(true)}
                        disable={mentors.length === 0}
                    >
                        <UsersThree size={18} /> Bulk assign
                    </MyButton>
                    <MyButton type="button" buttonType="primary" scale="medium" onClick={() => setAddOpen(true)}>
                        <Plus size={18} /> Add mentor
                    </MyButton>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Stat label="Mentors" value={data?.total_mentors ?? 0} />
                <Stat label="Active assignments" value={data?.total_active_assignments ?? 0} />
                <Stat label="Students mentored" value={data?.distinct_mentees ?? 0} />
            </div>

            {isLoading ? (
                <div className="text-body text-neutral-400">Loading mentors…</div>
            ) : isError ? (
                <div className="flex flex-col items-start gap-2">
                    <p className="text-body text-danger-600">Couldn&apos;t load mentors.</p>
                    <MyButton type="button" buttonType="secondary" scale="small" onClick={() => refetch()}>
                        Retry
                    </MyButton>
                </div>
            ) : mentors.length === 0 ? (
                <EmptyMentors onAdd={() => setAddOpen(true)} />
            ) : (
                <div className="flex flex-col gap-3">
                    {mentors.map((m) => (
                        <div
                            key={m.id}
                            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-body font-semibold text-primary-600">
                                    {initials(m.display_name || m.name)}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-body font-medium text-neutral-700">
                                        {m.display_name || m.name || 'Mentor'}
                                    </span>
                                    <span className="text-caption text-neutral-400">{m.title || m.email || ''}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-caption text-neutral-500">
                                    {m.assigned_student_count ?? 0} students
                                </span>
                                {m.booking_page_slug ? (
                                    <>
                                        <span className="flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-caption text-success-600">
                                            <CalendarCheck size={14} weight="bold" /> Booking on
                                        </span>
                                        <MyButton
                                            type="button"
                                            buttonType="secondary"
                                            scale="small"
                                            onClick={() => copyBookingLink(m)}
                                        >
                                            <Copy size={16} /> Copy link
                                        </MyButton>
                                        <a
                                            href={bookingUrl(m)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-caption font-medium text-primary-500 hover:text-primary-600"
                                        >
                                            Open
                                        </a>
                                    </>
                                ) : (
                                    <MyButton
                                        type="button"
                                        buttonType="secondary"
                                        scale="small"
                                        onClick={() => enableBooking(m)}
                                        disable={bookingId === m.id}
                                    >
                                        <CalendarCheck size={16} /> Enable booking
                                    </MyButton>
                                )}
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() => setAssignMentor(m)}
                                >
                                    <CalendarPlus size={16} /> Assign
                                </MyButton>
                                <MyButton type="button" buttonType="text" scale="small" onClick={() => remove(m)}>
                                    <Trash size={16} className="text-danger-500" />
                                </MyButton>
                            </div>
                        </div>
                    ))}
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
        </div>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-4">
            <span className="text-caption text-neutral-400">{label}</span>
            <span className="text-h2 font-semibold text-neutral-700">{value}</span>
        </div>
    );
}

function EmptyMentors({ onAdd }: { onAdd: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-200 p-10 text-center">
            <UsersThree size={40} className="text-neutral-300" />
            <p className="text-body text-neutral-500">No mentors yet. Promote a user to get started.</p>
            <MyButton type="button" buttonType="primary" scale="medium" onClick={onAdd}>
                <Plus size={18} /> Add mentor
            </MyButton>
        </div>
    );
}
