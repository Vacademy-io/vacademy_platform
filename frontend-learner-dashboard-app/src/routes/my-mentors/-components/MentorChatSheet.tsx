import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CircleNotch } from "@phosphor-icons/react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { ChatScreen } from "@/components/chat/ChatScreen";
import { openDirectConversation } from "@/services/chat/chatApi";
import type { MyMentor } from "../-services/my-mentors-service";
import { MentorAvatar } from "./MentorAvatar";

/**
 * In-place mentor chat: opens the direct conversation with the mentor in a
 * right-side drawer so the learner chats without leaving My Mentors (the
 * In-App Messages tab may not even be visible in their sidebar).
 */
export function MentorChatSheet({
    mentor,
    open,
    onOpenChange,
}: {
    mentor: MyMentor | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [conversationId, setConversationId] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !mentor) return;
        let cancelled = false;
        setConversationId(null);
        openDirectConversation({
            targetUserId: mentor.user_id,
            targetUserName: mentor.display_name || mentor.name || undefined,
            targetUserRole: "TEACHER",
        })
            .then((conv) => {
                if (!cancelled) setConversationId(conv.id);
            })
            .catch(() => {
                if (!cancelled) {
                    toast.error("Couldn't open the chat. Please try again.");
                    onOpenChange(false);
                }
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mentor?.user_id]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
                {/* h-14 (3.5rem) matches ChatScreen's own height calc, so the
                    thread fills the rest of the drawer exactly. */}
                <SheetHeader className="h-14 shrink-0 flex-row items-center gap-3 space-y-0 border-b border-border px-4 text-start">
                    <MentorAvatar
                        fileId={mentor?.profile_image_file_id || mentor?.profile_pic_file_id}
                        name={mentor?.display_name || mentor?.name}
                        className="size-8 text-caption"
                    />
                    <div className="flex min-w-0 flex-col">
                        <SheetTitle className="truncate text-body font-semibold text-neutral-700">
                            {mentor?.display_name || mentor?.name || "Mentor"}
                        </SheetTitle>
                        <SheetDescription className="truncate text-caption text-neutral-500">
                            {mentor?.title || "Your mentor"}
                        </SheetDescription>
                    </div>
                </SheetHeader>
                {conversationId ? (
                    <ChatScreen initialConversationId={conversationId} />
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-neutral-400">
                        <CircleNotch size={24} className="animate-spin" />
                        <span className="text-caption">Opening chat…</span>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
