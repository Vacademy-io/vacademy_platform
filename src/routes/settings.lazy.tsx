import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useState } from 'react';
import { SettingsTabs } from './settings/-constants/terms';
import { getAvailableSettingsTabs } from './settings/-utils/utils';
import { Route as SettingsRoute } from './settings';

export const Route = createLazyFileRoute('/settings')({
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
    const [selectedTab, setSelectedTab] = useState(searchParams.selectedTab ?? SettingsTabs.Tab);
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

    return (
        <div>
            {ActiveComponent && <ActiveComponent isTab={true} />}
        </div>
    );
}
