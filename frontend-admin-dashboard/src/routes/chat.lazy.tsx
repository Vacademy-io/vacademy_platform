import { createLazyFileRoute, getRouteApi } from '@tanstack/react-router';
import { useEffect } from 'react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { ChatScreen } from '@/components/chat/ChatScreen';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';

const routeApi = getRouteApi('/chat');

export const Route = createLazyFileRoute('/chat')({
    component: () => (
        <LayoutContainer>
            <ChatRoute />
        </LayoutContainer>
    ),
});

function ChatRoute() {
    const { setNavHeading } = useNavHeadingStore();
    const { conversationId } = routeApi.useSearch();

    useEffect(() => {
        setNavHeading('In-App Messages');
    }, [setNavHeading]);

    return <ChatScreen initialConversationId={conversationId} />;
}
