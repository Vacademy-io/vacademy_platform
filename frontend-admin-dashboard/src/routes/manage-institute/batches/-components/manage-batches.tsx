import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useState } from 'react';
import { BatchSection } from './batch-section';
import { useGetBatchesQuery } from '@/routes/manage-institute/batches/-services/get-batches';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { CreateBatchDialog } from './create-batch-dialog';
import {
    DropdownItemType,
    DropdownValueType,
} from '@/components/common/students/enroll-manually/dropdownTypesForPackageItems';
import { MyDropdown } from '@/components/common/students/enroll-manually/dropdownForPackageItems';
import { EmptyBatchImage } from '@/assets/svgs';
import { ContentTerms, RoleTerms } from '@/routes/settings/-components/NamingSettings';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';

export const ManageBatches = () => {
    const { setNavHeading } = useNavHeadingStore();

    const { getAllSessions, instituteDetails } = useInstituteDetailsStore();
    const [sessionList, setSessionList] = useState<DropdownItemType[]>(
        getAllSessions().map((session) => ({
            id: session.id,
            name: session.session_name,
        }))
    );

    const [currentSession, setCurrentSession] = useState<DropdownItemType | undefined>();

    useEffect(() => {
        if (sessionList.length > 0) {
            let selectedSession = sessionList[0];
            getAllSessions().forEach((session) => {
                if (session.status === 'ACTIVE') {
                    selectedSession = { id: session.id, name: session.session_name };
                }
            });
            setCurrentSession(selectedSession);
        } else {
            setCurrentSession(undefined);
        }
    }, [sessionList]);

    const { data, isLoading, isError } = useGetBatchesQuery({
        sessionId: currentSession?.id || '',
    });

    const handleSessionChange = (value: DropdownValueType) => {
        if (value && typeof value === 'object' && 'id' in value && 'name' in value) {
            setCurrentSession(value as DropdownItemType);
        }
    };

    useEffect(() => {
        setSessionList(
            getAllSessions().map((session) => ({
                id: session.id,
                name: session.session_name,
            }))
        );
    }, [instituteDetails]);

    useEffect(() => {
        setNavHeading('Manage Batches');
    }, []);

    if (isLoading) return <DashboardLoader />;

    if (isError)
        return (
            <div className="flex h-full flex-col items-center justify-center text-neutral-500">
                <p>Unable to fetch batches. Please try again later.</p>
            </div>
        );

    return (
        <div className="flex flex-col gap-4 p-2 text-neutral-700 sm:gap-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-lg font-semibold sm:text-xl">
                        {getTerminology(RoleTerms.Learner, 'Learner')} Batches
                    </p>
                    <p className="text-xs text-neutral-500 sm:text-sm">
                        Manage and organize your{' '}
                        {getTerminology(RoleTerms.Learner, 'Learner').toLocaleLowerCase()} batches
                        by {getTerminology(ContentTerms.Session, 'Session').toLocaleLowerCase()}.
                    </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    {sessionList.length > 0 && currentSession !== undefined && (
                        <MyDropdown
                            currentValue={currentSession}
                            dropdownList={sessionList}
                            placeholder="Select Session"
                            handleChange={handleSessionChange}
                        />
                    )}
                    <CreateBatchDialog />
                </div>
            </div>

            {data && data.length > 0 ? (
                <div className="flex flex-col gap-4 sm:gap-8">
                    {data.map((batch, index) => (
                        <BatchSection
                            key={index}
                            batch={batch}
                            currentSessionId={currentSession?.id}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-10 text-center sm:gap-5 sm:py-16">
                    <EmptyBatchImage className="size-24 text-neutral-400 sm:size-32" />
                    <p className="text-base font-medium text-neutral-600 sm:text-lg">
                        {currentSession
                            ? `No batches found for ${currentSession.name}`
                            : 'No sessions available'}
                    </p>
                    <p className="max-w-md text-xs text-neutral-500 sm:text-sm">
                        {currentSession
                            ? 'Create a new batch in this session to get started.'
                            : 'Please create a session first before adding batches.'}
                    </p>
                    {currentSession && <CreateBatchDialog />}
                </div>
            )}
        </div>
    );
};
