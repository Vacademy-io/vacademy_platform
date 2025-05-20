import {
    AIChatImg,
    AIExtractImg,
    AIExtractPdfImg,
    AIGivePromptImg,
    AISortAndSplitImg,
    AISorterImg,
    AIUploadAudioImg,
    AIUploadPdfImg,
    AIPlanLectureImg,
    AIEvaluateLectureImg,
} from '@/assets/svgs';

export const GetImagesForAITools = (key: string) => {
    switch (key) {
        case 'assessment':
            return <AIUploadPdfImg />;
        case 'audio':
            return <AIUploadAudioImg />;
        case 'text':
            return <AIGivePromptImg />;
        case 'chat':
            return <AIChatImg />;
        case 'question':
            return <AIExtractPdfImg />;
        case 'image':
            return <AIExtractImg />;
        case 'sortSplitPdf':
            return <AISortAndSplitImg />;
        case 'sortTopicsPdf':
            return <AISorterImg />;
        case 'planLecture':
            return <AIPlanLectureImg />;
        case 'evaluateLecture':
            return <AIEvaluateLectureImg />;
        default:
            <></>;
    }
    return <></>;
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
