import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { QuestionPaperTemplateFormProps } from '../../../-utils/question-paper-template-form';
import {
    CodingQuestionConfig,
    makeEmptyQuestion,
} from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/utils/code-editor-types';

// PPT/preview rendering: show problem + sample tests + language list. Read-only.
export const CodingQuestionPaperTemplatePPTView = ({
    form,
    currentQuestionIndex,
    className,
}: QuestionPaperTemplateFormProps) => {
    const value =
        (form.getValues(`questions.${currentQuestionIndex}.codingConfig`) as
            | CodingQuestionConfig
            | undefined) || makeEmptyQuestion();

    const visibleTests = (value.testCases || []).filter((t) => t.visible);

    return (
        <div className={className}>
            <div className="flex w-full flex-col gap-3">
                <FormField
                    control={form.control}
                    name={`questions.${currentQuestionIndex}.codingConfig.problemHtml`}
                    render={() => (
                        <FormItem className="w-full">
                            <FormControl>
                                <div
                                    className="prose max-w-none rounded border bg-background p-3"
                                    dangerouslySetInnerHTML={{
                                        __html:
                                            value.problemHtml ||
                                            '<i>(No problem statement)</i>',
                                    }}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-muted px-2 py-1">
                        Languages: {(value.allowedLanguages || []).join(', ') || '—'}
                    </span>
                    <span className="rounded bg-muted px-2 py-1">
                        Max points: {value.maxPoints}
                    </span>
                    <span className="rounded bg-muted px-2 py-1">
                        Tests: {value.testCases?.length || 0}
                    </span>
                </div>

                {visibleTests.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Sample Test Cases</h4>
                        {visibleTests.map((tc, i) => (
                            <div key={tc.id} className="rounded border p-2 text-xs">
                                <div className="font-medium">
                                    {tc.label || `Sample ${i + 1}`}
                                </div>
                                <div className="mt-1 grid grid-cols-2 gap-2">
                                    <div>
                                        <div className="text-muted-foreground">Input</div>
                                        <pre className="whitespace-pre-wrap">{tc.stdin}</pre>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">Expected</div>
                                        <pre className="whitespace-pre-wrap">
                                            {tc.expectedStdout}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
