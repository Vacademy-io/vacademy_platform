interface About {
  id: string | null;
  type: string | null;
  content: string | null;
}

export interface AssessmentPublicDto {
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

export interface AssessmentCustomFieldOpenRegistration {
  id: string;
  field_name: string;
  field_key: string;
  field_order: number;
  comma_separated_options: string;
  status: string;
  is_mandatory: boolean;
  field_type: string;
  created_at: string;
  updated_at: string;
}

export interface AssessmentDataOpenRegistration {
  institute_id: string;
  assessment_public_dto: AssessmentPublicDto;
  can_register: boolean;
  error_message: string | null;
  assessment_custom_fields: AssessmentCustomFieldOpenRegistration[];
}

export interface ParticipantsDataInterface {
  username: string;
  user_id: string;
  email: string;
  full_name: string;
  mobile_number: string;
  file_id: string;
  guardian_email: string;
  guardian_mobile_number: string;
  reattempt_count: number;
}

export interface DynamicField {
  name: string;
  value: string;
  is_mandatory: boolean;
  type: string;
  comma_separated_options?: string[];
}

export type DynamicSchemaData = Record<string, DynamicField>;

export interface OpenRegistrationUserDetails {
  id: string;
  username: string;
  email: string;
  full_name: string;
  address_line: string;
  city: string;
  region: string;
  pin_code: string;
  mobile_number: string;
  date_of_birth: string; // Using string since the date is in ISO format
  gender: string;
  password: string;
  profile_pic_file_id: string;
  roles: string[]; // Array of strings
  root_user: boolean;
}
