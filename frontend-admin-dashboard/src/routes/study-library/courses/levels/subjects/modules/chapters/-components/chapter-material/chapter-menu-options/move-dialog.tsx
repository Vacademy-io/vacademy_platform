import { StudyMaterialDetailsForm } from "@/routes/study-library/courses/-components/upload-study-material/study-material-details-form";
import { MyDialog } from "@/components/design-system/dialog";
import { useMoveChapter } from "@/routes/study-library/courses/levels/subjects/modules/chapters/-services/copy-move-chapter";
import { useInstituteDetailsStore } from "@/stores/students/students-list/useInstituteDetailsStore";
import { useSelectedSessionStore } from "@/stores/study-library/selected-session-store";
import { ChapterWithSlides } from "@/stores/study-library/use-modules-with-chapters-store";
import { useRouter } from "@tanstack/react-router";
import { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

interface MoveTo {
    openDialog: "copy" | "move" | "delete" | "edit" | null;
    setOpenDialog: Dispatch<SetStateAction<"copy" | "move" | "delete" | "edit" | null>>;
    chapter: ChapterWithSlides;
}

export const MoveToDialog = ({ openDialog, setOpenDialog, chapter }: MoveTo) => {
    const moveChapterMutation = useMoveChapter();
    const { getPackageSessionId } = useInstituteDetailsStore();
    const { selectedSession } = useSelectedSessionStore();
    const router = useRouter();

    const handleMoveChapter = async (data: {
        [x: string]:
            | {
                  id: string;
                  name: string;
              }
            | undefined;
    }) => {
        const searchParams = router.state.location.search;
        const existingPackageSessionId = getPackageSessionId({
            courseId: searchParams.courseId || "",
            sessionId: selectedSession?.id || "",
            levelId: searchParams.levelId || "",
        });
        const newPackageSessionId = getPackageSessionId({
            courseId: data["course"]?.id || "",
            sessionId: data["session"]?.id || "",
            levelId: data["level"]?.id || "",
        });

        try {
            await moveChapterMutation.mutateAsync({
                existingPackageSessionId: existingPackageSessionId || "",
                newPackageSessionId: newPackageSessionId || "",
                moduleId: data["module"]?.id || "",
                chapterId: chapter.chapter.id,
            });
            toast.success("Chapter moved successfully");
            setOpenDialog(null);
        } catch (err) {
            toast.error("Failed to move chapter");
        }
    };

    return (
        <MyDialog
            heading="Move to"
            dialogWidth="w-[400px]"
            open={openDialog == "move"}
            onOpenChange={() => setOpenDialog(null)}
        >
            <StudyMaterialDetailsForm
                fields={["course", "session", "level", "subject", "module"]}
                onFormSubmit={handleMoveChapter}
                submitButtonName="Move"
            />
        </MyDialog>
    );
};
