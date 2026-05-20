import { createFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { ProductPageEditor } from '../-components/ProductPageEditor';

export const Route = createFileRoute('/manage-pages/product-pages/editor/$productPageId')({
    component: () => (
        <LayoutContainer intrnalMargin={false}>
            <ProductPageEditor />
        </LayoutContainer>
    ),
});
