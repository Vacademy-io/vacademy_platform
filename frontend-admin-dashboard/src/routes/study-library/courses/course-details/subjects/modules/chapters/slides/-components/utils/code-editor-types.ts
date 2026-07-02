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
    // Optional list of acceptable outputs. A submission passes if its output
    // matches ANY entry. Absent ⇒ [expectedStdout]. Authoring keeps the
    // invariant acceptedOutputs[0] === expectedStdout so legacy display/preview
    // /redaction paths that read expectedStdout keep working unchanged.
    acceptedOutputs?: string[];
    visible: boolean; // sample (visible) vs hidden
}

// Resolve the effective set of acceptable outputs for a test case. Old test
// cases (no acceptedOutputs) fall back to [expectedStdout] so verdicts are
// byte-identical to the single-output behaviour.
export function effectiveAccepted(tc: Pick<CodingTestCase, 'expectedStdout' | 'acceptedOutputs'>): string[] {
    return tc.acceptedOutputs && tc.acceptedOutputs.length > 0
        ? tc.acceptedOutputs
        : [tc.expectedStdout ?? ''];
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
