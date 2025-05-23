import { ChapterAccordian } from './chapter-accordian';
import { ModulesWithChaptersProgressType } from '@/routes/manage-students/students-list/-types/student-subjects-details-types';

export const SubjectProgress = ({
    moduleDetails,
}: {
    moduleDetails?: ModulesWithChaptersProgressType | null;
}) => {
    return (
        <>
            {moduleDetails?.chapters ? (
                <div className="flex flex-col gap-10">
                    {moduleDetails?.chapters && (
                        <div className="flex flex-col gap-6">
                            {moduleDetails.chapters.map((chapter, index) => (
                                <ChapterAccordian ChapterDetails={chapter} key={index} />
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <p>No chapter created for this module</p>
            )}
        </>
    );
};
