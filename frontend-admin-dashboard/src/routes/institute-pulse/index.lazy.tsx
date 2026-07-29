import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import InstitutePulseTab from './-components/InstitutePulseTab';

export const Route = createLazyFileRoute('/institute-pulse/')({
    component: InstitutePulsePage,
});

function InstitutePulsePage() {
    return (
        <LayoutContainer>
            <InstitutePulseComponent />
        </LayoutContainer>
    );
}

function InstitutePulseComponent() {
    const { setNavHeading } = useNavHeadingStore();
    const instituteId = getInstituteId() ?? '';

    useEffect(() => {
        setNavHeading(<h1 className="text-h3 font-medium">Institute Pulse</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>Institute Pulse</title>
                <meta
                    name="description"
                    content="Live institute-wide view of content, live classes and assessments."
                />
            </Helmet>

            <div className="mb-4">
                <p className="text-sm text-neutral-500">
                    What is happening across the institute right now — learners in content, classes
                    on air, and assessments in flight.
                </p>
            </div>

            <InstitutePulseTab instituteId={instituteId} />
        </>
    );
}
