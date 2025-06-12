import { CaretUp, CaretDown } from '@phosphor-icons/react';
import { useState } from 'react';
import { TopicDetails } from './topic-details/topic-details';
import { StatusIcon } from '../status-icon';
import { ChapterWithProgress } from '@/routes/manage-students/students-list/-types/student-subjects-details-types';

export const ChapterAccordian = ({
    ChapterDetails,
    key,
}: {
    ChapterDetails: ChapterWithProgress;
    key: number;
}) => {
    const [expand, setExpand] = useState(false);

    const chapterCompletionStatus: 'done' | 'pending' =
        ChapterDetails.percentage_completed >= 90 ? 'done' : 'pending';

    return (
        <div className="flex">
            <div className="flex w-full cursor-pointer flex-col gap-4 rounded-lg border border-primary-300 p-4">
                <div
                    className="flex w-full items-center justify-between"
                    onClick={() => {
                        setExpand(!expand);
                    }}
                >
                    <div className="flex items-center gap-2">
                        <StatusIcon status={chapterCompletionStatus} />
                        <div>
                            Chapter {key}: {ChapterDetails.chapter_name}
                        </div>
                    </div>
                    <div>{expand ? <CaretUp /> : <CaretDown />}</div>
                </div>
                {expand && <TopicDetails chapterDetails={ChapterDetails} />}
            </div>
        </div>
    );
};
