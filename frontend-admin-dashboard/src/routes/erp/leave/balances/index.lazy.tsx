import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { LeaveBalancesMain } from '@/routes/erp/leave/-components/LeaveBalancesMain';

export const Route = createLazyFileRoute('/erp/leave/balances/')({
    component: () => (
        <LayoutContainer>
            <LeaveBalancesPage />
        </LayoutContainer>
    ),
});

function LeaveBalancesPage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Leave Balances</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>Leave Balances</title>
                <meta
                    name="description"
                    content="Leave balances per employee and leave type, comp-off approvals, accrual and year-end runs."
                />
            </Helmet>
            <LeaveBalancesMain />
        </>
    );
}
