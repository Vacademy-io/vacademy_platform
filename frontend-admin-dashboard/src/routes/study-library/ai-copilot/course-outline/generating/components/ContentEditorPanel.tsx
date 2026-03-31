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

/**
 * Extracts the user-facing text from video/ai-video slide content.
 *
 * Data formats by slide type:
 * - VIDEO: HTML string with <p>title</p><p>description</p><p>YouTube URL</p>
 * - AI_VIDEO: JSON string with { videoId, status, scriptUrl, message, ... } (no script text)
 * - VIDEO_CODE: JSON { video: {...}, code: { content: "markdown" }, layout }
 * - AI_VIDEO_CODE: JSON { video: { videoId, scriptUrl, message, ... }, code: { content }, layout }
 *
 * Returns { label, html } where html is safe to render via dangerouslySetInnerHTML.
 */
function extractVideoDisplayContent(
    content: string,
    slideType: string
): { label: string; html: string } {
    if (!content) return { label: '', html: '' };

    const isAiVideo = slideType === 'ai-video' || slideType === 'ai-video-code';

    // Try parsing as JSON first (VIDEO_CODE, AI_VIDEO_CODE, AI_VIDEO)
    try {
        const parsed = JSON.parse(content);

        if (isAiVideo) {
            // AI video types: script is in code.content (markdown) or video.message
            const script =
                parsed?.code?.content ||
                parsed?.video?.message ||
                parsed?.message ||
                '';

            if (script) {
                // Convert markdown-style newlines to HTML
                const html = script
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/\n/g, '<br/>')
                    .replace(/^/, '<p>')
                    .replace(/$/, '</p>')
                    .replace(/```(\w*)\n?([\s\S]*?)```/g,
                        (_: string, lang: string, code: string) =>
                            `<pre><code class="language-${lang || 'text'}">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
                    );
                return { label: 'Script', html };
            }

            // Fallback: show status info
            const status = parsed?.video?.status || parsed?.status || '';
            const stage = parsed?.video?.currentStage || parsed?.currentStage || '';
            if (status) {
                return {
                    label: 'Script',
                    html: `<p>Video generation status: <strong>${status}</strong>${stage ? ` (${stage})` : ''}</p><p>The script will appear once generation completes.</p>`,
                };
            }

            return { label: 'Script', html: '' };
        } else {
            // YouTube video types: description is in video.description or video.title
            const title = parsed?.video?.title || '';
            const description = parsed?.video?.description || '';
            let html = '';
            if (title) html += `<h3>${title}</h3>`;
            if (description) html += `<p>${description}</p>`;
            return { label: 'Description', html };
        }
    } catch {
        // Not JSON — it's HTML (VIDEO type stores content as HTML)
        // Strip YouTube URL links but keep the rest
        let html = content
            .replace(/<p[^>]*>YouTube URL:.*?<\/p>/gi, '')
            .replace(/<a[^>]*href="[^"]*(?:youtube\.com|youtu\.be)[^"]*"[^>]*>.*?<\/a>/gi, '')
            .replace(/<p[^>]*>\s*<\/p>/gi, '');
        return { label: isAiVideo ? 'Script' : 'Description', html: html.trim() };
    }
}

/**
 * Strips HTML tags from a string, returning plain text.
 */
function stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, '').trim();
}

/**
 * Parses quiz/assessment content from slide.content into a normalized QuizQuestion array.
 * Handles both the simple format { questions: [...] } and the assessment format with nested objects.
 */
function parseQuizContent(content: string): { questions: QuizQuestion[]; answers: Record<number, string> } {
    if (!content) return { questions: [], answers: {} };

    try {
        const parsed = JSON.parse(content);
        let rawQuestions: any[] = [];
        let answers: Record<number, string> = {};

        if (Array.isArray(parsed.questions)) {
            rawQuestions = parsed.questions;
            answers = parsed.answers || {};
        } else if (Array.isArray(parsed)) {
            rawQuestions = parsed;
        } else {
            return { questions: [], answers: {} };
        }

        const questions: QuizQuestion[] = rawQuestions.map((q: any) => {
            // Normalize question text - strip HTML if it contains tags
            let questionText = '';
            if (typeof q.question === 'object' && q.question?.content) {
                questionText = stripHtml(q.question.content);
            } else {
                questionText = stripHtml(String(q.question || ''));
            }

            // Normalize options - strip HTML from each option
            let options: string[] = [];
            if (Array.isArray(q.options)) {
                options = q.options.map((opt: any) => {
                    if (typeof opt === 'object' && opt?.content) {
                        return stripHtml(opt.content);
                    }
                    return stripHtml(String(opt || ''));
                });
            }

            // Resolve correct answer index
            let correctAnswerIndex = q.correctAnswerIndex ?? 0;
            if (Array.isArray(q.correct_options) && q.correct_options.length > 0 && Array.isArray(q.options)) {
                const correctId = q.correct_options[0];
                const foundIdx = q.options.findIndex((opt: any) =>
                    typeof opt === 'object' ? (opt.preview_id === correctId || opt.id === correctId) : opt === correctId
                );
                if (foundIdx !== -1) correctAnswerIndex = foundIdx;
            }

            // Normalize explanation
            let explanation = '';
            const expSource = q.explanation || q.exp;
            if (typeof expSource === 'object' && expSource?.content) {
                explanation = stripHtml(expSource.content);
            } else {
                explanation = stripHtml(String(expSource || ''));
            }

            return { question: questionText, options, correctAnswerIndex, explanation };
        });

        return { questions, answers };
    } catch {
        return { questions: [], answers: {} };
    }
}

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
            slide.slideType === 'solution'
        ) {
            setCodeContent(slide.content || '// Start writing your code here');
        } else if (
            slide.slideType === 'quiz' ||
            slide.slideType === 'assessment' ||
            slide.slideType === 'ASSESSMENT'
        ) {
            const { questions, answers } = parseQuizContent(slide.content || '');
            setQuizQuestions(questions.length > 0 ? questions : DEFAULT_QUIZ_QUESTIONS);
            setSelectedAnswers(answers);
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
            slide.slideType === 'solution'
        ) {
            content = codeContent;
        } else if (
            slide.slideType === 'video' ||
            slide.slideType === 'ai-video' ||
            slide.slideType === 'video-code' ||
            slide.slideType === 'ai-video-code'
        ) {
            content = slide.content || '';
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
            <div key={slide.id} className="flex-1 overflow-hidden">
                {/* Document Content */}
                {(slide.slideType === 'doc' ||
                    slide.slideType === 'objectives' ||
                    slide.slideType === 'topic') && (
                        <div className="h-full overflow-y-auto">
                            {isEditing ? (
                                <div className="h-full px-6 py-4 sm:px-8 sm:py-6">
                                    <YooptaEditorWrapper
                                        value={documentContent}
                                        onChange={(content) => setDocumentContent(content)}
                                        className="h-full"
                                    />
                                </div>
                            ) : (
                                <div
                                    className="prose prose-base max-w-none px-6 py-4 sm:px-8 sm:py-6 prose-headings:text-neutral-900 prose-h1:text-2xl prose-h1:font-bold prose-h2:text-xl prose-h2:font-semibold prose-h3:text-lg prose-h3:font-semibold prose-p:text-neutral-700 prose-p:leading-relaxed"
                                    dangerouslySetInnerHTML={{
                                        __html: documentContent || '<p>No content available</p>',
                                    }}
                                />
                            )}
                        </div>
                    )}

                {/* Video / AI-Video / Video-Code / AI-Video-Code Content - show description or script */}
                {(slide.slideType === 'video' ||
                    slide.slideType === 'ai-video' ||
                    slide.slideType === 'video-code' ||
                    slide.slideType === 'ai-video-code') && (() => {
                    const { label, html } = extractVideoDisplayContent(slide.content || '', slide.slideType);
                    return (
                        <div className="h-full overflow-y-auto px-6 py-4 sm:px-8 sm:py-6">
                            <h4 className="mb-4 text-sm font-medium uppercase tracking-wide text-neutral-500">
                                {label}
                            </h4>
                            <div
                                className="prose prose-base max-w-none prose-headings:text-neutral-900 prose-h3:text-lg prose-h3:font-semibold prose-p:text-neutral-700 prose-p:leading-relaxed"
                                dangerouslySetInnerHTML={{
                                    __html: html || '<p class="text-neutral-400">No content available</p>',
                                }}
                            />
                        </div>
                    );
                })()}

                {/* Code Content - only for pure code/solution slides */}
                {(slide.slideType === 'code-editor' ||
                    slide.slideType === 'solution') && (
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
                                    fontSize: 15,
                                    lineNumbers: 'on',
                                    scrollBeyondLastLine: false,
                                    wordWrap: 'on',
                                    padding: { top: 16, bottom: 16 },
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
                    <div className="h-full overflow-y-auto px-6 py-4 sm:px-8 sm:py-6">
                        <div
                            className="prose prose-base max-w-none prose-headings:text-neutral-900 prose-h1:text-2xl prose-h1:font-bold prose-h2:text-xl prose-h2:font-semibold prose-h3:text-lg prose-h3:font-semibold prose-p:text-neutral-700 prose-p:leading-relaxed"
                            dangerouslySetInnerHTML={{
                                __html: slide.content || '<p>No assignment content</p>',
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
