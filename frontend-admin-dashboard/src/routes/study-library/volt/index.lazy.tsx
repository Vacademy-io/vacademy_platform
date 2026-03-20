import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import ManageVolt from '@/components/common/slides/manage-volt';
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from '@/config/branding';

export const Route = createLazyFileRoute('/study-library/volt/')({
    component: ManageVoltPage,
});

function ManageVoltPage() {
    return (
        <LayoutContainer>
            <Helmet>
                <title>{PRODUCT_NAME}</title>
                <meta name="description" content={PRODUCT_DESCRIPTION} />
            </Helmet>
            <ManageVolt />
        </LayoutContainer>
    );
}

export default ManageVoltPage;
