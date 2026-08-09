import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { ChatScreen } from "@/components/chat/ChatScreen";
import {
  openDirectConversation,
  type ChatConversationResponse,
} from "@/services/chat/chatApi";

// Module-level dedupe for ?dm= resolution: StrictMode double-mounts the route,
// and two racing resolutions can end with one failing (and previously wiping
// the URL). One shared promise per target user keeps it single-flight.
const dmResolutions = new Map<string, Promise<ChatConversationResponse>>();

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

  // ?dm=: resolve the direct conversation and add the resolved conversation
  // id next to it (replace, so Back doesn't re-trigger). dm stays in the URL
  // so the sidebar can map the open chat back to its mentor entry. On failure
  // the URL is left untouched (a refresh retries) — never cleared.
  useEffect(() => {
    if (!dm || conversationId) return;
    let cancelled = false;
    let pending = dmResolutions.get(dm);
    if (!pending) {
      pending = openDirectConversation({
        targetUserId: dm,
        targetUserRole: "TEACHER",
      }).finally(() => dmResolutions.delete(dm));
      dmResolutions.set(dm, pending);
    }
    pending
      .then((conv) => {
        if (!cancelled) {
          navigate({ search: { conversationId: conv.id, dm }, replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Couldn't open the chat. Please try again.");
        }
      });
    return () => {
      cancelled = true;
    };
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
