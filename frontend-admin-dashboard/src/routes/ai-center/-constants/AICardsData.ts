export interface AIToolFeatureType {
    key: string;
    heading: string;
    subheading: string;
    tags: string[];
    route: string | null;
}

export interface AIToolCardDataType {
    title: string;
    features: AIToolFeatureType[];
}

export const AIToolCardData: AIToolCardDataType[] = [
    {
        title: 'Generate Questions form AI',
        features: [
            {
                key: 'assessment',
                heading: 'Vsmart Upload',
                subheading: 'Generate questions by uploading pdf, doc and ppt files',
                tags: ['PDF, Doc & PPT', 'AI Analysis', 'Structured Questions'],
                route: '/ai-center/ai-tools/vsmart-upload',
            },
            {
                key: 'audio',
                heading: 'Vsmart Audio',
                subheading: 'Generate questions by uploading audio files',
                tags: ['Audio to Questions', 'MP3 & WAV', 'Lecture Support'],
                route: '/ai-center/ai-tools/vsmart-audio',
            },
            {
                key: 'text',
                heading: 'Vsmart Topics',
                subheading: 'Generate questions by providing topics',
                tags: ['Topic Based', 'Instant Quiz', 'Custom Difficulty'],
                route: '/ai-center/ai-tools/vsmart-prompt',
            },
            {
                key: 'chat',
                heading: 'Vsmart Chat',
                subheading: 'Generate questions from chats',
                tags: ['Chat with PDF', 'Interactive Refinement', 'Auto-Generate'],
                route: '/ai-center/ai-tools/vsmart-chat',
            },
        ],
    },
    {
        title: 'Extract Questions with AI',
        features: [
            {
                key: 'question',
                heading: 'Vsmart Extract',
                subheading: 'Extract questions by uploading pdf, doc and ppt files',
                tags: ['Question Extraction', 'Pattern Recognition', 'Legacy Support'],
                route: '/ai-center/ai-tools/vsmart-extract',
            },
            {
                key: 'image',
                heading: 'Vsmart Image',
                subheading: 'Extract questions by uploading images',
                tags: ['Image to Text', 'OCR Technology', 'Handwritten Notes'],
                route: '/ai-center/ai-tools/vsmart-image',
            },
        ],
    },
    {
        title: 'Sort topic questions with AI',
        features: [
            {
                key: 'sortSplitPdf',
                heading: 'Vsmart Organizer',
                subheading: 'Sort specific questions from any topics, question numbers or page',
                tags: ['Topic Sorting', 'Chapter Wise', 'Structured Output'],
                route: '/ai-center/ai-tools/vsmart-organizer',
            },
            {
                key: 'sortTopicsPdf',
                heading: 'Vsmart Sorter',
                subheading: 'Get all the questions sorted by their topics',
                tags: ['Custom Order', 'Topic Grouping', 'Flexible Flow'],
                route: '/ai-center/ai-tools/vsmart-sorter',
            },
        ],
    },
    {
        title: 'Lecture support with AI',
        features: [
            {
                key: 'planLecture',
                heading: 'Vsmart Lecturer',
                subheading: 'Generate structured, time-based lectures with just a prompt',
                tags: ['Lesson Planning', 'Time Management', 'Structured Flow'],
                route: '/ai-center/ai-tools/vsmart-lecture',
            },
            {
                key: 'evaluateLecture',
                heading: 'Vsmart Feedback',
                subheading: 'Get feedback reports on your lecture performance',
                tags: ['Performance Score', 'Audio Analysis', 'Actionable Tips'],
                route: '/ai-center/ai-tools/vsmart-feedback',
            },
        ],
    },
];
