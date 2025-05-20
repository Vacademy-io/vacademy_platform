import { createFileRoute } from '@tanstack/react-router';
import { AICenterProvider } from '../-contexts/useAICenterContext';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';

export const Route = createFileRoute('/ai-center/ai-tools/')({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <LayoutContainer>
            <AICenterProvider>
                <p>welcome to ai center</p>
            </AICenterProvider>
        </LayoutContainer>
    );
}
