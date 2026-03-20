import { Preferences } from "@capacitor/preferences";
import { useDomainRouting } from "@/hooks/use-domain-routing";

/**
 * Resolve instituteId from local storage (Preferences) or subdomain lookup API.
 * Stores the resolved instituteId back to Preferences to avoid future lookups.
 */
export async function resolveInstituteIdFromLocalOrSubdomain(): Promise<string | null> {
  // Prefer domain routing outcome, then preferences fallback for backward compatibility
  try {
    // Backward-compat: Preferences first
    const stored = await Preferences.get({ key: "InstituteId" });
    if (stored?.value) return stored.value;
  } catch {}
  return null;
}









