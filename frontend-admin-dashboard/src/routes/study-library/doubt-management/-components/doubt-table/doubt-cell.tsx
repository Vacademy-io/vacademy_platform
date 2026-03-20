import { formatTime } from '@/helpers/formatYoutubeVideoTime';
import { Doubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useRouter } from '@tanstack/react-router';
import { Clock, FileText } from '@phosphor-icons/react';

const removeMediaTags = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('img, video').forEach((media) => media.remove());
    return doc.body.innerHTML;
};

export const TimestampCell = ({ doubt }: { doubt: Doubt }) => {
    const getIcon = () => {
        if (doubt.content_type == 'VIDEO') return <Clock weight="fill" />;
        else return <FileText weight="fill" />;
    };

    const getContent = () => {
        if (doubt.content_type == 'VIDEO') return formatTime(Number(doubt.content_position) / 1000);
        else return doubt.content_position;
    };

    const router = useRouter();
    const { getDetailsFromPackageSessionId } = useInstituteDetailsStore();

    const handleTimeStampClick = () => {
        const batch = getDetailsFromPackageSessionId({ packageSessionId: doubt?.batch_id || '' });
        const courseId = batch?.package_dto.id;
        const levelId = batch?.level.id;
        const sessionId = batch?.session.id;
        router.navigate({
            to: '/study-library/courses/course-details/subjects/modules/chapters/slides',
            search: {
                courseId: courseId || '',
                levelId: levelId || '',
                subjectId: doubt.subject_id,
                moduleId: doubt.module_id,
                chapterId: doubt.chapter_id,
                slideId: doubt.source_id,
                sessionId: sessionId || '',
                ...(doubt.content_type === 'VIDEO'
                    ? { timestamp: Number(doubt.content_position) / 1000 }
                    : {}),
                ...(doubt.content_type === 'PDF'
                    ? { currentPage: Number(doubt.content_position) }
                    : {}),
            },
            hash: '',
        });
    };
    return (
        <div className="flex items-center gap-1 text-neutral-400" onClick={handleTimeStampClick}>
            {getIcon()}
            <p className="text-blue-600">{getContent()}</p>
        </div>
    );
};

export const DoubtCell = ({ doubt }: { doubt: Doubt }) => {
    const cleanHtml = removeMediaTags(doubt.html_text);

    return (
        <div className="flex flex-col gap-1">
            <div className="line-clamp-2">
                <div dangerouslySetInnerHTML={{ __html: cleanHtml }} className="text-neutral-800" />
            </div>
            <div className="line-clamp-2 text-neutral-500">Slide: {doubt.source_name}</div>
            <TimestampCell doubt={doubt} />
        </div>
    );
};
