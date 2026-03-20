import { createLazyFileRoute } from '@tanstack/react-router';
import { DoubtManagement } from './-components/doubt-management';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';

export const Route = createLazyFileRoute('/study-library/doubt-management/')({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <LayoutContainer>
            <DoubtManagement />
        </LayoutContainer>
    );
}
