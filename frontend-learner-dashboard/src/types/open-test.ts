export interface UserDetailsOpenTest {
  id: string;
  username: string;
  user_id: string;
  email: string;
  full_name: string;
  address_line: string;
  region: string | null;
  city: string;
  pin_code: string | null;
  mobile_number: string;
  date_of_birth: string | null;
  gender: string;
  father_name: string;
  mother_name: string;
  parents_mobile_number: string;
  parents_email: string;
  linked_institute_name: string;
  package_session_id: string;
  institute_enrollment_id: string;
  status: string;
  session_expiry_days: number | null;
  institute_id: string;
  face_file_id: string | null;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

interface About {
  id: string | null;
  type: string | null;
  content: string | null;
}

interface AssessmentPublicDTO {
  assessment_id: string;
  assessment_name: string;
  about: About;
  play_mode: string;
  evaluation_type: string;
  submission_type: string;
  duration: number;
  status: string;
  registration_close_date: string;
  registration_open_date: string;
  expected_participants: number | null;
  cover_file_id: string | null;
  bound_start_time: string;
  bound_end_time: string;
  reattempt_count: number;
  created_at: string;
  updated_at: string;
}

interface AssessmentCustomField {
  id: string;
  field_name: string;
  field_key: string;
  comma_separated_options: string;
  status: string;
  is_mandatory: boolean;
  field_type: string;
  created_at: string;
  updated_at: string;
}

export interface OpenTestAssessmentRegistrationDetails {
  institute_id: string;
  assessment_public_dto: AssessmentPublicDTO;
  can_register: boolean;
  error_message: string | null;
  assessment_custom_fields: AssessmentCustomField[];
  server_time_in_gmt: string;
}
