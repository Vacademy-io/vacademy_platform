import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { AgentChat } from '@/components/agent-chat/AgentChat';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { getInstituteId } from '@/constants/helper';
import { TokenKey } from '@/constants/auth/tokens';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';

export const Route = createLazyFileRoute('/agent-chat')({
    component: () => (
        <LayoutContainer>
            <AgentChatRoute />
        </LayoutContainer>
    ),
});

function AgentChatRoute() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading('AI Agent Chat');
    }, [setNavHeading]);

    // Determine institute ID
    const instituteId = getCurrentInstituteId() || getInstituteId() || '';

    // Get auth token
    const authToken = getTokenFromCookie(TokenKey.accessToken) || '';

    return <AgentChat instituteId={instituteId} authToken={authToken} />;
}
