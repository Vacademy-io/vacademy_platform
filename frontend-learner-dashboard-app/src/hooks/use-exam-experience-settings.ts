import { useEffect, useState } from "react";
import { getExamExperienceSettings } from "@/services/assessment-experience-settings";
import {
  DEFAULT_EXAM_EXPERIENCE,
  type ExamExperienceSettings,
} from "@/types/assessment-experience";

/**
 * Institute-configured live-test experience (calculator, scratchpad, palette,
 * mobile chrome).
 *
 * Starts from the defaults rather than `null` so the exam shell renders on the
 * first frame — a learner must never see a blank screen waiting on a settings
 * call. Tools default to off, so a slow fetch can only reveal a tool late, never
 * hand a learner one the institute disabled.
 */
export function useExamExperienceSettings(): ExamExperienceSettings {
  const [settings, setSettings] = useState<ExamExperienceSettings>(
    DEFAULT_EXAM_EXPERIENCE
  );

  useEffect(() => {
    let cancelled = false;
    getExamExperienceSettings()
      .then((next) => {
        if (!cancelled) setSettings(next);
      })
      .catch(() => {
        /* defaults already applied */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}
