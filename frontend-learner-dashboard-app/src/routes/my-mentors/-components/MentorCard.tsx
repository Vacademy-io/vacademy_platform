import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CalendarPlus, ChatCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { MyButton } from "@/components/design-system/button";
import { ModernCard, ModernCardContent } from "@/components/design-system/modern-card";
import { openDirectConversation } from "@/services/chat/chatApi";
import type { MyMentor } from "../-services/my-mentors-service";

function initials(name?: string | null): string {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return (
        (parts[0]?.[0] ?? "").concat(parts.length > 1 ? (parts[1]?.[0] ?? "") : "").toUpperCase() || "?"
    );
}

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
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-title font-semibold text-primary-600">
                            {initials(mentor.display_name || mentor.name)}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-body font-semibold text-neutral-700">
                                {mentor.display_name || mentor.name || "Mentor"}
                            </span>
                            {mentor.title && (
                                <span className="text-caption text-neutral-500">{mentor.title}</span>
                            )}
                        </div>
                    </div>

                    {mentor.bio && <p className="text-caption text-neutral-500">{mentor.bio}</p>}

                    <div className="flex flex-wrap gap-2">
                        <MyButton
                            type="button"
                            buttonType="primary"
                            scale="medium"
                            onClick={book}
                            disable={!canBook}
                        >
                            <CalendarPlus size={16} /> Book
                        </MyButton>
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="medium"
                            onClick={message}
                            disable={messaging}
                        >
                            <ChatCircle size={16} /> Message
                        </MyButton>
                    </div>

                    {!canBook && (
                        <span className="text-caption text-neutral-400">Booking not set up yet</span>
                    )}
                </div>
            </ModernCardContent>
        </ModernCard>
    );
}
