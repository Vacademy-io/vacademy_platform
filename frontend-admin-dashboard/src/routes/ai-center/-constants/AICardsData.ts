export interface AIToolFeatureType {
    key: string;
    heading: string;
    subheading: string;
    tags: string[];
    route: string | null;
}

export interface AIToolCardDataType {
    title: string;
    description?: string;
    features: AIToolFeatureType[];
}

export const AIToolCardData: AIToolCardDataType[] = [
    {
        title: 'Make a new question paper',
        description: 'Start from a topic, a document, or a recording. Edit before you publish.',
        features: [
            {
                key: 'assessment',
                heading: 'Create a Question Paper',
                subheading:
                    'Drop a PDF, paste a topic, or upload audio. Get a draft you can edit before sending.',
                tags: ['PDF, audio or topic', 'Ready in ~30s', 'Editable draft'],
                route: '/ai-center/ai-tools/vsmart-upload',
            },
        ],
    },
    {
        title: 'Bring an existing paper online',
        description: 'Turn printed or scanned papers into editable question sets.',
        features: [
            {
                key: 'question',
                heading: 'Reuse Existing Questions',
                subheading:
                    'Upload a printed paper — photo, scan, or PDF — and get back a digital, editable question set.',
                tags: ['Photo, scan or PDF', 'OCR handled for you', 'Save to question bank'],
                route: '/ai-center/ai-tools/vsmart-extract',
            },
        ],
    },
    {
        title: 'Tidy your question bank',
        description: 'Group questions by topic so you can reuse them next term.',
        features: [
            {
                key: 'sortSplitPdf',
                heading: 'Organize My Question Bank',
                subheading:
                    'Auto-group questions by topic, or pick your own splits. Refine the result with drag and drop.',
                tags: ['Auto-group by topic', 'Chapter-wise', 'Drag to refine'],
                route: '/ai-center/ai-tools/vsmart-organizer',
            },
        ],
    },
    {
        title: 'Plan and improve your lectures',
        description: 'Draft a lesson before class. Get kind, specific feedback after.',
        features: [
            {
                key: 'planLecture',
                heading: 'Lesson Planner',
                subheading:
                    'Describe what you are teaching and how long you have. Get a draft plan you can refine.',
                tags: ['Time-based timeline', 'Editable in place', 'Homework optional'],
                route: '/ai-center/ai-tools/vsmart-lecture',
            },
            {
                key: 'evaluateLecture',
                heading: 'Lecture Coach',
                subheading:
                    'Drop a recording of a lecture you taught. Get a clear, constructive review.',
                tags: ['Pacing & engagement', 'Strong moments', 'Concrete suggestions'],
                route: '/ai-center/ai-tools/vsmart-feedback',
            },
        ],
    },
];
