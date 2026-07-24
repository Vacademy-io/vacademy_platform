import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { useEffect } from 'react';
import { Plus, Tray, Robot } from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyButton } from '@/components/design-system/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { useEngines } from './-hooks';
import { ToneBadge } from './-components/ToneBadge';
import { ENGINE_STATUS_META } from './-constants';
import { channelLabels } from './-utils';
import type { EngagementEngine } from './-types';

export const Route = createLazyFileRoute('/engagement-engines/')({
    component: EngagementEnginesPage,
});

function EngineCard({ engine }: { engine: EngagementEngine }) {
    const navigate = useNavigate();
    const meta = ENGINE_STATUS_META[engine.status] ?? { label: engine.status, tone: 'neutral' as const };
    const channels = channelLabels(engine);
    return (
        <Card
            role="button"
            tabIndex={0}
            onClick={() => navigate({ to: '/engagement-engines/$engineId', params: { engineId: engine.id } })}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate({ to: '/engagement-engines/$engineId', params: { engineId: engine.id } });
                }
            }}
            className="cursor-pointer p-4 transition-colors hover:border-primary-200"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-subtitle font-semibold text-neutral-700">{engine.name}</p>
                    {engine.objective && (
                        <p className="mt-1 line-clamp-2 text-body text-neutral-500">{engine.objective}</p>
                    )}
                </div>
                <ToneBadge label={meta.label} tone={meta.tone} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {channels.length ? (
                    channels.map((c) => (
                        <span
                            key={c}
                            className="rounded bg-neutral-100 px-1.5 py-0.5 text-caption text-neutral-500"
                        >
                            {c}
                        </span>
                    ))
                ) : (
                    <span className="text-caption text-neutral-400">No channels enabled</span>
                )}
                <span className="ml-auto text-caption text-neutral-400">
                    every {engine.cadenceHours}h
                </span>
            </div>
        </Card>
    );
}

function EngagementEnginesPage() {
    const navigate = useNavigate();
    const { setNavHeading } = useNavHeadingStore();
    const { data: engines, isLoading, isError } = useEngines();

    useEffect(() => {
        setNavHeading('Engagement Engines');
    }, [setNavHeading]);

    return (
        <LayoutContainer>
            <Helmet>
                <title>Engagement Engines</title>
            </Helmet>
            <div className="flex flex-col gap-5 p-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-h3 font-semibold text-neutral-700">Engagement Engines</h1>
                        <p className="text-body text-neutral-500">
                            Per-objective AI copilots that decide who to message, when, and with what.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => navigate({ to: '/engagement-engines/inbox' })}
                        >
                            <Tray className="mr-1 size-4" /> Task inbox
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onClick={() => navigate({ to: '/engagement-engines/create' })}
                        >
                            <Plus className="mr-1 size-4" /> New engine
                        </MyButton>
                    </div>
                </div>

                {isLoading && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {[0, 1, 2].map((i) => (
                            <Skeleton key={i} className="h-28 w-full rounded-lg" />
                        ))}
                    </div>
                )}

                {isError && (
                    <Card className="p-6 text-center text-body text-danger-600">
                        Could not load engines. Please refresh.
                    </Card>
                )}

                {!isLoading && !isError && (engines?.length ?? 0) === 0 && (
                    <Card className="flex flex-col items-center gap-3 p-10 text-center">
                        <Robot className="size-10 text-neutral-300" />
                        <p className="text-subtitle font-medium text-neutral-600">No engines yet</p>
                        <p className="max-w-md text-body text-neutral-500">
                            Create an engine for one objective — like re-engaging dormant{' '}
                            {getTerminologyPlural(RoleTerms.Learner, SystemTerms.Learner).toLowerCase()} or
                            a 14-day challenge. It drafts every message for you to review before sending.
                        </p>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onClick={() => navigate({ to: '/engagement-engines/create' })}
                        >
                            <Plus className="mr-1 size-4" /> Create your first engine
                        </MyButton>
                    </Card>
                )}

                {!isLoading && (engines?.length ?? 0) > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {engines?.map((e) => <EngineCard key={e.id} engine={e} />)}
                    </div>
                )}
            </div>
        </LayoutContainer>
    );
}
