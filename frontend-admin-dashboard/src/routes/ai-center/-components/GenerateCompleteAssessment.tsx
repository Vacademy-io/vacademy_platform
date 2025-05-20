import { useEffect, useState } from 'react';
import { FormProvider, useFieldArray, UseFormReturn } from 'react-hook-form';
import { transformQuestionsToGenerateAssessmentAI } from '../-utils/helper';
import { Sortable, SortableDragHandle, SortableItem } from '@/components/ui/sortable';
import { getPPTViewTitle } from '@/routes/assessment/question-papers/-utils/helper';
import { QuestionType } from '@/constants/dummy-data';
import { DotsSixVertical } from 'phosphor-react';
import { PPTComponentFactory } from '@/routes/assessment/question-papers/-components/QuestionPaperTemplatesTypes/PPTComponentFactory';
import { Separator } from '@/components/ui/separator';
import { MainViewComponentFactory } from '@/routes/assessment/question-papers/-components/QuestionPaperTemplatesTypes/MainViewComponentFactory';
import { z } from 'zod';
import { generateCompleteAssessmentFormSchema } from '../-utils/generate-complete-assessment-schema';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import useInstituteLogoStore from '@/components/common/layout-container/sidebar/institutelogo-global-zustand';
import { Input } from '@/components/ui/input';
import { AIAssessmentResponseInterface } from '@/types/ai/generate-assessment/generate-complete-assessment';
import ExportQuestionPaperAI from './export-ai-question-paper/ExportQuestionPaperAI';
import { QuestionsFromTextDialog } from '../ai-tools/vsmart-prompt/-components/QuestionsFromTextDialog';
import { QuestionsFromTextData } from '../ai-tools/vsmart-prompt/-components/GenerateQuestionsFromText';
import { useAICenter } from '../-contexts/useAICenterContext';
import { DashboardLoader } from '@/components/core/dashboard-loader';
// Infer the form type from the schema
type GenerateCompleteAssessmentFormType = z.infer<typeof generateCompleteAssessmentFormSchema>;

interface GenerateCompleteAssessmentProps {
    form: UseFormReturn<GenerateCompleteAssessmentFormType>;
    openCompleteAssessmentDialog: boolean;
    setOpenCompleteAssessmentDialog: React.Dispatch<React.SetStateAction<boolean>>;
    assessmentData: AIAssessmentResponseInterface | null;
    handleGenerateQuestionsForAssessment: (audioId?: string) => void;
    propmtInput: string;
    setPropmtInput: React.Dispatch<React.SetStateAction<string>>;
    isMoreQuestionsDialog: boolean;
    setIsMoreQuestionsDialog: React.Dispatch<React.SetStateAction<boolean>>;
    numQuestions?: number | null;
    setNumQuestions?: React.Dispatch<React.SetStateAction<number | null>>;
    difficulty?: string | null;
    setDifficulty?: React.Dispatch<React.SetStateAction<string | null>>;
    language?: string | null;
    setLanguage?: React.Dispatch<React.SetStateAction<string | null>>;
    audioId?: string;
    handleSubmitSuccessForText?: (data: QuestionsFromTextData) => void;
    isTextDialog?: boolean;
    submitButtonForText?: JSX.Element;
    handleDisableSubmitBtn?: (value: boolean) => void;
    submitFormFn?: (submitFn: () => void) => void;
    dialogForm?: UseFormReturn<QuestionsFromTextData>;
    keyProp: string | null;
}

