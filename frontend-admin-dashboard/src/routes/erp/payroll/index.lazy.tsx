import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { PayrollRunsList } from './-components/PayrollRunsList';

export const Route = createLazyFileRoute('/erp/payroll/')({
    component: () => (
        <LayoutContainer>
            <PayrollRunsPage />
        </LayoutContainer>
    ),
});

function PayrollRunsPage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Payroll Runs</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>Payroll Runs</title>
                <meta
                    name="description"
                    content="Create, process, approve and pay monthly payroll runs for your institute."
                />
            </Helmet>
            <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
                <PayrollRunsList />
            </div>
        </>
    );
}
