import { Suspense, lazy, ComponentType } from 'react';

// Lazy load all SVG components to avoid bundling them in the initial load
// These SVGs are large (2-3MB each) and should only load when needed
const AIChatImg = lazy(() => import('@/assets/svgs/AIChatImg.svg').then(m => ({ default: m.default as ComponentType })));
const AIExtractImg = lazy(() => import('@/assets/svgs/AIExtractImg.svg').then(m => ({ default: m.default as ComponentType })));
const AIExtractPdfImg = lazy(() => import('@/assets/svgs/AIExtractPdfImg.svg').then(m => ({ default: m.default as ComponentType })));
const AIGivePromptImg = lazy(() => import('@/assets/svgs/AIGivePromptImg.svg').then(m => ({ default: m.default as ComponentType })));
const AISortAndSplitImg = lazy(() => import('@/assets/svgs/AISortAndSplitImg.svg').then(m => ({ default: m.default as ComponentType })));
const AISorterImg = lazy(() => import('@/assets/svgs/AISorterImg.svg').then(m => ({ default: m.default as ComponentType })));
const AIUploadAudioImg = lazy(() => import('@/assets/svgs/AIUploadAudioImg.svg').then(m => ({ default: m.default as ComponentType })));
const AIUploadPdfImg = lazy(() => import('@/assets/svgs/AIUploadPdfImg.svg').then(m => ({ default: m.default as ComponentType })));
const AIPlanLectureImg = lazy(() => import('@/assets/svgs/AIPlanLectureImg.svg').then(m => ({ default: m.default as ComponentType })));
const AIEvaluateLectureImg = lazy(() => import('@/assets/svgs/AIEvaluateLectureImg.svg').then(m => ({ default: m.default as ComponentType })));

// Loading placeholder for SVG images
const ImagePlaceholder = () => (
    <div className="h-32 w-full animate-pulse rounded-lg bg-neutral-100" />
);

export const GetImagesForAITools = (key: string) => {
    const renderWithSuspense = (Component: ComponentType) => (
        <Suspense fallback={<ImagePlaceholder />}>
            <Component />
        </Suspense>
    );

    switch (key) {
        case 'assessment':
            return renderWithSuspense(AIUploadPdfImg);
        case 'audio':
            return renderWithSuspense(AIUploadAudioImg);
        case 'text':
            return renderWithSuspense(AIGivePromptImg);
        case 'chat':
            return renderWithSuspense(AIChatImg);
        case 'question':
            return renderWithSuspense(AIExtractPdfImg);
        case 'image':
            return renderWithSuspense(AIExtractImg);
        case 'sortSplitPdf':
            return renderWithSuspense(AISortAndSplitImg);
        case 'sortTopicsPdf':
            return renderWithSuspense(AISorterImg);
        case 'planLecture':
            return renderWithSuspense(AIPlanLectureImg);
        case 'evaluateLecture':
            return renderWithSuspense(AIEvaluateLectureImg);
        default:
            return <></>;
    }
};

export const getTaskTypeFromFeature = (heading: string): string => {
    switch (heading) {
        case 'Vsmart Upload':
            return 'PDF_TO_QUESTIONS';
        case 'Vsmart Extract':
            return 'PDF_TO_QUESTIONS';
        case 'Vsmart Image':
            return 'IMAGE_TO_QUESTIONS';
        case 'Vsmart Audio':
            return 'AUDIO_TO_QUESTIONS';
        case 'Vsmart Topics':
            return 'TEXT_TO_QUESTIONS';
        case 'Vsmart Chat':
            return 'CHAT_WITH_PDF';
        case 'Vsmart Organizer':
            return 'PDF_TO_QUESTIONS_WITH_TOPIC';
        case 'Vsmart Sorter':
            return 'SORT_QUESTIONS_TOPIC_WISE';
        case 'Vsmart Lecturer':
            return 'LECTURE_PLANNER';
        case 'Vsmart Feedback':
            return 'LECTURE_FEEDBACK';
        default:
            return 'UNKNOWN_TASK_TYPE'; // fallback for safety
    }
};
