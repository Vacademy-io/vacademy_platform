import axios from "axios";
import { Preferences } from "@capacitor/preferences";
import { GET_SUBDOMAIN_OR_INSTITUTEID } from "@/constants/urls";

/**
 * Resolve instituteId from local storage (Preferences) or subdomain lookup API.
 * Stores the resolved instituteId back to Preferences to avoid future lookups.
 */
export async function resolveInstituteIdFromLocalOrSubdomain(): Promise<string | null> {
  try {
    // 1) Try Preferences first
    const stored = await Preferences.get({ key: "InstituteId" });
    if (stored?.value) {
      return stored.value;
    }

    // 2) Fallback: subdomain lookup using current hostname
    const hostname = window.location.hostname;
    if (!hostname) return null;

    const response = await axios.get(GET_SUBDOMAIN_OR_INSTITUTEID, {
      params: { subdomain: hostname },
    });

    // Try common shapes
    const data = response?.data;
    const resolved =
      data?.instituteId ||
      data?.id ||
      data?.institute_id ||
      (typeof data === "string" ? data : null);

    if (resolved && typeof resolved === "string") {
      await Preferences.set({ key: "InstituteId", value: resolved });
      return resolved;
    }
  } catch (err) {
    // Silently ignore; UI can prompt for institute select if needed
    console.error("resolveInstituteIdFromLocalOrSubdomain failed:", err);
  }
  return null;
}






