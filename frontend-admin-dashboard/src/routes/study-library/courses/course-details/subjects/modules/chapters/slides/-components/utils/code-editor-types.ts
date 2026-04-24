import { LangId, SupportedLanguage } from '../constants/code-editor';

export interface LanguageState {
    code: string;
    lastEdited?: number;
}

// Per-language code state. python+javascript are required for back-compat with
// existing CODE slides; new languages are optional and only present when set.
export type AllLanguagesData = {
    python: LanguageState;
    javascript: LanguageState;
} & Partial<Record<LangId, LanguageState>>;

// ---------------------------------------------------------------------------
// Question Mode (added in Phase 1 — UI lands in Phase 2)
// ---------------------------------------------------------------------------

export interface CodingTestCase {
    id: string;
    label?: string;
    stdin: string;
    expectedStdout: string;
    visible: boolean; // sample (visible) vs hidden
}

export interface CodingPerRunLimits {
    cpuSeconds: number; // Judge0 cpu_time_limit
    memoryKb: number; // Judge0 memory_limit
}

export interface CodingQuestionConfig {
    problemHtml: string;
    allowedLanguages: LangId[];
    starterCode: Partial<Record<LangId, string>>;
    sessionTimeMinutes: number | null; // null = no session timer
    perRunLimits: CodingPerRunLimits;
    maxPoints: number;
    testCases: CodingTestCase[];
}

export type CodeSlideMode = 'practice' | 'question';

export interface CodeEditorData {
    language: SupportedLanguage;
    code: string;
    theme: 'light' | 'dark';
    viewMode: 'view' | 'edit';
    allLanguagesData?: AllLanguagesData;

    // NEW — opt-in. Absent ⇒ slide behaves exactly as today.
    mode?: CodeSlideMode;
    question?: CodingQuestionConfig;
}

export interface CodeEditorSlideProps {
    codeData?: CodeEditorData;
    isEditable: boolean;
    onDataChange?: (newData: CodeEditorData) => void;
    // Optional — when present and the slide is in Question Mode, the admin
    // QuestionEditor surfaces the Submissions tab for this slide.
    slideId?: string;
}

export const DEFAULT_PER_RUN_LIMITS: CodingPerRunLimits = {
    cpuSeconds: 2,
    memoryKb: 256_000,
};

export function makeEmptyQuestion(): CodingQuestionConfig {
    return {
        problemHtml: '',
        allowedLanguages: ['python'],
        starterCode: {},
        sessionTimeMinutes: null,
        perRunLimits: { ...DEFAULT_PER_RUN_LIMITS },
        maxPoints: 100,
        testCases: [],
    };
}
