export interface DoubtType {
    user_id: string;
    name: string;
    source: 'video' | string;
    source_id: string;
    raised_time: string; // ISO 8601 timestamp
    resolved_time: string | null; // ISO 8601 timestamp
    content_position: string | null; // Format: HH:MM:SS
    content_type: string;
    html_text: string;
    status: 'ACTIVE' | 'RESOLVED' | 'DELETED';
    parent_id: string | null;
    parent_level: number;
    doubt_assignee_request_user_ids: string[];
    id?:string;
  }
  
  export interface StudentDetailsType {
    address_line: string;
    city: string;
    created_at: string; // ISO timestamp
    date_of_birth: string | null; // Can be null
    email: string;
    expiry_date: string; // ISO timestamp
    face_file_id: string | null;
    father_name: string;
    full_name: string;
    gender: string;
    id: string;
    institute_enrollment_id: string;
    institute_id: string;
    linked_institute_name: string;
    mobile_number: string;
    mother_name: string;
    package_session_id: string;
    parents_email: string;
    parents_mobile_number: string;
    parents_to_mother_email: string | null;
    parents_to_mother_mobile_number: string | null;
    pin_code: string;
    region: string | null;
    session_expiry_days: number | null;
    status: string;
    updated_at: string; // ISO timestamp
    user_id: string;
    username: string;
  }
  