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

    if (isError) return <p>Unable to fetch batches</p>;

    return (
        <div className="flex flex-col gap-10 text-neutral-600">
            <div className="flex items-center justify-between">
                <p className="text-h3 font-semibold">Student Batches</p>
                <div className="flex items-center gap-6">
                    {currentSession !== undefined && (
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
            <div className="flex flex-col gap-10">
                {data == undefined && (
                    <div className="flex flex-col items-center justify-center gap-4">
                        <EmptyBatchImage />
                        <p className="text-neutral-400">No batches found</p>
                    </div>
                )}
                {data?.map((batch, index) => <BatchSection key={index} batch={batch} />)}
            </div>
        </div>
    );
};
