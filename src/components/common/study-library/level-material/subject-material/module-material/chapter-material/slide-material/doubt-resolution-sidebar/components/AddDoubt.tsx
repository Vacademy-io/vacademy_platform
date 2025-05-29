import { MyButton } from "@/components/design-system/button"
import { DoubtType, StudentDetailsType } from "../types/add-doubt-type"
import { getFromStorage } from "@/components/common/LoginPages/sections/login-form";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { useAddDoubt } from "../services/AddDoubt";
import { ArrowUp } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useMediaRefsStore } from "@/stores/mediaRefsStore";

interface AddDoubtProps {
    doubtText: string;
    refetch: () => void;
    setDoubt: (doubt: string) => void;
    setShowInput: (showInput: boolean) => void;
    timestamp?: number;
    formattedTime?: string;
}

export const AddDoubt = ({
    doubtText, 
    refetch, 
    setDoubt, 
    setShowInput, 
    timestamp, 
}: AddDoubtProps) => {

    const {activeItem} = useContentStore();
    const addDoubt = useAddDoubt()
    const { currentPdfPage, currentYoutubeTime, currentUploadedVideoTime } = useMediaRefsStore();
    
    const progressMarker = (() => {
        // If timestamp is provided, use it
        if (timestamp !== undefined) {
            return timestamp;
        }
        
        // Otherwise use current position
        switch(activeItem?.source_type){
            case "DOCUMENT":
                return currentPdfPage;
            case "VIDEO":
                switch(activeItem.video_slide?.source_type){
                case "FILE_ID":
                    return currentUploadedVideoTime*1000;
                default:
                    return currentYoutubeTime*1000;
                }
            default:
                return null;
        }
    })();
    
    const handleAddDoubt = async () => {
        const studentDetails = await getFromStorage("StudentDetails");
        const studentDetailsData: StudentDetailsType = JSON.parse(studentDetails || "{}");
        const doubtData: DoubtType = {
            user_id: studentDetailsData.user_id,
            name: studentDetailsData.full_name,
            source: "SLIDE",
            source_id: activeItem?.id || "",
            raised_time: new Date().toISOString(),
            resolved_time: null,
            content_position: String(progressMarker),
            content_type: (activeItem?.source_type=="DOCUMENT" ? activeItem.document_slide?.type : activeItem?.source_type || "") as string,
            html_text: doubtText,
            status: "ACTIVE",
            parent_id: null,
            parent_level: 0,
            doubt_assignee_request_user_ids: [],
        }

        addDoubt.mutate(doubtData, {
            onSuccess: () => {
                if (setDoubt && setShowInput && refetch) {
                    setDoubt("")
                    setShowInput(false)
                    refetch()
                }
            },
            onError: () => {
                toast.error("Error adding doubt")
            }
        })
    }

    return (
        <MyButton 
            layoutVariant="icon" 
            disable={doubtText.length === 0} 
            onClick={handleAddDoubt}
        >
            <ArrowUp />
        </MyButton>
    )
}