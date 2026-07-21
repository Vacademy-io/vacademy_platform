import { useEffect, useState } from "react";
import { Doubt } from "../types/get-doubts-type";
import { CaretUp, CaretDown, GraduationCap } from "@phosphor-icons/react";
import { getPublicUrl } from "@/services/upload_file";
import { useGetUserBasicDetails } from "@/services/getBasicUserDetails";
import { SmallDummyProfile } from "@/assets/svgs";
import { formatISODateTimeReadable } from "@/helpers/formatISOTime";
import { getUserId } from "@/constants/getUserId";
import { useTranslation } from "react-i18next";

interface ReplyProps {
    reply: Doubt;
    /**
     * User id of the original doubt's author. When the replier is not this user and not the
     * viewer, we treat them as a teacher/admin and label accordingly — so the student clearly
     * sees who answered.
     */
    raiserUserId?: string;
}

export const Reply = ({ reply, raiserUserId }: ReplyProps) => {
    const { t } = useTranslation("studyContent");
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [showReplies, setShowReplies] = useState<boolean>(true);
    const [viewerUserId, setViewerUserId] = useState<string | null>(null);

    const { data: userBasicDetails } = useGetUserBasicDetails([reply.user_id]);
    const replierName = userBasicDetails?.[0]?.name;

    useEffect(() => {
        const fetchImageUrl = async () => {
            if (userBasicDetails?.[0]?.face_file_id) {
                try {
                    const url = await getPublicUrl(userBasicDetails?.[0]?.face_file_id);
                    setImageUrl(url);
                } catch (error) {
                    console.error("Failed to fetch image URL:", error);
                }
            }
        };
        fetchImageUrl();
    }, [userBasicDetails?.[0]?.face_file_id]);

    useEffect(() => {
        (async () => {
            setViewerUserId(await getUserId());
        })();
    }, []);

    const isSelf = viewerUserId && reply.user_id === viewerUserId;
    const isRaiser = raiserUserId && reply.user_id === raiserUserId;
    const isStaffAnswer = !isSelf && !isRaiser;

    const roleBadge = isSelf ? (
        <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-3xs font-semibold uppercase tracking-wide text-primary-700">
            {t("doubts.roleYou")}
        </span>
    ) : isStaffAnswer ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-3xs font-semibold uppercase tracking-wide text-green-700">
            <GraduationCap size={11} weight="duotone" />
            {t("doubts.roleTeacher")}
        </span>
    ) : null;

    const displayName =
        replierName || (isStaffAnswer ? t("doubts.roleTeacher") : t("doubts.roleUser"));

    return (
        <div className="flex flex-col gap-3 text-regular max-sm:text-caption">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <div className="size-8 overflow-hidden rounded-full bg-neutral-300 sm:size-10">
                        {imageUrl ? (
                            <img
                                src={imageUrl}
                                alt={displayName}
                                className="size-full rounded-lg object-cover"
                            />
                        ) : (
                            <SmallDummyProfile />
                        )}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <p className="text-subtitle font-semibold text-neutral-700">
                                {displayName}
                            </p>
                            {roleBadge}
                        </div>
                        <p className="text-xs text-neutral-500">
                            {formatISODateTimeReadable(reply.raised_time)}
                        </p>
                    </div>
                </div>
            </div>
            <div
                dangerouslySetInnerHTML={{
                    __html: reply.html_text || "",
                }}
                className="custom-html-content"
            />
            {reply.replies.length > 0 && (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <p className="text-caption font-semibold sm:text-body">
                            {t("doubts.replies")}{" "}
                            <span className="text-primary-500">{reply.replies.length}</span>
                        </p>
                        {showReplies === false && (
                            <CaretDown
                                onClick={() => setShowReplies(true)}
                                className="cursor-pointer"
                            />
                        )}
                        {showReplies === true && (
                            <CaretUp
                                onClick={() => setShowReplies(false)}
                                className="cursor-pointer"
                            />
                        )}
                    </div>
                    {showReplies && (
                        <div className="flex flex-col gap-6 rounded-md border border-neutral-300 p-4">
                            {reply.replies.map((subReply, key) => (
                                <Reply
                                    reply={subReply}
                                    raiserUserId={raiserUserId}
                                    key={key}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
