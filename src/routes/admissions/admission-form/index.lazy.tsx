import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import AdmissionFormWizard from './-components/AdmissionFormWizard';

export const Route = createLazyFileRoute('/admissions/admission-form/')({
    component: AdmissionFormPage,
});

export function AdmissionFormPage() {
    return (
        <LayoutContainer>
            <Helmet>
                <title>Admission Form</title>
                <meta name="description" content="Multi-step admission form for new students." />
            </Helmet>
            <div className="flex h-full w-full flex-col">
                <AdmissionFormWizard />
            </div>
        </LayoutContainer>
    );
}
