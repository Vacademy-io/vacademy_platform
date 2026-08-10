import { useNavigate, useRouter } from "@tanstack/react-router";
import { BookOpenText, PlayCircle  } from "@phosphor-icons/react";
import { CheckCircle } from "@phosphor-icons/react";
import { Chapter } from "@/stores/study-library/use-modules-with-chapters-store";
import { CompletionStatusComponent } from "@/components/common/completion-status-component";
import { toTitleCase } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { getAuthoredChapterDescription } from "@/constants/chapter-description";
import { useShowContentDescriptions } from "@/hooks/use-content-descriptions";
import { DownloadNodeButton } from "@/components/common/offline/download-node-button";

export const ChapterCard = ({ chapter }: {chapter: Chapter}) => {
    const { t } = useTranslation("studyContent");
    const showDescription = useShowContentDescriptions();
    const description = showDescription
        ? getAuthoredChapterDescription(chapter.description)
        : "";
    const router = useRouter();
    const {  subjectId, moduleId, sessionId } = router.state.location.search as {
        subjectId?: string;
        moduleId?: string;
        sessionId?: string;
    };
    const navigate = useNavigate();

    const handleCardClick = (e: React.MouseEvent) => {
        if (
            (e.target as HTMLElement).closest(".menu-options-container") ||
            (e.target as HTMLElement).closest('[role="menu"]') ||
            (e.target as HTMLElement).closest(".drag-handle-container") ||
            (e.target as HTMLElement).closest('[role="dialog"]')
        ) {
            return;
        }

        const currentPath = router.state.location.pathname;

        navigate({
            to: `${currentPath}/slides`,
            search: {
                subjectId: subjectId,
                moduleId: moduleId,
                chapterId: chapter.id,
                slideId: chapter.last_slide_viewed,
            },
        });
    };

    return (
        <div onClick={handleCardClick} className="w-full cursor-pointer">
            <div className="flex w-full flex-col justify-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center justify-between text-body font-semibold">
                        <div>{toTitleCase(chapter.chapter_name)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <CompletionStatusComponent completionPercentage={chapter.percentage_completed} />
                        <p className="text-body text-neutral-500">{t("progress.percentCompletedParenthetical", { percent: chapter.percentage_completed.toFixed(2) })}</p>
                        <DownloadNodeButton nodeId={chapter.id} nodeType="CHAPTER" packageSessionId={sessionId} />
                    </div>
                </div>
                {description && (
                    <p
                        className="line-clamp-2 break-words text-caption text-neutral-500"
                        title={description}
                    >
                        {description}
                    </p>
                )}
                <div className="flex items-center justify-between">
                    <div className="flex gap-4 text-body font-semibold">
                        <div className="flex items-center gap-2">
                            <BookOpenText />
                            <div className="text-primary-500">{chapter.pdf_count + chapter.doc_count || 0}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <PlayCircle  />
                            <div className="text-primary-500">{chapter.video_count || 0}</div>
                        </div>
                    </div>
                    {chapter.percentage_completed==100 &&
                        <CheckCircle size={20} weight="fill" className="text-success-600 " />
                    }
                </div>
            </div>
        </div>
    );
};
