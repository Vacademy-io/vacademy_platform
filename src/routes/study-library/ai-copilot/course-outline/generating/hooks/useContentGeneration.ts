import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { getInstituteId } from '@/constants/helper';
import type { SlideGeneration, SlideType } from '../../../shared/types';
import { markdownToHtml } from '../../../shared/utils/markdownToHtml';
import { generateContent } from '../services/contentGenerationService';
import { convertAssessmentToJSON } from '../utils/assessmentToHtml';

/**
 * Custom hook for handling content generation from outline
 * Extracts the massive handleConfirmGenerateCourseAssets logic
 */
export const useContentGeneration = (
    outlineTodos: any[],
    slides: SlideGeneration[],
    setSlides: React.Dispatch<React.SetStateAction<SlideGeneration[]>>,
    setIsGeneratingContent: React.Dispatch<React.SetStateAction<boolean>>,
    setIsContentGenerated: React.Dispatch<React.SetStateAction<boolean>>,
    setContentGenerationProgress: React.Dispatch<React.SetStateAction<string>>,
    setAbortController: React.Dispatch<React.SetStateAction<AbortController | null>>
) => {
    const navigate = useNavigate();

    const handleConfirmGenerateCourseAssets = async () => {
        // Check if we have todos to generate content for
        if (!outlineTodos || outlineTodos.length === 0) {
            alert('No todos found. Please regenerate the course outline.');
            return;
        }

        const instituteId = getInstituteId();
        if (!instituteId) {
            alert('Institute ID not found. Please login again.');
            return;
        }

        // Read language that was stored during outline generation
        const language = sessionStorage.getItem('courseLanguage') || 'English';

        setIsGeneratingContent(true);
        setContentGenerationProgress('Starting content generation...');

        // Create abort controller for this request
        const controller = new AbortController();
        setAbortController(controller);

        try {
            // Filter todos to only include DOCUMENT, ASSESSMENT, VIDEO, AI_VIDEO, VIDEO_CODE, and AI_VIDEO_CODE types
            const contentTodos = outlineTodos.filter(
                (todo: any) =>
                    todo.type === 'DOCUMENT' ||
                    todo.type === 'ASSESSMENT' ||
                    todo.type === 'VIDEO' ||
                    todo.type === 'AI_VIDEO' ||
                    todo.type === 'VIDEO_CODE' ||
                    todo.type === 'AI_VIDEO_CODE'
            );

            if (contentTodos.length === 0) {
                alert('No content todos found to generate. Please check your course outline.');
                setIsGeneratingContent(false);
                return;
            }

            console.log('Generating content for todos:', contentTodos.length);
            console.log('Current slides:', slides.length);
            console.log(
                'Content todos:',
                contentTodos.map((t: any) => ({
                    path: t.path,
                    type: t.type,
                    title: t.title,
                    name: t.name,
                    chapter_name: t.chapter_name,
                }))
            );

            // Check payload size to prevent 500 errors
            const payload = {
                course_tree: { todos: contentTodos },
                institute_id: instituteId,
            };
            const payloadSize = JSON.stringify(payload).length;
            console.log('Payload size:', payloadSize, 'bytes');

            if (payloadSize > 1024 * 1024) {
                // 1MB
                console.warn('⚠️ Large payload detected:', payloadSize, 'bytes');
                if (
                    !confirm(
                        'The content generation payload is quite large. This might cause server issues. Continue anyway?'
                    )
                ) {
                    setIsGeneratingContent(false);
                    return;
                }
            }

            // Create a map of todos by their path for quick lookup
            const todoPathMap = new Map<string, any>();
            contentTodos.forEach((todo: any) => {
                todoPathMap.set(todo.path, todo);
            });

            // Create a map of path -> slide by matching todos to slides using multiple strategies
            const pathToSlideMap = new Map<string, SlideGeneration>();

            // First, try exact matches
            slides.forEach((slide) => {
                const matchingTodo = contentTodos.find((todo: any) => {
                    const sessionExact = slide.sessionTitle === todo.chapter_name;
                    const titleExact =
                        slide.slideTitle === todo.title || slide.slideTitle === todo.name;
                    const typeMatch =
                        (todo.type === 'DOCUMENT' && slide.slideType === 'doc') ||
                        (todo.type === 'ASSESSMENT' && slide.slideType === 'quiz') ||
                        (todo.type === 'VIDEO' && slide.slideType === 'video') ||
                        (todo.type === 'AI_VIDEO' && slide.slideType === 'ai-video') ||
                        (todo.type === 'VIDEO_CODE' && slide.slideType === 'video-code') ||
                        (todo.type === 'AI_VIDEO_CODE' && slide.slideType === 'ai-video-code');

                    return sessionExact && titleExact && typeMatch;
                });

                if (matchingTodo && matchingTodo.path) {
                    pathToSlideMap.set(matchingTodo.path, slide);
                    console.log(
                        `[Exact] Mapped path "${matchingTodo.path}" to slide "${slide.id}" (${slide.sessionTitle} - ${slide.slideTitle})`
                    );
                }
            });

            // Then, try case-insensitive matches for slides that weren't matched
            slides.forEach((slide) => {
                const alreadyMapped = Array.from(pathToSlideMap.values()).some(
                    (mappedSlide) => mappedSlide.id === slide.id
                );
                if (alreadyMapped) return;

                const matchingTodo = contentTodos.find((todo: any) => {
                    const sessionMatch =
                        slide.sessionTitle.toLowerCase().trim() ===
                        (todo.chapter_name || '').toLowerCase().trim();
                    const titleMatch =
                        slide.slideTitle.toLowerCase().trim() ===
                            (todo.title || '').toLowerCase().trim() ||
                        slide.slideTitle.toLowerCase().trim() ===
                            (todo.name || '').toLowerCase().trim();
                    const typeMatch =
                        (todo.type === 'DOCUMENT' && slide.slideType === 'doc') ||
                        (todo.type === 'ASSESSMENT' && slide.slideType === 'quiz') ||
                        (todo.type === 'VIDEO' && slide.slideType === 'video') ||
                        (todo.type === 'AI_VIDEO' && slide.slideType === 'ai-video') ||
                        (todo.type === 'VIDEO_CODE' && slide.slideType === 'video-code') ||
                        (todo.type === 'AI_VIDEO_CODE' && slide.slideType === 'ai-video-code');

                    return sessionMatch && titleMatch && typeMatch;
                });

                if (matchingTodo && matchingTodo.path) {
                    pathToSlideMap.set(matchingTodo.path, slide);
                    console.log(
                        `[Case-insensitive] Mapped path "${matchingTodo.path}" to slide "${slide.id}" (${slide.sessionTitle} - ${slide.slideTitle})`
                    );
                }
            });

            // Finally, try fuzzy matches (partial title match) for remaining slides
            slides.forEach((slide) => {
                const alreadyMapped = Array.from(pathToSlideMap.values()).some(
                    (mappedSlide) => mappedSlide.id === slide.id
                );
                if (alreadyMapped) return;

                const matchingTodo = contentTodos.find((todo: any) => {
                    const sessionMatch =
                        slide.sessionTitle.toLowerCase().trim() ===
                            (todo.chapter_name || '').toLowerCase().trim() ||
                        (todo.chapter_name || '')
                            .toLowerCase()
                            .trim()
                            .includes(slide.sessionTitle.toLowerCase().trim()) ||
                        slide.sessionTitle
                            .toLowerCase()
                            .trim()
                            .includes((todo.chapter_name || '').toLowerCase().trim());
                    const titleMatch =
                        slide.slideTitle.toLowerCase().trim() ===
                            (todo.title || '').toLowerCase().trim() ||
                        slide.slideTitle.toLowerCase().trim() ===
                            (todo.name || '').toLowerCase().trim() ||
                        (todo.title || '')
                            .toLowerCase()
                            .trim()
                            .includes(slide.slideTitle.toLowerCase().trim()) ||
                        slide.slideTitle
                            .toLowerCase()
                            .trim()
                            .includes((todo.title || '').toLowerCase().trim()) ||
                        (todo.name || '')
                            .toLowerCase()
                            .trim()
                            .includes(slide.slideTitle.toLowerCase().trim()) ||
                        slide.slideTitle
                            .toLowerCase()
                            .trim()
                            .includes((todo.name || '').toLowerCase().trim());
                    const typeMatch =
                        (todo.type === 'DOCUMENT' && slide.slideType === 'doc') ||
                        (todo.type === 'ASSESSMENT' && slide.slideType === 'quiz') ||
                        (todo.type === 'VIDEO' && slide.slideType === 'video') ||
                        (todo.type === 'AI_VIDEO' && slide.slideType === 'ai-video') ||
                        (todo.type === 'VIDEO_CODE' && slide.slideType === 'video-code') ||
                        (todo.type === 'AI_VIDEO_CODE' && slide.slideType === 'ai-video-code');

                    return sessionMatch && titleMatch && typeMatch;
                });

                if (matchingTodo && matchingTodo.path) {
                    pathToSlideMap.set(matchingTodo.path, slide);
                    console.log(
                        `[Fuzzy] Mapped path "${matchingTodo.path}" to slide "${slide.id}" (${slide.sessionTitle} - ${slide.slideTitle})`
                    );
                }
            });

            console.log(
                `Total path mappings created: ${pathToSlideMap.size} out of ${contentTodos.length} todos`
            );
            console.log(
                'Path to slide mappings:',
                Array.from(pathToSlideMap.entries()).map(([path, slide]) => ({
                    path,
                    slideId: slide.id,
                    sessionTitle: slide.sessionTitle,
                    slideTitle: slide.slideTitle,
                }))
            );

            // Mark all content slides as "generating" initially
            setSlides((prevSlides) => {
                const updatedSlides = prevSlides.map((slide) => {
                    const matchingTodo = contentTodos.find((todo: any) => {
                        const sessionTitle = todo.chapter_name || '';
                        const slideTitle = todo.title || todo.name || '';
                        return (
                            slide.sessionTitle === sessionTitle &&
                            slide.slideTitle === slideTitle &&
                            ((todo.type === 'DOCUMENT' && slide.slideType === 'doc') ||
                                (todo.type === 'ASSESSMENT' && slide.slideType === 'quiz') ||
                                (todo.type === 'VIDEO' && slide.slideType === 'video') ||
                                (todo.type === 'AI_VIDEO' && slide.slideType === 'ai-video') ||
                                (todo.type === 'VIDEO_CODE' && slide.slideType === 'video-code') ||
                                (todo.type === 'AI_VIDEO_CODE' &&
                                    slide.slideType === 'ai-video-code'))
                        );
                    });

                    if (matchingTodo) {
                        return {
                            ...slide,
                            status: 'generating' as const,
                            progress: 0,
                        };
                    }
                    return slide;
                });

                localStorage.setItem('generatedSlides', JSON.stringify(updatedSlides));
                localStorage.setItem('isGeneratingContent', 'true');

                return updatedSlides;
            });

            // Track if we've navigated to viewer (disabled - stay on outline page)
            // let hasNavigatedToViewer = false;

            // Store path map in a variable that persists across updates
            const persistentPathMap = new Map(pathToSlideMap);

            // Call content generation API with detailed onUpdate callback
            await generateContent(
                contentTodos,
                instituteId,
                (update) => {
                    console.log('🔵 Content update received:', {
                        type: update.type,
                        path: update.path,
                        slideType: update.slideType,
                        status: update.status,
                        hasContentData: !!update.contentData,
                        contentDataKeys: update.contentData ? Object.keys(update.contentData) : [],
                    });

                    if (update.type === 'SLIDE_CONTENT_UPDATE') {
                        console.log('🔵 Processing content update for path:', update.path);

                        let mappedSlide = persistentPathMap.get(update.path);
                        console.log(
                            '🔵 Mapped slide from path map:',
                            mappedSlide
                                ? {
                                      id: mappedSlide.id,
                                      sessionTitle: mappedSlide.sessionTitle,
                                      slideTitle: mappedSlide.slideTitle,
                                  }
                                : '❌ NOT FOUND IN MAP'
                        );

                        // Fallback: Try to find slide by matching chapter_name and title from the todo
                        if (!mappedSlide) {
                            console.log(`⚠️ [${update.path}] Trying fallback matching...`);
                            const todoChapter = update.path?.split('/')[0] || '';
                            const todoTitle = update.path?.split('/')[1] || '';

                            try {
                                const stored = localStorage.getItem('generatedSlides');
                                if (stored) {
                                    const parsedSlides = JSON.parse(stored);
                                    const fallbackSlide = parsedSlides.find((slide: any) => {
                                        const sessionMatch =
                                            slide.sessionTitle.toLowerCase().trim() ===
                                                todoChapter.toLowerCase().trim() ||
                                            todoChapter
                                                .toLowerCase()
                                                .includes(
                                                    slide.sessionTitle.toLowerCase().trim()
                                                ) ||
                                            slide.sessionTitle
                                                .toLowerCase()
                                                .includes(todoChapter.toLowerCase().trim());
                                        const titleMatch =
                                            slide.slideTitle.toLowerCase().trim() ===
                                                todoTitle.toLowerCase().trim() ||
                                            todoTitle
                                                .toLowerCase()
                                                .includes(slide.slideTitle.toLowerCase().trim()) ||
                                            slide.slideTitle
                                                .toLowerCase()
                                                .includes(todoTitle.toLowerCase().trim());
                                        const typeMatch =
                                            (update.slideType === 'DOCUMENT' &&
                                                slide.slideType === 'doc') ||
                                            (update.slideType === 'ASSESSMENT' &&
                                                slide.slideType === 'assessment') ||
                                            (update.slideType === 'VIDEO' &&
                                                slide.slideType === 'video') ||
                                            (update.slideType === 'AI_VIDEO' &&
                                                slide.slideType === 'ai-video') ||
                                            ((update.slideType as string) === 'VIDEO_CODE' &&
                                                slide.slideType === 'video-code') ||
                                            ((update.slideType as string) === 'AI_VIDEO_CODE' &&
                                                slide.slideType === 'ai-video-code');
                                        return sessionMatch && titleMatch && typeMatch;
                                    });

                                    if (fallbackSlide) {
                                        mappedSlide = fallbackSlide;
                                        console.log(
                                            `✅ [${update.path}] Found slide via fallback matching:`,
                                            {
                                                id: fallbackSlide.id,
                                                sessionTitle: fallbackSlide.sessionTitle,
                                                slideTitle: fallbackSlide.slideTitle,
                                            }
                                        );
                                    }
                                }
                            } catch (e) {
                                console.error(`❌ [${update.path}] Fallback matching failed:`, e);
                            }
                        }

                        if (!mappedSlide) {
                            console.error(
                                `❌ [${update.path}] No mapped slide found even with fallback, skipping update`
                            );
                            return;
                        }

                        // Prepare content based on type
                        let content = '';
                        if (update.slideType === 'DOCUMENT') {
                            const rawContent = update.contentData || '';

                            // Check if content is wrapped in markdown code blocks (```html...```)
                            if (rawContent.includes('```html')) {
                                // Extract HTML from markdown code blocks
                                const htmlMatch = rawContent.match(/```html\s*\n?([\s\S]*?)\n?```/);
                                if (htmlMatch && htmlMatch[1]) {
                                    content = htmlMatch[1].trim();
                                } else {
                                    content = rawContent;
                                }
                            } else {
                                // Content is markdown - convert to HTML
                                // This handles markdown with mermaid code blocks
                                content = markdownToHtml(rawContent);
                            }
                        } else if (update.slideType === 'ASSESSMENT') {
                            try {
                                console.log(`🔍 [${update.path}] Processing assessment data`);
                                content = convertAssessmentToJSON(update.contentData);
                                const parsed = JSON.parse(content);
                                console.log(
                                    `✅ [${update.path}] Assessment JSON validated successfully`
                                );
                            } catch (e) {
                                console.error(
                                    `❌ [${update.path}] Failed to convert assessment to JSON:`,
                                    e
                                );
                                content = JSON.stringify({
                                    questions: [],
                                    title: 'Assessment',
                                    error: 'Failed to parse assessment data',
                                    originalError: e instanceof Error ? e.message : 'Unknown error',
                                });
                            }
                        } else if (update.slideType === 'VIDEO') {
                            console.log(`🔵 [${update.path}] Processing video data`);
                            const videoUrl =
                                update.contentData.url || update.contentData.embedUrl || '';
                            const description = update.contentData.description || '';
                            const title = update.contentData.title || 'Video';

                            if (videoUrl) {
                                content = `<div>
                                    <p><strong>${title}</strong></p>
                                    <p>${description}</p>
                                    <p>YouTube URL: <a href="${videoUrl}" target="_blank">${videoUrl}</a></p>
                                </div>`;
                                console.log(
                                    `✅ [${update.path}] Video content created with URL: ${videoUrl}`
                                );
                            } else {
                                content = `<div><p><strong>${title}</strong></p><p>${description}</p><p>No video URL provided</p></div>`;
                                console.log(`⚠️ [${update.path}] No video URL found`);
                            }
                        } else if (update.slideType === 'AI_VIDEO') {
                            console.log(
                                `🔵 [${update.path}] Processing AI video data, status: ${update.status}`
                            );
                            console.log(`🔵 [${update.path}] Content data:`, update.contentData);

                            // For AI_VIDEO, process ALL events (not just COMPLETED)
                            // Store contentData if available, otherwise store progress info
                            if (update.contentData) {
                                // Store the full contentData (includes timelineUrl, audioUrl, progress, etc.)
                                content = JSON.stringify(update.contentData);
                                console.log(`✅ [${update.path}] AI video data stored:`, {
                                    videoId: update.contentData.videoId,
                                    timelineUrl: update.contentData.timelineUrl,
                                    audioUrl: update.contentData.audioUrl,
                                    status: update.contentData.status || update.status,
                                    progress: update.contentData.progress,
                                });
                            } else {
                                // No contentData yet, just store status/progress
                                content = JSON.stringify({
                                    status: update.status || 'GENERATING',
                                    progress: 0,
                                });
                                console.log(
                                    `⚠️ [${update.path}] AI video event received but no contentData yet, status: ${update.status}`
                                );
                            }
                        } else if (update.slideType === 'VIDEO_CODE') {
                            console.log(`🔵 [${update.path}] Processing VIDEO_CODE data`);
                            // contentData has { video: {...}, code: {...}, layout: "split-left" }
                            if (update.contentData && typeof update.contentData === 'object') {
                                // Store the full contentData structure
                                content = JSON.stringify(update.contentData);
                                console.log(`✅ [${update.path}] VIDEO_CODE data stored:`, {
                                    hasVideo: !!update.contentData.video,
                                    hasCode: !!update.contentData.code,
                                    layout: update.contentData.layout,
                                });
                            } else {
                                content = JSON.stringify({
                                    video: null,
                                    code: null,
                                    layout: 'split-left',
                                });
                                console.log(
                                    `⚠️ [${update.path}] VIDEO_CODE event received but no contentData`
                                );
                            }
                        } else if (update.slideType === 'AI_VIDEO_CODE') {
                            console.log(
                                `🔵 [${update.path}] Processing AI_VIDEO_CODE data, status: ${update.status}`
                            );
                            // contentData has { video: {...}, code: {...}, layout: "split-left" }
                            // video contains AI video data similar to AI_VIDEO
                            if (update.contentData && typeof update.contentData === 'object') {
                                // Store the full contentData structure
                                content = JSON.stringify(update.contentData);
                                console.log(`✅ [${update.path}] AI_VIDEO_CODE data stored:`, {
                                    hasVideo: !!update.contentData.video,
                                    videoStatus: update.contentData.video?.status,
                                    hasCode: !!update.contentData.code,
                                    layout: update.contentData.layout,
                                });
                            } else {
                                content = JSON.stringify({
                                    video: { status: 'GENERATING', progress: 0 },
                                    code: null,
                                    layout: 'split-left',
                                });
                                console.log(
                                    `⚠️ [${update.path}] AI_VIDEO_CODE event received but no contentData yet`
                                );
                            }
                        }

                        // Update localStorage first
                        try {
                            const stored = localStorage.getItem('generatedSlides');
                            if (stored) {
                                const parsed = JSON.parse(stored);
                                const slideIndex = parsed.findIndex(
                                    (s: any) => s.id === mappedSlide!.id
                                );
                                if (slideIndex >= 0) {
                                    // Determine status and progress based on update type and content
                                    let newStatus: 'pending' | 'generating' | 'completed' =
                                        'pending';
                                    let newProgress = 0;
                                    let aiVideoData = parsed[slideIndex].aiVideoData;

                                    if (update.slideType === 'AI_VIDEO' && update.contentData) {
                                        // For AI_VIDEO, use status from contentData or update.status
                                        const videoStatus =
                                            update.contentData.status || update.status;
                                        if (videoStatus === 'COMPLETED') {
                                            newStatus = 'completed';
                                            newProgress = 100;
                                            aiVideoData = update.contentData;
                                        } else if (
                                            videoStatus === 'GENERATING' ||
                                            update.status === 'GENERATING'
                                        ) {
                                            newStatus = 'generating';
                                            newProgress = update.contentData.progress || 0;
                                            // Store partial data if available
                                            if (update.contentData) {
                                                aiVideoData = update.contentData;
                                            }
                                        } else {
                                            newStatus = 'generating';
                                            newProgress = update.contentData.progress || 0;
                                        }
                                    } else if (
                                        (update.slideType as string) === 'VIDEO_CODE' &&
                                        update.contentData
                                    ) {
                                        // For VIDEO_CODE, mark as completed when we have both video and code
                                        if (update.contentData.video && update.contentData.code) {
                                            newStatus = 'completed';
                                            newProgress = 100;
                                        } else {
                                            newStatus = 'generating';
                                            newProgress = 50;
                                        }
                                    } else if (
                                        (update.slideType as string) === 'AI_VIDEO_CODE' &&
                                        update.contentData
                                    ) {
                                        // For AI_VIDEO_CODE, handle similar to AI_VIDEO - check video status
                                        const videoData = update.contentData.video;
                                        const videoStatus = videoData?.status || update.status;

                                        // If video is completed and we have code, mark as completed
                                        if (
                                            videoStatus === 'COMPLETED' &&
                                            update.contentData.code
                                        ) {
                                            newStatus = 'completed';
                                            newProgress = 100;
                                        } else if (
                                            videoStatus === 'GENERATING' ||
                                            update.status === 'GENERATING'
                                        ) {
                                            newStatus = 'generating';
                                            newProgress = videoData?.progress || 0;
                                        } else {
                                            newStatus = 'generating';
                                            newProgress = videoData?.progress || 0;
                                        }
                                    } else if (update.slideType === 'ASSESSMENT') {
                                        // For ASSESSMENT, validate that we have valid quiz questions
                                        try {
                                            const assessmentData = JSON.parse(content);
                                            if (
                                                assessmentData &&
                                                assessmentData.questions &&
                                                Array.isArray(assessmentData.questions) &&
                                                assessmentData.questions.length > 0
                                            ) {
                                                newStatus = 'completed';
                                                newProgress = 100;
                                            } else {
                                                newStatus = 'generating';
                                                newProgress = 50;
                                                console.log(
                                                    `⚠️ [${update.path}] Assessment has no valid questions, keeping as generating`
                                                );
                                            }
                                        } catch (e) {
                                            newStatus = 'generating';
                                            newProgress = 50;
                                            console.log(
                                                `⚠️ [${update.path}] Assessment content is invalid, keeping as generating`
                                            );
                                        }
                                    } else {
                                        // For other types, mark as completed when we have content
                                        newStatus = 'completed';
                                        newProgress = 100;
                                    }

                                    parsed[slideIndex] = {
                                        ...parsed[slideIndex],
                                        content,
                                        status: newStatus,
                                        progress: newProgress,
                                        aiVideoData: aiVideoData ?? parsed[slideIndex].aiVideoData,
                                    };

                                    localStorage.setItem('generatedSlides', JSON.stringify(parsed));
                                    console.log(
                                        `✅ [${update.path}] Updated localStorage for slide: ${mappedSlide!.id}`
                                    );

                                    // Check if all content slides are now completed
                                    const allCompleted = parsed.every(
                                        (s: any) =>
                                            s.status === 'completed' ||
                                            (s.slideType !== 'doc' &&
                                                s.slideType !== 'quiz' &&
                                                s.slideType !== 'assessment' &&
                                                s.slideType !== 'video' &&
                                                s.slideType !== 'ai-video' &&
                                                s.slideType !== 'video-code' &&
                                                s.slideType !== 'ai-video-code')
                                    );

                                    if (allCompleted) {
                                        localStorage.setItem('isGeneratingContent', 'false');
                                        setIsGeneratingContent(false);
                                        setIsContentGenerated(true);
                                        setAbortController(null);
                                        console.log(
                                            '✅ [FINAL] All slides completed, marked content generation as complete'
                                        );
                                    } else {
                                        const completedCount = parsed.filter(
                                            (s: any) => s.status === 'completed'
                                        ).length;
                                        const totalContent = parsed.filter(
                                            (s: any) =>
                                                s.slideType === 'doc' ||
                                                s.slideType === 'quiz' ||
                                                s.slideType === 'assessment' ||
                                                s.slideType === 'video' ||
                                                s.slideType === 'ai-video' ||
                                                s.slideType === 'video-code' ||
                                                s.slideType === 'ai-video-code'
                                        ).length;
                                        console.log(
                                            `📊 Progress: ${completedCount}/${totalContent} slides completed`
                                        );
                                    }
                                }
                            }
                        } catch (e) {
                            console.error(`❌ [${update.path}] Failed to update localStorage:`, e);
                        }

                        // Also update React state
                        setSlides((prevSlides) => {
                            const slideToUpdate = prevSlides.find(
                                (slide) => slide.id === mappedSlide!.id
                            );

                            if (!slideToUpdate) {
                                console.error(
                                    `❌ [${update.path}] Slide ${mappedSlide!.id} not found in prevSlides`
                                );
                                return prevSlides;
                            }

                            const updatedSlides = prevSlides.map((slide) => {
                                if (slide.id === slideToUpdate.id) {
                                    let aiVideoData = slide.aiVideoData;
                                    let newStatus: 'pending' | 'generating' | 'completed' =
                                        slide.status;
                                    let newProgress = slide.progress;

                                    // For AI_VIDEO, process all events and update status/progress
                                    if (update.slideType === 'AI_VIDEO') {
                                        if (update.contentData) {
                                            // Store the contentData
                                            aiVideoData = update.contentData;

                                            // Determine status from contentData or update.status
                                            const videoStatus =
                                                update.contentData.status || update.status;
                                            if (videoStatus === 'COMPLETED') {
                                                newStatus = 'completed';
                                                newProgress = 100;
                                            } else if (
                                                videoStatus === 'GENERATING' ||
                                                update.status === 'GENERATING'
                                            ) {
                                                newStatus = 'generating';
                                                newProgress =
                                                    update.contentData.progress ||
                                                    slide.progress ||
                                                    0;
                                            } else {
                                                newStatus = 'generating';
                                                newProgress =
                                                    update.contentData.progress ||
                                                    slide.progress ||
                                                    0;
                                            }

                                            console.log(
                                                `🔄 [${update.path}] Updated AI video slide:`,
                                                {
                                                    status: newStatus,
                                                    progress: newProgress,
                                                    hasTimelineUrl: !!aiVideoData?.timelineUrl,
                                                    hasAudioUrl: !!aiVideoData?.audioUrl,
                                                }
                                            );
                                        } else {
                                            // No contentData yet, but update status if provided
                                            if (update.status === 'GENERATING') {
                                                newStatus = 'generating';
                                            }
                                            console.log(
                                                `🔄 [${update.path}] AI video event without contentData, status: ${update.status}`
                                            );
                                        }
                                    } else if ((update.slideType as string) === 'VIDEO_CODE') {
                                        // For VIDEO_CODE, mark as completed when we have both video and code
                                        if (
                                            update.contentData &&
                                            update.contentData.video &&
                                            update.contentData.code
                                        ) {
                                            newStatus = 'completed';
                                            newProgress = 100;
                                        } else {
                                            newStatus = 'generating';
                                            newProgress = 50;
                                        }
                                    } else if ((update.slideType as string) === 'AI_VIDEO_CODE') {
                                        // For AI_VIDEO_CODE, handle similar to AI_VIDEO - check video status
                                        if (update.contentData) {
                                            const videoData = update.contentData.video;
                                            const videoStatus = videoData?.status || update.status;

                                            // If video is completed and we have code, mark as completed
                                            if (
                                                videoStatus === 'COMPLETED' &&
                                                update.contentData.code
                                            ) {
                                                newStatus = 'completed';
                                                newProgress = 100;
                                            } else if (
                                                videoStatus === 'GENERATING' ||
                                                update.status === 'GENERATING'
                                            ) {
                                                newStatus = 'generating';
                                                newProgress =
                                                    videoData?.progress || slide.progress || 0;
                                            } else {
                                                newStatus = 'generating';
                                                newProgress =
                                                    videoData?.progress || slide.progress || 0;
                                            }
                                        } else {
                                            // No contentData yet, but update status if provided
                                            if (update.status === 'GENERATING') {
                                                newStatus = 'generating';
                                            }
                                        }
                                    } else {
                                        // For other types, mark as completed
                                        newStatus = 'completed';
                                        newProgress = 100;
                                    }

                                    return {
                                        ...slide,
                                        content,
                                        slideType: (update.slideType === 'ASSESSMENT'
                                            ? 'assessment'
                                            : update.slideType === 'AI_VIDEO'
                                              ? 'ai-video'
                                              : slide.slideType) as SlideType,
                                        status: newStatus,
                                        progress: newProgress,
                                        aiVideoData,
                                    };
                                }
                                return slide;
                            });

                            localStorage.setItem('generatedSlides', JSON.stringify(updatedSlides));
                            console.log(
                                `✅ [${update.path}] Updated React state for slide: ${slideToUpdate.id}`
                            );

                            // Navigate to viewer on first content update (DISABLED - stay on outline page)
                            // if (!hasNavigatedToViewer) {
                            //     hasNavigatedToViewer = true;
                            //     setTimeout(() => {
                            //         navigate({ to: '/study-library/ai-copilot/course-outline/generating/viewer' });
                            //     }, 100);
                            // }

                            return updatedSlides;
                        });
                    } else if (update.type === 'SLIDE_CONTENT_ERROR') {
                        console.error('Content generation error:', update.errorMessage);
                        setContentGenerationProgress(
                            `Error generating ${update.slideType} for ${update.path}: ${update.errorMessage}`
                        );

                        const mappedSlide = pathToSlideMap.get(update.path);

                        setSlides((prevSlides) => {
                            let slideToUpdate = mappedSlide
                                ? prevSlides.find((slide) => slide.id === mappedSlide.id)
                                : null;

                            if (!slideToUpdate) {
                                const todo = todoPathMap.get(update.path);
                                if (todo) {
                                    const sessionTitle = todo.chapter_name || '';
                                    const slideTitle = todo.title || todo.name || '';

                                    slideToUpdate = prevSlides.find((slide) => {
                                        const sessionMatch =
                                            slide.sessionTitle === sessionTitle ||
                                            slide.sessionTitle.toLowerCase().trim() ===
                                                sessionTitle.toLowerCase().trim();
                                        const titleMatch =
                                            slide.slideTitle === slideTitle ||
                                            slide.slideTitle.toLowerCase().trim() ===
                                                slideTitle.toLowerCase().trim();
                                        const typeMatch =
                                            (todo.type === 'DOCUMENT' &&
                                                slide.slideType === 'doc') ||
                                            (todo.type === 'ASSESSMENT' &&
                                                slide.slideType === 'quiz') ||
                                            (todo.type === 'VIDEO' &&
                                                slide.slideType === 'video') ||
                                            (todo.type === 'AI_VIDEO' &&
                                                slide.slideType === 'ai-video');

                                        return sessionMatch && titleMatch && typeMatch;
                                    });
                                }
                            }

                            if (!slideToUpdate) {
                                console.warn('Could not find slide to mark as failed:', {
                                    path: update.path,
                                });
                                return prevSlides;
                            }

                            return prevSlides.map((slide) => {
                                if (slide.id === slideToUpdate!.id) {
                                    return {
                                        ...slide,
                                        status: 'pending' as const,
                                        progress: 0,
                                    };
                                }
                                return slide;
                            });
                        });
                    }
                },
                (error) => {
                    console.error('Content generation failed:', error);

                    const errorMessage = error;
                    let userFriendlyMessage = `Content generation failed: ${error}`;

                    // Special handling for different error types
                    if (typeof error === 'string') {
                        const lowerError = error.toLowerCase();

                        if (lowerError.includes('500')) {
                            console.error('🔴 500 error detected');
                            userFriendlyMessage = `Content generation encountered a server error (500). Try generating with fewer slides or contact support.`;
                        } else if (lowerError.includes('aborted') || lowerError.includes('abort')) {
                            console.error('🔴 Stream aborted');
                            userFriendlyMessage = `Content generation was interrupted. Try again.`;
                        } else if (lowerError.includes('buffer')) {
                            console.error('🔴 Stream buffer issue');
                            userFriendlyMessage = `Content generation failed due to stream buffer issues. Try generating fewer slides at once.`;
                        } else if (lowerError.includes('timeout')) {
                            console.error('🔴 Stream timeout');
                            userFriendlyMessage = `Content generation timed out. Try again later.`;
                        } else if (
                            lowerError.includes('network') ||
                            lowerError.includes('fetch') ||
                            lowerError.includes('failed to fetch')
                        ) {
                            console.error('🔴 Network error');
                            userFriendlyMessage = `Network error during content generation. Check your connection and try again.`;
                        }
                    }

                    alert(userFriendlyMessage);

                    setIsGeneratingContent(false);
                    setAbortController(null);
                    localStorage.setItem('isGeneratingContent', 'false');
                },
                (progress) => {
                    setContentGenerationProgress(progress);
                },
                0, // retryCount
                language
            );

            // Mark content generation as complete (fallback)
            setTimeout(() => {
                if (localStorage.getItem('isGeneratingContent') !== 'false') {
                    localStorage.setItem('isGeneratingContent', 'false');
                    setIsGeneratingContent(false);
                    setIsContentGenerated(true);
                    setAbortController(null);
                    console.log('✅ Generation marked complete (fallback)');
                }
            }, 2000);
        } catch (error) {
            console.error('Error generating content:', error);
            alert(
                `Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            setIsGeneratingContent(false);
        }
    };

    return {
        handleConfirmGenerateCourseAssets,
    };
};
