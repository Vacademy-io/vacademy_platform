import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { TranslationReviewPage } from './-components/translation-review-page';

export const Route = createLazyFileRoute('/study-library/courses/course-details/translation/')({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <LayoutContainer>
            <TranslationReviewPage />
        </LayoutContainer>
    );
}
