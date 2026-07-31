import { useEffect, useState } from 'react';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { ChatCircle, CheckCircle, GoogleLogo, NotePencil, UsersThree } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { MyButton } from '@/components/design-system/button';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { createDirectConversation } from '@/services/chat/chatApi';
import { useMyMentees, useMyMentorProfile } from '../-hooks/use-mentorship';
import { initiateMyGoogle } from '../-services/mentorship-service';
import type { MenteeDTO } from '../-types/mentorship-types';
import { MenteeDetailDialog } from '../-components/MenteeDetailDialog';

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
        </div>
    );
}
