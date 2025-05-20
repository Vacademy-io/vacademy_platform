import { LevelWithDetailsType } from "@/stores/study-library/use-study-library-store";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { LevelMenuOptions } from "./level-menu-options";
import { AddLevelData } from "./add-level-form";

export const LevelCard = ({
    level,
    onDelete,
    onEdit,
}: {
    level: LevelWithDetailsType;
    onDelete: (levelId: string) => void;
    onEdit: ({ requestData }: { requestData: AddLevelData }) => void;
}) => {
    const navigate = useNavigate();
    const router = useRouter();

    const currentPath = router.state.location.pathname;
    const { courseId } = router.state.location.search;

    const handleLevelCardClick = (e: React.MouseEvent) => {
        if (
            e.target instanceof Element &&
            (e.target.closest(".menu-options-container") ||
                e.target.closest(".drag-handle-container") ||
                e.target.closest('[role="menu"]') ||
                e.target.closest('[role="dialog"]'))
        ) {
            return;
        }

        navigate({
            to: `${currentPath}/subjects`,
            search: {
                courseId: courseId,
                levelId: level.id,
            },
        });
    };

    return (
        <div
            className={`relative flex h-[100px] w-full cursor-pointer items-center gap-4 rounded-xl border border-neutral-200 bg-neutral-50 py-5`}
            onClick={handleLevelCardClick}
        >
            <div className="flex w-full items-end justify-between gap-3 px-5">
                <div className="flex flex-col text-wrap">
                    <p className="text-subtitle font-semibold text-neutral-600">{level.name}</p>
                    <p className="text-caption text-neutral-400">
                        Duration: {level.duration_in_days} days
                    </p>
                </div>
                <LevelMenuOptions
                    onDelete={onDelete}
                    onEdit={onEdit}
                    levelId={level.id}
                    level={level}
                />
            </div>
        </div>
    );
};
