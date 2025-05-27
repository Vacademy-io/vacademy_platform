import { useEffect, useState } from "react";
import { Doubt } from "../types/get-doubts-type"
import { CaretUp } from "@phosphor-icons/react";
import { CaretDown } from "@phosphor-icons/react";
import { getPublicUrl } from "@/services/upload_file";
import { useGetUserBasicDetails } from "@/services/getBasicUserDetails";

export const Reply = ({reply}:{reply: Doubt}) => {

    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [showReplies, setShowReplies] = useState<boolean>(false);


    const { data: userBasicDetails } = useGetUserBasicDetails([reply.user_id]);

    useEffect(() => {
        const fetchImageUrl = async () => {
            if (userBasicDetails?.[0]?.face_file_id) {
                try {
                    const url = await getPublicUrl(userBasicDetails?.[0]?.face_file_id);
                    setImageUrl(url);
                } catch (error) {
                    console.error('Failed to fetch image URL:', error);
                }
            }
        };

        fetchImageUrl();
    }, [userBasicDetails?.[0]?.face_file_id]);
      
    return (
        <div className="flex flex-col gap-3 text-regular max-sm:text-caption">
            <div className="flex gap-2 sm:items-center justify-between sm:flex-row flex-col">
                <div className="flex gap-2 items-center">
                    <div className="sm:w-10 sm:h-10 w-8 h-8 rounded-full bg-neutral-300">
                        {/* add image here */}
                        {imageUrl ? (
                            <img
                            src={imageUrl}
                            alt={reply.name}
                            className="size-full rounded-lg object-cover "
                            />
                        ) : (
                            <></>
                        )}
                    </div>
                    <p className="text-subtitle text-neutral-700 font-semibold">{reply.name}</p>
                    {/* <StatusChip text={reply.role_type} textSize="text-caption" status="INFO" showIcon={false}/> */}
                </div>
                <div className="flex items-center gap-3 text-neutral-500 text-body">
                    <p>{reply.raised_time}</p>
                </div>
            </div>
            {/* <p>{reply.reply_text}</p> */}
            <div
                dangerouslySetInnerHTML={{
                    __html:reply.html_text || '',
                }}
                className="custom-html-content"
            />
            {reply.replies.length>0 &&
                <div className="flex flex-col gap-1">
                    <div className="flex gap-2 items-center">
                        <p className="sm:text-body text-caption font-semibold">Replies <span className="text-primary-500">{reply.replies.length}</span></p>
                        {showReplies==false && <CaretDown onClick={() => setShowReplies(true)} className="cursor-pointer"/>}
                        {showReplies==true && <CaretUp onClick={() => setShowReplies(false)} className="cursor-pointer"/>}
                    </div>
                    {showReplies &&
                        <div className="flex flex-col gap-6 p-4 border border-neutral-300 rounded-md">
                            {reply.replies.map((subReply, key) => (
                                <Reply reply={subReply} key={key} />
                            ))}
                        </div>
                    }
                </div>
            }
        </div>
    )
}