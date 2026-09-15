import { useState } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { cn } from '@/lib/utils';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { OnboardingFlowsPage } from './-components/onboarding-flows-page';
import { OnboardingDashboardPage } from './-components/onboarding-dashboard-page';

export const Route = createLazyFileRoute('/audience-manager/onboarding/')({
    component: OnboardingRoute,
});

type OnboardingTab = 'flows' | 'dashboard';

function OnboardingRoute() {
    const { t } = useTranslation('audienceManagerOnboardingIndexLazy');
    const [tab, setTab] = useState<OnboardingTab>('flows');
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id ?? '';

    const tabs = [
        { id: 'flows', label: t('tabs.flows') },
        { id: 'dashboard', label: t('tabs.dashboard') },
    ] as const;

    return (
        <LayoutContainer>
            <div className="flex flex-col gap-2 p-2">
                <div
                    role="tablist"
                    aria-label={t('tablistAriaLabel')}
                    className="flex gap-1 border-b border-neutral-200 px-2"
                >
                    {tabs.map((tabItem) => (
                        <button
                            key={tabItem.id}
                            type="button"
                            role="tab"
                            aria-selected={tab === tabItem.id}
                            onClick={() => setTab(tabItem.id)}
                            className={cn(
                                'rounded-t-md px-3.5 py-2 text-body font-medium transition-colors',
                                tab === tabItem.id
                                    ? 'border-b-2 border-primary-500 text-primary-600'
                                    : 'text-neutral-500 hover:text-neutral-800'
                            )}
                        >
                            {tabItem.label}
                        </button>
                    ))}
                </div>
                {tab === 'flows' ? (
                    <OnboardingFlowsPage />
                ) : (
                    <OnboardingDashboardPage instituteId={instituteId} />
                )}
            </div>
        </LayoutContainer>
    );
}
