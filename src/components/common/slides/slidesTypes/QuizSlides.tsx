/* eslint-disable */
// @ts-nocheck
import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
    FormLabel,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSlideStore } from '@/stores/Slides/useSlideStore'; // Adjust path
import debounce from 'lodash.debounce'; // Import debounce
import { Button } from '@/components/ui/button';
import { Plus, Trash2, MessageCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

// Assuming QuestionFormData and SlideTypeEnum are from your types file
import type { QuestionFormData } from '@/components/common/slides/utils/types'; // Import QuestionFormData as type
import { SlideTypeEnum } from '@/components/common/slides/utils/types';

interface QuizSlideProps {
    formdata: QuestionFormData; // Initial data for the form
    questionType: SlideTypeEnum.Quiz | SlideTypeEnum.Feedback;
    className?: string;
    currentSlideId: string;
    isPresentationMode?: boolean;
}

export const QuizSlide: React.FC<QuizSlideProps> = ({
    formdata,
    questionType,
    className,
    currentSlideId,
    isPresentationMode = false,
}) => {
    const { updateQuizFeedbackSlide } = useSlideStore();

    // console.log(`[QuizSlide] ID: ${currentSlideId}, PresentationMode: ${isPresentationMode}, Received formdata:`, JSON.parse(JSON.stringify(formdata)));

    const form = useForm<QuestionFormData>({
        defaultValues: formdata || {
            questionName: '',
            singleChoiceOptions: [],
            feedbackAnswer: '',
        },
    });

    const { control, getValues, setValue, watch, reset } = form;

    // Using watch() on the entire form could be expensive.
    // It's better to use useEffect with specific field watches or a debounced submit.
    const watchedFormValues = watch();

    // Use refs to store previous values for comparison and track initialization
    const hasInitialized = useRef(false);
    const previousSlideId = useRef(currentSlideId);
    const previousFormValues = useRef<QuestionFormData>(watchedFormValues);

    useEffect(() => {
        // Only reset if the slide ID changed (different slide) or if this is the first initialization
        const slideChanged = previousSlideId.current !== currentSlideId;

        if (!hasInitialized.current || slideChanged) {
            const resetData = formdata || { questionName: '', singleChoiceOptions: [], feedbackAnswer: '' };
            reset(resetData);

            // Initialize the previous form values ref
            previousFormValues.current = resetData;

            hasInitialized.current = true;
            previousSlideId.current = currentSlideId;
        }
    }, [formdata, reset, currentSlideId]);

    // Function to update store - called on blur events instead of during typing
    const updateStoreIfChanged = useCallback((data: QuestionFormData) => {
        if (!isPresentationMode && hasInitialized.current) {
            const hasChanged = JSON.stringify(previousFormValues.current) !== JSON.stringify(data);
            if (hasChanged) {
                // console.log("QuizSlide: Update to store for slide", currentSlideId, data);
                updateQuizFeedbackSlide(currentSlideId, data);
                previousFormValues.current = data;
            }
        }
    }, [currentSlideId, isPresentationMode, updateQuizFeedbackSlide]);

    // Handle blur events for question name editor
    const handleQuestionNameBlur = useCallback(() => {
        const currentValues = getValues();
        updateStoreIfChanged(currentValues);
    }, [getValues, updateStoreIfChanged]);

    // Handle blur events for option editors
    const handleOptionBlur = useCallback(() => {
        const currentValues = getValues();
        updateStoreIfChanged(currentValues);
    }, [getValues, updateStoreIfChanged]);

    // Update store immediately for option changes (adding/removing/selecting) since these don't involve typing
    const lastOptionsLength = useRef(watchedFormValues.singleChoiceOptions?.length || 0);
    useEffect(() => {
        if (hasInitialized.current) {
            const currentValues = getValues();
            const currentOptions = currentValues.singleChoiceOptions || [];
            const previousOptions = previousFormValues.current.singleChoiceOptions || [];

            // Check for structural changes (length change or selection change)
            const lengthChanged = currentOptions.length !== previousOptions.length;
            const selectionChanged = currentOptions.some((opt, idx) =>
                opt.isSelected !== previousOptions[idx]?.isSelected
            );

            if (lengthChanged || selectionChanged) {
                updateStoreIfChanged(currentValues);
            }

            lastOptionsLength.current = currentOptions.length;
        }
    }, [watchedFormValues.singleChoiceOptions, getValues, updateStoreIfChanged]);

    const handleOptionSelectionChange = (optionIndex: number) => {
        if (isPresentationMode) return;

        const currentOptions = getValues('singleChoiceOptions') || [];
        const isCurrentlySelected = currentOptions[optionIndex]?.isSelected;

        const updatedOptions = currentOptions.map((option: any, index: number) => ({
            ...option,
            isSelected: index === optionIndex ? !isCurrentlySelected : false,
        }));

        setValue('singleChoiceOptions', updatedOptions, {
            shouldDirty: true,
            shouldValidate: true,
        });
    };

    const handleAddOption = () => {
        const currentOptions = getValues('singleChoiceOptions') || [];
        if (currentOptions.length >= 5) {
            toast.info('You can add a maximum of 5 options.');
            return;
        }
        const newOption = {
            id: `temp-opt-${Date.now()}`,
            name: '',
            isSelected: false,
        };
        setValue('singleChoiceOptions', [...currentOptions, newOption], {
            shouldDirty: true,
            shouldValidate: true,
        });
    };

    const handleRemoveOption = (indexToRemove: number) => {
        const currentOptions = getValues('singleChoiceOptions') || [];
        if (currentOptions.length <= 2) {
            toast.info('You need at least 2 options for a quiz.');
            return;
        }
        const updatedOptions = currentOptions.filter((_, index) => index !== indexToRemove);
        setValue('singleChoiceOptions', updatedOptions, {
            shouldDirty: true,
            shouldValidate: true,
        });
    };

    if (isPresentationMode) {
        const displayData = formdata || {};
        // console.log(`[QuizSlide] Presentation Mode - ID: ${currentSlideId}, DisplayData:`, JSON.parse(JSON.stringify(displayData)));

        return (
            <div
                className={`flex h-full w-full flex-col items-center justify-center overflow-hidden relative ${className}`}
                style={{ boxSizing: 'border-box' }}
            >
                {/* Enhanced background with gradient and animated elements */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 pointer-events-none" />
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

                <ScrollArea className="h-full w-full relative z-10">
                    <div className="px-4 py-4 sm:px-6 md:px-8 lg:px-12 text-center">
                        {displayData?.questionName && (
                            <div className="mb-6 lg:mb-8">
                                <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/50 shadow-lg">
                                    {questionType === SlideTypeEnum.Quiz ? (
                                        <CheckCircle className="text-blue-500" size={20} />
                                    ) : (
                                        <MessageCircle className="text-purple-500" size={20} />
                                    )}
                                    <span className="text-xs font-semibold text-slate-600 tracking-wide">
                                        {questionType === SlideTypeEnum.Quiz ? 'Interactive Quiz' : 'Feedback Poll'}
                                    </span>
                                </div>
                                <h2
                                    className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold leading-tight bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent"
                                dangerouslySetInnerHTML={{ __html: displayData.questionName }}
                            />
                            </div>
                        )}

                        {questionType === SlideTypeEnum.Quiz &&
                            displayData?.singleChoiceOptions &&
                            Array.isArray(displayData.singleChoiceOptions) && (
                                <div className="mx-auto w-full max-w-4xl space-y-3 lg:space-y-4 pb-24"> {/* Added pb-24 to prevent overlap with bottom action bar/overlay */}
                                    {displayData.singleChoiceOptions.map(
                                        (option: any, index: number) => (
                                            <div
                                                key={option.id || `option-${index}`}
                                                className="group relative rounded-xl lg:rounded-2xl border border-slate-200/50 bg-white/80 backdrop-blur-sm p-3 lg:p-4 text-left shadow-lg hover:shadow-xl transition-all duration-300 ease-out hover:scale-[1.02] hover:border-blue-300/50 cursor-pointer h-auto min-h-[3.5rem]"
                                            >
                                                {/* Subtle gradient overlay */}
                                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 rounded-xl lg:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                                <div className="relative flex items-start"> {/* Changed items-center to items-start for multi-line support */}
                                                    <span className="mr-3 lg:mr-4 mt-0.5 flex-shrink-0 flex items-center justify-center w-7 h-7 lg:w-8 lg:h-8 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-sm lg:text-base rounded-full shadow-lg group-hover:scale-110 transition-transform duration-200">
                                                        {String.fromCharCode(65 + index)}
                                                    </span>
                                                    <span
                                                        className="text-sm lg:text-lg font-medium text-slate-700 group-hover:text-slate-800 transition-colors duration-200 break-words whitespace-normal" // Added break-words whitespace-normal to fix trimming
                                                        dangerouslySetInnerHTML={{
                                                            __html: option.name || 'Option text missing',
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            )}

                        {questionType === SlideTypeEnum.Feedback && (
                            <div className="mx-auto mt-6 lg:mt-8 w-full max-w-4xl">
                                <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100/80 backdrop-blur-sm rounded-lg border border-purple-200/50">
                                    <MessageCircle className="text-purple-600" size={18} />
                                    <p className="text-base font-semibold text-purple-700">
                                    Your feedback is valuable!
                                </p>
                                </div>
                                {displayData?.feedbackAnswer ? (
                                    <div className="rounded-xl lg:rounded-2xl border border-purple-200/50 bg-white/90 backdrop-blur-sm p-4 lg:p-6 text-left shadow-xl">
                                        <p
                                            className="text-sm lg:text-base text-slate-700 leading-relaxed"
                                            dangerouslySetInnerHTML={{
                                                __html: displayData.feedbackAnswer,
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="rounded-xl lg:rounded-2xl border-2 border-dashed border-purple-300/50 bg-white/60 backdrop-blur-sm p-8 lg:p-12 text-center shadow-lg">
                                        <MessageCircle className="mx-auto mb-3 text-purple-400" size={40} />
                                        <p className="text-xs lg:text-sm text-purple-400 font-medium">
                                            Feedback area - participants can share their thoughts here
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {!(
                            displayData?.questionName ||
                            (questionType === SlideTypeEnum.Quiz &&
                                displayData?.singleChoiceOptions?.length > 0) ||
                            (questionType === SlideTypeEnum.Feedback && displayData?.feedbackAnswer)
                        ) && (
                            <div className="mt-8 lg:mt-12">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/50 shadow-lg">
                                    {questionType === SlideTypeEnum.Quiz ? (
                                        <CheckCircle className="text-slate-400" size={20} />
                                    ) : (
                                        <MessageCircle className="text-slate-400" size={20} />
                                    )}
                                    <p className="text-slate-500 font-medium text-sm">
                                        This slide is awaiting content
                            </p>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
        );
    }

    // Editor Mode with enhanced styling
    const currentOptions = watch('singleChoiceOptions') || [];

    return (
        <div className="h-full w-full relative overflow-hidden">
            {/* Enhanced background for editor mode */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/20 pointer-events-none" />
            <div className="absolute top-0 right-1/4 w-64 h-64 bg-blue-500/3 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-purple-500/3 rounded-full blur-2xl" />

            <ScrollArea className="h-full w-full relative z-10">
            <Form {...form}>
                    <form className={`space-y-8 p-6 lg:p-8 ${className}`}>
                        {/* Enhanced question section */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6 shadow-lg">
                            <FormLabel className="mb-4 flex items-center gap-3 text-lg font-semibold text-slate-700">
                                {questionType === SlideTypeEnum.Quiz ? (
                                    <CheckCircle className="text-blue-500" size={24} />
                                ) : (
                                    <MessageCircle className="text-purple-500" size={24} />
                                )}
                            Question Title/Prompt
                        </FormLabel>
                        <FormField
                            control={control}
                            name="questionName"
                            render={({ field }) => (
                                <FormItem className="w-full">
                                    <FormControl>
                                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                        <RichTextEditor
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                            onBlur={handleQuestionNameBlur}
                                            placeholder="Type your question or prompt here..."
                                            minHeight={120}
                                        />
                                            </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {questionType === SlideTypeEnum.Quiz && (
                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6 shadow-lg space-y-6">
                                <FormLabel className="mb-4 flex items-center gap-3 text-lg font-semibold text-slate-700">
                                    <CheckCircle className="text-blue-500" size={24} />
                                Answer Options (Mark the correct one)
                            </FormLabel>
                            {Array.isArray(currentOptions) &&
                                currentOptions.map((option: any, idx: number) => (
                                    <div
                                        key={option?.id || `edit-option-${idx}`}
                                            className={`relative group rounded-xl border-2 p-4 transition-all duration-300 ease-out
                                            ${option?.isSelected
                                                ? 'border-blue-400 bg-blue-50/50 shadow-lg shadow-blue-500/10'
                                                : 'border-slate-200 bg-white/50 hover:border-slate-300 hover:shadow-md'
                                            }`}
                                    >
                                            {/* Gradient overlay for selected option */}
                                            {option?.isSelected && (
                                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-blue-500/5 rounded-xl" />
                                            )}

                                            <div className="relative flex items-start gap-4">
                                                <div className="flex items-center pt-2">
                                            <FormField
                                                control={control}
                                                name={`singleChoiceOptions.${idx}.isSelected`}
                                                render={({ field }) => (
                                                    <FormItem className="flex items-center">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={!!field.value}
                                                                onCheckedChange={() =>
                                                                    handleOptionSelectionChange(idx)
                                                                }
                                                                        className="size-5 rounded-md border-2 border-slate-400 focus-visible:ring-blue-400 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 transition-all duration-200"
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                                    <span className="ml-3 flex items-center justify-center w-7 h-7 bg-gradient-to-r from-slate-600 to-slate-700 text-white text-sm font-bold rounded-full shadow-sm">
                                                        {String.fromCharCode(65 + idx)}
                                            </span>
                                        </div>
                                        <FormField
                                            control={control}
                                            name={`singleChoiceOptions.${idx}.name`}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormControl>
                                                                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                                        <RichTextEditor
                                                            value={field.value || ''}
                                                            onChange={field.onChange}
                                                            onBlur={handleOptionBlur}
                                                            placeholder={`Option ${String.fromCharCode(65 + idx)} content`}
                                                            minHeight={80}
                                                            className="text-sm"
                                                        />
                                                                </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                                    className="mt-2 shrink-0 h-8 w-8 rounded-lg text-slate-400 hover:bg-red-100 hover:text-red-500 transition-all duration-200 hover:scale-105"
                                            onClick={() => handleRemoveOption(idx)}
                                            title="Remove Option"
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                            </div>
                                    </div>
                                ))}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                    className="w-full border-2 border-dashed border-blue-300 hover:border-blue-400 bg-white/50 hover:bg-blue-50/50 text-blue-600 hover:text-blue-700 font-semibold py-3 rounded-xl transition-all duration-200 hover:scale-[1.02]"
                                onClick={handleAddOption}
                            >
                                    <Plus size={16} className="mr-2" /> Add Option
                            </Button>
                        </div>
                    )}

                    {questionType === SlideTypeEnum.Feedback && (
                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6 shadow-lg">
                                <FormLabel className="mb-4 flex items-center gap-3 text-lg font-semibold text-slate-700">
                                    <MessageCircle className="text-purple-500" size={24} />
                                Feedback Area Configuration
                            </FormLabel>
                            <FormField
                                control={control}
                                    name="feedbackAnswer"
                                render={({ field }) => (
                                    <FormItem className="w-full">
                                        <FormControl>
                                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                            <RichTextEditor
                                                value={field.value || ''}
                                                onChange={field.onChange}
                                                onBlur={handleQuestionNameBlur}
                                                placeholder="Configure feedback prompt or display area..."
                                                minHeight={120}
                                            />
                                                </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    )}
                </form>
            </Form>
        </ScrollArea>
        </div>
    );
};
