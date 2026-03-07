import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";
import {
  COLLECT_PUBLIC_USER_DATA,
  LIVE_SESSION_REGISTER_GUEST_USER,
} from "@/constants/urls";
import {
  CollectPublicUserDataDTO,
  GuestRegistrationRequestDTO,
} from "../-utils/helper";
import { guestAxiosInstance } from "@/lib/auth/axiosInstance";

interface ErrorResponse {
  message: string;
  ex?: string;
  responseCode?: string;
}

export const useLiveSessionGuestRegistration = () => {
  return useMutation({
    mutationFn: async (payload: GuestRegistrationRequestDTO) => {
      const response = await guestAxiosInstance.post(
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

export const useCollectPublicUserData = () => {
  return useMutation({
    mutationFn: async ({
      payload,
      instituteId,
    }: {
      payload: CollectPublicUserDataDTO;
      instituteId: string;
    }) => {
      const response = await guestAxiosInstance.post(COLLECT_PUBLIC_USER_DATA, payload, {
        params: { instituteId },
      });
      return response.data;
    },
    onError: (error: AxiosError<ErrorResponse>) => {
      console.error("Collecting public user data failed:", error);
      toast.error(error.response?.data?.ex);
    },
  });
};
