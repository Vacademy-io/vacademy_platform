import { useMutation } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { toast } from "sonner";
import { LIVE_SESSION_REGISTER_GUEST_USER } from "@/constants/urls";
import { GuestRegistrationRequestDTO } from "../-utils/helper";

interface ErrorResponse {
  message: string;
  ex?: string;
  responseCode?: string;
}

export const useLiveSessionGuestRegistration = () => {
  return useMutation({
    mutationFn: async (payload: GuestRegistrationRequestDTO) => {
      const response = await axios.post(
        LIVE_SESSION_REGISTER_GUEST_USER,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      console.error("Registration failed:", error);

      // Don't show toast for 511 - already registered case
      // This will be handled in the component
      if (error.response?.status === 511) {
        return;
      }

      toast.error(error.response?.data?.message || "Registration failed");
    },
  });
};
