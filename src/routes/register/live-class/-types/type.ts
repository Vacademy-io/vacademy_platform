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
  startTime: string; // ISO date string
  lastEntryTime: string; // ISO date string
  accessLevel: string;
  instituteId: string;
  customFields: CustomField[];
}
