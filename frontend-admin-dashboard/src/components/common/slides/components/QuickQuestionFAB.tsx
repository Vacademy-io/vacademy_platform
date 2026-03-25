import React, { useState, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Plus,
    HelpCircle,
    Send,
    X,
    ChevronsRight,
    ListEnd,
    CheckCircle,
    MessageCircle,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { createNewSlide } from '../utils/util';
import { SlideTypeEnum } from '../utils/types';
import type { Slide as AppSlide, QuizSlideData } from '../utils/types';

export type InsertionBehavior = 'next' | 'end';

interface QuickQuestionFABProps {
    onAddQuickQuestion: (slideData: AppSlide, insertionBehavior: InsertionBehavior) => void;
    disabled?: boolean;
}

export const QuickQuestionFAB: React.FC<QuickQuestionFABProps> = ({
    onAddQuickQuestion,
    disabled,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [questionText, setQuestionText] = useState('');
    const [options, setOptions] = useState(['', '', '', '']);
    const [insertionBehavior, setInsertionBehavior] = useState<InsertionBehavior>('next');
    const formId = useId();

    const handleAddOption = () => {
        if (options.length < 5) {
            setOptions([...options, '']);
        } else {
            toast.info('You can add a maximum of 5 options.');
        }
    };

    const handleRemoveOption = (index: number) => {
        if (options.length > 2) {
            const newOptions = [...options];
            newOptions.splice(index, 1);
            setOptions(newOptions);
        } else {
            toast.info('You need at least 2 options for a quiz.');
        }
    };

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const resetForm = () => {
        setQuestionText('');
        setOptions(['', '', '', '']);
        setInsertionBehavior('next');
    };

    const handleSubmit = (type: 'poll' | 'question') => {
        if (!questionText.trim()) {
            toast.error('Question text cannot be empty.');
            return;
        }

        let newSlide: AppSlide;

        if (type === 'poll') {
            newSlide = createNewSlide(SlideTypeEnum.Feedback);
            // For feedback slides, the question text is stored in `questionName` within `elements`.
            (newSlide as QuizSlideData).elements = {
                ...((newSlide as QuizSlideData).elements || {}),
                questionName: questionText,
                feedbackAnswer: '', // Default empty answer field
            };
        } else {
            // type === 'question'
            if (options.some((opt) => !opt.trim())) {
                toast.error('All option fields must be filled out.');
                return;
            }
            newSlide = createNewSlide(SlideTypeEnum.Quiz);
            (newSlide as QuizSlideData).elements = {
                questionName: questionText,
                singleChoiceOptions: options.map((opt, index) => ({
                    id: `temp-opt-${Date.now()}-${index}`,
                    name: opt,
                    isSelected: false,
                })),
                timeLimit: 60,
            };
        }

        onAddQuickQuestion(newSlide, insertionBehavior);
        resetForm();
        setIsOpen(false);
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    className="fixed bottom-16 right-5 z-[1003] size-16 rounded-full border border-orange-400/30 bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-2xl backdrop-blur-sm transition-all duration-500 hover:scale-110 hover:from-orange-600 hover:to-orange-700 focus:ring-4 focus:ring-orange-300/50 disabled:scale-100 disabled:opacity-50"
                    size="icon"
                    disabled={disabled}
                    title="Add a Quick Question"
                >
                    {/* Subtle glow effect */}
                    <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-orange-400/20 to-orange-600/20 blur-xl" />

                    <Plus
                        className={`relative z-10 transition-transform duration-500 ${isOpen ? 'rotate-45 scale-110' : 'rotate-0 scale-100'}`}
                        size={28}
                    />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="z-[2000] mr-5 w-[380px] overflow-hidden rounded-2xl border-white/20 bg-white/95 p-0 shadow-2xl backdrop-blur-xl"
                align="end"
            >
                {/* Enhanced background effects */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-50/50 via-white to-purple-50/50" />
                <div className="absolute right-0 top-0 size-24 rounded-full bg-orange-500/10 blur-2xl" />
                <div className="absolute bottom-0 left-0 size-24 rounded-full bg-blue-500/10 blur-2xl" />

                <Tabs defaultValue="question" className="relative z-10 w-full">
                    {/* Enhanced compact header */}
                    <div className="flex items-center justify-between border-b border-slate-200/50 bg-white/80 p-3 shadow-sm backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 p-1.5 shadow-lg">
                                <Plus className="text-white" size={14} />
                            </div>
                            <h3 className="text-base font-bold text-slate-800">Quick Question</h3>
                        </div>
                        <TabsList className="h-8 border border-slate-200/50 bg-slate-100/80 shadow-sm backdrop-blur-sm">
                            <TabsTrigger
                                value="question"
                                className="px-3 py-1 text-xs transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
                            >
                                <CheckCircle size={14} className="mr-1" />
                                Quiz
                            </TabsTrigger>
                            <TabsTrigger
                                value="poll"
                                className="px-3 py-1 text-xs transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm"
                            >
                                <MessageCircle size={14} className="mr-1" />
                                Poll
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="space-y-4 p-4">
                        <TabsContent value="question" className="m-0 space-y-4">
                            {/* Enhanced question input */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor={`q-text-${formId}`}
                                    className="flex items-center gap-2 text-sm font-semibold text-slate-700"
                                >
                                    <CheckCircle className="text-blue-500" size={14} />
                                    Quiz Question
                                </Label>
                                <Input
                                    id={`q-text-${formId}`}
                                    value={questionText}
                                    onChange={(e) => setQuestionText(e.target.value)}
                                    placeholder="e.g., What is the capital of France?"
                                    className="rounded-lg border-slate-300 bg-white/80 text-sm shadow-sm backdrop-blur-sm transition-all duration-200 focus:border-blue-400 focus:ring-blue-400/20"
                                />
                            </div>

                            {/* Enhanced options section */}
                            <div className="space-y-3">
                                <Label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <div className="size-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600" />
                                    Answer Options
                                </Label>
                                <div className="space-y-2">
                                    {options.map((opt, index) => (
                                        <div key={index} className="group flex items-center gap-2">
                                            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-slate-600 to-slate-700 text-xs font-bold text-white shadow-sm">
                                                {String.fromCharCode(65 + index)}
                                            </div>
                                            <Input
                                                value={opt}
                                                onChange={(e) =>
                                                    handleOptionChange(index, e.target.value)
                                                }
                                                placeholder={`Option ${index + 1}`}
                                                className="h-8 flex-1 rounded-lg border-slate-300 bg-white/80 text-sm shadow-sm backdrop-blur-sm transition-all duration-200 focus:border-blue-400 focus:ring-blue-400/20"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-6 shrink-0 rounded-lg text-slate-400 transition-all duration-200 hover:scale-105 hover:bg-red-100 hover:text-red-500"
                                                onClick={() => handleRemoveOption(index)}
                                            >
                                                <X size={14} />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-full rounded-lg border-2 border-dashed border-blue-300 bg-white/50 text-xs font-semibold text-blue-600 transition-all duration-200 hover:scale-[1.02] hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700"
                                    onClick={handleAddOption}
                                >
                                    <Plus size={12} className="mr-1" /> Add Option
                                </Button>
                            </div>

                            {/* Enhanced submit button */}
                            <Button
                                className="w-full rounded-lg border border-blue-500/30 bg-gradient-to-r from-blue-600 to-blue-700 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:scale-[1.02] hover:from-blue-700 hover:to-blue-800"
                                onClick={() => handleSubmit('question')}
                            >
                                <Send size={14} className="mr-2" /> Launch Quiz Question
                            </Button>
                        </TabsContent>

                        <TabsContent value="poll" className="m-0 space-y-4">
                            {/* Enhanced poll input */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor={`poll-text-${formId}`}
                                    className="flex items-center gap-2 text-sm font-semibold text-slate-700"
                                >
                                    <MessageCircle className="text-purple-500" size={14} />
                                    Poll Question
                                </Label>
                                <Input
                                    id={`poll-text-${formId}`}
                                    value={questionText}
                                    onChange={(e) => setQuestionText(e.target.value)}
                                    placeholder="e.g., What topics should we cover next?"
                                    className="rounded-lg border-slate-300 bg-white/80 text-sm shadow-sm backdrop-blur-sm transition-all duration-200 focus:border-purple-400 focus:ring-purple-400/20"
                                />
                            </div>

                            {/* Enhanced description */}
                            <div className="rounded-lg border border-purple-200/50 bg-purple-50/80 p-3 backdrop-blur-sm">
                                <div className="mb-1 flex items-center gap-2">
                                    <MessageCircle className="text-purple-600" size={14} />
                                    <span className="text-sm font-medium text-purple-700">
                                        Open-ended Feedback
                                    </span>
                                </div>
                                <p className="text-xs leading-relaxed text-purple-600">
                                    Participants can type short text responses for opinions or
                                    feedback.
                                </p>
                            </div>

                            {/* Enhanced submit button */}
                            <Button
                                className="w-full rounded-lg border border-purple-500/30 bg-gradient-to-r from-purple-600 to-purple-700 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all duration-300 hover:scale-[1.02] hover:from-purple-700 hover:to-purple-800"
                                onClick={() => handleSubmit('poll')}
                            >
                                <HelpCircle size={14} className="mr-2" /> Launch Feedback Poll
                            </Button>
                        </TabsContent>

                        {/* Enhanced placement section */}
                        <div className="!mt-6 border-t border-slate-200/50 pt-4">
                            <Label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <div className="size-3 rounded-sm bg-gradient-to-r from-orange-500 to-orange-600" />
                                Placement
                            </Label>
                            <RadioGroup
                                defaultValue="next"
                                value={insertionBehavior}
                                onValueChange={(val: InsertionBehavior) =>
                                    setInsertionBehavior(val)
                                }
                                className="grid grid-cols-2 gap-2"
                            >
                                <div>
                                    <RadioGroupItem
                                        value="next"
                                        id={`placement-next-${formId}`}
                                        className="peer sr-only"
                                    />
                                    <Label
                                        htmlFor={`placement-next-${formId}`}
                                        className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-2 border-slate-200 bg-white/80 p-2 text-xs font-medium backdrop-blur-sm transition-all duration-200 hover:bg-slate-50 peer-data-[state=checked]:border-orange-500 peer-data-[state=checked]:bg-orange-50/50 peer-data-[state=checked]:text-orange-700 peer-data-[state=checked]:shadow-lg peer-data-[state=checked]:shadow-orange-500/10 [&:has([data-state=checked])]:border-orange-500"
                                    >
                                        <ChevronsRight size={14} /> After This
                                    </Label>
                                </div>
                                <div>
                                    <RadioGroupItem
                                        value="end"
                                        id={`placement-end-${formId}`}
                                        className="peer sr-only"
                                    />
                                    <Label
                                        htmlFor={`placement-end-${formId}`}
                                        className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-2 border-slate-200 bg-white/80 p-2 text-xs font-medium backdrop-blur-sm transition-all duration-200 hover:bg-slate-50 peer-data-[state=checked]:border-orange-500 peer-data-[state=checked]:bg-orange-50/50 peer-data-[state=checked]:text-orange-700 peer-data-[state=checked]:shadow-lg peer-data-[state=checked]:shadow-orange-500/10 [&:has([data-state=checked])]:border-orange-500"
                                    >
                                        <ListEnd size={14} /> At The End
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>
                </Tabs>
            </PopoverContent>
        </Popover>
    );
};
