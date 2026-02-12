// Content Types supported by the AI Video Player
export type ContentType =
  | "VIDEO"              // Default: time-synced HTML overlays
  | "QUIZ"               // Question-based assessments
  | "STORYBOOK"          // Page-by-page narratives
  | "INTERACTIVE_GAME"   // Self-contained HTML5 games
  | "PUZZLE_BOOK"        // Collection of puzzles
  | "SIMULATION"         // Physics/science sandboxes
  | "FLASHCARDS"         // Spaced-repetition cards
  | "MAP_EXPLORATION"    // Interactive SVG maps
  | "WORKSHEET"          // Printable worksheets
  | "CODE_PLAYGROUND"    // Code editor exercises
  | "TIMELINE"           // Chronological visualization
  | "CONVERSATION";      // Language dialogues

// Navigation modes
export type NavigationType = "time_driven" | "user_driven" | "self_contained";

// Entry label types for different content
export type EntryLabel = 
  | "segment"   // VIDEO
  | "question"  // QUIZ
  | "page"      // STORYBOOK, PUZZLE_BOOK, MAP_EXPLORATION, FLASHCARDS
  | "event"     // TIMELINE
  | "exercise"  // WORKSHEET, CODE_PLAYGROUND
  | "exchange"  // CONVERSATION
  | "level";    // INTERACTIVE_GAME, SIMULATION

// Branding configuration
export interface BrandingConfig {
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  watermark_html?: string;
  intro_html?: string;
  outro_html?: string;
}

// Frame/Entry structure
export interface Frame {
  inTime: number;
  exitTime: number;
  html: string;
  id: string;
  z: number;
  htmlStartX?: number;
  htmlStartY?: number;
  htmlEndX?: number;
  htmlEndY?: number;
  audio_url?: string;  // Optional per-entry audio for user_driven content
}

// Timeline metadata
export interface TimelineMeta {
  content_type: ContentType;
  navigation: NavigationType;
  entry_label: EntryLabel | string;
  audio_start_at: number;
  total_duration: number | null;
  dimensions: { width: number; height: number };
  branding?: BrandingConfig;
  intro_duration?: number;
  outro_duration?: number;
  content_starts_at?: number;
  content_ends_at?: number;
  target_language?: string;  // For CONVERSATION content type
}

// Timeline data structure
export interface TimelineData {
  meta: TimelineMeta;
  entries: Frame[];
}

// Content type configuration for UI display
export const CONTENT_TYPE_LABELS: Record<ContentType, { emoji: string; label: string }> = {
  VIDEO: { emoji: "🎬", label: "Video" },
  QUIZ: { emoji: "📝", label: "Quiz" },
  STORYBOOK: { emoji: "📖", label: "Storybook" },
  INTERACTIVE_GAME: { emoji: "🎮", label: "Game" },
  PUZZLE_BOOK: { emoji: "🧩", label: "Puzzles" },
  SIMULATION: { emoji: "🔬", label: "Simulation" },
  FLASHCARDS: { emoji: "🃏", label: "Flashcards" },
  MAP_EXPLORATION: { emoji: "🗺️", label: "Map" },
  WORKSHEET: { emoji: "📋", label: "Worksheet" },
  CODE_PLAYGROUND: { emoji: "💻", label: "Code" },
  TIMELINE: { emoji: "⏳", label: "Timeline" },
  CONVERSATION: { emoji: "🗣️", label: "Conversation" },
};

// Navigation type to content types mapping
export const NAVIGATION_CONFIG: Record<NavigationType, ContentType[]> = {
  time_driven: ["VIDEO"],
  user_driven: [
    "QUIZ",
    "STORYBOOK",
    "PUZZLE_BOOK",
    "FLASHCARDS",
    "MAP_EXPLORATION",
    "WORKSHEET",
    "TIMELINE",
    "CONVERSATION",
  ],
  self_contained: ["INTERACTIVE_GAME", "SIMULATION", "CODE_PLAYGROUND"],
};

// Default entry labels for each content type
export const DEFAULT_ENTRY_LABELS: Record<ContentType, string> = {
  VIDEO: "segment",
  QUIZ: "question",
  STORYBOOK: "page",
  INTERACTIVE_GAME: "level",
  PUZZLE_BOOK: "page",
  SIMULATION: "level",
  FLASHCARDS: "card",
  MAP_EXPLORATION: "page",
  WORKSHEET: "exercise",
  CODE_PLAYGROUND: "exercise",
  TIMELINE: "event",
  CONVERSATION: "exchange",
};
