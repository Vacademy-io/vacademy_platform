/**
 * Full-page editor for a counselor pool. Used for both create (poolId === null)
 * and edit (poolId === existing id). Tabs:
 *   - Overview    name, description, mode  (only tab visible during create)
 *   - Audiences   add/remove campaigns
 *   - Counselors  add/remove + status + backup
 *   - Order       rotation order editor       (only when mode = ROUND_ROBIN)
 *   - Schedule    weekly shift editor         (only when mode = TIME_BASED)
 *
 * The 4th tab swaps between Order and Schedule based on the pool's mode.
 * MANUAL mode shows neither — there's nothing to configure beyond audiences
 * and counselors.
 */

import { useNavigate } from '@tanstack/react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MyButton } from '@/components/design-system/button';
import { useCounselorPool } from '@/services/counselor-pool';
import OverviewTab from './OverviewTab';
import AudiencesTab from './AudiencesTab';
import CounselorsTab from './CounselorsTab';
import OrderTab from './OrderTab';
import ScheduleTab from './ScheduleTab';

type EditorTab = 'overview' | 'audiences' | 'counselors' | 'order' | 'schedule';

interface PoolEditorProps {
    /** null when creating a new pool. */
    poolId: string | null;
    /** Tab to land on initially, driven by URL search param ?tab=...  */
    initialTab?: EditorTab;
}

export default function PoolEditor({ poolId, initialTab }: PoolEditorProps) {
    const navigate = useNavigate();
    const { data: pool, isLoading } = useCounselorPool(poolId ?? undefined);

    const goBack = () =>
        navigate({ to: '/settings', search: { selectedTab: 'leadSettings' } });

    if (poolId && isLoading) {
        return <div className="p-6 text-sm text-muted-foreground">Loading pool…</div>;
    }

    const isCreating = poolId === null;
    const headerTitle = isCreating ? 'Create Pool' : pool?.name ?? 'Pool';
    const isRoundRobin = pool?.assignment_mode === 'ROUND_ROBIN';
    const isTimeBased = pool?.assignment_mode === 'TIME_BASED';

    // Pick which tab to land on:
    //   1. URL search param ?tab=... (e.g. after create, we redirect to ?tab=audiences)
    //   2. fall back to 'overview'
    // During create or when the requested tab is hidden for the current mode, bounce to 'overview'.
    let landingTab: EditorTab = initialTab ?? 'overview';
    if (isCreating && landingTab !== 'overview') landingTab = 'overview';
    if (landingTab === 'order' && !isRoundRobin) landingTab = 'overview';
    if (landingTab === 'schedule' && !isTimeBased) landingTab = 'overview';

    return (
        <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <MyButton buttonType="secondary" scale="small" onClick={goBack}>
                        ← Back
                    </MyButton>
                    <h1 className="text-xl font-semibold">{headerTitle}</h1>
                </div>
            </div>

            <Tabs defaultValue={landingTab} className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="audiences" disabled={isCreating}>
                        Audiences
                    </TabsTrigger>
                    <TabsTrigger value="counselors" disabled={isCreating}>
                        Counselors
                    </TabsTrigger>
                    {/* Dynamic 4th tab: Order for ROUND_ROBIN, Schedule for TIME_BASED,
                        nothing for MANUAL (no rotation config to set). */}
                    {!isCreating && isRoundRobin && (
                        <TabsTrigger value="order">Order</TabsTrigger>
                    )}
                    {!isCreating && isTimeBased && (
                        <TabsTrigger value="schedule">Schedule</TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="overview">
                    <OverviewTab pool={pool ?? null} />
                </TabsContent>

                {pool && (
                    <>
                        <TabsContent value="audiences">
                            <AudiencesTab pool={pool} />
                        </TabsContent>
                        <TabsContent value="counselors">
                            <CounselorsTab pool={pool} />
                        </TabsContent>
                        {isRoundRobin && (
                            <TabsContent value="order">
                                <OrderTab pool={pool} />
                            </TabsContent>
                        )}
                        {isTimeBased && (
                            <TabsContent value="schedule">
                                <ScheduleTab pool={pool} />
                            </TabsContent>
                        )}
                    </>
                )}
            </Tabs>
        </div>
    );
}
