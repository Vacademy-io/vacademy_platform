import {
  getTerminology,
  getTerminologyPlural,
} from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, RoleTerms, SystemTerms } from "@/types/naming-settings";
import i18n from "@/i18n";

export enum TabType {
  OUTLINE = "OUTLINE",
  CONTENT_STRUCTURE = "CONTENT_STRUCTURE",
  // SUBJECTS = "SUBJECTS",
  TEACHERS = "TEACHERS",
  ASSESSMENT = "ASSESSMENT",
  COURSE_DISCUSSION = "COURSE_DISCUSSION",
  // TODO: will add after the feature is developed
  // ASSIGNMENT = "ASSIGNMENT",
  // GRADING = "GRADING",
  // ANNOUNCEMENT = "ANNOUNCEMENT",
}
/**
 * Tab labels are locale- AND terminology-dependent, so they must be built per
 * render: a module-scope array evaluates once at import and would freeze both
 * the language and any institute rename. Call these from inside a component
 * that subscribes to changes (useTranslation re-renders on languageChanged,
 * which sidebar/utils also republishes as a naming-settings update).
 */
export const getTabs = (): Array<{ label: string; value: string }> => [
  { label: i18n.t("studyContent:tabs.outline"), value: "OUTLINE" },
  {
    label: i18n.t("studyContent:tabs.contentStructure"),
    value: "CONTENT_STRUCTURE",
  },
  {
    label: getTerminologyPlural(RoleTerms.Teacher, SystemTerms.Teacher),
    value: "TEACHERS",
  },
  { label: i18n.t("studyContent:tabs.assessment"), value: "ASSESSMENT" },
  {
    label: i18n.t("studyContent:tabs.courseDiscussion", {
      course: getTerminology(ContentTerms.Course, SystemTerms.Course),
    }),
    value: "COURSE_DISCUSSION",
  },
];

export const getCatalogTabs = (): Array<{ label: string; value: string }> => [
  { label: i18n.t("studyContent:tabs.outline"), value: "OUTLINE" },
];

/**
 * @deprecated Module-scope snapshot — frozen at import, so it ignores both the
 * active locale and institute renames. Retained only for callers outside this
 * namespace's migration (routes/study-library/courses/**); use getTabs().
 */
export const tabs = [
  { label: "Outline", value: "OUTLINE" },
  { label: "Content Structure", value: "CONTENT_STRUCTURE" },
  {
    label: getTerminology(RoleTerms.Teacher, SystemTerms.Teacher) + "s",
    value: "TEACHERS",
  },
  { label: "Assessment", value: "ASSESSMENT" },
  { label: "Course Discussion", value: "COURSE_DISCUSSION" },
];

/**
 * @deprecated Same module-scope snapshot problem as `tabs`; use getCatalogTabs().
 */
export const catalogTabs = [
  { label: "Outline", value: "OUTLINE" }
];
