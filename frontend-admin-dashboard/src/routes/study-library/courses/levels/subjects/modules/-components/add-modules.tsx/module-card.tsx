import { useRouter } from "@tanstack/react-router";
import { DotsSixVertical } from "phosphor-react";
import { useEffect, useState } from "react";
import { MenuOptions } from "./module-menu-options";
import { MyDialog } from "@/components/design-system/dialog";
import { AddModulesForm } from "./add-modules-form";
import { SortableDragHandle } from "@/components/ui/sortable";
import { Module } from "@/stores/study-library/use-modules-with-chapters-store";
import { getPublicUrl } from "@/services/upload_file";
import { ModulesWithChapters } from "../../../../../../../../stores/study-library/use-modules-with-chapters-store";

interface ModuleCardProps {
    module: ModulesWithChapters;
    onDelete: () => void;
    onEdit: (updatedModule: Module) => void;
}

// Update the ModuleCard component
export const ModuleCard = ({ module, onDelete, onEdit }: ModuleCardProps) => {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const router = useRouter();
    const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);

    const handleCardClick = (e: React.MouseEvent) => {
        if (
            e.target instanceof Element &&
            (e.target.closest(".drag-handle-container") ||
                e.target.closest('[role="menu"]') ||
                e.target.closest('[role="dialog"]'))
        ) {
            return;
        }

        const currentPath = router.state.location.pathname;
        const searchParams = router.state.location.search;
        router.navigate({
            to: `${currentPath}/chapters`,
            search: {
                courseId: searchParams.courseId,
                levelId: searchParams.levelId,
                subjectId: searchParams.subjectId,
                moduleId: module.module.id,
                sessionId: searchParams.sessionId,
            },
        });
    };

    useEffect(() => {
        const fetchImageUrl = async () => {
            if (module.module.thumbnail_id) {
                try {
                    const url = await getPublicUrl(module.module.thumbnail_id);
                    setImageUrl(url);
                } catch (error) {
                    console.error("Failed to fetch image URL:", error);
                }
            }
        };

        fetchImageUrl();
    }, [module.module.thumbnail_id]);

    return (
        <div onClick={handleCardClick} className="cursor-pointer">
            <div
                className={`flex h-[300px] w-full flex-col gap-4 rounded-lg border border-neutral-300 bg-neutral-50 p-3 shadow-md`}
            >
                <div className="flex items-center justify-between text-title font-semibold">
                    <div>{module.module.module_name}</div>
                    <div className="drag-handle-container">
                        <SortableDragHandle
                            variant="ghost"
                            size="icon"
                            className="cursor-grab hover:bg-neutral-100"
                            // onClick={(e) => e.stopPropagation()}
                        >
                            <DotsSixVertical className="size-6" />
                        </SortableDragHandle>
                    </div>
                </div>

                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={module.module.module_name}
                        className="h-[145px] rounded-lg object-cover"
                    />
                ) : (
                    <div className="flex size-full w-full items-center justify-center rounded-lg bg-neutral-100">
                        <span className="text-neutral-400">No Image</span>
                    </div>
                )}

                <div className="flex gap-2 text-body font-semibold">
                    <div className="text-primary-500">{module.chapters.length}</div>
                    <div>Chapters</div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="text-wrap text-body text-neutral-500">
                        {module.module.description}
                    </div>
                    <MenuOptions onDelete={onDelete} onEdit={() => setIsEditDialogOpen(true)} />
                </div>
            </div>

            <MyDialog
                trigger={<></>}
                heading="Edit Module"
                dialogWidth="w-[400px]"
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
            >
                <AddModulesForm
                    initialValues={module.module}
                    onSubmitSuccess={(updatedModule) => {
                        onEdit(updatedModule);
                        setIsEditDialogOpen(false);
                    }}
                />
            </MyDialog>
        </div>
    );
};
