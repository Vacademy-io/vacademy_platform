export interface Slide {
  status: string;
  source_type: string;
  video_description: string;
  slide_description: string;
  document_cover_file_id: string;
  document_id: string;
  video_id: string;
  video_url: string;
  document_type: string;
  slide_title: string;
  document_data: string;
  document_title: string;
  video_title: string;
  slide_id: string;
}

export interface CourseData {
  courses: number;
  tests_assigned: number;
  slides: Slide[];
}
