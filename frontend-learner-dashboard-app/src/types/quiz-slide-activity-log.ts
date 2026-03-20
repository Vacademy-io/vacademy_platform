export interface QuizSlideActivityLogPayload {
  id: string;
  source_id: string;
  source_type: string;
  user_id: string;
  slide_id: string;
  start_time_in_millis: number;
  end_time_in_millis: number;
  percentage_watched: number;
  videos: Array<{
    id: string;
    start_time_in_millis: number;
    end_time_in_millis: number;
  }>;
  documents: Array<{
    id: string;
    start_time_in_millis: number;
    end_time_in_millis: number;
    page_number: number;
  }>;
  question_slides: Array<{
    id: string;
    attempt_number: number;
    response_json: string;
    response_status: string;
    marks: number;
  }>;
  assignment_slides: Array<{
    id: string;
    comma_separated_file_ids: string;
    date_submitted: string;
    marks: number;
  }>;
  video_slides_questions: Array<{
    id: string;
    response_json: string;
    response_status: string;
  }>;
  new_activity: boolean;
  concentration_score: {
    id: string;
    concentration_score: number;
    tab_switch_count: number;
    pause_count: number;
    answer_times_in_seconds: number[];
  };
  quiz_sides: Array<{
    id: string;
    response_json: string;
    response_status: string;
    activity_id: string;
    question_id: string;
  }>;
} 