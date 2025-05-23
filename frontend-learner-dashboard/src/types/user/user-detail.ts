interface Student {
  id: string;
  username: string;
  user_id: string;
  email: string;
  full_name: string;
  address_line: string;
  region: string;
  city: string;
  pin_code: string;
  mobile_number: string;
  date_of_birth: string;
  gender: string;
  father_name: string;
  mother_name: string;
  parents_mobile_number: string;
  parents_email: string;
  linked_institute_name: string;
  package_session_id: string;
  institute_enrollment_id: string;
  status: string;
  session_expiry_days: string;
  institute_id: string;
  face_file_id: string;
  expiry_date: string;
  created_at: string;
  updated_at: string;
  // Additional fields from the image
  course?: string;
  session?: string;
  level?: string;
  school?: string;
}
interface Batch {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  session_ids: string[];
}

interface Institute {
  id: string;
  name: string;
  batches_for_sessions: Batch[];
}

interface Session {
  id: string;
  level: {
    level_name: string;
    thumbnail_id: string | null;
  };
  session: {
    session_name: string;
    start_date: string;
    status: string;
  };
  package_dto: {
    package_name: string;
    thumbnail_file_id: string | null;
  };
  status: string;
  start_time: string;
}

export type { Student, Batch, Institute, Session };
