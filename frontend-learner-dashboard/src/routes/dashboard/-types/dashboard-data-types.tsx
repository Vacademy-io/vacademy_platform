export type DashboardSlide = {
  slide_description: string;
  slide_title: string;
  progress_marker: number;
  level_id: string;
  package_id: string;
  module_id: string;
  image_file_id: string;
  slide_id: string;
  chapter_id: string;
  subject_id: string;
  source_type: string;
  status: string;
};


export type DashbaordResponse = {
  courses: number;
  tests_assigned: number;
  slides: DashboardSlide[];
};
