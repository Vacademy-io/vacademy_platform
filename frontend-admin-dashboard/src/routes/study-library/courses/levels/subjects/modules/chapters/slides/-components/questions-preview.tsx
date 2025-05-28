import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MainViewComponentFactory } from '@/routes/assessment/question-papers/-components/QuestionPaperTemplatesTypes/MainViewComponentFactory';
import { UploadQuestionPaperFormType } from '@/routes/assessment/question-papers/-components/QuestionPaperUpload';
import { uploadQuestionPaperFormSchema } from '@/routes/assessment/question-papers/-utils/upload-question-paper-form-schema';
import { QuestionType } from '@/constants/dummy-data';
import { useEffect, useState } from 'react';
import { Slide } from '../-hooks/use-slides';
import { useContentStore } from '../-stores/chapter-sidebar-store';

export const StudyLibraryQuestionsPreview = ({ activeItem }: { activeItem: Slide }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const { setItems, setActiveItem, items } = useContentStore();

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
            questions: [activeItem.question_slide || {}],
        },
    });

    const { watch } = form;

    useEffect(() => {
        const subscription = watch((_, { name }) => {
            if (name?.startsWith('questions')) {
                setActiveItem({
                    ...activeItem,
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    question_slide: form.getValues(`questions.${currentQuestionIndex}`),
                });
            }
        });

        return () => subscription.unsubscribe(); // cleanup
    }, [watch, items, activeItem, form, setItems]);

    return (
        <div key={`question-${activeItem.id}`} className="size-full">
            <FormProvider {...form}>
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
            </FormProvider>
        </div>
    );
};
