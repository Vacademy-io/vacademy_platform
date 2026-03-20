// batch-section.tsx
import React, { useState } from 'react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import {
    BatchType,
    batchWithStudentDetails,
} from '@/routes/manage-institute/batches/-types/manage-batches-types';
import { Plus, TrashSimple, Users, Copy } from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';
import { useGetStudentBatch } from '@/routes/manage-students/students-list/-hooks/useGetStudentBatch';
import { EnrollManuallyButton } from '@/components/common/students/enroll-manually/enroll-manually-button';
import { useDeleteBatches } from '@/routes/manage-institute/batches/-services/delete-batches';
import { toast } from 'sonner';
import createInviteLink from '@/routes/manage-students/invite/-utils/createInviteLink';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms } from '@/routes/settings/-components/NamingSettings';
import { convertCapitalToTitleCase } from '@/lib/utils';

// Locally defined type based on observed structure from useInstituteDetailsStore
interface BatchForSessionStoreType {
    id: string; // This is the package_session_id
    session: {
        id: string;
        session_name: string;
    };
    level: {
        id: string;
        level_name: string;
    };
    package_dto: {
        id: string; // This is courseId / packageId
        package_name: string;
    };
}

interface batchCardProps {
    batch: BatchType;
}

const BatchCard = ({ batch }: batchCardProps) => {
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const navigate = useNavigate();
    const { levelName, packageName } = useGetStudentBatch(batch.package_session_id);
    const deleteBatchesMutation = useDeleteBatches();
    const { instituteDetails } = useInstituteDetailsStore();

    const handleViewBatch = () => {
        const batchName = `${levelName} ${packageName}`;
        navigate({
            to: '/manage-students/students-list',
            search: {
                batch: batchName,
                package_session_id: batch.package_session_id,
            },
        });
    };

    const handleDeleteBatch = () => {
        deleteBatchesMutation.mutate(
            { packageSessionIds: [batch.package_session_id] },
            {
                onSuccess: () => {
                    toast.success('Batch deleted successfully');
                    setOpenDeleteDialog(false);
                },
                onError: () => {
                    toast.error('Failed to delete batch');
                },
            }
        );
    };

    const handleCopyInviteCode = () => {
        const fullInviteLink = createInviteLink(
            batch.invite_code,
            instituteDetails?.learner_portal_base_url
        );
        navigator.clipboard.writeText(fullInviteLink);
        toast.success('Invite link copied to clipboard');
    };

    return (
        <>
            <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                        <p className="text-lg font-semibold text-neutral-700">
                            {convertCapitalToTitleCase(batch.batch_name)}
                        </p>
                        <MyButton
                            buttonType="text"
                            layoutVariant="icon"
                            className="rounded-full p-1 text-danger-400 hover:bg-danger-50 hover:text-danger-600"
                            onClick={() => setOpenDeleteDialog(true)}
                            scale="medium"
                        >
                            <TrashSimple size={20} />
                        </MyButton>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-600">
                        <Users size={20} />
                        <p className="text-sm font-medium">
                            {batch.count_students} {getTerminology(RoleTerms.Learner, 'Learner')}
                            {batch.count_students !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                        <p className="font-medium">Invite Code:</p>
                        <span className="rounded bg-neutral-100 px-2 py-1 font-mono text-xs text-neutral-700">
                            {batch.invite_code}
                        </span>
                        <MyButton
                            layoutVariant="icon"
                            buttonType="text"
                            onClick={handleCopyInviteCode}
                            className="text-neutral-500 hover:text-neutral-700"
                            scale="small"
                        >
                            <Copy size={16} />
                        </MyButton>
                    </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-neutral-100 pt-4">
                    <EnrollManuallyButton
                        triggerButton={
                            <MyButton
                                buttonType="text"
                                layoutVariant="default"
                                scale="medium"
                                className="w-full text-neutral-700 hover:text-primary-600 sm:w-auto"
                            >
                                <Plus size={18} className="mr-1" />
                                Enroll {getTerminology(RoleTerms.Learner, 'Learner')}
                            </MyButton>
                        }
                    />
                    <MyButton
                        buttonType="secondary"
                        layoutVariant="default"
                        scale="medium"
                        onClick={handleViewBatch}
                        className="w-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 sm:w-auto"
                    >
                        View Batch
                    </MyButton>
                </div>
            </div>
            <MyDialog
                heading="Delete Batch"
                open={openDeleteDialog}
                onOpenChange={() => setOpenDeleteDialog(!openDeleteDialog)}
                dialogWidth="w-[400px]"
                footer={
                    <div className="flex w-full items-center justify-end gap-3 py-2">
                        <MyButton
                            buttonType="secondary"
                            onClick={() => setOpenDeleteDialog(false)}
                            className="hover:bg-neutral-100"
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            buttonType="secondary"
                            onClick={handleDeleteBatch}
                            className="border-danger-300 text-danger-600 hover:border-danger-500 hover:bg-danger-50"
                        >
                            Yes, Delete
                        </MyButton>
                    </div>
                }
            >
                <p className="text-neutral-600">
                    Are you sure you want to delete the batch &quot;{batch.batch_name}&quot;? This
                    action cannot be undone.
                </p>
            </MyDialog>
        </>
    );
};

interface BatchSectionProps {
    batch: batchWithStudentDetails;
    currentSessionId?: string;
}

export const BatchSection = ({ batch, currentSessionId }: BatchSectionProps) => {
    const { instituteDetails } = useInstituteDetailsStore();

    const filteredBatches =
        currentSessionId && instituteDetails?.batches_for_sessions
            ? batch.batches.filter((b) => {
                const batchDetail: BatchForSessionStoreType | undefined =
                    instituteDetails.batches_for_sessions.find(
                        (detail: BatchForSessionStoreType) => detail.id === b.package_session_id
                    );
                return batchDetail?.session.id === currentSessionId;
            })
            : batch.batches;

    return (
        <>
            {filteredBatches.length > 0 ? (
                <div className="flex flex-col gap-5">
                    <p className="text-xl font-semibold text-neutral-700">
                        {convertCapitalToTitleCase(batch.package_dto.package_name)}
                    </p>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {filteredBatches.map((batchLevel, index) => (
                            <BatchCard batch={batchLevel} key={index} />
                        ))}
                    </div>
                </div>
            ) : currentSessionId && batch.batches.length > 0 ? null : (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
                    <p className="text-lg font-semibold text-neutral-700">
                        {convertCapitalToTitleCase(batch.package_dto.package_name)}
                    </p>
                    <p className="text-neutral-500">
                        No batches found for this package
                        {currentSessionId ? ' in the selected session' : ''}.
                    </p>
                </div>
            )}
        </>
    );
};
