import { CaretUp } from '@phosphor-icons/react';
import { CaretDown } from '@phosphor-icons/react';
import { Doubt } from '../../-types/get-doubts-type';
import { useState } from 'react';
import { AddReply } from './AddReply';
import { Reply } from './reply';
import { getUserId, isUserAdmin } from '@/utils/userDetails';

export const ShowReplies = ({ parent, refetch }: { parent: Doubt; refetch: () => void }) => {
    const [showReplies, setShowReplies] = useState<boolean>(false);
    const userId = getUserId();
    const isAdmin = isUserAdmin();
    const canReply =
        isAdmin ||
        (userId && parent.all_doubt_assignee?.some((assignee) => assignee.id === userId)) ||
        (userId && parent.doubt_assignee_request_user_ids?.includes(userId));

    // Determine if the AddReply component should be shown when there are no replies
    const showAddReplyWithoutReplies = canReply && parent.replies.length === 0;

    return (
        <div className="w-full">
            {parent.replies.length > 0 && (
                <div
                    className="flex cursor-pointer items-center gap-1 text-xs text-primary-500 hover:underline"
                    onClick={() => setShowReplies(!showReplies)}
                >
                    <span>
                        {showReplies ? 'Hide Replies' : 'Show Replies'} ({parent.replies.length})
                    </span>
                    {showReplies ? <CaretUp size={14} /> : <CaretDown size={14} />}
                </div>
            )}

            {showReplies && parent.replies.length > 0 && (
                <div className="mt-2 flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    {parent.replies?.map((reply, key) => (
                        <Reply reply={reply} key={key} refetch={refetch} />
                    ))}
                    {/* Always show AddReply inside the expanded replies section if user can reply */}
                    {canReply && <AddReply parent={parent} refetch={refetch} />}
                </div>
            )}

            {/* Show AddReply directly if there are no replies and user can reply */}
            {showAddReplyWithoutReplies && (
                <div className="mt-2">
                    <AddReply parent={parent} refetch={refetch} />
                </div>
            )}
        </div>
    );
};
