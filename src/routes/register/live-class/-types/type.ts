export interface CustomField {
  id: string;
  fieldKey: string;
  fieldName: string;
  fieldType: string;
  defaultValue: string | null;
  config: string; // This can also be typed as an object if parsed
  formOrder: number;
  filter: boolean;
  sortable: boolean;
  mandatory: boolean;
}

export interface SessionCustomFieldsResponse {
  sessionId: string;
  sessionTitle: string;
  subject: string;
  startTime: string; // ISO date string
  lastEntryTime: string; // ISO date string
  accessLevel: string;
  instituteId: string;
  coverFileId: string;
  customFields: CustomField[];
}

export interface ApiError {
  response?: {
    data?: unknown;
    status?: number;
    statusText?: string;
  };
  message: string;
}

export interface FormFieldValue {
  value: string | number | boolean;
  label?: string;
}

export interface RegistrationFormValues {
  [key: string]: FormFieldValue | string;
}

export interface DropdownOption {
  name: string;
  label: string;
}

export interface SessionDetailsResponse {
  sessionId: string;
  scheduleId: string;
  instituteId: string;
  sessionStartTime: string;
  lastEntryTime: string;
  accessLevel: string;
  meetingType: string | null;
  linkType: string;
  sessionStreamingServiceType: string;
  defaultMeetLink: string;
  waitingRoomLink: string | null;
  waitingRoomTime: number;
  registrationFormLinkForPublicSessions: string | null;
  createdByUserId: string;
  title: string;
  descriptionHtml: string | null;
  notificationEmailMessage: string | null;
  attendanceEmailMessage: string | null;
  coverFileId: string | null;
  subject: string;
  thumbnailFileId: string | null;
  backgroundScoreFileId: string | null;
  status: string;
  recurrenceType: string;
  recurrenceKey: string;
  meetingDate: string;
  scheduleStartTime: string;
  scheduleLastEntryTime: string;
  customMeetingLink: string;
  customWaitingRoomMediaId: string | null;
}
