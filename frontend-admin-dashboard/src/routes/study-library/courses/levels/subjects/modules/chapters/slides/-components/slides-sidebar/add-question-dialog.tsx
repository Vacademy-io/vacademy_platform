import { MCQS, MCQM, Numerical, TrueFalse, LongAnswer, SingleWord, CMCQS, CMCQM } from '@/svgs';
import { QuestionType as QuestionTypeList } from '@/constants/dummy-data';
import { Separator } from '@/components/ui/separator';
import { z } from 'zod';
import { questionsFormSchema } from '@/routes/assessment/question-papers/-utils/question-form-schema';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UploadQuestionPaperFormType } from '@/routes/assessment/question-papers/-components/QuestionPaperUpload';
import { uploadQuestionPaperFormSchema } from '@/routes/assessment/question-papers/-utils/upload-question-paper-form-schema';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MyInput } from '@/components/design-system/input';
import { MyButton } from '@/components/design-system/button';
import { useState } from 'react';
import { useContentStore } from '../../-stores/chapter-sidebar-store';
import { toast } from 'sonner';
import { useSlides } from '../../-hooks/use-slides';
import { Route } from '../..';
import { convertToQuestionSlideFormat } from '../../-helper/helper';

export interface QuestionTypeProps {
    icon: React.ReactNode; // Accepts an SVG or any React component
    text: string; // Accepts the text label
    type?: QuestionTypeList;
    handleAddQuestion: (
        type: string,
        questionPoints: string | undefined,
        reattemptCount: string | undefined
    ) => void;
}

export type QuestionPaperFormType = z.infer<typeof questionsFormSchema>;

