import { StudentSubjectsDetailsTypes } from '../-types/student-subjects-details-types';

/**
 * Overall course-completion % for the learner side-view gauge.
 *
 * This MUST equal the number the learner sees on their own portal/home page.
 * That number is the backend `learner_operation` PACKAGE_SESSION rollup, which
 * is a *nested* average — NOT a flat average of every chapter:
 *
 *   course%  = mean over subjects of subject%          (getPackageSessionCompletionPercentage)
 *   subject% = mean over modules  of module%           (getSubjectCompletionPercentage)
 *   module%  = learner_operation PERCENTAGE_MODULE_COMPLETED (already provided per module)
 *
 * At every level the backend divides by the count of ALL active children (via
 * `SUM(value) / NULLIF(COUNT(...), 0)`), so an untracked child counts as 0 and
 * is still included in the denominator. We mirror that: every returned subject
 * and module is counted, and a missing `percentage_completed` is treated as 0.
 *
 * The previous implementation flat-averaged every chapter (each chapter equal
 * weight, module/subject grouping ignored), which drifts from the learner's
 * number whenever modules/subjects have unequal chapter counts (e.g. admin 73%
 * vs learner 71%). Using the canonical module percentages fixes that.
 */
export default function calculateLearningPercentage(
    subjectsWithChapters: StudentSubjectsDetailsTypes
): number {
    const subjectPercentages: number[] = [];

    subjectsWithChapters.forEach((subject) => {
        const modules = subject.modules ?? [];
        if (modules.length === 0) {
            // Active subject with no active modules → 0, but still counted
            // (matches the backend course-rollup denominator).
            subjectPercentages.push(0);
            return;
        }
        const moduleSum = modules.reduce(
            (sum, module) => sum + (module.percentage_completed ?? 0),
            0
        );
        subjectPercentages.push(moduleSum / modules.length);
    });

    if (subjectPercentages.length === 0) return 0;

    const total = subjectPercentages.reduce((sum, value) => sum + value, 0);
    return total / subjectPercentages.length;
}
