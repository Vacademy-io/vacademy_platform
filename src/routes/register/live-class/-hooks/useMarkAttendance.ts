import { useMutation } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { LIVE_SESSION_MARK_ATTENDANCE } from "@/constants/urls";
import { toast } from "sonner";

interface MarkAttendancePayload {
  sessionId: string;
  scheduleId: string;
  userSourceType: "USER" | "EXTERNAL_USER";
  userSourceId: string;
  details?: string;
}

export const useMarkAttendance = () => {
  return useMutation({
    mutationFn: async (payload: MarkAttendancePayload) => {
      const response = await axios.post(LIVE_SESSION_MARK_ATTENDANCE, payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Attendance marked successfully");
    },
    onError: (error: AxiosError) => {
      console.error("Failed to mark attendance:", error);
      toast.error("Failed to mark attendance");
    },
  });
};
