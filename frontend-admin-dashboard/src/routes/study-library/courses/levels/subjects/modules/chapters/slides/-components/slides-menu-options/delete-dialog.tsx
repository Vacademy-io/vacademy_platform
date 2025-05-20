import { MyButton } from "@/components/design-system/button";
import { MyDialog } from "@/components/design-system/dialog";
import { TokenKey } from "@/constants/auth/tokens";
import { useSlides } from "@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-hooks/use-slides";
import { getTokenDecodedData, getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { useRouter } from "@tanstack/react-router";
import { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

interface DeleteProps {
    openDialog: "copy" | "move" | "delete" | null;
    setOpenDialog: Dispatch<SetStateAction<"copy" | "move" | "delete" | null>>;
}

export const DeleteDialog = ({ openDialog, setOpenDialog }: DeleteProps) => {
    const router = useRouter();
    const searchParams = router.state.location.search;
    const chapterId: string = searchParams.chapterId || "";
    const slideId: string = searchParams.slideId || "";
    const { updateSlideStatus } = useSlides(chapterId);
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];

    const handleDeleteSlide = async () => {
        try {
            await updateSlideStatus({
                chapterId: chapterId,
                slideId: slideId,
                status: "DELETED",
                instituteId: INSTITUTE_ID || "",
            });

            toast.success("Slide deleted successfully!");
            setOpenDialog(null);
        } catch (error) {
            toast.error("Failed to delete the slide");
        }
    };

    return (
        <MyDialog
            heading="Delete"
            dialogWidth="w-[400px]"
            open={openDialog == "delete"}
            onOpenChange={() => setOpenDialog(null)}
        >
            <div className="flex w-full flex-col gap-6">
                <p>Are you sure you want to delete this?</p>
                <MyButton onClick={handleDeleteSlide}>Delete</MyButton>
            </div>
        </MyDialog>
    );
};
