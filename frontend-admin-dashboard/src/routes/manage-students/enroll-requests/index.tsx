import { createFileRoute } from '@tanstack/react-router';
import { EnrollRequests } from './-components/enroll-requests';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';

export const Route = createFileRoute('/manage-students/enroll-requests/')({
    component: RouteComponent,
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading('Enroll Requests');
    }, []);

    return (
        <LayoutContainer>
            <EnrollRequests />
        </LayoutContainer>
    );
}
