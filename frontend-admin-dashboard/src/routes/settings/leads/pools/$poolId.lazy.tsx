import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import PoolEditor from './-components/PoolEditor';

// Cast until the TanStack Router code generator regenerates routeTree.gen.ts to include this path.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createLazyFileRoute('/settings/leads/pools/$poolId' as any)({
    component: () => (
        <LayoutContainer>
            <RouteComponent />
        </LayoutContainer>
    ),
});

function RouteComponent() {
    const { poolId } = Route.useParams();
    const isCreating = poolId === 'new';
    return <PoolEditor poolId={isCreating ? null : poolId} />;
}