const GenerateCompleteAssessment = ({
    form,
    openCompleteAssessmentDialog,
    setOpenCompleteAssessmentDialog,
    assessmentData,
    handleGenerateQuestionsForAssessment,
    propmtInput,
    setPropmtInput,
    isMoreQuestionsDialog,
    setIsMoreQuestionsDialog,
    numQuestions,
    setNumQuestions,
    difficulty,
    setDifficulty,
    language,
    setLanguage,
    audioId,
    submitButtonForText,
    handleSubmitSuccessForText,
    handleDisableSubmitBtn,
    submitFormFn,
    dialogForm,
    keyProp,
}: GenerateCompleteAssessmentProps) => {
    const { instituteLogo } = useInstituteLogoStore();
    const transformQuestionsData = transformQuestionsToGenerateAssessmentAI(
        assessmentData?.questions
    );
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const { loader, key: keyContext } = useAICenter();

    const { getValues } = form;

    // UseFieldArray to manage questions array
    const { fields, move } = useFieldArray({
        control: form.control,
        name: 'questions', // Name of the field array
    });

    const questions = form.getValues('questions');

    const handlePageClick = (pageIndex: number) => {
        setCurrentQuestionIndex(pageIndex);
        form.trigger();
    };

    useEffect(() => {
        form.reset({
            ...form.getValues(),
            title: assessmentData?.title,
            questions: transformQuestionsData,
        });
    }, []);

    return (
        <>
            <Dialog
                open={openCompleteAssessmentDialog}
                onOpenChange={setOpenCompleteAssessmentDialog}
            >
                <DialogContent className="no-scrollbar !m-0 flex h-full !w-full !max-w-full flex-col !gap-0 overflow-y-auto !rounded-none !p-0 [&>button]:hidden">
                    <FormProvider {...form}>
                        <form className="flex h-screen flex-col items-start">
                            <div className="flex w-full items-center justify-between bg-primary-100 p-2">
                                <div className="flex items-center gap-2">
                                    <img
                                        src={instituteLogo}
                                        alt="logo"
                                        className="size-12 rounded-full"
                                    />
                                    <span className="text-lg font-semibold text-neutral-500">
                                        {form.getValues('title')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    {submitFormFn &&
                                    handleSubmitSuccessForText &&
                                    handleDisableSubmitBtn &&
                                    dialogForm ? (
                                        <QuestionsFromTextDialog
                                            form={dialogForm}
                                            open={isMoreQuestionsDialog}
                                            onOpenChange={setIsMoreQuestionsDialog}
                                            trigger={
                                                <MyButton
                                                    type="button"
                                                    scale="medium"
                                                    buttonType="secondary"
                                                    layoutVariant="default"
                                                    className="mr-4 text-sm"
                                                    onClick={() => {
                                                        setIsMoreQuestionsDialog(true);
                                                    }}
                                                >
                                                    Generate
                                                </MyButton>
                                            }
                                            onSubmitSuccess={handleSubmitSuccessForText}
                                            submitButton={submitButtonForText || <></>}
                                            handleDisableSubmitBtn={handleDisableSubmitBtn}
                                            submitForm={submitFormFn}
                                            taskId={keyProp || ''}
                                        />
                                    ) : (
                                        <Dialog
                                            open={isMoreQuestionsDialog}
                                            onOpenChange={setIsMoreQuestionsDialog}
                                        >
                                            <DialogTrigger>
                                                <MyButton
                                                    type="button"
                                                    scale="medium"
                                                    buttonType="secondary"
                                                    layoutVariant="default"
                                                    className="mr-4 text-sm"
                                                >
                                                    Generate
                                                </MyButton>
                                            </DialogTrigger>
                                            <DialogContent className="p-0">
                                                <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                                                    Generate more questions
                                                </h1>
                                                <div className="flex flex-col items-center justify-center gap-4 p-4">
                                                    <Input
                                                        placeholder="Enter topics to generate questions"
                                                        value={propmtInput}
                                                        onChange={(e) =>
                                                            setPropmtInput(e.target.value)
                                                        }
                                                    />
                                                    {setNumQuestions && (
                                                        <Input
                                                            type=""
                                                            placeholder="Enter number of questions to generate"
                                                            value={numQuestions || ''}
                                                            onChange={(e) =>
                                                                setNumQuestions(
                                                                    Number(e.target.value)
                                                                )
                                                            }
                                                        />
                                                    )}
                                                    {setDifficulty && (
                                                        <Input
                                                            placeholder="Enter difficulty level [Easy, Medium, Hard]"
                                                            value={difficulty || ''}
                                                            onChange={(e) =>
                                                                setDifficulty(e.target.value)
                                                            }
                                                        />
                                                    )}
                                                    {setLanguage && (
                                                        <Input
                                                            placeholder="Enter language [English, Hindi, etc.]"
                                                            value={language || ''}
                                                            onChange={(e) =>
                                                                setLanguage(e.target.value)
                                                            }
                                                        />
                                                    )}
                                                    {loader && keyContext == keyProp ? (
                                                        <MyButton
                                                            type="button"
                                                            scale="medium"
                                                            buttonType="primary"
                                                            layoutVariant="default"
                                                            className="mr-4 text-sm"
                                                        >
                                                            <DashboardLoader
                                                                size={20}
                                                                color="#ffffff"
                                                            />
                                                        </MyButton>
                                                    ) : (
                                                        <MyButton
                                                            type="button"
                                                            scale="medium"
                                                            buttonType="primary"
                                                            layoutVariant="default"
                                                            className="mr-4 text-sm"
                                                            onClick={() =>
                                                                handleGenerateQuestionsForAssessment(
                                                                    audioId || ''
                                                                )
                                                            }
                                                        >
                                                            Generate Questions
                                                        </MyButton>
                                                    )}
                                                    {/* <ExportQuestionPaperAI
                                                        responseQuestionsData={
                                                            assessmentData?.questions
                                                        }
                                                    /> */}
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                    <MyButton
                                        type="button"
                                        scale="medium"
                                        buttonType="secondary"
                                        layoutVariant="default"
                                        className="mr-4 text-sm"
                                        onClick={() => {
                                            setNumQuestions && setNumQuestions(null);
                                            setDifficulty && setDifficulty(null);
                                            setLanguage && setLanguage(null);
                                            setOpenCompleteAssessmentDialog(false);
                                        }}
                                    >
                                        Cancel
                                    </MyButton>
                                    <ExportQuestionPaperAI
                                        responseQuestionsData={assessmentData?.questions}
                                    />
                                </div>
                            </div>
                            <div className="flex w-full">
                                <div className="mt-4 flex w-40 flex-col items-center justify-center gap-2">
                                    <div className="flex h-[325vh] w-40 flex-col items-start justify-between gap-4 overflow-x-hidden overflow-y-scroll p-2">
                                        <Sortable
                                            value={fields}
                                            onMove={({ activeIndex, overIndex }) =>
                                                move(activeIndex, overIndex)
                                            }
                                        >
                                            <div className="flex origin-top-left scale-[0.26] flex-col gap-8 overflow-x-hidden">
                                                {fields.map((field, index) => {
                                                    return (
                                                        <SortableItem
                                                            key={field.id}
                                                            value={field.id}
                                                            asChild
                                                        >
                                                            <div
                                                                key={index}
                                                                // onClick={() => handlePageClick(index)}
                                                                className={`rounded-xl border-4 bg-primary-50 p-6 ${
                                                                    currentQuestionIndex === index
                                                                        ? 'border-primary-500 bg-none'
                                                                        : 'bg-none'
                                                                }`}
                                                                onMouseEnter={() =>
                                                                    handlePageClick(index)
                                                                }
                                                            >
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center justify-start gap-4">
                                                                        <h1 className="left-0 w-96 whitespace-nowrap text-4xl font-bold">
                                                                            {index + 1}
                                                                            &nbsp;
                                                                            {getPPTViewTitle(
                                                                                getValues(
                                                                                    `questions.${index}.questionType`
                                                                                ) as QuestionType
                                                                            )}
                                                                        </h1>
                                                                        <SortableDragHandle
                                                                            variant="outline"
                                                                            size="icon"
                                                                            className="size-16"
                                                                        >
                                                                            <DotsSixVertical className="!size-12" />
                                                                        </SortableDragHandle>
                                                                    </div>
                                                                    <PPTComponentFactory
                                                                        key={index}
                                                                        type={
                                                                            getValues(
                                                                                `questions.${currentQuestionIndex}.questionType`
                                                                            ) as QuestionType
                                                                        }
                                                                        props={{
                                                                            form: form,
                                                                            currentQuestionIndex:
                                                                                index,
                                                                            setCurrentQuestionIndex:
                                                                                setCurrentQuestionIndex,
                                                                            className:
                                                                                'relative mt-4 rounded-xl border-4 border-primary-300 bg-white p-4',
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </SortableItem>
                                                    );
                                                })}
                                            </div>
                                        </Sortable>
                                    </div>
                                </div>
                                <Separator orientation="vertical" className="h-screen" />
                                {questions && questions.length === 0 ? (
                                    <div className="flex h-screen w-screen items-center justify-center">
                                        <h1>No Question Exists.</h1>
                                    </div>
                                ) : (
                                    <MainViewComponentFactory
                                        key={currentQuestionIndex}
                                        type={
                                            getValues(
                                                `questions.${currentQuestionIndex}.questionType`
                                            ) as QuestionType
                                        }
                                        props={{
                                            form: form,
                                            currentQuestionIndex: currentQuestionIndex,
                                            setCurrentQuestionIndex: setCurrentQuestionIndex,
                                            className:
                                                'dialog-height overflow-auto ml-6 flex w-full flex-col gap-6 pr-6 pt-4',
                                        }}
                                    />
                                )}
                            </div>
                        </form>
                    </FormProvider>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default GenerateCompleteAssessment;
