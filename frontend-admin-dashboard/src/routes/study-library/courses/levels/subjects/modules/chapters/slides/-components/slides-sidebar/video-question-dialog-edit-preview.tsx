import { QuestionType } from '@/constants/dummy-data';
import { MainViewComponentFactory } from '@/routes/assessment/question-papers/-components/QuestionPaperTemplatesTypes/MainViewComponentFactory';
import { uploadQuestionPaperFormSchema } from '@/routes/assessment/question-papers/-utils/upload-question-paper-form-schema';
import { Dispatch, MutableRefObject, SetStateAction, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import { UploadQuestionPaperFormType } from '@/routes/assessment/question-papers/-components/QuestionPaperUpload';
import { DialogTrigger } from '@radix-ui/react-dialog';
import { PencilSimpleLine } from 'phosphor-react';
import { zodResolver } from '@hookform/resolvers/zod';

type QuestionPaperForm = z.infer<typeof uploadQuestionPaperFormSchema>;

import { useRef } from 'react'; // Add useRef import
import { StudyLibraryQuestion } from '@/types/study-library/study-library-video-questions';
import { useContentStore } from '../../-stores/chapter-sidebar-store';

const VideoQuestionDialogEditPreview = ({
    formRefData,
    question,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    updateQuestion, // Add updateQuestion prop
}: {
    formRefData: MutableRefObject<UploadQuestionPaperFormType>;
    question?: StudyLibraryQuestion;
    currentQuestionIndex: number;
    setCurrentQuestionIndex: Dispatch<SetStateAction<number>>;
    updateQuestion?: (question: StudyLibraryQuestion) => void; // New prop for updating state
}) => {
    const { activeItem, setActiveItem } = useContentStore();
    const form = useForm<QuestionPaperForm>({
        resolver: zodResolver(uploadQuestionPaperFormSchema),
        mode: 'onChange',
        defaultValues: {
            questionPaperId: '',
            isFavourite: false,
            title: '',
            createdOn: new Date(),
            yearClass: '',
            subject: '',
            questionsType: '',
            optionsType: '',
            answersType: '',
            explanationsType: '',
            fileUpload: null as unknown as File,
            questions: [],
        },
    });

    const closeRef = useRef<HTMLButtonElement | null>(null);

    const handleEditQuestionInAddedForm = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();

        // Ensure formRefData.current and question are defined
        if (!formRefData.current || !question) return;

        const currentQIndex = formRefData.current.questions.findIndex(
            (q) => q.questionId === question.questionId
        );

        // If question with the matching questionId was not found
        if (currentQIndex === -1) return;

        const updatedQuestions = form.getValues('questions');

        // Ensure updatedQuestions is an array and that the current question exists in the array
        if (!Array.isArray(updatedQuestions) || !updatedQuestions[currentQIndex]) return;

        // Only assign if the updated question is not undefined
        const updatedQuestion = updatedQuestions[currentQIndex];

        if (updatedQuestion) {
            // Update the ref for compatibility with existing code
            formRefData.current.questions[currentQIndex] = updatedQuestion;

            setActiveItem({
                ...activeItem,
                video_slide: {
                    ...activeItem?.video_slide,
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    questions: updatedQuestions || [],
                },
            });

            // Call updateQuestion to update the state and trigger re-render
            if (updateQuestion) {
                updateQuestion(updatedQuestion);
            }
        }

        // Close the form after the update
        closeRef.current?.click();
    };

    useEffect(() => {
        form.reset({
            ...form.getValues(),
            questions: [...formRefData.current.questions],
        });
    }, []);

    return (
        <Dialog>
            <DialogTrigger>
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    layoutVariant="default"
                    className="h-8 min-w-4"
                >
                    <PencilSimpleLine size={32} />
                </MyButton>
            </DialogTrigger>
            <DialogContent className="no-scrollbar !m-0 flex h-full !w-full !max-w-full flex-col !gap-0 overflow-y-auto !rounded-none !p-0">
                <h1 className="bg-primary-50 p-4 font-semibold text-primary-500">Question</h1>
                <div>
                    <FormProvider {...form}>
                        {form.getValues('questions')?.length === 0 ? (
                            <p>Nothing to show</p>
                        ) : (
                            <div className="my-4 flex flex-col gap-2">
                                <MainViewComponentFactory
                                    key={currentQuestionIndex}
                                    type={
                                        form.getValues(
                                            `questions.${currentQuestionIndex}.questionType`
                                        ) as QuestionType
                                    }
                                    props={{
                                        form,
                                        currentQuestionIndex,
                                        setCurrentQuestionIndex,
                                        className:
                                            'dialog-height overflow-auto ml-6 flex w-full flex-col gap-6 pr-6 pt-4',
                                    }}
                                />
                            </div>
                        )}
                    </FormProvider>
                </div>
                <div className="flex justify-end">
                    <DialogClose asChild>
                        <button ref={closeRef} className="hidden" />
                    </DialogClose>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="large"
                        layoutVariant="default"
                        className="mr-3"
                        onClick={handleEditQuestionInAddedForm}
                    >
                        Edit
                    </MyButton>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default VideoQuestionDialogEditPreview;
