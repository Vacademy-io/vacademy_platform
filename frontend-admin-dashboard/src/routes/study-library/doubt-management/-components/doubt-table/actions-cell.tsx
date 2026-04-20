import { DeleteDoubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/doubt-resolution/DeleteDoubt';
import { Doubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';
import { isUserAdmin } from '@/utils/userDetails';
import { BookOpen, Clock, Eye, GraduationCap, User } from '@phosphor-icons/react';
import { useState } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TimestampCell } from './doubt-cell';
import { MarkAsResolved } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/doubt-resolution/MarkAsResolved';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useDoubtTable } from '../../-hooks/useDoubtTable';
import { convertCapitalToTitleCase } from '@/lib/utils';
import { AssigneeCell } from './assignee-cell';

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

const getInitials = (name?: string) => {
    const cleaned = (name ?? '').trim();
    if (!cleaned) return '?';
    const parts = cleaned.split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
    return (first + last).toUpperCase();
};

const SectionHeading = ({
    icon,
    title,
}: {
    icon: React.ReactNode;
    title: string;
}) => (
    <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary-50 text-primary-600">
            {icon}
        </span>
        <span>{title}</span>
    </div>
);

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
    const isAdmin = isUserAdmin();
    const { instituteDetails } = useInstituteDetailsStore();
    const batch = instituteDetails?.batches_for_sessions?.find(
        (batch) => batch.id == doubt.batch_id
    );
    const { userDetailsRecord } = useDoubtTable();
    const learnerName = userDetailsRecord[doubt.user_id]?.name ?? 'Anonymous';
    const batchName = batch
        ? convertCapitalToTitleCase(batch.level.level_name) +
          ' ' +
          convertCapitalToTitleCase(batch.package_dto.package_name) +
          ' ' +
          convertCapitalToTitleCase(batch.session.session_name)
        : '';
    const isResolved = doubt.status === 'RESOLVED';
    const resolveTime = calculateTimeDifference(doubt.raised_time, doubt.resolved_time);

    return (
        <MyDialog
            trigger={
                <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-primary-600"
                    aria-label="View doubt details"
                >
                    <Eye size={18} />
                </button>
            }
            heading="Doubt Details"
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            dialogWidth="w-[95vw] sm:min-w-[640px] sm:w-auto"
        >
            <div className="flex flex-col gap-5 p-5 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
                    <div className="flex flex-col gap-5">
                        <section className="flex flex-col gap-2">
                            <SectionHeading
                                icon={<BookOpen size={16} weight="duotone" />}
                                title="Doubt Description"
                            />
                            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-800">
                                <div dangerouslySetInnerHTML={{ __html: doubt.html_text }} />
                            </div>
                        </section>

                        <section className="flex flex-col gap-2">
                            <SectionHeading
                                icon={<BookOpen size={16} weight="duotone" />}
                                title="Content Information"
                            />
                            <div className="grid grid-cols-1 gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-sm sm:grid-cols-3">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs uppercase tracking-wide text-neutral-400">
                                        Type
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className="w-fit border-primary-200 bg-primary-50 text-primary-600"
                                    >
                                        {doubt.content_type}
                                    </Badge>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs uppercase tracking-wide text-neutral-400">
                                        Title
                                    </span>
                                    <span className="truncate font-medium text-neutral-800">
                                        {doubt.source_name || '—'}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs uppercase tracking-wide text-neutral-400">
                                        Location
                                    </span>
                                    <div className="flex items-center">
                                        <TimestampCell doubt={doubt} />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {isAdmin && (
                            <section className="flex flex-col gap-2">
                                <SectionHeading
                                    icon={<GraduationCap size={16} weight="duotone" />}
                                    title="Assign Teacher"
                                />
                                <div className="rounded-lg border border-neutral-200 bg-white p-3">
                                    <AssigneeCell doubt={doubt} />
                                </div>
                            </section>
                        )}

                        <div>
                            <MarkAsResolved doubt={doubt} refetch={refetch} />
                        </div>
                    </div>

                    <div className="flex flex-col gap-5">
                        <section className="flex flex-col gap-2">
                            <SectionHeading
                                icon={<User size={16} weight="duotone" />}
                                title="Learner"
                            />
                            <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3">
                                <Avatar className="size-11 bg-primary-50">
                                    <AvatarFallback className="bg-primary-100 text-sm font-semibold text-primary-700">
                                        {getInitials(learnerName)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex min-w-0 flex-col">
                                    <span className="truncate text-sm font-semibold text-neutral-800">
                                        {learnerName}
                                    </span>
                                    <span className="truncate text-xs text-neutral-500">
                                        {batchName || '—'}
                                    </span>
                                </div>
                            </div>
                        </section>

                        <section className="flex flex-col gap-2">
                            <SectionHeading
                                icon={<Clock size={16} weight="duotone" />}
                                title="Summary"
                            />
                            <div
                                className={`flex flex-col gap-1 rounded-lg border p-3 ${
                                    isResolved
                                        ? 'border-green-200 bg-green-50'
                                        : 'border-primary-200 bg-primary-50'
                                }`}
                            >
                                <span className="text-xs uppercase tracking-wide text-neutral-500">
                                    Resolve Time
                                </span>
                                <span
                                    className={`text-lg font-semibold ${
                                        isResolved ? 'text-green-700' : 'text-primary-700'
                                    }`}
                                >
                                    {resolveTime}
                                </span>
                                <Separator className="my-1" />
                                <span className="text-xs text-neutral-500">
                                    Status: {isResolved ? 'Resolved' : 'Unresolved'}
                                </span>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </MyDialog>
    );
};
