import { createLazyFileRoute } from '@tanstack/react-router';
import MyResources from '../-components/My-Resources-List/MyResources';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { AICenterProvider } from '../-contexts/useAICenterContext';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';
import UploadFileMyResourcesComponent from '../-components/UploadFileMyResourcesComponent';

export const Route = createLazyFileRoute('/ai-center/my-resources/')({
    component: () => (
        <LayoutContainer>
            <AICenterProvider>
                <RouteComponent />
            </AICenterProvider>
        </LayoutContainer>
    ),
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading('My Resources List');
    }, [setNavHeading]);

    return (
        <div className="container mx-auto p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">My Resources</h1>
                <UploadFileMyResourcesComponent />
            </div>
            <MyResources />
        </div>
    );
}
