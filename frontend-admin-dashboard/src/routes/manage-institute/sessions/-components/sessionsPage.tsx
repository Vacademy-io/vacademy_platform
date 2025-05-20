import { useEffect, useState } from 'react';
import SessionHeader from './sessionHeader';
import { useSessionData } from '@/services/study-library/session-management/getSessionData';
import { SessionsResponse } from '@/types/study-library/session-types';
import { SessionCard } from './sessionCard';
import { useQuery } from '@tanstack/react-query';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { EmptySessionImage } from '@/assets/svgs';
import { NoCourseDialog } from '@/components/common/students/no-course-dialog';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

export function SessionsPage() {
    const { data, isLoading } = useQuery({
        ...useSessionData(),
    });
    const [isOpen, setIsOpen] = useState(false);
    const [sessionData, setSessionData] = useState<SessionsResponse>();
    const { getCourseFromPackage, instituteDetails } = useInstituteDetailsStore();

    useEffect(() => {
        const courseList = getCourseFromPackage();
        if (courseList.length === 0) {
            setIsOpen(true);
        }
    }, [instituteDetails]);

    useEffect(() => {
        setSessionData(data);
    }, [data]);

    if (isLoading) {
        return <DashboardLoader />;
    }
    return (
        <div>
            <SessionHeader></SessionHeader>
            <div className="my-10 flex flex-col gap-6 text-neutral-600">
                {sessionData?.length ? (
                    sessionData?.map((session, idx) => <SessionCard key={idx} data={session} />)
                ) : (
                    <div className="flex h-[50vh] flex-col items-center justify-center gap-2">
                        {' '}
                        <EmptySessionImage />{' '}
                        <p className="text-body text-neutral-600">No sessions found</p>
                    </div>
                )}
            </div>
            <NoCourseDialog
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                type="Adding Sessions"
                content="You need to create a course before"
            />
        </div>
    );
}
