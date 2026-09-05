import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { LeaveRequestsMain } from '@/routes/erp/leave/-components/LeaveRequestsMain';

export const Route = createLazyFileRoute('/erp/leave/')({
    component: () => (
        <LayoutContainer>
            <LeaveRequestsPage />
        </LayoutContainer>
    ),
});

function LeaveRequestsPage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Leave Requests</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>Leave Requests</title>
                <meta
                    name="description"
                    content="Approve, reject or cancel your employees' leave requests."
                />
            </Helmet>
            <LeaveRequestsMain />
        </>
    );
}
