import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { BlogPostsList } from './-components/BlogPostsList';

export const Route = createLazyFileRoute('/manage-pages/blog/')({
    component: () => (
        <LayoutContainer>
            <BlogPostsList />
        </LayoutContainer>
    ),
});
