
import { DoubtType, StudentDetailsType } from "../types/add-doubt-type"
import { getFromStorage } from "@/components/common/LoginPages/sections/login-form";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { useAddDoubt } from "../services/AddDoubt";
import { ArrowUp } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useMediaRefsStore } from "@/stores/mediaRefsStore";
import { useEffect, useState } from "react";
import { getPackageSessionId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";

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
    const [packageSessionId, setPackageSessionId] = useState<string | null>(null);

    useEffect(() => {
        const fetchPackageSessionId = async () => {
            const id = await getPackageSessionId();
            setPackageSessionId(id);
        };
        fetchPackageSessionId();
    }, []);
    
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
            batch_id: packageSessionId || "",
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
        <button
            onClick={handleAddDoubt}
            disabled={doubtText.length === 0}
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
                doubtText.length === 0 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
            }`}
        >
            <ArrowUp size={18} />
        </button>
    )
}