import { BASE_URL } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";

const DISCLAIMER_BASE = `${BASE_URL}/admin-core-service/live-session/disclaimer/v1`;

/** Ceiling on how long joining a class may be delayed by this check. */
const DISCLAIMER_TIMEOUT_MS = 4000;

export interface LiveClassDisclaimer {
  /**
   * true only when the institute configured a video AND this learner has not
   * been marked present in this particular class yet.
   */
  required: boolean;
  videoUrl?: string;
}

/**
 * The disclaimer a learner watches before joining a class they have not attended.
 *
 * There is no companion "acknowledge" call: attendance is the record. Once the
 * learner is marked present in this class, the disclaimer stops being required
 * for THAT class — the next class asks again.
 *
 * The learner is identified from the JWT server-side, so nothing here can be
 * spoofed by passing a different id.
 *
 * Fails OPEN: any error resolves to "not required". A learner must never be
 * locked out of a class they paid for because this lookup was unavailable.
 */
export const getLiveClassDisclaimer = async (
  instituteId: string,
  /**
   * The class being joined. The answer is per CLASS: required whenever this
   * learner has not been marked present in this particular class yet.
   *
   * Ask BEFORE marking attendance — once that row exists the learner counts as
   * present and the answer is always "not required".
   */
  scheduleId?: string
): Promise<LiveClassDisclaimer> => {
  try {
    const res = await authenticatedAxiosInstance.get(DISCLAIMER_BASE, {
      params: { instituteId, ...(scheduleId ? { scheduleId } : {}) },
      // This call sits IN FRONT of joining a class, and the shared axios instance
      // has no timeout — so without one a hung backend would not fail, it would
      // simply never answer, and the learner could never enter their class. An
      // explicit ceiling turns that into a few seconds' delay and then a normal
      // join. Worst case someone misses a disclaimer; they never miss the class.
      timeout: DISCLAIMER_TIMEOUT_MS,
    });
    return res.data ?? { required: false };
  } catch (error) {
    console.error("Disclaimer lookup failed — allowing the class:", error);
    return { required: false };
  }
};
