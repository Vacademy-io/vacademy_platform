import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyPayslipsMain } from '@/routes/erp/my-hr/-components/MyPayslipsMain';

export const Route = createLazyFileRoute('/erp/my-hr/payslips/')({
    component: () => (
        <LayoutContainer>
            <MyPayslipsPage />
        </LayoutContainer>
    ),
});

function MyPayslipsPage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">My Payslips</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>My Payslips</title>
                <meta name="description" content="Download the payslips issued to you, by year." />
            </Helmet>
            <MyPayslipsMain />
        </>
    );
}
