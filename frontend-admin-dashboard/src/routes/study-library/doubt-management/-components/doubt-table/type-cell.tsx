import { getIcon } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/slides-sidebar/slides-sidebar-slides';
import { Doubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';

export const TypeCell = ({ doubt }: { doubt: Doubt }) => {
    return (
        <div className="flex items-center gap-1">
            {getIcon(
                doubt.content_type == 'PDF' || doubt.content_type == 'DOC'
                    ? 'DOCUMENT'
                    : doubt.content_type,
                doubt.content_type,
                '5'
            )}
            <p>{doubt.content_type}</p>
        </div>
    );
};
