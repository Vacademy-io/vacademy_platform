import { AUTHENTICATED_BOOKING_BASE, OPEN_BOOKING_BASE } from "@/constants/urls";
import axios from "axios";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { getBackendErrorMessage } from "@/utils/error-message";
import type { InstituteCustomField } from "@/routes/audience-response/-services/audience-campaign-services";

// ── Types (snake_case — mirrors backend open booking API) ────────────────────

/** A bookable session option offered by the page (name + duration). */
export interface SessionType {
  id?: string;
  name: string;
  duration_minutes: number;
}

export interface BookingPageResponse {
  slug: string;
  title: string;
  description: string | null;
  host_name: string | null;
  duration_minutes: number;
  timezone: string;
  location_type: string | null;
  require_approval: boolean;
  min_notice_minutes: number;
  booking_horizon_days: number;
  /**
   * Campaign custom fields of the linked audience list (same
   * InstituteCustomFieldDTO shape the audience-response form consumes).
   * Empty for standalone pages.
   */
  custom_fields?: InstituteCustomField[];
  /** Optional bookable session options; when present the invitee picks one. */
  session_types?: SessionType[];
}

export interface BookingSlotsResponse {
  slots: string[]; // ISO offset datetimes in the requested tz
  duration_minutes: number;
  timezone: string;
}

export type BookingStatus =
  | "CONFIRMED"
  | "PENDING"
  | "CANCELLED"
  | "COMPLETED"
  | string;

export interface BookingView {
  manage_token: string;
  page_slug: string;
  title: string;
  host_name: string | null;
  invitee_name: string;
  invitee_email: string | null;
  status: BookingStatus;
  meet_link: string | null;
  start_time_utc: string;
  end_time_utc: string;
  invitee_timezone: string;
}

export interface BookRequest {
  /**
   * Required on the public endpoint. Optional on the authenticated one, which fills
   * name, email and phone in from the caller's own account when they're omitted —
   * a signed-in learner has already told us who they are.
   */
  name?: string;
  email?: string;
  phone?: string;
  start_time: string; // ISO offset datetime
  invitee_timezone: string;
  /** Answers to the page's campaign custom fields, keyed by field_key. */
  custom_field_values?: Record<string, string>;
  /** Chosen session-type length (minutes). Omitted = the page's default duration. */
  duration_minutes?: number;
}

// ── API calls (open endpoints — plain axios, no auth interceptor) ────────────

export const getBookingPage = async ({
  instituteId,
  slug,
}: {
  instituteId: string;
  slug: string;
}): Promise<BookingPageResponse> => {
  const response = await axios({
    method: "GET",
    url: `${OPEN_BOOKING_BASE}/page/${instituteId}/${slug}`,
  });
  return response?.data;
};

export const handleGetBookingPage = ({
  instituteId,
  slug,
}: {
  instituteId: string;
  slug: string;
}) => {
  return {
    queryKey: ["GET_BOOKING_PAGE", instituteId, slug],
    queryFn: () => getBookingPage({ instituteId, slug }),
    staleTime: 5 * 60 * 1000,
    enabled: !!instituteId && !!slug,
  };
};

export const getBookingSlots = async ({
  instituteId,
  slug,
  from,
  to,
  tz,
  duration,
}: {
  instituteId: string;
  slug: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  tz: string; // IANA timezone
  duration?: number; // chosen session-type length; omitted = page default
}): Promise<BookingSlotsResponse> => {
  const response = await axios({
    method: "GET",
    url: `${OPEN_BOOKING_BASE}/page/${instituteId}/${slug}/slots`,
    params: { from, to, tz, ...(duration ? { duration } : {}) },
  });
  return response?.data;
};

export const handleGetBookingSlots = ({
  instituteId,
  slug,
  from,
  to,
  tz,
  duration,
}: {
  instituteId: string;
  slug: string;
  from: string;
  to: string;
  tz: string;
  duration?: number;
}) => {
  return {
    queryKey: ["GET_BOOKING_SLOTS", instituteId, slug, from, to, tz, duration ?? null],
    queryFn: () => getBookingSlots({ instituteId, slug, from, to, tz, duration }),
    staleTime: 30 * 1000,
    enabled: !!instituteId && !!slug && !!from && !!to && !!tz,
  };
};

export const bookSlot = async ({
  instituteId,
  slug,
  payload,
  authenticated,
}: {
  instituteId: string;
  slug: string;
  payload: BookRequest;
  // When true, book via the authenticated endpoint so invitee_user_id is tied to
  // the logged-in learner. Only set by flows where the caller is guaranteed to be
  // a member of the institute (e.g. My Mentors) — public links must stay guest.
  authenticated?: boolean;
}): Promise<BookingView> => {
  if (authenticated) {
    const res = await authenticatedAxiosInstance({
      method: "POST",
      url: `${AUTHENTICATED_BOOKING_BASE}/book/${instituteId}/${slug}`,
      data: payload,
    });
    return res?.data;
  }
  const response = await axios({
    method: "POST",
    url: `${OPEN_BOOKING_BASE}/page/${instituteId}/${slug}/book`,
    data: payload,
    headers: { "Content-Type": "application/json" },
  });
  return response?.data;
};

export const getManagedBooking = async (
  token: string
): Promise<BookingView> => {
  const response = await axios({
    method: "GET",
    url: `${OPEN_BOOKING_BASE}/manage/${token}`,
  });
  return response?.data;
};

export const handleGetManagedBooking = (token: string) => {
  return {
    queryKey: ["GET_MANAGED_BOOKING", token],
    queryFn: () => getManagedBooking(token),
    staleTime: 30 * 1000,
    enabled: !!token,
  };
};

export const cancelBooking = async ({
  token,
  reason,
}: {
  token: string;
  reason?: string;
}): Promise<BookingView> => {
  const response = await axios({
    method: "POST",
    url: `${OPEN_BOOKING_BASE}/manage/${token}/cancel`,
    data: reason ? { reason } : {},
    headers: { "Content-Type": "application/json" },
  });
  return response?.data;
};

export const rescheduleBooking = async ({
  token,
  startTime,
  inviteeTimezone,
}: {
  token: string;
  startTime: string;
  inviteeTimezone?: string;
}): Promise<BookingView> => {
  const response = await axios({
    method: "POST",
    url: `${OPEN_BOOKING_BASE}/manage/${token}/reschedule`,
    data: {
      start_time: startTime,
      ...(inviteeTimezone ? { invitee_timezone: inviteeTimezone } : {}),
    },
    headers: { "Content-Type": "application/json" },
  });
  return response?.data;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Surface backend exception messages (e.g. "This slot is no longer
 * available…"). The platform's GlobalExceptionHandler serializes
 * VacademyException as ErrorInfo { ex } (HTTP 510) — getBackendErrorMessage
 * reads `ex` first, then `message`, then the fallback.
 */
export const extractBookingErrorMessage = (
  error: unknown,
  fallback: string
): string => getBackendErrorMessage(error, fallback);

export const getBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};
