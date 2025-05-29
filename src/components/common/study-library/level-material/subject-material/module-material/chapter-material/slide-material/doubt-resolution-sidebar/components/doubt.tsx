import { useEffect, useState } from "react";
import { getUserId } from "@/constants/getUserId";
import { ArrowSquareOut, CaretUp } from "@phosphor-icons/react";
import { CaretDown } from "@phosphor-icons/react";
import { Reply } from "./reply";
import { StatusChip } from "@/components/design-system/status-chips";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { useSidebar } from "@/components/ui/sidebar";
import { Doubt as DoubtType, DoubtFilter } from "../types/get-doubts-type";
import { formatISODateTimeReadable } from "@/helpers/formatISOTime";
import { DeleteDoubt } from "./DeleteDoubt";
import { MarkAsResolved } from "./MarkAsResolved";
import { useGetUserBasicDetails } from "@/services/getBasicUserDetails";
import { getPublicUrl } from "@/services/upload_file";
import { formatTime } from "../../youtube-player";
import { SmallDummyProfile } from "@/assets/svgs";
    import { useMediaRefsStore } from "@/stores/mediaRefsStore";

export const Doubt = ({doubt, refetch}:{doubt:DoubtType, filter:DoubtFilter, refetch: () => void}) => {
    
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    // const imageUrl: string | null = null;
    const [userId, setUserId] = useState<string | null>(null);
    const [showReplies, setShowReplies] = useState<boolean>(false);
    const {activeItem, setActiveItem} = useContentStore();
    const {setOpen} = useSidebar();
    const { navigateToPdfPage } = useMediaRefsStore();

    const handleTimeStampClick = (timestamp: number) => {
        if (activeItem?.source_type === "DOCUMENT") {
            // For documents, use the PDF navigation function
            navigateToPdfPage(timestamp);
        } else {
            // For videos, update the progress marker as before
            setActiveItem({
                id: activeItem?.id || "",
                source_id: activeItem?.source_id || "",
                source_type: activeItem?.source_type || "",
                title: activeItem?.title || "",
                image_file_id: activeItem?.image_file_id || "",
                description: activeItem?.description || "",
                status: activeItem?.status || "",
                slide_order: activeItem?.slide_order || 0,
                video_slide: activeItem?.video_slide || undefined,
                document_slide: activeItem?.document_slide || undefined,
                question_slide: activeItem?.question_slide || undefined,
                assignment_slide: activeItem?.assignment_slide || undefined,
                is_loaded: activeItem?.is_loaded || false,
                new_slide: false,
                percentage_completed: 0,
                progress_marker: timestamp
            });
        }
        setOpen(false);
    }

    const { data: userBasicDetails } = useGetUserBasicDetails([doubt.user_id]);

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
   

    useEffect(() => {
        const fetchUserId = async () => {
            const id = await getUserId();
            setUserId(id);
        };
        fetchUserId();
    }, []);
    

    
    return (
        <>
            <div className="lg:px-3 md:px-1 py-3 px-3 flex flex-col gap-3 rounded-lg max-sm:text-caption">
                <div className="flex flex-col gap-2">
                    <div className="flex sm:items-center justify-between sm:flex-row flex-col gap-2">
                        <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-neutral-300 sm:size-10">
                            {/* add image here */}
                            {imageUrl ? (
                                <img
                                    src={imageUrl}
                                    alt={doubt.name}
                                    className="size-full rounded-lg object-cover "
                                />
                            ) : (
                                <SmallDummyProfile />
                            )}
                        </div>
                            <div className="text-subtitle text-lg text-neutral-700 font-semibold">
                            {userBasicDetails?.[0].name}
                            </div>
                        </div>
                        <div className="flex gap-3 items-center">
                            <StatusChip text={doubt.status === "RESOLVED" ? "Resolved" : "Unresolved"} textSize="text-caption" status={doubt.status === "RESOLVED" ? "SUCCESS" : "INFO"} />
                            <p className="text-neutral-500 sm:text-body text-caption">{formatISODateTimeReadable(doubt.raised_time)}</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                    {(activeItem?.source_type=="VIDEO" || activeItem?.source_type=="DOCUMENT") &&
                        <div className="flex items-center justify-between">
                            <div className="flex gap-1 items-center justify-center line-clamp-[1rem]">
                                <p className="text-body font-semibold text-neutral-500"><span className="font-semibold text-neutral-600">Timestamp: </span>{activeItem?.source_type=="VIDEO" ? formatTime(parseInt(doubt.content_position || "0")/1000) : parseInt(doubt.content_position || "0") + 1 }</p>
                                <ArrowSquareOut className="cursor-pointer" onClick={()=>handleTimeStampClick(parseInt(doubt.content_position || "0"))}/>   
                            </div>
                            {userId && doubt.user_id === userId && doubt.replies.length>0 && ( 
                            <MarkAsResolved doubt={doubt} refetch={refetch}/>
                            )}
                        </div>
                    }
                    <div
                        dangerouslySetInnerHTML={{
                            __html:doubt.html_text || '',
                        }}
                        className="custom-html-content text-neutral-500"
                    />
                    {doubt.user_id==userId && doubt.replies.length==0 && 
                       <DeleteDoubt doubt={doubt} refetch={refetch} />
                    }
                    </div>
                </div>
                {doubt.replies.length>0 &&
                    <div className="flex flex-col gap-1">
                        <div className="flex gap-2 items-center">
                            <p className="sm:text-body text-caption font-semibold">Replies <span className="text-primary-500">{doubt.replies.length}</span></p>
                            {showReplies==false && <CaretDown onClick={() => setShowReplies(true)} className="cursor-pointer"/>}
                            {showReplies==true && <CaretUp onClick={() => setShowReplies(false)} className="cursor-pointer"/>}
                        </div>
                        {showReplies &&
                            <div className="flex flex-col gap-6 p-4 border border-neutral-300 rounded-md">
                                {doubt.replies.map((reply, key) => (
                                    <Reply reply={reply} key={key} />
                                ))}
                            </div>
                        }
                    </div>
                }
            </div>
        </>
    )
}