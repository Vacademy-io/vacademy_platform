import { isAxiosError } from "axios";

export const getUnsubscribeErrorMessage = (error: unknown) => {
  if (!error) {
    return "We couldn't update your preferences just yet. Please try again.";
  }

  if (
    isAxiosError<{ message?: string }>(error) &&
    (error.response?.data?.message || error.message)
  ) {
    return error.response?.data?.message ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "We couldn't update your preferences just yet. Please try again.";
};

