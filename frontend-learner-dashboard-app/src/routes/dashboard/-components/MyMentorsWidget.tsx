import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, ChatCircle, UserPlus, UsersThree, VideoCamera } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MyButton } from "@/components/design-system/button";
import { getInstituteId } from "@/constants/helper";
import { getCurrentUserId } from "@/lib/auth/sessionUtility";
import { openDirectConversation } from "@/services/chat/chatApi";
import {
    handleGetMentorDirectory,
    handleGetMyBookings,
    handleGetMyMentors,
    type MyBooking,
    type MyMentor,
} from "@/routes/my-mentors/-services/my-mentors-service";
import { MentorAvatar } from "@/routes/my-mentors/-components/MentorAvatar";

function fmtWhen(v?: string | number | null): string {
    if (v == null) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
    });
}

/**
 * Learner dashboard widget: the student's assigned mentors + their next upcoming
 * mentor session, with quick Book / Message. A student with no mentor yet gets a
 * prompt into the directory instead — but only when their institute actually lists
 * mentors, so the widget still self-hides where mentorship isn't in use.
 */
export function MyMentorsWidget() {
    const navigate = useNavigate();
    const [instituteId, setInstituteId] = useState<string | undefined>();
    const [userId, setUserId] = useState<string | undefined>();
    const [messagingId, setMessagingId] = useState<string | null>(null);

    useEffect(() => {
        getInstituteId().then((id) => setInstituteId(id ?? undefined));
        getCurrentUserId().then((id) => setUserId(id ?? undefined));
    }, []);

    const mentorsQuery = useQuery(handleGetMyMentors(instituteId));
    const bookingsQuery = useQuery(handleGetMyBookings(instituteId, userId));
    // Only asked for when there's nothing to show yet — a student who already has
    // a mentor never needs the directory to decide what this widget renders.
    const directoryQuery = useQuery({
        ...handleGetMentorDirectory(instituteId),
        enabled: !!instituteId && mentorsQuery.isSuccess && (mentorsQuery.data?.length ?? 0) === 0,
    });

    const mentors = (mentorsQuery.data ?? []) as MyMentor[];

    const nextSession = useMemo<MyBooking | undefined>(() => {
        const now = Date.now();
        return ((bookingsQuery.data ?? []) as MyBooking[])
            .filter(
                (b) =>
                    b.status !== "CANCELLED" &&
                    b.status !== "RESCHEDULED" &&
                    b.scheduled_start_utc != null &&
                    new Date(b.scheduled_start_utc).getTime() >= now
            )
            .sort(
                (a, b) =>
                    new Date(a.scheduled_start_utc as string).getTime() -
                    new Date(b.scheduled_start_utc as string).getTime()
            )[0];
    }, [bookingsQuery.data]);

    if (mentorsQuery.isLoading) {
        return (
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">My Mentors</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    {Array.from({ length: 2 }, (_, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <Skeleton className="h-9 w-9 rounded-full" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    if (mentors.length === 0) {
        if ((directoryQuery.data?.length ?? 0) === 0) return null;
        return (
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <UsersThree size={18} weight="duotone" className="text-primary-500" />
                        Mentorship
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-start gap-3">
                    <p className="text-caption text-neutral-500">
                        Get one-to-one guidance — browse your institute&apos;s mentors and request
                        the one that fits what you&apos;re working on.
                    </p>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="small"
                        onClick={() => navigate({ to: "/my-mentors" })}
                    >
                        <UserPlus size={16} /> Find a mentor
                    </MyButton>
                </CardContent>
            </Card>
        );
    }

    const book = (m: MyMentor) => {
        if (!m.booking_page_slug || !instituteId) return;
        navigate({
            to: "/booking-response",
            search: { instituteId, slug: m.booking_page_slug, authed: "1" },
        });
    };

    const message = async (m: MyMentor) => {
        setMessagingId(m.user_id);
        try {
            const conv = await openDirectConversation({
                targetUserId: m.user_id,
                targetUserName: m.name ?? undefined,
                targetUserRole: "TEACHER",
            });
            navigate({ to: "/chat", search: { conversationId: conv.id } });
        } catch {
            toast.error("Couldn't open the chat. Please try again.");
        } finally {
            setMessagingId(null);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <UsersThree size={18} weight="duotone" className="text-primary-500" />
                    My Mentors
                </CardTitle>
                <button
                    type="button"
                    onClick={() => navigate({ to: "/my-mentors" })}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                    View all
                </button>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {nextSession && (
                    <div className="flex flex-col gap-1 rounded-lg border border-primary-200 bg-primary-50 p-3">
                        <span className="text-xs font-medium uppercase tracking-wide text-primary-600">
                            Next session
                        </span>
                        <span className="text-sm font-medium text-neutral-700">
                            {nextSession.booking_page_title || nextSession.host_name || "Mentor session"}
                        </span>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-neutral-500">
                                {fmtWhen(nextSession.scheduled_start_utc)}
                            </span>
                            {nextSession.meet_link ? (
                                <a
                                    href={nextSession.meet_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-xs font-medium text-primary-600"
                                >
                                    <VideoCamera size={14} /> Join
                                </a>
                            ) : (
                                // The link is minted after the booking commits, so a fresh
                                // booking can have none yet. Saying so beats a row that
                                // silently offers no way in.
                                <span
                                    className="text-xs text-neutral-400"
                                    title="Your mentor's meeting link is still being created. Check back shortly."
                                >
                                    Link coming soon
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {mentors.slice(0, 3).map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <MentorAvatar
                                fileId={m.profile_image_file_id || m.profile_pic_file_id}
                                name={m.display_name || m.name}
                                className="size-9 text-xs"
                            />
                            <div className="flex min-w-0 flex-col">
                                <span className="truncate text-sm font-medium text-neutral-700">
                                    {m.display_name || m.name || "Mentor"}
                                </span>
                                {m.title && (
                                    <span className="truncate text-xs text-neutral-400">{m.title}</span>
                                )}
                            </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                            <MyButton
                                type="button"
                                buttonType="primary"
                                scale="medium"
                                layoutVariant="icon"
                                onClick={() => book(m)}
                                disable={!m.booking_page_slug}
                            >
                                <CalendarPlus size={16} />
                            </MyButton>
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="medium"
                                layoutVariant="icon"
                                onClick={() => message(m)}
                                disable={messagingId === m.user_id}
                            >
                                <ChatCircle size={16} />
                            </MyButton>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
