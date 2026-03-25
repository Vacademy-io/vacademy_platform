/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

import type {
    AppState as ExcalidrawAppStateOriginal,
    BinaryFiles,
    Collaborator,
    SocketId,
    LibraryItems,
} from '@excalidraw/excalidraw/types';

import type { ContextMenuItems } from '../../excalidraw/packages/excalidraw/components/ContextMenu';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

// Define AppState based on Excalidraw's AppState structure
// Ensure all properties from the original AppState are included if needed,
// or use ExcalidrawAppStateOriginal directly where a full, mutable state is handled.
// For data storage (like in slide objects), Partial<ExcalidrawAppStateOriginal> is often sufficient.
export type AppState = ExcalidrawAppStateOriginal;
export type PartialAppState = Partial<ExcalidrawAppStateOriginal>;

export enum SlideTypeEnum {
    Title = 'title',
    Text = 'text',
    Blank = 'blank',
    Excalidraw = 'excalidraw', // Generic Excalidraw slide
    Quiz = 'quiz',
    Feedback = 'feedback',
    InteractiveVideo = 'interactive-video',
}

// Data structure for Quiz/Feedback slide elements
export interface QuestionFormData {
    questionName?: string;
    // Add other fields specific to your quiz/feedback editor
    [key: string]: any; // Allows flexibility for now
}

// Base interface for all slide types
interface BaseSlide {
    id: string;
    type: SlideTypeEnum;
    slide_order: number; // Important for presentation sequence
    title?: string; // Optional title for the slide itself
    source_id?: string; // S3 file ID from the backend — preserved to avoid re-uploading unchanged slides
    questionId?: string; // DB question ID for Quiz/Feedback slides
}

// Interface for Excalidraw-based slides (Title, Text, Blank, Excalidraw, and others by default)
export interface ExcalidrawSlideData extends BaseSlide {
    type: SlideTypeEnum; // Broadened to accept any slide type, discriminated by Slide union.
    elements: readonly ExcalidrawElement[];
    appState: PartialAppState; // Storing partial appState is usually fine for initial data
    files: BinaryFiles | null;
}

// Interface for Quiz slides
export interface QuizSlideData extends BaseSlide {
    type: SlideTypeEnum.Quiz;
    elements: QuestionFormData; // Specific form data structure for Quiz
}

// Interface for Feedback slides
export interface FeedbackSlideData extends BaseSlide {
    type: SlideTypeEnum.Feedback;
    elements: QuestionFormData; // Specific form data structure for Feedback
}

// Discriminated union for a slide object
export type Slide = ExcalidrawSlideData | QuizSlideData | FeedbackSlideData;

// Props for ExcalidrawWrapper's initial data
export interface ExcalidrawWrapperInitialData {
    id: string; // Unique ID for the Excalidraw dataset (used for React key)
    elements?: readonly ExcalidrawElement[];
    appState?: PartialAppState;
    files?: BinaryFiles;
    libraryItems?: LibraryItems;
}

// For the Presentation data structure from your sample
export interface PresentationData {
    id: string;
    title: string;
    description: string;
    cover_file_id: string; // Assuming this relates to a file ID
    added_slides: Slide[]; // Using the refined Slide type
    // You might also have other fields like status, category, counts from your backend
    status?: string;
    category?: string;
    added_slides_count?: number;
    updated_at?: string; // ISO date string
    created_at?: string; // ISO date string
}

export type { ContextMenuItems }; // Export if used directly elsewhere

// RichText and Option types from your sample data (if needed widely)
export interface RichText {
    id: string | null;
    type: string;
    content: string | null;
}

export interface Option {
    id: string;
    preview_id: string | null;
    question_id: string;
    text: RichText;
    media_id: string;
    option_order: number | null;
    created_on: string;
    updated_on: string;
    explanation_text: RichText | null;
}
