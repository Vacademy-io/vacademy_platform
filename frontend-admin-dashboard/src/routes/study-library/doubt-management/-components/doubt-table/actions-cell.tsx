import { DeleteDoubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/doubt-resolution/DeleteDoubt';
import { Doubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';
import { isUserAdmin } from '@/utils/userDetails';
import { BookOpen, Clock, Eye, User } from '@phosphor-icons/react';
import { useState } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { Separator } from '@/components/ui/separator';
import { TimestampCell } from './doubt-cell';
import { MarkAsResolved } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/doubt-resolution/MarkAsResolved';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useDoubtTable } from '../../-hooks/useDoubtTable';
import { convertCapitalToTitleCase } from '@/lib/utils';

const calculateTimeDifference = (raisedTime: string, resolvedTime: string | null) => {
    if (!resolvedTime) return 'Not resolved yet';

    const raised = new Date(raisedTime);
    const resolved = new Date(resolvedTime);
    const diffInMs = resolved.getTime() - raised.getTime();

    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffInMs % (1000 * 60)) / 1000);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.join(' ') || '0s';
};

export const ActionsCell = ({ doubt, refetch }: { doubt: Doubt; refetch: () => void }) => {
    const isAdmin = isUserAdmin();

    return (
        <div className="flex w-full items-center justify-center gap-2 text-center">
            <DoubtDetailsDialog doubt={doubt} refetch={refetch} />
            {isAdmin && <DeleteDoubt doubt={doubt} refetch={refetch} showText={false} />}
        </div>
    );
};

export const DoubtDetailsDialog = ({ doubt, refetch }: { doubt: Doubt; refetch: () => void }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { instituteDetails } = useInstituteDetailsStore();
    const batch = instituteDetails?.batches_for_sessions?.find(
        (batch) => batch.id == doubt.batch_id
    );
    const { userDetailsRecord } = useDoubtTable();
    const batchName = batch
        ? convertCapitalToTitleCase(batch.level.level_name) +
        ' ' +
        convertCapitalToTitleCase(batch.package_dto.package_name) +
        ' ' +
        convertCapitalToTitleCase(batch.session.session_name)
        : '';
    return (
        <MyDialog
            trigger={<Eye className="cursor-pointer" />}
            heading="Doubt Details"
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            dialogWidth="w-[95vw] sm:min-w-[50vw] sm:w-auto"
        >
            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <div className="flex w-full flex-col gap-4 sm:w-3/4 sm:gap-8">
                        <div className="flex flex-col gap-2">
                            <p className="text-regular font-semibold">Doubt Description</p>
                            <div className="w-full rounded-lg border border-neutral-300 bg-neutral-50 p-2">
                                <div
                                    dangerouslySetInnerHTML={{ __html: doubt.html_text }}
                                    className="text-neutral-800"
                                />
                            </div>
                        </div>
                        <Separator />
                        <div className="flex flex-col gap-2 text-body text-neutral-600">
                            <p className="text-regular flex items-center gap-2 font-semibold">
                                <BookOpen /> Content Information
                            </p>
                            <div className="w-full rounded-lg border border-neutral-300 p-2">
                                <div className="flex w-full items-center justify-between">
                                    <p className="text-neutral-400">Slide Type:</p>
                                    <p className="rounded-lg border border-primary-500 bg-primary-50 px-2 py-[2px] text-caption text-primary-500">
                                        {doubt.content_type}
                                    </p>
                                </div>
                                <div className="flex w-full items-center justify-between">
                                    <p className="text-neutral-400">Title:</p>
                                    <p className=" font-semibold ">{doubt.source_name}</p>
                                </div>
                                <div className="flex w-full items-center justify-between">
                                    <p className="text-neutral-400">Location:</p>
                                    <TimestampCell doubt={doubt} />
                                </div>
                            </div>
                        </div>
                        <MarkAsResolved doubt={doubt} refetch={refetch} />
                    </div>
                    <div className="flex flex-1 flex-col gap-4 sm:gap-8">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-1">
                                <User />
                                <p className="text-regular font-semibold">Learner</p>
                            </div>
                            <div className="w-full rounded-lg border border-neutral-300 p-2 text-body">
                                <div className="flex w-full items-center justify-between">
                                    <p className="text-neutral-400">Name:</p>
                                    <p className=" font-semibold ">
                                        {userDetailsRecord[doubt.user_id]?.name}
                                    </p>
                                </div>
                                <div className="flex w-full items-center justify-between">
                                    <p className="text-neutral-400">Batch:</p>
                                    <p className=" font-semibold ">{batchName}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex w-full flex-col gap-2">
                            <div className="flex w-full items-center gap-1">
                                <Clock />
                                <p className="text-regular font-semibold">Summary</p>
                            </div>
                            <div className="flex w-full flex-col items-center justify-normal rounded-lg border border-primary-500 bg-primary-50 p-2 text-primary-500">
                                <p className="w-full text-center text-base font-bold">
                                    {calculateTimeDifference(
                                        doubt.raised_time,
                                        doubt.resolved_time
                                    )}
                                </p>
                                <p className="w-full text-center text-caption">Resolve Time</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MyDialog>
    );
};
