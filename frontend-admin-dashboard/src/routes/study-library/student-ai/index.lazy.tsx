import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { StudentAiPage } from './-components/StudentAiPage';

export const Route = createLazyFileRoute('/study-library/student-ai/')({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <LayoutContainer>
            <StudentAiPage />
        </LayoutContainer>
    );
}
