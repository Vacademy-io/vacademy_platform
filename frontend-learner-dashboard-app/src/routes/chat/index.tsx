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

  // ?dm=: resolve the direct conversation and add the resolved conversation
  // id next to it (replace, so Back doesn't re-trigger). dm stays in the URL
  // so the sidebar can map the open chat back to its mentor entry.
  useEffect(() => {
    if (!dm || conversationId || resolvingRef.current) return;
    resolvingRef.current = true;
    openDirectConversation({ targetUserId: dm, targetUserRole: "TEACHER" })
      .then((conv) =>
        navigate({ search: { conversationId: conv.id, dm }, replace: true }),
      )
      .catch(() => {
        toast.error("Couldn't open the chat. Please try again.");
        navigate({ search: {}, replace: true });
      })
      .finally(() => {
        resolvingRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dm, conversationId]);

  return (
    // fullWidth: the chat screen is a full-bleed master-detail surface and
    // manages its own internal padding, so opt out of the centered content
    // contract. enableChatbotPanel is disabled to avoid two side panels.
    <LayoutContainer fullWidth enableChatbotPanel={false}>
      {/* Keyed by conversation so switching mentors via the sidebar remounts
          the screen and honors the new deep link (its guard is once-only). */}
      <ChatScreen
        key={conversationId ?? "chat"}
        initialConversationId={conversationId}
      />
    </LayoutContainer>
  );
}
