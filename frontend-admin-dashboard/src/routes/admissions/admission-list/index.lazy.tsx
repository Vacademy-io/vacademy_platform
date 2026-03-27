import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import AdmissionEntryScreen from '../admission-form/-components/AdmissionEntryScreen';

export const Route = createLazyFileRoute('/admissions/admission-list/')({
    component: AdmissionListPage,
});

function AdmissionListPage() {
    return (
        <LayoutContainer>
            <Helmet>
                <title>Admission List</title>
                <meta name="description" content="View and manage admission entries." />
            </Helmet>
            <div className="flex h-full w-full flex-col">
                <AdmissionEntryScreen />
            </div>
        </LayoutContainer>
    );
}
