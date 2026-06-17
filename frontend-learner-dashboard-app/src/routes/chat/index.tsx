import { createFileRoute } from "@tanstack/react-router";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { ChatScreen } from "@/components/chat/ChatScreen";

export const Route = createFileRoute("/chat/")({
  // Accept ?conversationId= so a chat push deep-link opens the conversation.
  validateSearch: (
    search: Record<string, unknown>,
  ): { conversationId?: string } => ({
    conversationId:
      typeof search.conversationId === "string"
        ? search.conversationId
        : undefined,
  }),
  component: ChatRoute,
});

function ChatRoute() {
  const { conversationId } = Route.useSearch();
  return (
    // fullWidth: the chat screen is a full-bleed master-detail surface and
    // manages its own internal padding, so opt out of the centered content
    // contract. enableChatbotPanel is disabled to avoid two side panels.
    <LayoutContainer fullWidth enableChatbotPanel={false}>
      <ChatScreen initialConversationId={conversationId} />
    </LayoutContainer>
  );
}
