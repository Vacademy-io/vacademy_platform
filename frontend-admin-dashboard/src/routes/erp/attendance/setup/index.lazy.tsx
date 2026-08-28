import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { AttendanceSetupMain } from '@/routes/erp/attendance/-components/AttendanceSetupMain';

export const Route = createLazyFileRoute('/erp/attendance/setup/')({
    component: () => (
        <LayoutContainer>
            <AttendanceSetupPage />
        </LayoutContainer>
    ),
});

function AttendanceSetupPage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Shifts &amp; Holidays</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>Shifts &amp; Holidays</title>
                <meta
                    name="description"
                    content="Shifts, the holiday calendar and how this institute records attendance."
                />
            </Helmet>
            <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
                <AttendanceSetupMain />
            </div>
        </>
    );
}
