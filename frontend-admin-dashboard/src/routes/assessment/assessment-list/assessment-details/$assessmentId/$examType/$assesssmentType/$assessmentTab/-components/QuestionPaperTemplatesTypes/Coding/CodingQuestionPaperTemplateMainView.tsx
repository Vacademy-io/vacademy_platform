import { useEffect } from 'react';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { SectionQuestionPaperFormProps } from '../../../-utils/assessment-question-paper';
import { QuestionEditor } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/coding-question/QuestionEditor';
import {
    CodingQuestionConfig,
    makeEmptyQuestion,
} from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/utils/code-editor-types';

function ensureCompleteConfig(
    raw: Partial<CodingQuestionConfig> | undefined | null
): CodingQuestionConfig {
    const defaults = makeEmptyQuestion();
    return {
        ...defaults,
        ...(raw ?? {}),
        allowedLanguages:
            raw?.allowedLanguages && raw.allowedLanguages.length > 0
                ? raw.allowedLanguages
                : defaults.allowedLanguages,
        starterCode: raw?.starterCode ?? defaults.starterCode,
        testCases: raw?.testCases ?? defaults.testCases,
        perRunLimits: raw?.perRunLimits ?? defaults.perRunLimits,
        sessionTimeMinutes:
            raw?.sessionTimeMinutes === undefined
                ? defaults.sessionTimeMinutes
                : raw.sessionTimeMinutes,
        problemHtml: raw?.problemHtml ?? defaults.problemHtml,
        maxPoints: typeof raw?.maxPoints === 'number' ? raw.maxPoints : defaults.maxPoints,
    };
}

export const CodingQuestionPaperTemplateMainView = ({
    form,
    currentQuestionIndex,
    className,
    selectedSectionIndex,
}: SectionQuestionPaperFormProps) => {
    const fieldName =
        `sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.codingConfig` as const;

    useEffect(() => {
        const current = form.getValues(fieldName) as
            | Partial<CodingQuestionConfig>
            | undefined;
        const complete = ensureCompleteConfig(current);
        if (!current || JSON.stringify(current) !== JSON.stringify(complete)) {
            form.setValue(
                fieldName,
                { ...complete, evaluationMode: 'AUTO' } as never,
                {
                    shouldDirty: false,
                    shouldTouch: false,
                    shouldValidate: false,
                }
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentQuestionIndex, selectedSectionIndex]);

    return (
        <div className={className}>
            <FormField
                control={form.control}
                name={fieldName}
                render={({ field }) => (
                    <FormItem className="w-full">
                        <FormControl>
                            <QuestionEditor
                                question={ensureCompleteConfig(
                                    field.value as Partial<CodingQuestionConfig> | undefined
                                )}
                                onChange={(next) => {
                                    field.onChange(next);
                                    // Mirror problem statement into the
                                    // schema-level questionName so the
                                    // "Question isn't complete" tooltip
                                    // clears once the admin writes the
                                    // problem.
                                    form.setValue(
                                        `sections.${selectedSectionIndex}.questions.${currentQuestionIndex}.questionName`,
                                        next.problemHtml || '',
                                        {
                                            shouldDirty: true,
                                            shouldTouch: true,
                                            shouldValidate: true,
                                        }
                                    );
                                }}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
};
