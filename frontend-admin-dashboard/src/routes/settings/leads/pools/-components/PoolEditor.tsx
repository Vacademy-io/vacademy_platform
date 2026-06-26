/**
 * Full-page editor for a counselor pool. Used for both create (poolId === null)
 * and edit (poolId === existing id). Tabs:
 *   - Overview    name, description, mode  (only tab visible during create)
 *   - Audiences   add/remove campaigns
 *   - Counselors  add/remove + status + backup
 *   - Order       rotation order editor       (ROUND_ROBIN and TIME_BASED)
 *   - Schedule    weekly shift editor         (only when mode = TIME_BASED)
 *
 * Order is shown for both rotation modes because the routing engine sorts
 * candidate counsellors by display_order in both: for ROUND_ROBIN it drives
 * the rotation itself; for TIME_BASED it tie-breaks when multiple counsellors
 * are on the same shift block. MANUAL mode shows neither — there's nothing
 * to configure beyond audiences and counselors.
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
    // Schedule tab is needed by TIME_BASED, and by ROUND_ROBIN pools that opted
    // into shift-gating (shift_aware) — both consume the weekly shift schedule.
    const scheduleVisible = isTimeBased || (isRoundRobin && !!pool?.shift_aware);

    // Pick which tab to land on:
    //   1. URL search param ?tab=... (e.g. after create, we redirect to ?tab=audiences)
    //   2. fall back to 'overview'
    // During create or when the requested tab is hidden for the current mode, bounce to 'overview'.
    const orderVisible = isRoundRobin || isTimeBased;
    let landingTab: EditorTab = initialTab ?? 'overview';
    if (isCreating && landingTab !== 'overview') landingTab = 'overview';
    if (landingTab === 'order' && !orderVisible) landingTab = 'overview';
    if (landingTab === 'schedule' && !scheduleVisible) landingTab = 'overview';

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
                    {/* Order tab: ROUND_ROBIN and TIME_BASED. For TIME_BASED it tie-breaks
                        when multiple counsellors are on the same shift. */}
                    {!isCreating && orderVisible && (
                        <TabsTrigger value="order">Order</TabsTrigger>
                    )}
                    {!isCreating && scheduleVisible && (
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
                        {orderVisible && (
                            <TabsContent value="order">
                                <OrderTab pool={pool} />
                            </TabsContent>
                        )}
                        {scheduleVisible && (
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
