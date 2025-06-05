import { useQuery } from "@tanstack/react-query";
import { SessionCustomFieldsResponse } from "../-types/type";
import { LIVE_SESSION_GET_REGISTRATION_DATA } from "@/constants/urls";
import axios from "axios";

const fetchSessionCustomFields = async (
  sessionId: string
): Promise<SessionCustomFieldsResponse> => {
  try {
    const response = await axios({
      method: "GET",
      url: LIVE_SESSION_GET_REGISTRATION_DATA,
      params: {
        sessionId,
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error fetching session custom fields:", error);
    throw error; // Let react-query handle it
  }
};

export const useSessionCustomFields = (sessionId: string) => {
  return useQuery<SessionCustomFieldsResponse>({
    queryKey: ["sessionCustomFields", sessionId],
    queryFn: () => fetchSessionCustomFields(sessionId),
    enabled: !!sessionId,
  });
};
