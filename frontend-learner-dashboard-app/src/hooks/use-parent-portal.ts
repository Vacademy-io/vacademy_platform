// ─────────────────────────────────────────────────────────────
// Parent Portal — React Query Hooks
// ─────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
  getChildProfile,
  getRegistrationForm,
  saveRegistrationSection,
  submitRegistration,
  getPaymentSummary,
  getPaymentHistory,
  initiatePayment,
  verifyPayment,
  downloadReceipt,
} from "@/services/parent-portal/parent-api";
import type {
  RegistrationSavePayload,
  InitiatePaymentPayload,
} from "@/types/parent-portal";
import {
  GET_PARENT_DATA,
  SEARCH_ENQUIRY,
  SUBMIT_APPLICATION,
  GET_APPLICATION_STAGES,
  GET_APPLICANT_STAGES,
} from "@/constants/urls";

// ── Query Keys ─────────────────────────────────────────────────

export const parentQueryKeys = {
  all: ["parent-portal"] as const,
  child: (id: string) => [...parentQueryKeys.all, "child", id] as const,
  admissionStages: (childId: string) =>
    [...parentQueryKeys.child(childId), "admission-stages"] as const,
  applicantStages: (childId: string) =>
    [...parentQueryKeys.child(childId), "applicant-stages"] as const,
  registration: (childId: string) =>
    [...parentQueryKeys.child(childId), "registration"] as const,
  paymentSummary: (childId: string) =>
    [...parentQueryKeys.child(childId), "payment-summary"] as const,
  paymentHistory: (childId: string, page: number) =>
    [...parentQueryKeys.child(childId), "payment-history", page] as const,
};

// ── Child Profile Hook ────────────────────────────────────────

