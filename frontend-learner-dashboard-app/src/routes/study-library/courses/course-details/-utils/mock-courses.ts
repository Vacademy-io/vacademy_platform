import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import type {
  Course,
  ModuleType,
  SlideType,
  SubjectType,
} from "./course-details-types";

export const mockCourses: Course[] = [
  {
    id: "1",
    title: `2-Level ${getTerminology(
      ContentTerms.Course,
      SystemTerms.Course,
    )} Structure`,
    level: 2,
    structure: {
      courseName: "Introduction to Web Development",
      items: [] as SlideType[],
    },
  },
  {
    id: "2",
    title: `3-Level ${getTerminology(
      ContentTerms.Course,
      SystemTerms.Course,
    )} Structure`,
    level: 3,
    structure: {
      courseName: "Frontend Fundamentals",
      items: [] as SlideType[],
    },
  },
  {
    id: "3",
    title: `4-Level ${getTerminology(
      ContentTerms.Course,
      SystemTerms.Course,
    )} Structure`,
    level: 4,
    structure: {
      courseName: "Full-Stack JavaScript Development Mastery",
      items: [] as ModuleType[],
    },
  },
  {
    id: "4",
    title: `5-Level ${getTerminology(
      ContentTerms.Course,
      SystemTerms.Course,
    )} Structure`,
    level: 5,
    structure: {
      courseName: "Advanced Software Engineering Principles",
      items: [] as SubjectType[],
    },
  },
];
