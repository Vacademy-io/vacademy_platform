// Mirrors the admin-side coding-question types so admin and learner agree on
// the JSON stored in document_slide.published_data.

export type LangId = "python" | "javascript" | "c" | "cpp" | "java" | "go";

export interface CodingTestCase {
  id: string;
  label?: string;
  stdin: string;
  expectedStdout: string;
  // Optional list of acceptable outputs. A submission passes if its output
  // matches ANY entry (same trim-then-exact rule). Absent ⇒ [expectedStdout].
  // Invariant maintained by authoring: acceptedOutputs[0] === expectedStdout.
  acceptedOutputs?: string[];
  visible: boolean;
}

export interface CodingPerRunLimits {
  cpuSeconds: number;
  memoryKb: number;
}

export interface CodingQuestionConfig {
  problemHtml: string;
  allowedLanguages: LangId[];
  starterCode: Partial<Record<LangId, string>>;
  sessionTimeMinutes: number | null;
  perRunLimits: CodingPerRunLimits;
  maxPoints: number;
  testCases: CodingTestCase[];
}

export interface CodeEditorData {
  language: string;
  code: string;
  theme?: "light" | "dark";
  viewMode?: "view" | "edit";
  allLanguagesData?: Record<string, { code: string; lastEdited?: number }>;
  mode?: "practice" | "question";
  question?: CodingQuestionConfig;
}

// ---------------------------------------------------------------------------
// Submission shape (Phase 3 stores in Preferences; Phase 4 mirrors to backend)
// ---------------------------------------------------------------------------

export type Verdict =
  | "ACCEPTED"
  | "PARTIAL"
  | "REJECTED"
  | "ERROR"
  | "TIMED_OUT";

export type CodeErrorType =
  | "TLE"
  | "MLE"
  | "COMPILE"
  | "RUNTIME"
  | "JUDGE0"
  | "RUNTIME_JS"
  | "OTHER";

export interface TestCaseResult {
  id: string;
  label?: string;
  visible: boolean;
  passed: boolean;
  stdout: string;
  expected: string;
  // Which accepted output matched (index into the test case's acceptedOutputs),
  // or -1 if none matched. acceptedCount is the size of the accepted set, so the
  // UI can show "matched 1 of N".
  matchedIndex?: number;
  acceptedCount?: number;
  stderr?: string;
  timeMs?: number;
  memoryKb?: number;
  error?: string;
  errorType?: CodeErrorType;
  errorLabel?: string;
}

export interface CodingSubmission {
  id: string; // local UUID
  slideId: string;
  language: LangId;
  sourceCode: string;
  verdict: Verdict;
  passedCount: number;
  totalCount: number;
  score: number;
  maxPoints: number;
  results: TestCaseResult[];
  totalTimeMs: number;
  peakMemoryKb: number;
  submittedAt: number; // epoch ms
  sessionStartedAt?: number; // epoch ms
}
