import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CalendarPlus, ChatCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { MyButton } from "@/components/design-system/button";
import { ModernCard, ModernCardContent } from "@/components/design-system/modern-card";
import { openDirectConversation } from "@/services/chat/chatApi";
import type { MyMentor } from "../-services/my-mentors-service";
import { MentorAvatar } from "./MentorAvatar";

export function MentorCard({
    mentor,
    instituteId,
}: {
    mentor: MyMentor;
    instituteId: string | undefined;
}) {
    const navigate = useNavigate();
    const [messaging, setMessaging] = useState(false);
    const canBook = !!mentor.booking_page_slug && !!instituteId;

    const book = () => {
        if (!mentor.booking_page_slug || !instituteId) return;
        navigate({
            to: "/booking-response",
            search: { instituteId, slug: mentor.booking_page_slug, authed: "1" },
        });
    };

    const message = async () => {
        setMessaging(true);
        try {
            const conv = await openDirectConversation({
                targetUserId: mentor.user_id,
                targetUserName: mentor.name ?? undefined,
                targetUserRole: "TEACHER",
            });
            navigate({ to: "/chat", search: { conversationId: conv.id } });
        } catch {
            toast.error("Couldn't open the chat. Please try again.");
        } finally {
            setMessaging(false);
        }
    };

    return (
        <ModernCard variant="default" padding="md" rounded="lg">
            <ModernCardContent>
                <div className="flex h-full flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <MentorAvatar
                            fileId={mentor.profile_image_file_id || mentor.profile_pic_file_id}
                            name={mentor.display_name || mentor.name}
                            className="size-12 text-title"
                        />
                        <div className="flex min-w-0 flex-col">
                            <span className="truncate text-body font-semibold text-neutral-700">
                                {mentor.display_name || mentor.name || "Mentor"}
                            </span>
                            {mentor.title && (
                                <span className="truncate text-caption text-neutral-500">
                                    {mentor.title}
                                </span>
                            )}
                        </div>
                    </div>

                    {mentor.bio && (
                        <p className="line-clamp-3 text-caption text-neutral-500">{mentor.bio}</p>
                    )}

                    <div className="mt-auto flex flex-col gap-2">
                        <div className="flex gap-2">
                            <MyButton
                                type="button"
                                buttonType="primary"
                                scale="medium"
                                onClick={book}
                                disable={!canBook}
                                className="flex-1"
                            >
                                <CalendarPlus size={16} /> Book session
                            </MyButton>
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="medium"
                                onClick={message}
                                disable={messaging}
                                className="flex-1"
                            >
                                <ChatCircle size={16} /> Message
                            </MyButton>
                        </div>
                        {!canBook && (
                            <span className="text-caption text-neutral-400">
                                Booking not set up yet
                            </span>
                        )}
                    </div>
                </div>
            </ModernCardContent>
        </ModernCard>
    );
}
