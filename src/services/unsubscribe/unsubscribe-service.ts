import axios from "axios";
import { USER_ANNOUNCEMENT_PREFERENCES_BASE_URL } from "@/constants/urls";

export type AnnouncementChannel = "EMAIL" | "WHATSAPP";

export interface AnnouncementPreferencePayload {
  username: string;
  preferences: {
    emailSenders?: Array<{ emailType: string; unsubscribed: boolean }>;
    whatsappUnsubscribed?: boolean;
  };
}

export interface AnnouncementPreferenceUpdateRequest {
  username: string;
  instituteId: string;
  payload: AnnouncementPreferencePayload;
}

export interface AnnouncementPreferenceUpdateResponse {
  preferences?: AnnouncementPreferencePayload["preferences"];
  [key: string]: unknown;
}

const buildEndpoint = (username: string) =>
  `${USER_ANNOUNCEMENT_PREFERENCES_BASE_URL}/${encodeURIComponent(username)}`;

export const updateAnnouncementPreferences = async (
  request: AnnouncementPreferenceUpdateRequest
): Promise<AnnouncementPreferenceUpdateResponse> => {
  const { username, instituteId, payload } = request;

  const response = await axios.put<AnnouncementPreferenceUpdateResponse>(
    buildEndpoint(username),
    payload,
    {
      params: { instituteId },
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 15000,
      withCredentials: false,
    }
  );

  return response.data;
};
