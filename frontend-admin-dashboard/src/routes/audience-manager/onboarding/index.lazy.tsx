import { useState } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
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
    const [tab, setTab] = useState<OnboardingTab>('flows');
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id ?? '';

    return (
        <LayoutContainer>
            <div className="flex flex-col gap-2 p-2">
                <div role="tablist" aria-label="Onboarding sections" className="flex gap-1 border-b border-neutral-200 px-2">
                    {(
                        [
                            { id: 'flows', label: 'Flows' },
                            { id: 'dashboard', label: 'Dashboard' },
                        ] as const
                    ).map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={tab === t.id}
                            onClick={() => setTab(t.id)}
                            className={cn(
                                'rounded-t-md px-3.5 py-2 text-body font-medium transition-colors',
                                tab === t.id
                                    ? 'border-b-2 border-primary-500 text-primary-600'
                                    : 'text-neutral-500 hover:text-neutral-800'
                            )}
                        >
                            {t.label}
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
