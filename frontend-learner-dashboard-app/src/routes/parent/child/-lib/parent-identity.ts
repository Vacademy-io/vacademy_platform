import { getTokenDecodedData } from "@/lib/auth/sessionUtility";

/**
 * The signed-in guardian's display name, from the JWT. Used to greet the parent
 * on the home and in the profile menu. Empty string if unavailable.
 */
export function getParentName(): string {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) return "";
    const decoded = getTokenDecodedData(token) as
      | { fullname?: string; full_name?: string; email?: string }
      | null;
    return decoded?.fullname || decoded?.full_name || decoded?.email || "";
  } catch {
    return "";
  }
}

/** Just the first word of the parent's name, for a friendly "Hi Anil 👋". */
export function getParentFirstName(): string {
  const full = getParentName().trim();
  return full ? full.split(/\s+/)[0] : "";
}
