import { createFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { BlogPostEditor } from '../-components/BlogPostEditor';

/** `/manage-pages/blog/editor/new` creates; any other id edits that post. */
export const Route = createFileRoute('/manage-pages/blog/editor/$postId')({
    component: () => (
        <LayoutContainer intrnalMargin={false}>
            <BlogPostEditor />
        </LayoutContainer>
    ),
});
