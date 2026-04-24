import { useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TipTapEditor } from '@/components/tiptap/TipTapEditor';
import { TestCaseList } from './TestCaseList';
import { QuestionSettingsForm } from './QuestionSettingsForm';
import { StarterCodeEditor } from './StarterCodeEditor';
import { SubmissionsReport } from './SubmissionsReport';
import type { CodingQuestionConfig, CodingTestCase } from '../utils/code-editor-types';

interface Props {
    question: CodingQuestionConfig;
    onChange: (next: CodingQuestionConfig) => void;
    disabled?: boolean;
    // The slide id this question belongs to. When present, the Submissions tab
    // is rendered (admin reporting). Absent on brand-new slides that haven't
    // been saved yet — the tab simply hides itself.
    slideId?: string;
}

export function QuestionEditor({ question, onChange, disabled, slideId }: Props) {
    const setProblemHtml = useCallback(
        (html: string) => {
            onChange({ ...question, problemHtml: html });
        },
        [question, onChange]
    );

    const setTestCases = useCallback(
        (testCases: CodingTestCase[]) => {
            onChange({ ...question, testCases });
        },
        [question, onChange]
    );

    return (
        <div className="border-t bg-muted/30 p-3">
            <Tabs defaultValue="problem">
                <TabsList>
                    <TabsTrigger value="problem">Problem</TabsTrigger>
                    <TabsTrigger value="testcases">
                        Test Cases ({question.testCases.length})
                    </TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="starter">Starter Code</TabsTrigger>
                    {slideId && <TabsTrigger value="submissions">Submissions</TabsTrigger>}
                </TabsList>

                <TabsContent value="problem" className="mt-3">
                    <div className="rounded border bg-background p-2">
                        <TipTapEditor
                            value={question.problemHtml}
                            onChange={setProblemHtml}
                            placeholder="Describe the problem. Include constraints, input/output format, and examples."
                            minHeight={200}
                            editable={!disabled}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="testcases" className="mt-3">
                    <TestCaseList
                        testCases={question.testCases}
                        onChange={setTestCases}
                        disabled={disabled}
                    />
                </TabsContent>

                <TabsContent value="settings" className="mt-3">
                    <QuestionSettingsForm
                        question={question}
                        onChange={onChange}
                        disabled={disabled}
                    />
                </TabsContent>

                <TabsContent value="starter" className="mt-3">
                    <StarterCodeEditor
                        question={question}
                        onChange={onChange}
                        disabled={disabled}
                    />
                </TabsContent>

                {slideId && (
                    <TabsContent value="submissions" className="mt-3">
                        <SubmissionsReport slideId={slideId} />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
