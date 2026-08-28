import { useEffect } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { DailyBoardMain } from './-components/DailyBoardMain';

export const Route = createLazyFileRoute('/erp/attendance/')({
    component: () => (
        <LayoutContainer>
            <AttendanceDailyPage />
        </LayoutContainer>
    ),
});

function AttendanceDailyPage() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Attendance</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>Attendance</title>
                <meta
                    name="description"
                    content="Mark and review one day of attendance for every employee."
                />
            </Helmet>
            <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
                <DailyBoardMain />
            </div>
        </>
    );
}
