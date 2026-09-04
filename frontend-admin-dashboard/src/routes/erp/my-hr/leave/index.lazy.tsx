import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyLeaveMain } from '@/routes/erp/my-hr/-components/MyLeaveMain';

export const Route = createLazyFileRoute('/erp/my-hr/leave/')({
    component: () => (
        <LayoutContainer>
            <MyLeavePage />
        </LayoutContainer>
    ),
});

function MyLeavePage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">My Leave</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>My Leave</title>
                <meta
                    name="description"
                    content="Your leave balance, applications and comp-off — and where you apply for leave."
                />
            </Helmet>
            <MyLeaveMain />
        </>
    );
}