const AddQuestionDialog = ({
    openState,
}: {
    openState?: ((open: boolean) => void) | undefined;
}) => {
    const { setActiveItem, getSlideById } = useContentStore();
    const form = useForm<UploadQuestionPaperFormType>({
        resolver: zodResolver(uploadQuestionPaperFormSchema),
        mode: 'onChange',
        defaultValues: {
            questionPaperId: '1',
            isFavourite: false,
            title: '',
            createdOn: new Date(),
            yearClass: '',
            subject: '',
            questionsType: '',
            optionsType: '',
            answersType: '',
            explanationsType: '',
            fileUpload: undefined,
            questions: [],
        },
    });

    const { chapterId } = Route.useSearch();
    const { updateQuestionOrder } = useSlides(chapterId);
    const [title, setTitle] = useState('');
    const [localReattempts, setLocalReattempts] = useState('');
    const [activeQuestionDialog, setActiveQuestionDialog] = useState<QuestionTypeList | null>(null);

    const QuestionType = ({ icon, text, type = QuestionTypeList.MCQS }: QuestionTypeProps) => {
        return (
            <div
                className="flex w-full cursor-pointer flex-row items-center gap-4 rounded-md border px-4 py-3"
                onClick={() => setActiveQuestionDialog(type)}
            >
                {icon}
                <div className="text-body">{text}</div>
            </div>
        );
    };

    const { fields } = useFieldArray({
        control: form.control,
        name: 'questions', // Name of the field array
    });

    const handleAddQuestion = async (
        newQuestionType: string,
        title: string | undefined,
        reattemptCount: string | undefined
    ) => {
        const responseData = {
            id: '',
            questionId: String(fields.length + 1),
            questionName: '',
            explanation: '',
            questionType: newQuestionType,
            questionPenalty: '',
            questionDuration: {
                hrs: '',
                min: '',
            },
            questionMark: '',
            singleChoiceOptions: Array(4).fill({
                id: '',
                name: '',
                isSelected: false,
            }),
            multipleChoiceOptions: Array(4).fill({
                id: '',
                name: '',
                isSelected: false,
            }),
            csingleChoiceOptions: Array(4).fill({
                id: '',
                name: '',
                isSelected: false,
            }),
            cmultipleChoiceOptions: Array(4).fill({
                id: '',
                name: '',
                isSelected: false,
            }),
            trueFalseOptions: Array(2).fill({
                id: '',
                name: '',
                isSelected: false,
            }),
            parentRichTextContent: '',
            decimals: 0,
            numericType: '',
            validAnswers: [],
            questionResponseType: '',
            subjectiveAnswerText: '',
            reattemptCount: reattemptCount || '',
        };
        try {
            const response: string = await updateQuestionOrder({
                id: crypto.randomUUID(),
                source_id: '',
                source_type: 'QUESTION',
                title: title || '',
                image_file_id: '',
                description: '',
                status: 'DRAFT',
                slide_order: 0,
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                question_slide: convertToQuestionSlideFormat(responseData),
                is_loaded: true,
                new_slide: true,
            });

            toast.success('Question added successfully!');
            form.reset();
            openState?.(false);
            setTimeout(() => {
                setActiveItem(getSlideById(response));
            }, 500);
        } catch (error) {
            toast.error('Failed to add question');
        }
    };

    return (
        <>
            <div className="flex flex-col gap-4">
                <div className="text-subtitle font-semibold">Quick Access</div>
                <QuestionType
                    icon={<MCQS />}
                    text="Multiple Choice Questions (Single correct)"
                    type={QuestionTypeList.MCQS}
                    handleAddQuestion={handleAddQuestion}
                />
                <QuestionType
                    icon={<MCQM />}
                    text="Multiple Choice Questions (Multiple correct)"
                    type={QuestionTypeList.MCQM}
                    handleAddQuestion={handleAddQuestion}
                />
                <QuestionType
                    icon={<Numerical />}
                    text="Numerical"
                    type={QuestionTypeList.NUMERIC}
                    handleAddQuestion={handleAddQuestion}
                />
                <QuestionType
                    type={QuestionTypeList.TRUE_FALSE}
                    icon={<TrueFalse />}
                    text="True False"
                    handleAddQuestion={handleAddQuestion}
                />
            </div>
            <Separator className="my-6" />
            <div className="flex flex-col gap-4">
                <div className="text-subtitle font-semibold">Option Based</div>
                <QuestionType
                    icon={<MCQS />}
                    text="Multiple Choice Questions (Single correct)"
                    type={QuestionTypeList.MCQS}
                    handleAddQuestion={handleAddQuestion}
                />
                <QuestionType
                    icon={<MCQM />}
                    text="Multiple Choice Questions (Multiple correct)"
                    type={QuestionTypeList.MCQM}
                    handleAddQuestion={handleAddQuestion}
                />
            </div>
            <Separator className="my-6" />
            <div className="flex flex-col gap-4">
                <div className="text-subtitle font-semibold">Math Based</div>
                <QuestionType
                    icon={<Numerical />}
                    text="Numerical"
                    type={QuestionTypeList.NUMERIC}
                    handleAddQuestion={handleAddQuestion}
                />
            </div>
            <Separator className="my-6" />
            <div className="flex flex-col gap-4">
                <div className="text-subtitle font-semibold">Writing Skills</div>
                <QuestionType
                    icon={<LongAnswer />}
                    type={QuestionTypeList.LONG_ANSWER}
                    text="Long Answer"
                    handleAddQuestion={handleAddQuestion}
                />
                <QuestionType
                    icon={<SingleWord />}
                    type={QuestionTypeList.ONE_WORD}
                    text="Single Word"
                    handleAddQuestion={handleAddQuestion}
                />
            </div>
            <Separator className="my-6" />
            <div className="flex flex-col gap-4">
                <div className="text-subtitle font-semibold">Reading Skills</div>
                <QuestionType
                    icon={<CMCQS />}
                    text="Comprehension Multiple Choice Questions (Single correct)"
                    type={QuestionTypeList.CMCQS}
                    handleAddQuestion={handleAddQuestion}
                />
                <QuestionType
                    icon={<CMCQM />}
                    text="Comprehension Multiple Choice Questions (Multiple correct)"
                    type={QuestionTypeList.CMCQM}
                    handleAddQuestion={handleAddQuestion}
                />
                <QuestionType
                    icon={<CMCQM />}
                    text="Comprehension Numeric"
                    type={QuestionTypeList.CNUMERIC}
                    handleAddQuestion={handleAddQuestion}
                />
            </div>

            {/* Separate dialog component that appears when a question type is selected */}
            <Dialog
                open={activeQuestionDialog !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setActiveQuestionDialog(null);
                        setTitle('');
                        setLocalReattempts('');
                    }
                }}
            >
                <DialogContent className="p-0">
                    <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                        Question Settings
                    </h1>
                    <div className="flex flex-col gap-4 p-4">
                        <MyInput
                            input={title}
                            onChangeFunction={(e) => setTitle(e.target.value)}
                            label="Title"
                            required={true}
                            inputType="text"
                            inputPlaceholder="Add Title"
                            className="w-full"
                        />
                        <MyInput
                            input={localReattempts}
                            onChangeFunction={(e) => setLocalReattempts(e.target.value)}
                            label="Reattempt Count"
                            required={true}
                            inputType="number"
                            inputPlaceholder="00"
                            className="w-full"
                            min={0}
                            onKeyDown={(e) => {
                                if (['e', 'E', '-', '+'].includes(e.key)) {
                                    e.preventDefault();
                                }
                            }}
                        />
                        <div>
                            <MyButton
                                type="button"
                                scale="large"
                                buttonType="primary"
                                className="font-medium"
                                onClick={() => {
                                    if (activeQuestionDialog) {
                                        handleAddQuestion(
                                            activeQuestionDialog,
                                            title,
                                            localReattempts
                                        );
                                    }
                                }}
                            >
                                Add
                            </MyButton>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default AddQuestionDialog;
