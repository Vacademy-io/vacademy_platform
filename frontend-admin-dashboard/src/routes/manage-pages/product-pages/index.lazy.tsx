import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { ProductPagesList } from './-components/ProductPagesList';

export const Route = createLazyFileRoute('/manage-pages/product-pages/')({
    component: () => (
        <LayoutContainer>
            <ProductPagesList />
        </LayoutContainer>
    ),
});
