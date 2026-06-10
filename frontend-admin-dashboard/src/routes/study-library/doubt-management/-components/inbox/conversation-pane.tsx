import { Doubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CaretLeft } from '@phosphor-icons/react';
import { isUserAdmin, isUserTeacher, getUserId } from '@/utils/userDetails';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { convertCapitalToTitleCase } from '@/lib/utils';
import { formatISODateTimeReadable } from '@/helpers/formatISOTime';
import { MarkAsResolved } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/doubt-resolution/MarkAsResolved';
import { DeleteDoubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/doubt-resolution/DeleteDoubt';
import { AddReply } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/doubt-resolution/AddReply';
import { Reply } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/doubt-resolution/reply';
import { AssigneeCell } from '../doubt-table/assignee-cell';
import { CategoryCell } from '../doubt-table/category-cell';
import { TimestampCell } from '../doubt-table/doubt-cell';
import { NavigateCell } from '../doubt-table/navigate-cell';
import { getInitials } from './utils';

/** Right pane: header (resolve/assign/delete/view-source) + conversation thread + reply composer. */
export const ConversationPane = ({
    doubt,
    refetch,
    learnerName,
    onBack,
}: {
    doubt: Doubt;
    refetch: () => void;
    learnerName?: string;
    onBack: () => void;
}) => {
    const isAdmin = isUserAdmin();
    const isTeacher = isUserTeacher();
    const userId = getUserId();
    const { instituteDetails } = useInstituteDetailsStore();
    const name = learnerName ?? 'Anonymous';

    const batch = instituteDetails?.batches_for_sessions?.find((b) => b.id === doubt.batch_id);
    const batchName = batch
        ? `${convertCapitalToTitleCase(batch.level.level_name)} ${convertCapitalToTitleCase(
              batch.package_dto.package_name
          )} ${convertCapitalToTitleCase(batch.session.session_name)}`
        : '';

    const isSlide = doubt.source === 'SLIDE' && !!doubt.source_id;
    const isAssignedUser =
        !!userId &&
        !!doubt.all_doubt_assignee?.some((a) => a.source === 'USER' && a.source_id === userId);
    const isPendingAssignee =
        !!userId && !!doubt.doubt_assignee_request_user_ids?.includes(userId);
    const canReply = isAdmin || isTeacher || isAssignedUser || isPendingAssignee;

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="Back to list"
                    className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 sm:hidden"
                >
                    <CaretLeft size={18} />
                </button>
                <Avatar className="size-9">
                    <AvatarFallback className="bg-primary-100 text-sm font-semibold text-primary-700">
                        {getInitials(name)}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-neutral-800">{name}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
                        <CategoryCell doubt={doubt} />
                        {batchName && <span className="truncate">{batchName}</span>}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {isSlide && <NavigateCell doubt={doubt} />}
                    <MarkAsResolved doubt={doubt} refetch={refetch} />
                    {isAdmin && <DeleteDoubt doubt={doubt} refetch={refetch} showText={false} />}
                </div>
            </div>

            {/* Assignee */}
            {isAdmin && (
                <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2">
                    <span className="shrink-0 text-xs font-medium text-neutral-500">Assigned</span>
                    <AssigneeCell doubt={doubt} />
                </div>
            )}

            {/* Conversation thread */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                <div className="rounded-lg border border-primary-100 bg-primary-50/40 p-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-neutral-700">
                            {name} · asked
                        </span>
                        <span className="shrink-0 text-caption text-neutral-400">
                            {formatISODateTimeReadable(doubt.raised_time)}
                        </span>
                    </div>
                    <div
                        className="custom-html-content text-sm text-neutral-800"
                        dangerouslySetInnerHTML={{ __html: doubt.html_text || '' }}
                    />
                    {isSlide && (
                        <div className="mt-2">
                            <TimestampCell doubt={doubt} />
                        </div>
                    )}
                </div>

                {(doubt.replies ?? []).map((r) => (
                    <Reply key={r.id} reply={r} refetch={refetch} />
                ))}
            </div>

            {/* Composer */}
            <div className="border-t border-neutral-200 p-3">
                {canReply ? (
                    <AddReply parent={doubt} refetch={refetch} />
                ) : (
                    <p className="px-1 text-center text-xs text-neutral-400">
                        You do not have permission to reply to this doubt.
                    </p>
                )}
            </div>
        </div>
    );
};
