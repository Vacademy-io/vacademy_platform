import { SubjectDefaultImage } from "@/assets/svgs";
import { CompletionStatusComponent } from "@/components/common/completion-status-component";
import { useFileUpload } from "@/hooks/use-file-upload";
import { SubjectType } from "@/stores/study-library/use-study-library-store";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

interface SubjectCardProps {
  subject: SubjectType;
}

export const SubjectCard = ({ subject }: SubjectCardProps) => {
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const { getPublicUrl } = useFileUpload();
  const router = useRouter();

  const handleCardClick = (e: React.MouseEvent) => {
    if (
      e.target instanceof Element &&
      (e.target.closest(".menu-options-container") ||
        e.target.closest(".drag-handle-container") ||
        e.target.closest('[role="menu"]') ||
        e.target.closest('[role="dialog"]'))
    ) {
      return;
    }

    const currentPath = router.state.location.pathname;
    router.navigate({
      to: `${currentPath}/modules`,
      search: {
        subjectId: subject.id,
      },
    });
  };

  useEffect(() => {
    const fetchImageUrl = async () => {
      if (subject.thumbnail_id) {
        try {
          const url = await getPublicUrl(subject.thumbnail_id);
          setImageUrl(url);
        } catch (error) {
          console.error("Failed to fetch image URL:", error);
        }
      }
    };

    fetchImageUrl();
  }, [subject.thumbnail_id]);

  return (
    <div onClick={handleCardClick} className="cursor-pointer w-full h-[280px]">
      <div
        className={`group h-full relative flex flex-col items-center justify-center gap-3 border rounded-xl border-neutral-200 bg-gradient-to-br from-white to-neutral-50/50 hover:from-primary-50/30 hover:to-blue-50/40 hover:border-primary-200/60 transition-all duration-200 px-4 py-3 w-full hover:shadow-sm hover:scale-[1.02]`}
      >
        <div className="h-[65%] w-full">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={subject.subject_name}
              className="size-full rounded-lg object-contain group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <div className="size-full flex items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-lg group-hover:from-primary-100 group-hover:to-blue-100 transition-all duration-200">
              <SubjectDefaultImage />
            </div>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 w-full flex-col">
          <div className="text-sm font-semibold text-neutral-800 group-hover:text-primary-700 transition-colors duration-200 text-center leading-tight">
            {subject.subject_name}
          </div>
          <div className="flex items-center gap-2">
            <CompletionStatusComponent completionPercentage={subject.percentage_completed} />
            <p className="text-xs text-neutral-500 group-hover:text-neutral-600 transition-colors duration-200">
              ({subject.percentage_completed.toFixed(1)}% completed)
            </p>
          </div>
        </div>
        
        {/* Progress bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-200 rounded-b-xl overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-300 ease-out"
            style={{ width: `${subject.percentage_completed}%` }}
          />
        </div>
      </div>
    </div>
  );
};
