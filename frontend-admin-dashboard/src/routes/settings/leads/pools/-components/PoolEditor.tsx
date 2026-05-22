/**
 * Full-page editor for a counselor pool. Used for both create (poolId === null)
 * and edit (poolId === existing id). Wraps four tabs:
 *   - Overview    name, description, mode  (only tab visible during create)
 *   - Audiences   add/remove campaigns
 *   - Counselors  add/remove/reorder + status + backup
 *   - Schedule    weekly shift editor (only enabled when mode = TIME_BASED)
 */

import { useNavigate } from '@tanstack/react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MyButton } from '@/components/design-system/button';
import { useCounselorPool } from '@/services/counselor-pool';
import OverviewTab from './OverviewTab';
import AudiencesTab from './AudiencesTab';
import CounselorsTab from './CounselorsTab';
import ScheduleTab from './ScheduleTab';

interface PoolEditorProps {
    /** null when creating a new pool. */
    poolId: string | null;
}

export default function PoolEditor({ poolId }: PoolEditorProps) {
    const navigate = useNavigate();
    const { data: pool, isLoading } = useCounselorPool(poolId ?? undefined);

    const goBack = () =>
        navigate({ to: '/settings', search: { selectedTab: 'leadSettings' } });

    if (poolId && isLoading) {
        return <div className="p-6 text-sm text-muted-foreground">Loading pool…</div>;
    }

    const isCreating = poolId === null;
    const headerTitle = isCreating ? 'Create Pool' : pool?.name ?? 'Pool';
    const isTimeBased = pool?.assignment_mode === 'TIME_BASED';

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

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="audiences" disabled={isCreating}>
                        Audiences
                    </TabsTrigger>
                    <TabsTrigger value="counselors" disabled={isCreating}>
                        Counselors
                    </TabsTrigger>
                    <TabsTrigger value="schedule" disabled={isCreating || !isTimeBased}>
                        Schedule
                    </TabsTrigger>
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
                        <TabsContent value="schedule">
                            <ScheduleTab pool={pool} />
                        </TabsContent>
                    </>
                )}
            </Tabs>
        </div>
    );
}
