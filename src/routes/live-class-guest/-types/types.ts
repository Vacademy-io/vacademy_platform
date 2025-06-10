export interface SessionDetailsResponse {
  sessionId: string;
  sessionTitle: string;
  startTime: string;
  lastEntryTime: string;
  subject?: string;
  accessLevel: string;
  customFields?: Array<{
    id: string;
    fieldKey: string;
    fieldName: string;
    fieldType: string;
    mandatory: boolean;
    config: string;
  }>;
}
