import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { RoleTerms, SystemTerms } from "@/types/naming-settings";

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

export const catalogTabs = [
  { label: "Outline", value: "OUTLINE" }
];
