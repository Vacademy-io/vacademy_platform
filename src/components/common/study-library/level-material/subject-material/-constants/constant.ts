import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { RoleTerms, SystemTerms } from "@/types/naming-settings";

export enum TabType {
  OUTLINE = "OUTLINE",
  // SUBJECTS = "SUBJECTS",
  TEACHERS = "TEACHERS",
  ASSESSMENT = "ASSESSMENT",
  // TODO: will add after the feature is developed
  // ASSIGNMENT = "ASSIGNMENT",
  // GRADING = "GRADING",
  // ANNOUNCEMENT = "ANNOUNCEMENT",
}
export const tabs = [
  { label: "Outline", value: "OUTLINE" },
  // { label: "Subjects", value: "SUBJECTS" },
  {
    label: getTerminology(RoleTerms.Teacher, SystemTerms.Teacher) + "s",
    value: "TEACHERS",
  },
  { label: "Assessment", value: "ASSESSMENT" },
  // TODO: will after the feature is developed
  // { label: "Assignment ", value: "ASSIGNMENT" },
  // { label: "Grading ", value: "GRADING" },
  // { label: "Announcements ", value: "ANNOUNCEMENT" },
];
