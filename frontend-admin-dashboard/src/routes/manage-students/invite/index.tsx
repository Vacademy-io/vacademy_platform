import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Invite } from './-components/invite';
import { InviteFormProvider } from './-context/useInviteFormContext';

export const Route = createFileRoute('/manage-students/invite/')({
    component: RouteComponent,
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading('Invite Link');
    }, []);

    return (
        <InviteFormProvider>
            <LayoutContainer>
                <Invite />
            </LayoutContainer>
        </InviteFormProvider>
    );
}
