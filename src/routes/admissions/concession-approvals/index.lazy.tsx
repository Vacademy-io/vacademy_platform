import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { PendingConcessionsPanel } from '../-components/PendingConcessionsPanel';

export const Route = createLazyFileRoute('/admissions/concession-approvals/')({
    component: ConcessionApprovalsPage,
});

function ConcessionApprovalsPage() {
    return (
        <LayoutContainer>
            <Helmet>
                <title>Concession Approvals</title>
                <meta
                    name="description"
                    content="Review and approve fee concession requests."
                />
            </Helmet>
            <div className="flex h-full w-full flex-col p-6">
                <PendingConcessionsPanel />
            </div>
        </LayoutContainer>
    );
}
