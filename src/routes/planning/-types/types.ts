// Type definitions for Planning & Activity Logs feature

export type LogType = "planning" | "diary_log";
export type IntervalType =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly_month"
  | "yearly_quarter";
export type LogStatus = "ACTIVE" | "DELETED";

export interface PlanningLog {
  id: string;
  created_by_user_id: string;
  created_by: string; // Creator's name
  log_type: LogType;
  entity: "packageSession";
  entity_id: string; // Batch/Course ID
  interval_type: IntervalType;
  interval_type_id: string; // Formatted date/period identifier
  title: string;
  description?: string;
  content_html: string; // Main content in HTML format
  subject_id: string;
  comma_separated_file_ids?: string; // Attached file IDs
  is_shared_with_student: boolean;
  status: LogStatus;
  institute_id: string;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface ListPlanningLogsRequest {
  log_types?: LogType[];
  interval_types?: IntervalType[];
  interval_type_ids?: string[];
  created_by_user_ids?: string[];
  entity_ids?: string[];
  subject_ids?: string[];
  statuses?: LogStatus[];
  is_shared_with_student?: boolean;
}

export interface ListPlanningLogsResponse {
  content: PlanningLog[];
  pageable: {
    sort: { sorted: boolean; unsorted: boolean; empty: boolean };
    pageNumber: number;
    pageSize: number;
    offset: number;
    paged: boolean;
    unpaged: boolean;
  };
  totalPages: number;
  totalElements: number;
  last: boolean;
  first: boolean;
  size: number;
  number: number;
  sort: { sorted: boolean; unsorted: boolean; empty: boolean };
  numberOfElements: number;
  empty: boolean;
}

export interface LogTypeOption {
  id: LogType;
  label: string;
}

export interface IntervalTypeOption {
  id: IntervalType;
  label: string;
}

export interface FilterOption {
  id: string;
  label: string;
}

export type ViewMode = "table" | "timeline";