/** Fetch single child profile. */
export function useChildProfile(childId: string | undefined) {
  return useQuery({
    queryKey: parentQueryKeys.child(childId ?? ""),
    queryFn: () => getChildProfile(childId!),
    enabled: !!childId,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Application Stages Hooks ───────────────────────────────────

/** Fetch admission stages for a child by institute ID. */
export function useAdmissionStages(instituteId: string | undefined) {
  return useQuery({
    queryKey: ["parent-portal", "admission-stages", instituteId],
    queryFn: async () => {
      if (!instituteId) return [];

      const response = await authenticatedAxiosInstance.get(
        GET_APPLICATION_STAGES,
        {
          params: {
            instituteId,
          },
        },
      );

      return response.data;
    },
    enabled: !!instituteId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch applicant stages for a child by applicant ID. */
export function useApplicantStages(applicantId: string | undefined) {
  return useQuery({
    queryKey: ["parent-portal", "applicant-stages", applicantId],
    queryFn: async () => {
      if (!applicantId) return [];

      const response = await authenticatedAxiosInstance.get(
        GET_APPLICANT_STAGES(applicantId),
      );
      return response.data;
    },
    enabled: !!applicantId,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Registration Hooks ─────────────────────────────────────────

/** Fetch registration form. */
export function useRegistrationForm(childId: string | undefined) {
  return useQuery({
    queryKey: parentQueryKeys.registration(childId ?? ""),
    queryFn: () => getRegistrationForm(childId!),
    enabled: !!childId,
    staleTime: 1 * 60 * 1000,
  });
}

/** Save a registration section (draft or final). */
export function useSaveRegistrationSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RegistrationSavePayload) =>
      saveRegistrationSection(payload),
    onSuccess: (_data, variables) => {
      if (variables.is_draft) {
        toast.success("Draft saved");
      } else {
        toast.success("Section saved successfully");
      }
      // Invalidate registration data cache
      queryClient.invalidateQueries({
        queryKey: parentQueryKeys.all,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save form");
    },
  });
}

/** Submit the complete registration. */
export function useSubmitRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (registrationId: string) => submitRegistration(registrationId),
    onSuccess: () => {
      toast.success("Registration submitted successfully!");
      queryClient.invalidateQueries({ queryKey: parentQueryKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit registration");
    },
  });
}

// ── Payment Hooks ──────────────────────────────────────────────

export function usePaymentSummary(childId: string | undefined) {
  return useQuery({
    queryKey: parentQueryKeys.paymentSummary(childId ?? ""),
    queryFn: () => getPaymentSummary(childId!),
    enabled: !!childId,
    staleTime: 2 * 60 * 1000,
  });
}

export function usePaymentHistory(
  childId: string | undefined,
  page: number = 0,
) {
  return useQuery({
    queryKey: parentQueryKeys.paymentHistory(childId ?? "", page),
    queryFn: () => getPaymentHistory(childId!, page),
    enabled: !!childId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useInitiatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: InitiatePaymentPayload) => initiatePayment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parentQueryKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to initiate payment");
    },
  });
}

export function useVerifyPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      paymentSessionId,
      gatewayPaymentId,
    }: {
      paymentSessionId: string;
      gatewayPaymentId: string;
    }) => verifyPayment(paymentSessionId, gatewayPaymentId),
    onSuccess: () => {
      toast.success("Payment verified successfully!");
      queryClient.invalidateQueries({ queryKey: parentQueryKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Payment verification failed");
    },
  });
}

export function useDownloadReceipt() {
  return useMutation({
    mutationFn: (transactionId: string) => downloadReceipt(transactionId),
    onSuccess: () => {
      toast.success("Receipt downloaded successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to download receipt");
    },
  });
}

// ── Application Form Hooks ────────────────────────────────────

/** Query for searching applicant by tracking ID */
export function useSearchApplicant(
  instituteId: string | undefined,
  trackingId: string | undefined,
  searching: boolean = false,
) {
  return useQuery({
    queryKey: ["parent-portal", "search-applicant", instituteId, trackingId],
    queryFn: async () => {
      if (!instituteId || !trackingId) return null;

      const response = await authenticatedAxiosInstance({
        method: "GET",
        url: SEARCH_ENQUIRY,
        params: {
          enquiryTrackingId: trackingId,
        },
      });

      console.log("search:", response.data);

      return response.data;
    },
    enabled: !!instituteId && !!trackingId && searching,
    staleTime: 2 * 60 * 1000,
  });
}

/** Mutation for submitting an application */
export function useSubmitApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await authenticatedAxiosInstance.post(
        SUBMIT_APPLICATION,
        payload,
      );

      return response.data;
    },
    onSuccess: () => {
      toast.success("Application submitted successfully!");
      queryClient.invalidateQueries({
        queryKey: ["parent-portal", "search-applicant"],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit application");
    },
  });
}

// ── Parent Data Hook ──────────────────────────────────────────

export interface ParentPortalResponse {
  parentInfo: {
    id: string;
    username: string;
    email: string;
    full_name: string;
    address_line: string;
    city: string;
    region: string;
    pin_code: string;
    mobile_number: string;
    date_of_birth: string;
    gender: string;
    is_parent: boolean;
    root_user: boolean;
  };
  children: Array<{
    childInfo: {
      id: string;
      username: string;
      email: string;
      full_name: string;
      date_of_birth: string;
      gender: string;
      is_parent: boolean;
    };
    applications: Array<{
      id: string;
      userId: string;
      studentUserId: string;
      sourceType: string;
      sourceId: string;
      enquiryId: string;
      parentName: string;
      parentEmail: string;
      parentMobile: string;
      submittedAt: string;
      applicantId: string;
      conversionStatus: string;
      overallStatus: string;
      destinationPackageSessionId?: string;
    }>;
    enrollments: Array<{
      id: string;
      userId: string;
      email: string;
      fullName: string;
      applyingForClass: string;
      academicYear: string;
    }>;
  }>;
}

/** Fetch parent's children, applications, and enrollments data */
export function useParentData(parentUserId: string | undefined) {
  return useQuery({
    queryKey: ["parent-portal", "parent-data", parentUserId],
    queryFn: async () => {
      if (!parentUserId) {
        throw new Error("Parent user ID is required");
      }

      const response = await authenticatedAxiosInstance.get(
        `${GET_PARENT_DATA}/${parentUserId}`,
      );

      return response.data as ParentPortalResponse;
    },
    enabled: !!parentUserId,
    staleTime: 5 * 60 * 1000,
  });
}
