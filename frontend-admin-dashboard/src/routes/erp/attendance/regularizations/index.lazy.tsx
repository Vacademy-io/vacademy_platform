import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { RegularizationsMain } from '@/routes/erp/attendance/-components/RegularizationsMain';

export const Route = createLazyFileRoute('/erp/attendance/regularizations/')({
    component: () => (
        <LayoutContainer>
            <RegularizationsPage />
        </LayoutContainer>
    ),
});

function RegularizationsPage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Regularizations</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>Attendance Regularizations</title>
                <meta
                    name="description"
                    content="Approve or reject employee requests to correct their attendance."
                />
            </Helmet>
            <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
                <RegularizationsMain />
            </div>
        </>
    );
}
