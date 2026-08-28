import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { LeaveSetupMain } from '@/routes/erp/leave/-components/LeaveSetupMain';

export const Route = createLazyFileRoute('/erp/leave/setup/')({
    component: () => (
        <LayoutContainer>
            <LeaveSetupPage />
        </LayoutContainer>
    ),
});

function LeaveSetupPage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Leave Types &amp; Policies</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>Leave Types &amp; Policies</title>
                <meta
                    name="description"
                    content="Define the kinds of leave your institute grants and the policies that set each quota."
                />
            </Helmet>
            <LeaveSetupMain />
        </>
    );
}
