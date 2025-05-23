import { useSidebar } from "@/components/ui/sidebar";
import { getPublicUrl } from "@/services/upload_file";
import { ModulesWithChapters } from "@/stores/study-library/use-modules-with-chapters-store";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ModuleDefaultImage } from "@/assets/svgs";
import { CompletionStatusComponent } from "@/components/common/completion-status-component";

export const ModuleCard = ({ module }: { module: ModulesWithChapters}) => {

    const router = useRouter();
    const { open } = useSidebar();
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
                subjectId: searchParams.subjectId,
                moduleId: module.module.id,
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
        <div onClick={handleCardClick} className="cursor-pointer w-full items-center flex justify-center h-[380px]">
            <div
                className={`flex w-[310px] xs:w-[340px] sm:w-full ${open ? "md-tablet:w-[270px]" : "md-tablet:w-[340px]"} h-full flex-col gap-4 rounded-lg border border-neutral-300 p-6`}
            >
                <div className="flex items-center justify-between text-title font-semibold">
                    <div>{module.module.module_name}</div>
                </div>

                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={module.module.module_name}
                        className="w-full rounded-lg object-cover h-[70%]"
                    />
                ) : (
                    <div className="flex w-full items-center justify-center rounded-lg bg-neutral-100 h-[80%]">
                         <ModuleDefaultImage />
                     </div>
                )}

                <div className="w-full flex justify-between">
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2 text-subtitle font-semibold">
                            <div className="text-primary-500">{module.chapters.length}</div>
                            <div>Chapters</div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="text-caption text-neutral-500">{module.module.description}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <CompletionStatusComponent completionPercentage={module.percentage_completed} />
                        <p className="text-neutral-500 text-body">{module.percentage_completed}% completed</p>
                    </div>
                </div>
            </div>
        </div>
    )
}