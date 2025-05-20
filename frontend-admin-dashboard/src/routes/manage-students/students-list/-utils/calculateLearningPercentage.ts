import { StudentSubjectsDetailsTypes } from '../-types/student-subjects-details-types';

export default function calculateLearningPercentage(
    subjectsWithChapters: StudentSubjectsDetailsTypes
): number {
    let totalPercentage = 0;
    let totalChapters = 0;

    subjectsWithChapters.forEach((subject) => {
        subject.modules.forEach((module) => {
            module.chapters.forEach((chapter) => {
                totalChapters += 1;
                totalPercentage += chapter.percentage_completed;
            });
        });
    });

    if (totalChapters == 0) return 0;
    const percentage = totalPercentage / totalChapters;
    return percentage;
}
