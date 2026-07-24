import { Preferences } from "@capacitor/preferences";

/**
 * Single source of truth for the public live-class guest identity on this
 * device. The durable record is per-session (`live-session-registration:<id>`)
 * so one browser can hold registrations for many public sessions at once.
 *
 * The legacy keys are still written alongside it because other pages read
 * them: `live-session-guestId`/`live-session-email` (Capacitor Preferences,
 * read by the guest embed + session-details fetch for paid access) and the
 * `verifiedEmail` list (localStorage, used to prefill the form for other
 * sessions).
 */

/** Guest identity: email (classic) and/or mobile number (phone-identity institutes). */
export interface GuestIdentity {
  email?: string;
  mobileNumber?: string;
}

export interface StoredGuestRegistration extends GuestIdentity {
  registrationId: string;
}

const registrationKey = (sessionId: string) =>
  `live-session-registration:${sessionId}`;

export const getStoredRegistration = (
  sessionId: string
): StoredGuestRegistration | null => {
  try {
    const raw = localStorage.getItem(registrationKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.registrationId && (parsed?.email || parsed?.mobileNumber)) {
      return {
        email: parsed.email || undefined,
        mobileNumber: parsed.mobileNumber || undefined,
        registrationId: parsed.registrationId,
      };
    }
    return null;
  } catch {
    return null;
  }
};

export const storeRegistration = async (
  sessionId: string,
  identity: GuestIdentity,
  registrationId: string
): Promise<void> => {
  try {
    localStorage.setItem(
      registrationKey(sessionId),
      JSON.stringify({
        email: identity.email || undefined,
        mobileNumber: identity.mobileNumber || undefined,
        registrationId,
      })
    );
  } catch {
    // storage full/blocked — the server lookup by identity still recovers state
  }
  try {
    if (identity.email) {
      await Preferences.set({ key: "live-session-email", value: identity.email });
    }
    await Preferences.set({ key: "live-session-guestId", value: registrationId });
  } catch {
    // ignore — legacy mirror only
  }
  if (identity.email) {
    rememberEmail(identity.email);
  }
};

/** Emails this device has used before, newest kept in place (legacy list). */
export const getRememberedEmails = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem("verifiedEmail") || "[]");
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e === "string") : [];
  } catch {
    return [];
  }
};

export const rememberEmail = (email: string): void => {
  try {
    const emails = getRememberedEmails();
    if (!emails.includes(email)) {
      emails.push(email);
      localStorage.setItem("verifiedEmail", JSON.stringify(emails));
    }
  } catch {
    // ignore
  }
};

/** Legacy Preferences email written by older builds — used as a resume hint. */
export const getLegacyStoredEmail = async (): Promise<string | undefined> => {
  try {
    const stored = await Preferences.get({ key: "live-session-email" });
    return stored?.value || undefined;
  } catch {
    return undefined;
  }
};
