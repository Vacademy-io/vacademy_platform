'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { uploadQuestionPaperFormSchema } from '@/routes/assessment/question-papers/-utils/upload-question-paper-form-schema';
import { UploadQuestionPaperFormType } from '@/routes/assessment/question-papers/-components/QuestionPaperUpload';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { Plus, Trash, Warning } from '@phosphor-icons/react';
import { MainViewComponentFactory } from '@/routes/assessment/question-papers/-components/QuestionPaperTemplatesTypes/MainViewComponentFactory';
import { QuestionType } from '@/constants/dummy-data';
import { useContentStore } from '../-stores/chapter-sidebar-store';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { useSlidesMutations } from '../-hooks/use-slides';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

// Import our new components and utilities
import {
    QuizPreviewProps,
    TransformedQuestion,
    BackendQuestion,
    transformQuestion,
    createQuizSlidePayload,
    QuestionDisplay,
    QuestionTypeSelector,
    DeleteConfirmDialog,
} from './quiz';
import QuizAddQuestionsDropdown from './quiz/components/QuizAddQuestionsDropdown';
import QuizAddViaAIDialog from './quiz/components/QuizAddViaAIDialog';
import QuizAddViaDocumentDialog from './quiz/components/QuizAddViaDocumentDialog';
import QuizAddViaCSVDialog from './quiz/components/QuizAddViaCSVDialog';
import QuizQuestionsPreviewDialog from './quiz/components/QuizQuestionsPreviewDialog';
import QuizSettingsPanel, { QuizSettings } from './quiz/components/QuizSettingsPanel';

