import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useState } from 'react';
import { SettingsTabs } from './-constants/terms';
import { getAvailableSettingsTabs } from './-utils/utils';
import { Route as SettingsRoute } from '.';

export const Route = createLazyFileRoute('/settings/')({
    component: () => (
        <LayoutContainer>
            <RouteComponent />
        </LayoutContainer>
    ),
});

const SafeRouteSearch = () => {
    try {
        return SettingsRoute.useSearch() as { selectedTab?: string };
    } catch (error) {
        // Return a default object if the hook fails
        return { selectedTab: SettingsTabs.Tab };
    }
};

function RouteComponent() {
    const searchParams = SafeRouteSearch();
    const [selectedTab, setSelectedTab] = useState('adminDisplay');
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading('Settings');
    }, [setNavHeading]);

    // Sync selectedTab with URL search params when they change
    useEffect(() => {
        if (searchParams.selectedTab) {
            setSelectedTab(searchParams.selectedTab);
        }
    }, [searchParams.selectedTab]);

    // Find the active tab component
    const availableTabs = getAvailableSettingsTabs();
    const activeTabConfig = availableTabs.find((t) => t.tab === selectedTab) || availableTabs[0];
    const ActiveComponent = activeTabConfig?.component;

    return <div>{ActiveComponent && <ActiveComponent isTab={true} />}</div>;
}
