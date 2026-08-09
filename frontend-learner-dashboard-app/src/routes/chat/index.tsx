import { useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { ChatScreen } from "@/components/chat/ChatScreen";
import { openDirectConversation } from "@/services/chat/chatApi";

export const Route = createFileRoute("/chat/")({
  // Accept ?conversationId= so a chat push deep-link opens the conversation,
  // and ?dm=<userId> to open/create a direct conversation with that user
  // (used by the sidebar's per-mentor chat entries).
  validateSearch: (
    search: Record<string, unknown>,
  ): { conversationId?: string; dm?: string } => ({
    conversationId:
      typeof search.conversationId === "string"
        ? search.conversationId
        : undefined,
    dm: typeof search.dm === "string" && search.dm ? search.dm : undefined,
  }),
  component: ChatRoute,
});

function ChatRoute() {
  const { conversationId, dm } = Route.useSearch();
  const navigate = Route.useNavigate();
  const resolvingRef = useRef(false);

  // ?dm=: resolve the direct conversation, then swap the param for the
  // resolved conversation id (replace, so Back doesn't re-trigger it).
  useEffect(() => {
    if (!dm || resolvingRef.current) return;
    resolvingRef.current = true;
    openDirectConversation({ targetUserId: dm, targetUserRole: "TEACHER" })
      .then((conv) =>
        navigate({ search: { conversationId: conv.id }, replace: true }),
      )
      .catch(() => {
        toast.error("Couldn't open the chat. Please try again.");
        navigate({ search: {}, replace: true });
      })
      .finally(() => {
        resolvingRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dm]);

  return (
    // fullWidth: the chat screen is a full-bleed master-detail surface and
    // manages its own internal padding, so opt out of the centered content
    // contract. enableChatbotPanel is disabled to avoid two side panels.
    <LayoutContainer fullWidth enableChatbotPanel={false}>
      <ChatScreen initialConversationId={conversationId} />
    </LayoutContainer>
  );
}
