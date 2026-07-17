export const NAMING_SETTINGS_KEY = "namingSettings";

/**
 * One institute's rename of a term in a NON-source language. Every field is
 * optional: an institute may translate the singular only, or record gender
 * without renaming anything.
 *
 * Mirrors NamingSettingsLocaleOverride in the admin app
 * (src/routes/settings/-constants/terms.ts) — keep the two in sync.
 */
export interface NamingSettingsLocaleOverride {
  customValue?: string;
  customPluralValue?: string;
  /** Grammatical gender of customValue — consumed by future sentence frames (hi/ar). */
  gender?: "m" | "f";
}

/** BCP-47 locale → override. Keys are locales from src/i18n/locales.ts. */
export type NamingSettingsLocales = Record<string, NamingSettingsLocaleOverride>;

/**
 * NamingSettingsType (src/services/fetchAndStoreInstituteDetails.tsx) plus the
 * OPTIONAL per-locale overrides. The flat customValue/customPluralValue stay the
 * institute's entry in its CONTENT SOURCE language (LANGUAGE_SETTING
 * .content_source_locale, 'en' when unset).
 *
 * `locales` is absent from every blob cached before this field existed, so
 * readers must treat it as possibly-undefined.
 */
export interface LocalizedNamingSettings {
  key: string;
  systemValue?: string | null;
  customValue?: string;
  systemPluralValue?: string | null;
  customPluralValue?: string;
  locales?: NamingSettingsLocales;
}

export enum ContentTerms {
  Course = "Course",
  Level = "Level",
  Session = "Session",
  Subjects = "Subject",
  Modules = "Module",
  Chapters = "Chapter",
  Slides = "Slide",
  LiveSession = "LiveSession",
  Batch = "Batch",
  PopularTag = "PopularTag",
}

export enum RoleTerms {
  Admin = "Admin",
  Teacher = "Teacher",
  CourseCreator = "CourseCreator",
  AssessmentCreator = "AssessmentCreator",
  Evaluator = "Evaluator",
  Learner = "Learner",
}
export enum SystemTerms {
  Course = "Course",
  Level = "Level",
  Session = "Session",
  Subjects = "Subject",
  Modules = "Module",
  Chapters = "Chapter",
  Slides = "Slide",
  LiveSession = "Live Class",
  Batch = "Batch",
  PopularTag = "Popular Tag",
  Admin = "Admin",
  Teacher = "Instructor",
  CourseCreator = "Course Creator",
  AssessmentCreator = "Assessment Creator",
  Evaluator = "Evaluator",
  Learner = "Learner",
}
