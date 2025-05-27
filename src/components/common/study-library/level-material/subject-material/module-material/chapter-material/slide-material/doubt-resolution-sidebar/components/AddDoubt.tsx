import { MyButton } from "@/components/design-system/button"
import { DoubtType, StudentDetailsType } from "../types/add-doubt-type"
import { getFromStorage } from "@/components/common/LoginPages/sections/login-form";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { useAddDoubt } from "../services/AddDoubt";
import { ArrowUp } from "@phosphor-icons/react";
import { toast } from "sonner";

export const AddDoubt = ({doubtText, refetch, setDoubt, setShowInput}: {doubtText: string, refetch: () => void, setDoubt: (doubt: string) => void, setShowInput: (showInput: boolean) => void}) => {

    const {activeItem} = useContentStore();
    const addDoubt = useAddDoubt()

    

    
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
            content_position: null,
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
        <MyButton layoutVariant="icon" disable={doubtText.length === 0} onClick={()=>handleAddDoubt()}>
            <ArrowUp />
        </MyButton>
    )
}