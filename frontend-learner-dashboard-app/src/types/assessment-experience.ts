/**
 * Learner-side mirror of the `examExperience` block inside the institute's
 * ASSESSMENT_SETTING (authored in the admin dashboard under
 * Settings → Assessment → Live Test Experience).
 *
 * Keep the shape in sync with
 * `frontend-admin-dashboard/src/types/assessment-settings.ts`.
 */

export type ExamCalculatorMode = "basic" | "scientific";

export type QuestionPaletteView = "grid" | "list";

export interface ExamExperienceSettings {
  calculator: {
    enabled: boolean;
    mode: ExamCalculatorMode;
  };
  scratchpad: {
    enabled: boolean;
  };
  questionPalette: {
    enabled: boolean;
    defaultView: QuestionPaletteView;
  };
  /** Marks / negative-marks chips beside each question. */
  showMarkingScheme: boolean;
  mobile: {
    /** Hide chatbot launcher + other app chrome during a live test on phones. */
    hideAppNavigation: boolean;
  };
}

/** Institute setting key shared with the admin dashboard. */
export const ASSESSMENT_SETTING_KEY = "ASSESSMENT_SETTING";

export const DEFAULT_EXAM_EXPERIENCE: ExamExperienceSettings = {
  calculator: { enabled: false, mode: "scientific" },
  scratchpad: { enabled: false },
  questionPalette: { enabled: true, defaultView: "grid" },
  showMarkingScheme: true,
  mobile: { hideAppNavigation: true },
};

/** Fill in any branch an institute hasn't saved yet. */
export function mergeExamExperience(
  incoming?: Partial<ExamExperienceSettings> | null
): ExamExperienceSettings {
  const d = DEFAULT_EXAM_EXPERIENCE;
  return {
    calculator: { ...d.calculator, ...incoming?.calculator },
    scratchpad: { ...d.scratchpad, ...incoming?.scratchpad },
    questionPalette: { ...d.questionPalette, ...incoming?.questionPalette },
    showMarkingScheme: incoming?.showMarkingScheme ?? d.showMarkingScheme,
    mobile: { ...d.mobile, ...incoming?.mobile },
  };
}
