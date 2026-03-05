import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { CatalogueList } from './-components/CatalogueList';

export const Route = createLazyFileRoute('/manage-pages/')({
    component: () => (
        <LayoutContainer intrnalMargin={false}>
            <CatalogueList />
        </LayoutContainer>
    ),
});
