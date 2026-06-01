import { isAxiosError } from "axios";

/**
 * Extracts a human-readable message from a backend error.
 *
 * Vacademy's GlobalExceptionHandler serializes VacademyException as
 * ErrorInfo { ex }, while some endpoints return { message }. For non-Axios
 * errors (e.g. a client-side TypeError) the provided fallback is returned so
 * callers never surface a raw stack/JS message to users.
 */
export const getBackendErrorMessage = (
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string => {
  if (isAxiosError<{ ex?: string; message?: string }>(error)) {
    return (
      error.response?.data?.ex || error.response?.data?.message || fallback
    );
  }
  return fallback;
};
