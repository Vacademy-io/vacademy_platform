/**
 * Enroll-invite availability, shared across the learner enroll page, the course details
 * page/enroll dialog, and the catalogue grid.
 *
 * The backend computes availability on the server clock from the invite's status +
 * [start_date, end_date] window (see admin_core_service EnrollInviteAvailabilityUtil) and
 * returns it as `availability_status` on the single-invite DTO and `enroll_invite_availability`
 * on catalogue search rows. These helpers just read that value — no client-side date math —
 * so every surface agrees. Enrollment itself is blocked server-side; this only drives display.
 */

export type InviteAvailability = "AVAILABLE" | "EXPIRED" | "NOT_STARTED" | "INACTIVE";

/**
 * Normalises the server value to a known state. Missing/unknown → AVAILABLE, so a course with
 * no default invite (or an older backend that doesn't send the field) is never over-blocked.
 */
export const resolveInviteAvailability = (
  raw: string | null | undefined
): InviteAvailability => {
  switch (raw) {
    case "EXPIRED":
    case "NOT_STARTED":
    case "INACTIVE":
      return raw;
    default:
      return "AVAILABLE";
  }
};

export const isInviteAvailable = (raw: string | null | undefined): boolean =>
  resolveInviteAvailability(raw) === "AVAILABLE";

/**
 * Pulls the admin-authored "unavailable" HTML message out of an invite's `setting_json`
 * string (stored at setting.AVAILABILITY_SETTING.UNAVAILABLE_MESSAGE). Returns "" when absent
 * or unparseable — callers fall back to a neutral line, never a hardcoded canned message.
 */
export const extractUnavailableMessageHtml = (
  settingJson: string | null | undefined
): string => {
  if (!settingJson) return "";
  try {
    const parsed = JSON.parse(settingJson);
    const msg = parsed?.setting?.AVAILABILITY_SETTING?.UNAVAILABLE_MESSAGE;
    return typeof msg === "string" ? msg : "";
  } catch {
    return "";
  }
};
