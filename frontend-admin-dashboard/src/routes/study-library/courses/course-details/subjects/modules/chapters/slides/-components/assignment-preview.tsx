import { useEffect, useState } from 'react';
import { Slide } from '../-hooks/use-slides';
import { useContentStore } from '../-stores/chapter-sidebar-store';
import { assignmentFormSchema, AssignmentFormType } from '../-form-schemas/assignmentFormSchema';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { MyInput } from '@/components/design-system/input';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { Separator } from '@/components/ui/separator';
import useDialogStore from '@/routes/assessment/question-papers/-global-states/question-paper-dialogue-close';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MyButton } from '@/components/design-system/button';
import { X } from '@phosphor-icons/react';
import { QuestionPaperUpload } from '@/routes/assessment/question-papers/-components/QuestionPaperUpload';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { QuestionPapersTabs } from '@/routes/assessment/question-papers/-components/QuestionPapersTabs';
import { Badge } from '@/components/ui/badge';
import { ReverseProgressBar } from '@/components/ui/progress';
import { RichContentRenderer } from '@/routes/assessment/assessment-list/offline-entry/$assessmentId/-components/RichContentRenderer';

const QUESTION_TYPE_LABELS: Record<string, string> = {
    MCQS: 'Single Choice',
    MCQM: 'Multiple Choice',
    TRUE_FALSE: 'True / False',
    ONE_WORD: 'One Word',
    LONG_ANSWER: 'Long Answer',
    NUMERIC: 'Numeric',
    CMCQS: 'Comprehension (Single)',
    CMCQM: 'Comprehension (Multiple)',
};

