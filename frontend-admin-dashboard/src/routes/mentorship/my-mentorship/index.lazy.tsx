import { useEffect, useState } from 'react';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import {
    CalendarCheck,
    ChatCircle,
    CheckCircle,
    Clock,
    Copy,
    GoogleLogo,
    LinkSimple,
    NotePencil,
    UsersThree,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { MyButton } from '@/components/design-system/button';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';
import { createDirectConversation } from '@/services/chat/chatApi';
import { useMyMentees, useMyMentorProfile } from '../-hooks/use-mentorship';
import { initiateMyGoogle } from '../-services/mentorship-service';
import type { MenteeDTO } from '../-types/mentorship-types';
import { MenteeDetailDialog } from '../-components/MenteeDetailDialog';
import { AvailabilityDialog } from '../-components/AvailabilityDialog';

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

function initials(name?: string | null): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] ?? '').concat(parts.length > 1 ? (parts[1]?.[0] ?? '') : '').toUpperCase() || '?';
}

function MyMentorshipPage() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">My Mentorship</h1>);
    }, [setNavHeading]);

    const navigate = useNavigate();
    const instituteId = getInstituteId();
    const { data, isLoading, isError, refetch } = useMyMentees(instituteId);
    const profileQuery = useMyMentorProfile(instituteId);
    const [messagingId, setMessagingId] = useState<string | null>(null);
    const [detailMentee, setDetailMentee] = useState<MenteeDTO | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [availabilityOpen, setAvailabilityOpen] = useState(false);

    const mentees = data ?? [];
    const profile = profileQuery.data;

    const connectGoogle = async () => {
        if (!instituteId) return;
        setConnecting(true);
        try {
            const { oauth_url } = await initiateMyGoogle(instituteId);
            window.location.href = oauth_url;
        } catch {
            toast.error("Couldn't start Google connect. Please try again.");
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
        } catch {
            toast.error("Couldn't open the chat. Please try again.");
        } finally {
            setMessagingId(null);
        }
    };

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col">
                <h2 className="text-title font-semibold text-neutral-700">My mentees</h2>
                <p className="text-body text-neutral-500">Students assigned to you for mentorship.</p>
            </div>

            {profile && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50">
                            <GoogleLogo size={20} weight="bold" className="text-primary-600" />
                        </span>
                        <div className="flex flex-col">
                            <span className="text-body font-medium text-neutral-700">Google Calendar</span>
                            <span className="text-caption text-neutral-500">
                                {profile.google_connected
                                    ? `Connected${profile.google_email ? ` · ${profile.google_email}` : ''} — your bookings appear on your own calendar with a Meet link.`
                                    : 'Connect your Google so your 1:1 bookings land on your own calendar with a Meet link.'}
                            </span>
                        </div>
                    </div>
                    {profile.google_connected ? (
                        <span className="flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-caption text-success-600">
                            <CheckCircle size={14} weight="fill" /> Connected
                        </span>
                    ) : (
                        <MyButton
                            type="button"
                            buttonType="primary"
                            scale="small"
                            onClick={connectGoogle}
                            disable={connecting}
                        >
                            {connecting ? 'Redirecting…' : 'Connect Google'}
                        </MyButton>
                    )}
                </div>
            )}

            {profile && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50">
                            <CalendarCheck size={20} weight="bold" className="text-primary-600" />
                        </span>
                        <div className="flex flex-col">
                            <span className="text-body font-medium text-neutral-700">
                                Your 1:1 booking link
                            </span>
                            <span className="text-caption text-neutral-500">
                                {myBookingUrl
                                    ? 'Share this link so learners can book a session with you.'
                                    : 'Booking isn’t set up yet. Ask your admin to enable your booking page.'}
                            </span>
                            {myBookingUrl && (
                                <span className="mt-1 flex items-center gap-1 text-caption text-neutral-400">
                                    <LinkSimple size={12} />
                                    <span className="max-w-sm truncate">{myBookingUrl}</span>
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="small"
                            onClick={() => setAvailabilityOpen(true)}
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
                                >
                                    <Copy size={16} /> Copy link
                                </MyButton>
                                <a
                                    href={myBookingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-caption font-medium text-primary-500 hover:text-primary-600"
                                >
                                    Open
                                </a>
                            </>
                        )}
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="text-body text-neutral-400">Loading mentees…</div>
            ) : isError ? (
                <div className="flex flex-col items-start gap-2">
                    <p className="text-body text-danger-600">Couldn&apos;t load your mentees.</p>
                    <MyButton type="button" buttonType="secondary" scale="small" onClick={() => refetch()}>
                        Retry
                    </MyButton>
                </div>
            ) : mentees.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-200 p-10 text-center">
                    <UsersThree size={40} className="text-neutral-300" />
                    <p className="text-body text-neutral-500">No students are assigned to you yet.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {mentees.map((mentee) => (
                        <div
                            key={mentee.assignment_id}
                            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-body font-semibold text-primary-600">
                                    {initials(mentee.name)}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-body font-medium text-neutral-700">
                                        {mentee.name || mentee.student_user_id}
                                    </span>
                                    {mentee.email && (
                                        <span className="text-caption text-neutral-400">{mentee.email}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() => setDetailMentee(mentee)}
                                >
                                    <NotePencil size={16} /> Details
                                </MyButton>
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() => message(mentee)}
                                    disable={messagingId === mentee.student_user_id}
                                >
                                    <ChatCircle size={16} /> Message
                                </MyButton>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <MenteeDetailDialog
                mentee={detailMentee}
                instituteId={instituteId}
                open={!!detailMentee}
                onOpenChange={(o) => {
                    if (!o) setDetailMentee(null);
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
