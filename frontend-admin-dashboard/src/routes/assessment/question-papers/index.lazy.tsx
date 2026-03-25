import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { QuestionPapersComponent } from './-components/QuestionPapersComponent';

export const Route = createLazyFileRoute('/assessment/question-papers/')({
    component: () => (
        <LayoutContainer>
            <QuestionPapersComponent />
        </LayoutContainer>
    ),
});