const StudyLibraryAssignmentPreview = ({ activeItem }: { activeItem: Slide }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const { setItems, setActiveItem, items } = useContentStore();
    const {
        isManualQuestionPaperDialogOpen,
        isUploadFromDeviceDialogOpen,
        setIsManualQuestionPaperDialogOpen,
        setIsUploadFromDeviceDialogOpen,
        isSavedQuestionPaperDialogOpen,
        setIsSavedQuestionPaperDialogOpen,
    } = useDialogStore();

    const defaultValues = activeItem.assignment_slide;
    const form = useForm<AssignmentFormType>({
        resolver: zodResolver(assignmentFormSchema),
        defaultValues: defaultValues || {},
    });

    const adaptive_marking_for_each_question = form.getValues('adaptive_marking_for_each_question');
    const { watch, getValues } = form;
    const totalParticipants = Number(getValues('totalParticipants')) || 0;
    const submittedParticipants = Number(getValues('submittedParticipants')) || 0;

    useEffect(() => {
        const subscription = watch(() => {
            setActiveItem({
                ...activeItem,
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                assignment_slide: form.getValues(),
            });
        });

        return () => subscription.unsubscribe(); // cleanup
    }, [watch, items, activeItem, form, setItems]);

    return (
        <div key={`assignment-${activeItem.id}`} className="flex size-full flex-col gap-8">
            <FormProvider {...form}>
                {/* Task Description */}
                <div className="flex flex-col gap-6">
                    <h1 className="-mb-5">Task Description</h1>
                    <FormField
                        control={form.control}
                        name="taskDescription"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <RichTextEditor
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        value={field.value}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>

                {/* Live Date Range */}
                <div>
                    <h1 className="mb-3 font-semibold">Live Date Range</h1>
                    <div className="flex items-center gap-6">
                        <FormField
                            control={form.control}
                            name="startDate"
                            render={({ field: { ...field } }) => (
                                <FormItem>
                                    <FormControl>
                                        <MyInput
                                            inputType="datetime-local"
                                            input={field.value}
                                            onChangeFunction={field.onChange}
                                            required
                                            size="large"
                                            label="Start Date & Time"
                                            labelStyle="font-normal"
                                            {...field}
                                            className="w-full"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="endDate"
                            render={({ field: { ...field } }) => (
                                <FormItem>
                                    <FormControl>
                                        <MyInput
                                            inputType="datetime-local"
                                            input={field.value}
                                            onChangeFunction={field.onChange}
                                            required
                                            size="large"
                                            label="End Date & Time"
                                            labelStyle="font-normal"
                                            {...field}
                                            className="w-full"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                {/* Reattempt Count */}
                <FormField
                    control={form.control}
                    name="reattemptCount"
                    render={({ field: { onChange, value, ...field } }) => (
                        <FormItem>
                            <FormControl>
                                <MyInput
                                    inputType="number"
                                    label="Reattempt Count"
                                    inputPlaceholder="Reattempt Count"
                                    input={value}
                                    onChangeFunction={onChange}
                                    required={false}
                                    size="large"
                                    className="w-96"
                                    {...field}
                                    min={0}
                                    onKeyDown={(e) => {
                                        if (['e', 'E', '-', '+'].includes(e.key)) {
                                            e.preventDefault();
                                        }
                                    }}
                                    onWheel={(e) => e.currentTarget.blur()}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                {/* Upload Question Paper */}
                <div className="flex flex-wrap items-center justify-start gap-5">
                    <h3>Upload Question Paper</h3>
                    <AlertDialog
                        open={isUploadFromDeviceDialogOpen}
                        onOpenChange={setIsUploadFromDeviceDialogOpen}
                    >
                        <AlertDialogTrigger>
                            <MyButton
                                type="button"
                                scale="large"
                                buttonType="secondary"
                                className="font-thin"
                            >
                                Upload from Device
                            </MyButton>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="p-0">
                            <div className="flex items-center justify-between rounded-md bg-primary-50">
                                <h1 className="rounded-sm p-4 font-bold text-primary-500">
                                    Upload Question Paper From Device
                                </h1>
                                <AlertDialogCancel
                                    className="border-none bg-primary-50 shadow-none hover:bg-primary-50"
                                    onClick={() => setIsUploadFromDeviceDialogOpen(false)}
                                >
                                    <X className="text-neutral-600" />
                                </AlertDialogCancel>
                            </div>
                            <QuestionPaperUpload
                                isManualCreated={false}
                                studyLibraryAssignmentForm={form}
                                isStudyLibraryAssignment={true}
                                currentQuestionIndex={currentQuestionIndex}
                                setCurrentQuestionIndex={setCurrentQuestionIndex}
                            />
                        </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog
                        open={isManualQuestionPaperDialogOpen}
                        onOpenChange={setIsManualQuestionPaperDialogOpen}
                    >
                        <AlertDialogTrigger>
                            <MyButton
                                type="button"
                                scale="large"
                                buttonType="secondary"
                                className="font-thin"
                            >
                                Create Manually
                            </MyButton>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="p-0">
                            <div className="flex items-center justify-between rounded-md bg-primary-50">
                                <h1 className="rounded-sm p-4 font-bold text-primary-500">
                                    Create Question Paper Manually
                                </h1>
                                <AlertDialogCancel
                                    className="border-none bg-primary-50 shadow-none hover:bg-primary-50"
                                    onClick={() => setIsManualQuestionPaperDialogOpen(false)}
                                >
                                    <X className="text-neutral-600" />
                                </AlertDialogCancel>
                            </div>
                            <QuestionPaperUpload
                                isManualCreated={true}
                                studyLibraryAssignmentForm={form}
                                isStudyLibraryAssignment={true}
                                currentQuestionIndex={currentQuestionIndex}
                                setCurrentQuestionIndex={setCurrentQuestionIndex}
                            />
                        </AlertDialogContent>
                    </AlertDialog>
                    <Dialog
                        open={isSavedQuestionPaperDialogOpen}
                        onOpenChange={setIsSavedQuestionPaperDialogOpen}
                    >
                        <DialogTrigger>
                            <MyButton
                                type="button"
                                scale="large"
                                buttonType="secondary"
                                className="font-thin"
                            >
                                Choose Saved Paper
                            </MyButton>
                        </DialogTrigger>
                        <DialogContent className="no-scrollbar !m-0 flex h-[90vh] !w-full !max-w-[90vw] flex-col items-start !gap-0 overflow-y-auto !p-0 [&>button]:hidden">
                            <div className="flex h-14 w-full items-center justify-between rounded-md bg-primary-50">
                                <h1 className="rounded-sm p-4 font-bold text-primary-500">
                                    Choose Saved Question Paper From List
                                </h1>
                                <DialogClose
                                    className="mr-4 !border-none bg-primary-50 shadow-none hover:bg-primary-50"
                                    onClick={() => setIsSavedQuestionPaperDialogOpen(false)}
                                >
                                    <X className="text-neutral-600" />
                                </DialogClose>
                            </div>
                            <div className="h-full w-screen overflow-y-auto p-8">
                                <QuestionPapersTabs
                                    isAssessment={true}
                                    studyLibraryAssignmentForm={form}
                                    isStudyLibraryAssignment={true}
                                    currentQuestionIndex={currentQuestionIndex}
                                    setCurrentQuestionIndex={setCurrentQuestionIndex}
                                />
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Questions List */}
                {Boolean(adaptive_marking_for_each_question?.length) && (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h1 className="font-semibold text-primary-500">
                                Questions ({adaptive_marking_for_each_question.length})
                            </h1>
                        </div>
                        <div className="flex flex-col gap-4">
                            {adaptive_marking_for_each_question.map((question, idx) => (
                                <div
                                    key={idx}
                                    className="rounded-lg border border-neutral-200 bg-white shadow-sm"
                                >
                                    {/* Question header */}
                                    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
                                        <div className="flex gap-3">
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-600">
                                                {idx + 1}
                                            </span>
                                            <RichContentRenderer
                                                html={question.questionName || ''}
                                                className="whitespace-pre-line pt-0.5 text-sm leading-relaxed text-neutral-800"
                                            />
                                        </div>
                                        {question.questionType && (
                                            <Badge
                                                variant="outline"
                                                className="shrink-0 border-primary-200 bg-primary-50 text-xs text-primary-600"
                                            >
                                                {QUESTION_TYPE_LABELS[question.questionType] ||
                                                    question.questionType}
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Options */}
                                    {question.options && question.options.length > 0 && (
                                        <div className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-2">
                                            {question.options.map((opt, optIdx) => (
                                                <div
                                                    key={opt.id || optIdx}
                                                    className="flex items-start gap-2 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2"
                                                >
                                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-medium text-neutral-600">
                                                        {String.fromCharCode(65 + optIdx)}
                                                    </span>
                                                    <RichContentRenderer
                                                        html={opt.text.content || ''}
                                                        className="text-sm text-neutral-700"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <Separator />

                {/* Responses */}
                <div className="flex flex-col gap-4">
                    <h1 className="font-semibold">Responses</h1>
                    <div className="flex flex-col gap-2 text-sm">
                        <span>Total Participants: {totalParticipants}</span>
                        <div className="flex items-center justify-between">
                            <span>Submitted By: {submittedParticipants}</span>
                            <span>Pending: {totalParticipants - submittedParticipants}</span>
                        </div>
                        <ReverseProgressBar
                            value={parseFloat(
                                (
                                    ((totalParticipants - submittedParticipants) /
                                        totalParticipants) *
                                    100
                                ).toFixed(2)
                            )}
                        />
                    </div>
                </div>
            </FormProvider>
        </div>
    );
};

export default StudyLibraryAssignmentPreview;
