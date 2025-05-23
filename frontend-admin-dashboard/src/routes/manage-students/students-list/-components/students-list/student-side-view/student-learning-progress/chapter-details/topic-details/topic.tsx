// components/topic.tsx
import { MyButton } from '@/components/design-system/button';
import { useActivityStatsStore } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-stores/activity-stats-store';
import { SlideWithStatusType } from '@/routes/manage-students/students-list/-types/student-slides-progress-type';
import { useEffect, useState } from 'react';
import { ActivityLogDialog } from '../../../../../../../../../components/common/student-slide-tracking/activity-log-dialog';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { FileDoc } from 'phosphor-react';
import { FilePdf } from 'phosphor-react';
import { PlayCircle } from 'phosphor-react';

interface TopicProps {
    slideData: SlideWithStatusType;
    status?: 'done' | 'pending';
}

export const SlideIcon = ({ slideData, status }: TopicProps) => {
    const className = status == 'done' ? 'text-success-600' : 'text-neutral-500';
    if (slideData.source_type == 'DOCUMENT') {
        if (slideData.document_type == 'PDF') {
            return <FilePdf className={`${className}`} size={20} />;
        } else {
            return <FileDoc className={`${className}`} size={20} />;
        }
    } else if (slideData.source_type == 'VIDEO') {
        return <PlayCircle className={`${className}`} size={20} />;
    }
    return <></>;
};

export const Topic = ({ slideData }: TopicProps) => {
    const store = useActivityStatsStore.getState();
    const [chapterCompletionStatus, setChapterCompletionStatus] = useState<'done' | 'pending'>(
        'pending'
    );
    const { selectedStudent } = useStudentSidebar();

    const handleOpenDialog = () => {
        store.openDialog(selectedStudent?.user_id || '');
    };

    useEffect(() => {
        const status: 'done' | 'pending' =
            slideData.source_type == 'DOCUMENT'
                ? slideData.percentage_document_watched &&
                  slideData.percentage_document_watched >= '90'
                    ? 'done'
                    : 'pending'
                : slideData.percentage_video_watched && slideData.percentage_video_watched >= '90'
                  ? 'done'
                  : 'pending';
        setChapterCompletionStatus(status);
    }, [slideData]);

    return (
        <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2 text-body">
                <div className="flex gap-2">
                    <SlideIcon slideData={slideData} status={chapterCompletionStatus} />
                    <div>{slideData.slide_title}</div>
                </div>
                <div>
                    Last viewed on:{' '}
                    {slideData.video_url == null
                        ? slideData.document_last_updated
                        : slideData.video_last_updated}
                </div>
            </div>
            <div>
                <MyButton
                    buttonType="secondary"
                    layoutVariant="default"
                    scale="small"
                    onClick={handleOpenDialog}
                >
                    Activity Log
                </MyButton>
                <ActivityLogDialog selectedUser={selectedStudent} slideData={slideData} />
            </div>
        </div>
    );
};
