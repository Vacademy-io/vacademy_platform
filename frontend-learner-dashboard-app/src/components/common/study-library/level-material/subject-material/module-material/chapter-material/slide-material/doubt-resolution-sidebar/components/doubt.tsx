import { useState, useEffect } from "react";
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
    const [showReplies, setShowReplies] = useState<boolean>(true);
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
            <div className="bg-white rounded-xl border border-gray-200/60 p-5 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-gray-300/80 group">
                <div className="flex flex-col gap-4">
                    {/* Enhanced Header */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="relative flex-shrink-0">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden ring-2 ring-white shadow-sm">
                                    {imageUrl ? (
                                        <img
                                            src={imageUrl}
                                            alt={doubt.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <SmallDummyProfile />
                                        </div>
                                    )}
                                </div>
                                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${doubt.status === "RESOLVED" ? "bg-green-500" : "bg-amber-500"}`}></div>
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                                <h4 className="font-semibold text-gray-900 text-sm leading-tight truncate">
                                    {userBasicDetails?.[0].name}
                                </h4>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {formatISODateTimeReadable(doubt.raised_time)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <StatusChip 
                                text={doubt.status === "RESOLVED" ? "Resolved" : "Pending"} 
                                textSize="text-xs" 
                                status={doubt.status === "RESOLVED" ? "SUCCESS" : "INFO"} 
                            />
                        </div>
                    </div>
                    {/* Content Section */}
                    <div className="flex flex-col gap-4">
                        {/* Timestamp/Page Section */}
                        {(activeItem?.source_type=="VIDEO" || activeItem?.source_type=="DOCUMENT") && (
                            <div className="flex items-center justify-between">
                                <div 
                                    onClick={()=>handleTimeStampClick(parseInt(doubt.content_position || "0"))}
                                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 cursor-pointer transition-all duration-200 hover:shadow-sm group/timestamp"
                                >
                                    <div className="text-sm font-medium text-gray-700">
                                        {activeItem?.source_type=="VIDEO"? "Timestamp" : "Page"}: 
                                    </div>
                                    <div className="text-sm font-semibold text-primary-600">
                                        {activeItem?.source_type=="VIDEO" 
                                            ? formatTime(parseInt(doubt.content_position || "0")/1000) 
                                            : `Page ${parseInt(doubt.content_position || "0") + 1}`
                                        }
                                    </div>
                                    <ArrowSquareOut 
                                        size={16} 
                                        className="text-gray-400 group-hover/timestamp:text-primary-500 transition-colors" 
                                    />   
                                </div>
                                {userId && doubt.user_id === userId && doubt.replies.length > 0 && ( 
                                    <MarkAsResolved doubt={doubt} refetch={refetch}/>
                                )}
                            </div>
                        )}

                        {/* Doubt Content */}
                        <div
                            dangerouslySetInnerHTML={{
                                __html:doubt.html_text || '',
                            }}
                            className="custom-html-content text-gray-700 text-sm leading-relaxed bg-gray-50/50 rounded-lg p-4 border border-gray-100"
                        />

                        {/* Actions for own doubts */}
                        {doubt.user_id == userId && doubt.replies.length == 0 && (
                            <div className="flex justify-end">
                                <DeleteDoubt doubt={doubt} refetch={refetch} />
                            </div>
                        )}
                    </div>
                </div>
                {/* Replies Section */}
                {doubt.replies.length > 0 && (
                    <div className="flex flex-col gap-3 mt-2">
                        <button 
                            onClick={() => setShowReplies(!showReplies)}
                            className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg transition-colors w-fit group/replies"
                        >
                            <p className="text-sm font-semibold text-gray-700">
                                Replies <span className="text-primary-500 bg-primary-50 px-2 py-0.5 rounded-full text-xs ml-1">{doubt.replies.length}</span>
                            </p>
                            {showReplies ? (
                                <CaretUp size={16} className="text-gray-500 group-hover/replies:text-gray-700 transition-colors"/>
                            ) : (
                                <CaretDown size={16} className="text-gray-500 group-hover/replies:text-gray-700 transition-colors"/>
                            )}
                        </button>
                        {showReplies && (
                            <div className="space-y-4 pl-4 border-l-2 border-gray-200 ml-2 animate-in slide-in-from-top-2 duration-200">
                                {doubt.replies.map((reply, key) => (
                                    <div key={key} className="animate-in fade-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${key * 100}ms` }}>
                                        <Reply reply={reply} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    )
}