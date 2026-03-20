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


export type UserActivity = {
  time_spent_by_user_millis: number;
  activity_date: string; // ISO 8601 date string
  avg_time_spent_by_batch_millis: number;
};

export type UserActivityArray = UserActivity[];