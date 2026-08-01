import {
  VideoSlide,
  DocumentSlide,
  QuestionSlide,
  AssignmentSlide,
} from "../../-services/getAllSlides";

export type SlideType = {
  id: string;
  name: string;
  type: string;
  description: string;
  status: string;
  order: number;
  videoSlide?: VideoSlide;
  documentSlide?: DocumentSlide;
  questionSlide?: QuestionSlide;
  assignmentSlide?: AssignmentSlide;
};

export type ChapterType = {
  id: string;
  name: string;
  status: string;
  file_id: string;
  description: string;
  chapter_order: number;
  slides: SlideType[];
  isOpen?: boolean;
};

export type ModuleType = {
  id: string;
  name: string;
  description: string;
  status: string;
  thumbnail_id: string;
  chapters: ChapterType[];
  isOpen?: boolean;
};

export type SubjectType = {
  id: string;
  subject_name: string;
  subject_code: string;
  credit: number;
  thumbnail_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  modules: ModuleType[];
};

export type Course = {
  id: string;
  title: string;
  level: 1 | 2 | 3 | 4 | 5;
  structure: {
    courseName: string;
    items: SubjectType[] | ModuleType[] | ChapterType[] | SlideType[];
  };
};

export type SlideCountType = {
  slide_count: number;
  source_type: string;
};

// Shape shared by the course-init payload's package_sessions and the
// enrolled-session matching logic on the course-details page.
export type PackageSessionSummary = {
  id: string;
  session?: { id: string };
  level?: { id: string };
  package_dto?: { id?: string };
};

export type SelectOption = { _id: string; value: string; label: string };
