// Shared parent/guardian role detection + session hydration for the login forms.
//
// Extracted from the copy-pasted isParent blocks in login-form / UsernamePasswordForm
// / EmailOtpForm. Two responsibilities:
//   1. Classify the token: is this a guardian? a dual-role (STUDENT+PARENT) user?
//   2. Hydrate a minimal session for a PARENT-only user — who has NO student row,
//      so fetchAndStoreStudentDetails would never satisfy isAuthenticated()
//      (token + StudentDetails + InstituteDetails). Mirrors auth-cycle-service's
//      optimistic-hydration shape.

import { Preferences } from "@capacitor/preferences";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";

interface Decodedish {
  user?: string;
  email?: string;
  username?: string;
  full_name?: string;
  authorities?: Record<string, { roles?: string[] }>;
}

/** All role names across every institute in the token, upper-cased. */
export function getRolesFromToken(decoded: Decodedish | null | undefined): string[] {
  const out: string[] = [];
  const authorities = decoded?.authorities;
  if (authorities && typeof authorities === "object") {
    for (const inst of Object.values(authorities)) {
      const roles = inst?.roles;
      if (Array.isArray(roles)) out.push(...roles);
    }
  }
  return out.map((r) => r.toUpperCase());
}

export function isParentToken(decoded: Decodedish | null | undefined): boolean {
  return getRolesFromToken(decoded).includes("PARENT");
}

export function isStudentToken(decoded: Decodedish | null | undefined): boolean {
  return getRolesFromToken(decoded).includes("STUDENT");
}

/**
 * A PARENT who is NOT also a STUDENT — the common guardian. These are the users
 * that must auto-route to the parent portal. Dual-role users (rare — a parent who
 * is themselves enrolled) are deliberately NOT force-routed, so they can still
 * reach their own learner dashboard; they switch to the parent view from the nav.
 */
export function isParentOnly(decoded: Decodedish | null | undefined): boolean {
  return isParentToken(decoded) && !isStudentToken(decoded);
}

/**
 * Write the minimal StudentDetails + InstituteDetails a PARENT-only session needs
 * to satisfy isAuthenticated(). Additive: only ever runs on the parent branch,
 * which already early-returns, so no learner/admin path is touched. Best-effort
 * real-institute fetch follows (a failure can't log the parent out — the minimal
 * blob is already written).
 */
export async function hydrateParentSession(
  userId: string,
  instituteId: string,
  decoded: Decodedish | null | undefined,
): Promise<void> {
  const minimalStudent = {
    id: userId,
    user_id: userId,
    username: decoded?.username ?? "",
    email: decoded?.email ?? "",
    full_name: decoded?.full_name ?? "",
    institute_id: instituteId,
    is_parent: true,
    status: "ACTIVE",
  };
  const minimalInstitute = {
    id: instituteId,
    institute_name: "Loading...",
    institute_theme_code: "#000000", // design-lint-ignore: theme default color
  };

  await Preferences.set({ key: "StudentDetails", value: JSON.stringify(minimalStudent) });
  await Preferences.set({ key: "InstituteDetails", value: JSON.stringify(minimalInstitute) });
  try {
    localStorage.setItem("StudentDetails", JSON.stringify(minimalStudent));
    localStorage.setItem("InstituteDetails", JSON.stringify(minimalInstitute));
  } catch {
    // best-effort mirror
  }

  try {
    await fetchAndStoreInstituteDetails(instituteId, userId);
  } catch {
    // real institute details are a background nicety; the minimal blob already
    // satisfies isAuthenticated(), so this failing must not block the parent.
  }
}
