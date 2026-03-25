// Import rich slide types
import type {
    VideoSlide,
    DocumentSlide,
    QuizSlide,
    AssignmentSlide,
    QuestionSlide,
} from '../types/index';

export interface Slide {
    id: string;
    name: string;
    title: string;
    type:
        | 'pdf'
        | 'text'
        | 'code'
        | 'youtube'
        | 'html'
        | 'assessment'
        | 'document'
        | 'video'
        | 'presentation'
        | 'quiz'
        | 'assignment';
    source_type: 'VIDEO' | 'DOCUMENT' | 'QUIZ' | 'ASSIGNMENT' | 'QUESTION' | 'PRESENTATION' | 'PDF';
    key?: string;
    depth?: number;
    path?: string;
    content?: string;
    status?: 'DRAFT' | 'PUBLISHED';
    slide_order?: number;
    is_ai_generated?: boolean;

    // Rich slide data (same structure as types/index.ts)
    video_slide?: VideoSlide | null;
    document_slide?: DocumentSlide | null;
    quiz_slide?: QuizSlide | null;
    assignment_slide?: AssignmentSlide | null;
    question_slide?: QuestionSlide | null;

    // AI-specific metadata
    ai_content?: string;
    manual_modifications?: boolean;
}

export interface Chapter {
    id: string;
    name: string;
    key?: string;
    depth?: number;
    path?: string;
    slides: Slide[];
}

export interface Module {
    id: string;
    name: string;
    key?: string;
    depth?: number;
    path?: string;
    chapters: Chapter[];
}

export interface Subject {
    id: string;
    name: string;
    key?: string;
    depth?: number;
    path?: string;
    modules: Module[];
}

export const courseData: Subject[] = [
    {
        id: 'subj-3',
        name: 'Introduction to Python',
        modules: [
            {
                id: 'mod-1',
                name: 'Python Fundamentals',
                chapters: [
                    {
                        id: 'chap-1',
                        name: 'Introduction',
                        slides: [
                            {
                                id: 'slide-1',
                                name: 'Course Overview',
                                title: 'Course Overview',
                                type: 'pdf',
                                source_type: 'PDF',
                            },
                            {
                                id: 'slide-2',
                                name: 'The Power of Python',
                                title: 'The Power of Python',
                                type: 'video',
                                source_type: 'VIDEO',
                            },
                            {
                                id: 'slide-3',
                                name: 'Further Reading',
                                title: 'Further Reading',
                                type: 'document',
                                source_type: 'DOCUMENT',
                            },
                            {
                                id: 'slide-4',
                                name: 'Initial Assessment',
                                title: 'Initial Assessment',
                                type: 'assessment',
                                source_type: 'QUIZ',
                            },
                        ],
                    },
                ],
            },
        ],
    },
];
