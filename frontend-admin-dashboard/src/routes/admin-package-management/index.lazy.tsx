import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { PackageManagementSection } from './-components/package-management-section';
import { Helmet } from 'react-helmet';

export const Route = createLazyFileRoute('/admin-package-management/')({
    component: PackageManagement,
});

export function PackageManagement() {
    return (
        <LayoutContainer>
            <Helmet>
                <title>Package Management</title>
                <meta name="description" content="Manage all packages and their sessions" />
            </Helmet>
            <PackageManagementSection />
        </LayoutContainer>
    );
}
