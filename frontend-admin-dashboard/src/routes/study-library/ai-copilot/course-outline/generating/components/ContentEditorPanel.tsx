import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
    FileText,
    Video,
    Code,
    FileQuestion,
    Loader2,
    CheckCircle,
    Clock,
    Sparkles,
    Play,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { SlideGeneration, SlideType, QuizQuestion } from '../../../shared/types';
import { YooptaEditorWrapperSafe as YooptaEditorWrapper } from '../../../shared/components';
import Editor from '@monaco-editor/react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

import { isYouTubeUrl, getYouTubeEmbedUrl } from '../../../shared/utils/youtube';

interface ContentEditorPanelProps {
    slide: SlideGeneration | null;
    onContentChange: (slideId: string, content: string) => void;
    onSave: (slideId: string) => void;
}

const DEFAULT_QUIZ_QUESTIONS: QuizQuestion[] = [
    {
        question: 'What is the main concept covered in this section?',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswerIndex: 0,
        explanation: 'This is the explanation for the correct answer.',
    },
];

export const ContentEditorPanel: React.FC<ContentEditorPanelProps> = ({
    slide,
    onContentChange,
    onSave,
}) => {
    const [documentContent, setDocumentContent] = useState<string>('');
    const [codeContent, setCodeContent] = useState<string>('');
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(DEFAULT_QUIZ_QUESTIONS);
    const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
    const [isEditing, setIsEditing] = useState(true);

    // Initialize content when slide changes
    useEffect(() => {
        if (!slide) return;

        if (
            slide.slideType === 'doc' ||
            slide.slideType === 'objectives' ||
            slide.slideType === 'topic'
        ) {
            setDocumentContent(slide.content || '');
        } else if (
            slide.slideType === 'code-editor' ||
            slide.slideType === 'solution' ||
            slide.slideType === 'video-code' ||
            slide.slideType === 'ai-video-code'
        ) {
            setCodeContent(slide.content || '// Your code here\n');
        } else if (
            slide.slideType === 'quiz' ||
            slide.slideType === 'assessment' ||
            slide.slideType === 'ASSESSMENT'
        ) {
            if (slide.content) {
                try {
                    const parsed = JSON.parse(slide.content);
                    if (Array.isArray(parsed.questions)) {
                        setQuizQuestions(parsed.questions);
                        setSelectedAnswers(parsed.answers || {});
                    } else if (Array.isArray(parsed)) {
                        setQuizQuestions(parsed);
                        setSelectedAnswers({});
                    } else {
                        setQuizQuestions(DEFAULT_QUIZ_QUESTIONS);
                    }
                } catch {
                    setQuizQuestions(DEFAULT_QUIZ_QUESTIONS);
                }
            } else {
                setQuizQuestions(DEFAULT_QUIZ_QUESTIONS);
            }
            setCurrentQuizIndex(0);
        }
        setIsEditing(true);
    }, [slide?.id, slide?.content]);

    const handleSave = () => {
        if (!slide) return;

        let content = '';
        if (
            slide.slideType === 'doc' ||
            slide.slideType === 'objectives' ||
            slide.slideType === 'topic'
        ) {
            content = documentContent;
        } else if (
            slide.slideType === 'code-editor' ||
            slide.slideType === 'solution' ||
            slide.slideType === 'video-code' ||
            slide.slideType === 'ai-video-code'
        ) {
            content = codeContent;
        } else if (
            slide.slideType === 'quiz' ||
            slide.slideType === 'assessment' ||
            slide.slideType === 'ASSESSMENT'
        ) {
            content = JSON.stringify({ questions: quizQuestions, answers: selectedAnswers });
        }

        onContentChange(slide.id, content);
        onSave(slide.id);
        setIsEditing(false);
    };

    // Empty state - no slide selected
    if (!slide) {
        return (
            <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-md">
                <div className="flex flex-1 items-center justify-center text-neutral-400">
                    <div className="text-center">
                        <FileText className="mx-auto mb-3 size-10 opacity-50 sm:size-12" />
                        <p className="text-xs sm:text-sm">Select a page to view its content</p>
                    </div>
                </div>
            </div>
        );
    }

    // Pending state - show prompt
    if (slide.status === 'pending') {
        return (
            <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-md">
                {/* Header */}
                <div className="shrink-0 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <h3 className="truncate text-sm font-semibold text-neutral-900">
                            {slide.slideTitle}
                        </h3>
                        <span className="flex items-center gap-1 text-xs text-neutral-500">
                            <Clock className="size-3.5" />
                            Pending
                        </span>
                    </div>
                </div>

                {/* Prompt Display */}
                <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
                    <div className="max-w-md text-center">
                        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-100">
                            <Sparkles className="size-6 text-amber-600" />
                        </div>
                        <h4 className="mb-2 text-lg font-medium text-neutral-900">
                            AI Generation Prompt
                        </h4>
                        <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
                            {slide.prompt || 'No prompt available for this slide.'}
                        </p>
                        <p className="mt-4 text-xs text-neutral-400">
                            Content will be generated when you click "Generate Page Content"
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Generating state
    if (slide.status === 'generating') {
        return (
            <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-md">
                {/* Header */}
                <div className="shrink-0 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <h3 className="truncate text-sm font-semibold text-neutral-900">
                            {slide.slideTitle}
                        </h3>
                        <span className="flex items-center gap-1 text-xs text-indigo-600">
                            <Loader2 className="size-3.5 animate-spin" />
                            Generating...
                        </span>
                    </div>
                </div>

                {/* Loading Animation */}
                <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
                    <div className="text-center">
                        <div className="mx-auto mb-4 flex size-16 animate-pulse items-center justify-center rounded-full bg-indigo-100">
                            <Loader2 className="size-8 animate-spin text-indigo-600" />
                        </div>
                        <h4 className="mb-2 text-lg font-medium text-neutral-900">
                            Generating Content
                        </h4>
                        <p className="text-sm text-neutral-500">
                            AI is creating content for this page...
                        </p>
                        {slide.prompt && (
                            <p className="mx-auto mt-4 max-w-sm text-xs text-neutral-400">
                                Prompt: {slide.prompt.substring(0, 100)}...
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Completed state - show editable content
    return (
        <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-md">
            {/* Header */}
            <div className="shrink-0 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                        <CheckCircle className="size-4 shrink-0 text-green-500" />
                        <h3 className="truncate text-sm font-semibold text-neutral-900">
                            {slide.slideTitle}
                        </h3>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
                {/* Document Content */}
                {(slide.slideType === 'doc' ||
                    slide.slideType === 'objectives' ||
                    slide.slideType === 'topic') && (
                        <div className="h-full overflow-y-auto">
                            {isEditing ? (
                                <div className="h-full">
                                    <YooptaEditorWrapper
                                        value={documentContent}
                                        onChange={(content) => setDocumentContent(content)}
                                        className="h-full"
                                    />
                                </div>
                            ) : (
                                <div
                                    className="prose prose-sm max-w-none p-3 sm:p-6"
                                    dangerouslySetInnerHTML={{
                                        __html: documentContent || '<p>No content available</p>',
                                    }}
                                />
                            )}
                        </div>
                    )}

                {/* Video Content */}
                {(slide.slideType === 'video' || slide.slideType === 'ai-video') && (
                    <div className="flex h-full items-center justify-center bg-neutral-900 p-3 sm:p-6">
                        {slide.content && isYouTubeUrl(slide.content) ? (
                            <iframe
                                src={getYouTubeEmbedUrl(slide.content) || undefined}
                                className="aspect-video w-full max-w-3xl rounded-lg"
                                allowFullScreen
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            />
                        ) : slide.aiVideoData?.timelineUrl ? (
                            <div className="text-center text-white">
                                <Video className="mx-auto mb-4 size-12 opacity-50" />
                                <p className="text-sm">AI Content Generated</p>
                                <p className="mt-2 text-xs text-neutral-400">
                                    Video ID: {slide.aiVideoData.videoId}
                                </p>
                            </div>
                        ) : (
                            <div className="text-center text-white">
                                <Video className="mx-auto mb-4 size-12 opacity-50" />
                                <p className="text-sm">Video content will appear here</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Code Content */}
                {(slide.slideType === 'code-editor' ||
                    slide.slideType === 'solution' ||
                    slide.slideType === 'video-code' ||
                    slide.slideType === 'ai-video-code') && (
                        <div className="h-full">
                            <Editor
                                height="100%"
                                defaultLanguage="javascript"
                                value={codeContent}
                                onChange={(value) => setCodeContent(value || '')}
                                theme="vs-dark"
                                options={{
                                    readOnly: !isEditing,
                                    minimap: { enabled: false },
                                    fontSize: 13,
                                    lineNumbers: 'on',
                                    scrollBeyondLastLine: false,
                                    wordWrap: 'on',
                                }}
                            />
                        </div>
                    )}

                {/* Quiz Content */}
                {(slide.slideType === 'quiz' ||
                    slide.slideType === 'assessment' ||
                    slide.slideType === 'ASSESSMENT') && (
                        <div className="h-full overflow-y-auto p-3 sm:p-6">
                            {quizQuestions.length > 0 && quizQuestions[currentQuizIndex] && (
                                <div className="mx-auto max-w-2xl">
                                    {/* Question Navigation */}
                                    <div className="mb-6 flex items-center justify-between">
                                        <span className="text-sm font-medium text-neutral-600">
                                            Question {currentQuizIndex + 1} of {quizQuestions.length}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() =>
                                                    setCurrentQuizIndex(
                                                        Math.max(0, currentQuizIndex - 1)
                                                    )
                                                }
                                                disabled={currentQuizIndex === 0}
                                                className="rounded p-1 hover:bg-neutral-100 disabled:opacity-50"
                                            >
                                                <ChevronLeft className="size-5" />
                                            </button>
                                            <button
                                                onClick={() =>
                                                    setCurrentQuizIndex(
                                                        Math.min(
                                                            quizQuestions.length - 1,
                                                            currentQuizIndex + 1
                                                        )
                                                    )
                                                }
                                                disabled={currentQuizIndex === quizQuestions.length - 1}
                                                className="rounded p-1 hover:bg-neutral-100 disabled:opacity-50"
                                            >
                                                <ChevronRight className="size-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Question */}
                                    <div className="mb-4 rounded-lg bg-neutral-50 p-4 sm:mb-6 sm:p-6">
                                        <h4 className="mb-4 text-lg font-medium text-neutral-900">
                                            {quizQuestions[currentQuizIndex]?.question}
                                        </h4>
                                        <RadioGroup
                                            value={selectedAnswers[currentQuizIndex] || ''}
                                            onValueChange={(value) =>
                                                setSelectedAnswers((prev) => ({
                                                    ...prev,
                                                    [currentQuizIndex]: value,
                                                }))
                                            }
                                            disabled={!isEditing}
                                        >
                                            <div className="space-y-3">
                                                {quizQuestions[currentQuizIndex]?.options?.map(
                                                    (option, optionIndex) => (
                                                        <div
                                                            key={optionIndex}
                                                            className="flex items-center space-x-3"
                                                        >
                                                            <RadioGroupItem
                                                                value={optionIndex.toString()}
                                                                id={`option-${optionIndex}`}
                                                            />
                                                            <Label
                                                                htmlFor={`option-${optionIndex}`}
                                                                className="cursor-pointer text-sm text-neutral-700"
                                                            >
                                                                {option}
                                                            </Label>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </RadioGroup>
                                    </div>

                                    {/* Explanation */}
                                    {quizQuestions[currentQuizIndex]?.explanation && (
                                        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                                            <p className="text-sm text-green-800">
                                                <span className="font-medium">Explanation: </span>
                                                {quizQuestions[currentQuizIndex]?.explanation}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                {/* Homework/Assignment Content */}
                {(slide.slideType === 'homework' || slide.slideType === 'assignment') && (
                    <div className="h-full overflow-y-auto p-3 sm:p-6">
                        <div className="mx-auto max-w-2xl">
                            <div className="rounded-lg bg-neutral-50 p-6">
                                <h4 className="mb-4 text-lg font-medium text-neutral-900">
                                    Assignment
                                </h4>
                                <div
                                    className="prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{
                                        __html: slide.content || '<p>No assignment content</p>',
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
