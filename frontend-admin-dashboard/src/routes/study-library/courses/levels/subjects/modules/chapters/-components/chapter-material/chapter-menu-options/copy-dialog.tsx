import { StudyMaterialDetailsForm } from "@/routes/study-library/courses/-components/upload-study-material/study-material-details-form";
import { MyDialog } from "@/components/design-system/dialog";
import { useCopyChapter } from "@/routes/study-library/courses/levels/subjects/modules/chapters/-services/copy-move-chapter";
import { useInstituteDetailsStore } from "@/stores/students/students-list/useInstituteDetailsStore";
import { ChapterWithSlides } from "@/stores/study-library/use-modules-with-chapters-store";
import { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

interface CopyTo {
    openDialog: "copy" | "move" | "delete" | "edit" | null;
    setOpenDialog: Dispatch<SetStateAction<"copy" | "move" | "delete" | "edit" | null>>;
    chapter: ChapterWithSlides;
}

export const CopyToDialog = ({ openDialog, setOpenDialog, chapter }: CopyTo) => {
    const copyChapterMutation = useCopyChapter();
    const { getPackageSessionId } = useInstituteDetailsStore();

    const handleCopyChapter = async (data: {
        [x: string]:
            | {
                  id: string;
                  name: string;
              }
            | undefined;
    }) => {
        const packageSessionId = getPackageSessionId({
            courseId: data["course"]?.id || "",
            sessionId: data["session"]?.id || "",
            levelId: data["level"]?.id || "",
        });

        try {
            await copyChapterMutation.mutateAsync({
                packageSessionId: packageSessionId || "",
                moduleId: data["module"]?.id || "",
                chapterId: chapter.chapter.id,
            });
            toast.success("Chapter copied successfully");
            setOpenDialog(null);
        } catch (err) {
            toast.error("Failed to copy chapter");
        }
    };

    return (
        <MyDialog
            heading="Copy to"
            dialogWidth="w-[400px]"
            open={openDialog == "copy"}
            onOpenChange={() => setOpenDialog(null)}
        >
            <StudyMaterialDetailsForm
                fields={["course", "session", "level", "subject", "module"]}
                onFormSubmit={handleCopyChapter}
                submitButtonName="Copy"
            />
        </MyDialog>
    );
};
