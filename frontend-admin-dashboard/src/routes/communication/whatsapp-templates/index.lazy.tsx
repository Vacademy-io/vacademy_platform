import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { TemplateListPage } from './-components/template-list-page';

export const Route = createLazyFileRoute('/communication/whatsapp-templates/')({
    component: () => (
        <LayoutContainer>
            <TemplateListPage />
        </LayoutContainer>
    ),
});