const QuizPreview = ({ activeItem, routeParams }: QuizPreviewProps) => {
    // Get route parameters for API calls
    const { chapterId, moduleId, subjectId, sessionId } = routeParams || {};

    // Get package session ID from institute details store
    const { getPackageSessionId } = useInstituteDetailsStore();

    // Get the slides mutations hook with correct package session ID
    const { addUpdateQuizSlide } = useSlidesMutations(
        chapterId || '',
        moduleId || '',
        subjectId || '',
        getPackageSessionId({
            courseId: routeParams?.courseId || '',
            levelId: routeParams?.levelId || '',
            sessionId: sessionId || '',
        }) || ''
    );

    const form = useForm<UploadQuestionPaperFormType>({
        resolver: zodResolver(uploadQuestionPaperFormSchema()),
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

    const { fields, append, replace, update } = useFieldArray({
        control: form.control,
        name: 'questions',
    });

    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [isAddQuestionDialogOpen, setIsAddQuestionDialogOpen] = useState(false);
    const [isQuestionTypeDialogOpen, setIsQuestionTypeDialogOpen] = useState(false);
    const [selectedQuestionType, setSelectedQuestionType] = useState<string>('');
    const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
    const [questionToDelete, setQuestionToDelete] = useState<number | null>(null);

    // Quiz-level settings (time limit, marks, negative marking)
    const [quizSettings, setQuizSettings] = useState<QuizSettings>({
        timeLimitEnabled: false,
        timeLimitMinutes: 30,
        marksPerQuestion: 1,
        negativeMarkingEnabled: false,
        negativeMarking: 0,
    });
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // External question adding (document / AI / CSV)
    const [isDocDialogOpen, setIsDocDialogOpen] = useState(false);
    const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
    const [isCSVDialogOpen, setIsCSVDialogOpen] = useState(false);
    const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
    const [pendingQuestions, setPendingQuestions] = useState<UploadQuestionPaperFormType['questions']>([]);
    const [isAddingExternal, setIsAddingExternal] = useState(false);

    const editForm = useForm<UploadQuestionPaperFormType>({
        resolver: zodResolver(uploadQuestionPaperFormSchema()),
        mode: 'onChange',
    });

    const closeRef = useRef<HTMLButtonElement | null>(null);
    const { setActiveItem } = useContentStore();

    // Add watch subscription to automatically update store when form changes
    useEffect(() => {
        const subscription = form.watch((_, { name }) => {
            if (name?.startsWith('questions')) {
                const currentQuestions = form.getValues('questions');

                // Update the store with the new questions data
                // IMPORTANT: preserve quiz settings so they are not wiped on every question edit
                setActiveItem({
                    ...activeItem,
                    title: activeItem.title || 'Quiz',
                    source_id: activeItem.source_id || '',
                    source_type: activeItem.source_type || 'QUIZ',
                    image_file_id: activeItem.image_file_id || '',
                    quiz_slide: {
                        id: activeItem.quiz_slide?.id || '',
                        title: activeItem.quiz_slide?.title || '',
                        description: activeItem.quiz_slide?.description || {
                            id: '',
                            content: '',
                            type: 'TEXT',
                        },
                        time_limit_in_minutes: quizSettings.timeLimitEnabled ? quizSettings.timeLimitMinutes : null,
                        marks_per_question: quizSettings.marksPerQuestion,
                        negative_marking: quizSettings.negativeMarkingEnabled ? quizSettings.negativeMarking : 0,
                        questions: currentQuestions,
                    },
                });
            }
        });

        return () => subscription.unsubscribe(); // cleanup
    }, [form, activeItem, setActiveItem, quizSettings]);

    // Only re-populate the form when navigating to a different slide (id change).
    // Depending on the questions reference causes a circular loop:
    //   form watch → setActiveItem(questions) → useEffect → replace → form watch → ...
    useEffect(() => {
        if (activeItem?.quiz_slide?.questions) {
            const questions = activeItem.quiz_slide.questions;

            const transformedQuestions = questions.map((question: BackendQuestion) => {
                const transformed = transformQuestion(question);
                return transformed;
            });

            replace(transformedQuestions);
        } else {
            replace([]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeItem.quiz_slide?.id]);

    // Initialise quiz settings whenever the active slide changes
    useEffect(() => {
        const qs = activeItem?.quiz_slide;
        if (qs) {
            const timeLimitMinutes = qs.time_limit_in_minutes ?? 30;
            const marksPerQuestion = qs.marks_per_question ?? 1;
            const negativeMarking = qs.negative_marking ?? 0;
            setQuizSettings({
                timeLimitEnabled: qs.time_limit_in_minutes != null,
                timeLimitMinutes: timeLimitMinutes > 0 ? timeLimitMinutes : 30,
                marksPerQuestion: marksPerQuestion > 0 ? marksPerQuestion : 1,
                negativeMarkingEnabled: negativeMarking > 0,
                negativeMarking: negativeMarking,
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeItem.quiz_slide?.id]);

    // Check if the slide is deleted
    if (activeItem?.status === 'DELETED') {
        return (
            <div className="flex size-full flex-col overflow-hidden rounded border border-neutral-200 bg-white shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between border-b bg-red-50 px-6 py-4">
                    <h2 className="text-lg font-semibold text-red-700">Quiz Questions</h2>
                    <div className="flex items-center gap-2">
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-600">
                            DELETED
                        </span>
                    </div>
                </div>

                {/* Deleted Content */}
                <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12">
                    <div className="text-center">
                        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-red-100">
                            <Trash size={24} className="text-red-500" />
                        </div>
                        <h3 className="mb-2 text-lg font-medium text-slate-600">
                            This quiz has been deleted
                        </h3>
                        <p className="text-sm text-slate-400">
                            The quiz content is no longer available
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const syncToStore = () => {
        const currentQuestions = form.getValues('questions');
        setActiveItem({
            ...activeItem,
            title: activeItem.title || 'Quiz',
            source_id: activeItem.source_id || '',
            source_type: activeItem.source_type || 'QUIZ',
            image_file_id: activeItem.image_file_id || '',
            quiz_slide: {
                id: activeItem.quiz_slide?.id || '',
                title: activeItem.quiz_slide?.title || '',
                description: activeItem.quiz_slide?.description || {
                    id: '',
                    content: '',
                    type: 'TEXT',
                },
                // Use quizSettings state (reliable) instead of activeItem.quiz_slide (may be stale)
                time_limit_in_minutes: quizSettings.timeLimitEnabled ? quizSettings.timeLimitMinutes : null,
                marks_per_question: quizSettings.marksPerQuestion,
                negative_marking: quizSettings.negativeMarkingEnabled ? quizSettings.negativeMarking : 0,
                questions: currentQuestions,
            },
        });
    };

    const initializeQuestionFields = (question: any) => {
        // Initialize MCQ single choice options
        if (question.questionType === 'MCQS' && !question.singleChoiceOptions) {
            question.singleChoiceOptions = Array(4).fill({
                id: '',
                name: '',
                isSelected: false,
            });
        }

        // Initialize MCQ multiple choice options
        if (question.questionType === 'MCQM' && !question.multipleChoiceOptions) {
            question.multipleChoiceOptions = Array(4).fill({
                id: '',
                name: '',
                isSelected: false,
            });
        }

        // Initialize Comprehensive MCQ single choice options
        if (question.questionType === 'CMCQS' && !question.csingleChoiceOptions) {
            question.csingleChoiceOptions = Array(4).fill({
                id: '',
                name: '',
                isSelected: false,
            });
        }

        // Initialize Comprehensive MCQ multiple choice options
        if (question.questionType === 'CMCQM' && !question.cmultipleChoiceOptions) {
            question.cmultipleChoiceOptions = Array(4).fill({
                id: '',
                name: '',
                isSelected: false,
            });
        }

        // Initialize True/False options
        if (question.questionType === 'TRUE_FALSE' && !question.trueFalseOptions) {
            question.trueFalseOptions = Array(2).fill({
                id: '',
                name: '',
                isSelected: false,
            });
        }

        // Initialize Numeric question fields
        if ((question.questionType === 'NUMERIC' || question.questionType === 'CNUMERIC') && !question.decimals) {
            question.decimals = 0;
            question.numericType = '';
            question.validAnswers = [0];
        }

        // Initialize Subjective answer fields
        if ((question.questionType === 'LONG_ANSWER' || question.questionType === 'ONE_WORD') && !question.subjectiveAnswerText) {
            question.subjectiveAnswerText = '';
        }

        return question;
    };

    // Converts UI settings state to the QuizSettings payload shape
    const buildSettingsPayload = (s: typeof quizSettings) => ({
        timeLimitInMinutes: s.timeLimitEnabled ? s.timeLimitMinutes : null,
        marksPerQuestion: s.marksPerQuestion,
        negativeMarking: s.negativeMarkingEnabled ? s.negativeMarking : 0,
    });

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        try {
            const currentQuestions = form.getValues('questions');
            const payload = createQuizSlidePayload(currentQuestions, activeItem, buildSettingsPayload(quizSettings));
            await addUpdateQuizSlide(payload);
            syncToStore();
            toast.success('Quiz settings saved!');
        } catch {
            toast.error('Failed to save settings. Please try again.');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleQuestionsReady = (questions: UploadQuestionPaperFormType['questions']) => {
        setPendingQuestions(questions);
        setIsPreviewDialogOpen(true);
    };

    const handleConfirmAddQuestions = async (questions: UploadQuestionPaperFormType['questions']) => {
        setIsAddingExternal(true);
        try {
            // Assign stable IDs to new questions so every subsequent save reuses the same ID
            // and the backend updates instead of creating duplicate questions.
            const questionsWithIds = questions.map((q) => ({
                ...q,
                id: (q as any).id || crypto.randomUUID(),
            }));

            // Append to form FIRST (synchronous), then build payload from form state.
            // This matches the manual-add flow (handleAddQuestionConfirm) and avoids a
            // race condition: addUpdateQuizSlide's onSuccess awaits a slides refetch which
            // can trigger the useEffect(replace) before append runs, causing duplicates.
            append(questionsWithIds);

            const allQuestions = form.getValues('questions');
            const payload = createQuizSlidePayload(allQuestions, activeItem, buildSettingsPayload(quizSettings));
            await addUpdateQuizSlide(payload);
            syncToStore();
            setIsPreviewDialogOpen(false);
            setPendingQuestions([]);
            toast.success(`${questions.length} question(s) added successfully!`);
        } catch {
            toast.error('Failed to add questions. Please try again.');
        } finally {
            setIsAddingExternal(false);
        }
    };

    const handleEdit = (index: number) => {
        const question = form.getValues(`questions.${index}`);

        // Initialize all required fields based on question type
        const initializedQuestion = initializeQuestionFields(question);

        // Prefill CMCQS/CMCQM options for edit dialog just like MCQ types
        if (initializedQuestion.questionType === 'CMCQS' && initializedQuestion.singleChoiceOptions) {
            initializedQuestion.csingleChoiceOptions = initializedQuestion.singleChoiceOptions;
        }
        if (initializedQuestion.questionType === 'CMCQM' && initializedQuestion.multipleChoiceOptions) {
            initializedQuestion.cmultipleChoiceOptions = initializedQuestion.multipleChoiceOptions;
        }

        editForm.reset({ ...form.getValues(), questions: [initializedQuestion] });
        setEditIndex(index);
    };

    const handleEditConfirm = async () => {
        const updated = editForm.getValues(`questions.0`);

        if (editIndex !== null) {
            try {
                // Update the question in the form
                update(editIndex, updated);

                // Get all current questions
                const currentQuestions = form.getValues('questions');

                // Create payload for API call
                const payload = createQuizSlidePayload(currentQuestions, activeItem, buildSettingsPayload(quizSettings));

                // Call the API to update the quiz slide
                await addUpdateQuizSlide(payload);

                // Update the store
                syncToStore();
                setEditIndex(null);
                closeRef.current?.click();
                toast.success('Question updated successfully!');
            } catch (error) {
                console.error('Error updating question:', error);
                toast.error('Failed to update question. Please try again.');
            }
        }
    };

    const handleAddQuestion = (questionType: string) => {
        setSelectedQuestionType(questionType);
        setIsQuestionTypeDialogOpen(false);
        setIsAddQuestionDialogOpen(true);

        // Initialize options based on question type
        const questionOptions: UploadQuestionPaperFormType['questions'][0] = {
            questionName: '',
            questionType: questionType,
            questionPenalty: '0',
            questionDuration: { min: '0', hrs: '0' },
            questionMark: '1',
            explanation: '',
            validAnswers: [0],
            canSkip: false,
            tags: [],
        };

        // Add type-specific options to prevent input fields from hiding
        switch (questionType) {
            case 'MCQS':
                questionOptions.singleChoiceOptions = Array(4).fill({
                    id: '',
                    name: '',
                    isSelected: false,
                });
                break;
            case 'MCQM':
                questionOptions.multipleChoiceOptions = Array(4).fill({
                    id: '',
                    name: '',
                    isSelected: false,
                });
                break;
            case 'CMCQS':
                questionOptions.csingleChoiceOptions = Array(4).fill({
                    id: '',
                    name: '',
                    isSelected: false,
                });
                break;
            case 'CMCQM':
                questionOptions.cmultipleChoiceOptions = Array(4).fill({
                    id: '',
                    name: '',
                    isSelected: false,
                });
                break;
            case 'TRUE_FALSE':
                questionOptions.trueFalseOptions = Array(2).fill({
                    id: '',
                    name: '',
                    isSelected: false,
                });
                break;
            case 'NUMERIC':
            case 'CNUMERIC':
                questionOptions.decimals = 0;
                questionOptions.numericType = '';
                questionOptions.validAnswers = [0];
                break;
            case 'LONG_ANSWER':
            case 'ONE_WORD':
                questionOptions.subjectiveAnswerText = '';
                break;
            default:
                // For any other question type, ensure basic options are available
                questionOptions.singleChoiceOptions = Array(4).fill({
                    id: '',
                    name: '',
                    isSelected: false,
                });
        }

        // Reset the form for new question with proper options
        editForm.reset({
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
            questions: [questionOptions],
        });
    };

    const handleAddQuestionConfirm = async () => {
        const newQuestion = editForm.getValues(`questions.0`);
        if (newQuestion.questionName.trim()) {
            try {
                // Assign a stable ID now so every future save reuses the same ID.
                // Without this, createQuestionStructure generates a new UUID each time
                // the question is saved (settings save, draft save, etc.) which makes the
                // backend treat it as a brand-new question on every save → duplicates.
                const newQuestionWithId = { ...newQuestion, id: (newQuestion as any).id || crypto.randomUUID() };

                // Add the new question to the form
                append(newQuestionWithId);

                // Get all current questions including the new one
                const currentQuestions = form.getValues('questions');

                // Create payload for API call
                const payload = createQuizSlidePayload(currentQuestions, activeItem, buildSettingsPayload(quizSettings));

                // Call the API to update the quiz slide
                await addUpdateQuizSlide(payload);

                // Update the store
                syncToStore();
                setIsAddQuestionDialogOpen(false);
                toast.success('Question added successfully!');
            } catch (error) {
                console.error('Error adding question:', error);
                toast.error('Failed to add question. Please try again.');
            }
        } else {
            toast.error('Please enter a question name');
        }
    };

    const handleRemove = (index: number) => {
        setQuestionToDelete(index);
        setIsDeleteConfirmDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (questionToDelete !== null) {
            try {
                // Get all current questions
                const currentQuestions = form.getValues('questions');

                // Mark the question to be deleted with status "DELETED"
                const updatedQuestions = currentQuestions.map((question, index) => {
                    if (index === questionToDelete) {
                        return {
                            ...question,
                            status: 'DELETED',
                        };
                    }
                    return question;
                });

                // Update the form with the modified questions
                replace(updatedQuestions);

                // Create payload for API call with the updated questions
                const payload = createQuizSlidePayload(updatedQuestions, activeItem, buildSettingsPayload(quizSettings));

                // Call the API to update the quiz slide
                await addUpdateQuizSlide(payload);

                // Update the store
                setTimeout(syncToStore, 0);
                toast.success('Question deleted successfully!');
                setQuestionToDelete(null);
            } catch (error) {
                console.error('Error deleting question:', error);
                toast.error('Failed to delete question. Please try again.');
            }
        }
        setIsDeleteConfirmDialogOpen(false);
    };

    const cancelDelete = () => {
        setQuestionToDelete(null);
        setIsDeleteConfirmDialogOpen(false);
    };

    // Check if route parameters are available
    if (!chapterId || !moduleId || !subjectId || !sessionId) {
        console.warn('[QuizPreview] Route parameters not available:', {
            chapterId,
            moduleId,
            subjectId,
            sessionId,
        });
        return (
            <div className="flex size-full flex-col overflow-hidden rounded border border-neutral-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b bg-red-50 px-6 py-4">
                    <h2 className="text-lg font-semibold text-red-700">Quiz Questions</h2>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12">
                    <div className="text-center">
                        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-red-100">
                            <Warning size={24} className="text-red-500" />
                        </div>
                        <h3 className="mb-2 text-lg font-medium text-slate-600">
                            Unable to load quiz
                        </h3>
                        <p className="text-sm text-slate-400">
                            Route parameters are not available. Please refresh the page.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <FormProvider {...form}>
            <div className="flex size-full flex-col overflow-hidden rounded border border-neutral-200 bg-white shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between border-b bg-primary-50 px-6 py-4">
                    <h2 className="text-primary-700 text-lg font-semibold">Quiz Questions</h2>
                    <QuizAddQuestionsDropdown
                        onManual={() => setIsQuestionTypeDialogOpen(true)}
                        onDocument={() => setIsDocDialogOpen(true)}
                        onAI={() => setIsAIDialogOpen(true)}
                        onCSV={() => setIsCSVDialogOpen(true)}
                    />
                </div>

                {/* Settings Panel */}
                <QuizSettingsPanel
                    settings={quizSettings}
                    onChange={setQuizSettings}
                    onSave={handleSaveSettings}
                    isSaving={isSavingSettings}
                />

                {/* Question List */}
                <div className="flex-1 space-y-4 overflow-y-auto bg-white px-6 py-5">
                    {fields.filter((field) => field.status !== 'DELETED').length > 0 ? (
                        fields
                            .filter((field) => field.status !== 'DELETED')
                            .map((field) => {
                                // Find the original index in the fields array
                                const originalIndex = fields.findIndex((f) => f.id === field.id);
                                return (
                                    <QuestionDisplay
                                        key={field.id}
                                        question={field as TransformedQuestion}
                                        questionIndex={originalIndex}
                                        onEdit={handleEdit}
                                        onDelete={handleRemove}
                                    />
                                );
                            })
                    ) : (
                        <div
                            className="flex cursor-pointer flex-col items-center justify-center rounded-lg py-12 text-center transition-colors duration-200 hover:bg-slate-50"
                            onClick={() => setIsQuestionTypeDialogOpen(true)}
                        >
                            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-slate-100 transition-colors duration-200 hover:bg-slate-200">
                                <Plus size={24} className="text-slate-400" />
                            </div>
                            <h3 className="mb-2 text-lg font-medium text-slate-600">
                                No questions yet
                            </h3>
                            <p className="text-sm text-slate-400">
                                Add your first question to get started
                            </p>
                        </div>
                    )}
                </div>

                {/* Question Type Selection Dialog */}
                <QuestionTypeSelector
                    isOpen={isQuestionTypeDialogOpen}
                    onOpenChange={setIsQuestionTypeDialogOpen}
                    onSelectQuestionType={handleAddQuestion}
                />

                {/* Add Question Dialog */}
                <Dialog open={isAddQuestionDialogOpen} onOpenChange={setIsAddQuestionDialogOpen}>
                    <DialogContent className="no-scrollbar !m-0 flex h-full !w-full !max-w-full flex-col overflow-y-auto !rounded-none !p-0">
                        <h1 className="bg-primary-50 p-4 font-semibold text-primary-500">
                            Add New Question
                        </h1>

                        <FormProvider {...editForm}>
                            <MainViewComponentFactory
                                type={selectedQuestionType as QuestionType}
                                props={{
                                    form: editForm,
                                    currentQuestionIndex: 0,
                                    setCurrentQuestionIndex: () => {},
                                    className:
                                        'dialog-height overflow-auto ml-6 flex w-full flex-col gap-6 pr-6 pt-4',
                                    showQuestionNumber: false,
                                }}
                            />
                        </FormProvider>

                        <div className="flex justify-end px-6 pb-4 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="mr-2"
                                onClick={() => setIsAddQuestionDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <MyButton type="button" className="" onClick={handleAddQuestionConfirm}>
                                Add Question
                            </MyButton>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Edit Question Dialog */}
                <Dialog
                    open={editIndex !== null}
                    onOpenChange={(open) => !open && setEditIndex(null)}
                >
                    <DialogContent className="no-scrollbar !m-0 flex h-full !w-full !max-w-full flex-col overflow-y-auto !rounded-none !p-0">
                        <h1 className="bg-primary-50 p-4 font-semibold text-primary-500">
                            Edit Question {editIndex !== null ? editIndex + 1 : ''}
                        </h1>

                        <FormProvider {...editForm}>
                            <MainViewComponentFactory
                                type={
                                    editForm.getValues('questions.0.questionType') as QuestionType
                                }
                                props={{
                                    form: editForm,
                                    currentQuestionIndex: 0,
                                    setCurrentQuestionIndex: () => {},
                                    className:
                                        'dialog-height overflow-auto ml-6 flex w-full flex-col gap-6 pr-6 pt-4',
                                    showQuestionNumber: false,
                                }}
                            />
                        </FormProvider>

                        <div className="flex justify-end gap-3 px-6 pb-4 pt-2">
                            <DialogClose asChild>
                                <button ref={closeRef} className="hidden" />
                            </DialogClose>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditIndex(null)}
                            >
                                Cancel
                            </Button>
                            <MyButton type="button" onClick={handleEditConfirm}>
                                Save Changes
                            </MyButton>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <DeleteConfirmDialog
                    isOpen={isDeleteConfirmDialogOpen}
                    onOpenChange={setIsDeleteConfirmDialogOpen}
                    onConfirm={confirmDelete}
                    onCancel={cancelDelete}
                />

                {/* External question adding dialogs */}
                <QuizAddViaDocumentDialog
                    open={isDocDialogOpen}
                    onOpenChange={setIsDocDialogOpen}
                    onQuestionsReady={handleQuestionsReady}
                />
                <QuizAddViaAIDialog
                    open={isAIDialogOpen}
                    onOpenChange={setIsAIDialogOpen}
                    onQuestionsReady={handleQuestionsReady}
                />
                <QuizAddViaCSVDialog
                    open={isCSVDialogOpen}
                    onOpenChange={setIsCSVDialogOpen}
                    onQuestionsReady={handleQuestionsReady}
                />
                <QuizQuestionsPreviewDialog
                    open={isPreviewDialogOpen}
                    onOpenChange={setIsPreviewDialogOpen}
                    questions={pendingQuestions}
                    onConfirm={handleConfirmAddQuestions}
                    isLoading={isAddingExternal}
                />
            </div>
        </FormProvider>
    );
};

export default QuizPreview;
