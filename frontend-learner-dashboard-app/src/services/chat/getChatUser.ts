import { getUserId } from "@/constants/getUserId";
import {
  getAccessToken,
  getTokenDecodedData,
} from "@/lib/auth/sessionUtility";

/**
 * Resolved identity the chat backend needs as query params on every call.
 * The learner app stores identity asynchronously (Capacitor Preferences +
 * JWT), so this is async. The resolved value is cached in module scope so
 * components don't repeatedly hit storage.
 */
export interface ChatUser {
  userId: string;
  instituteId: string;
  userRole: string;
  userName: string;
  token: string;
}

let cachedUser: ChatUser | null = null;
let inFlight: Promise<ChatUser> | null = null;

const safeJsonParse = <T>(raw: string | null | undefined): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

async function resolveChatUser(): Promise<ChatUser> {
  const token = (await getAccessToken()) ?? "";
  const userId = (await getUserId()) ?? "";

  // instituteId + full name live in Capacitor Preferences.
  const { Preferences } = await import("@capacitor/preferences");

  const instituteRaw = (await Preferences.get({ key: "InstituteDetails" }))
    .value;
  const institute = safeJsonParse<{ id?: string }>(instituteRaw);
  const instituteId = institute?.id ?? "";

  const studentRaw = (await Preferences.get({ key: "StudentDetails" })).value;
  const student = safeJsonParse<{ full_name?: string; username?: string }>(
    studentRaw,
  );

  const decoded = getTokenDecodedData(token);
  const userName =
    student?.full_name?.trim() ||
    decoded?.username ||
    student?.username ||
    "Learner";

  // Role from the JWT authorities map, keyed by institute id. Backend
  // normalizes LEARNER -> STUDENT, so either form is acceptable.
  let userRole = "STUDENT";
  const authorityForInstitute = instituteId
    ? decoded?.authorities?.[instituteId]
    : undefined;
  const firstRole = authorityForInstitute?.roles?.[0];
  if (firstRole) {
    userRole = firstRole;
  }

  return { userId, instituteId, userRole, userName, token };
}

/**
 * Returns the cached chat user, resolving it (once) if needed.
 * Concurrent callers share a single in-flight resolution.
 */
export async function getChatUser(): Promise<ChatUser> {
  if (cachedUser) return cachedUser;
  if (inFlight) return inFlight;

  inFlight = resolveChatUser()
    .then((user) => {
      cachedUser = user;
      return user;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Clears the cached identity (e.g. on logout / institute switch). */
export function clearChatUserCache(): void {
  cachedUser = null;
  inFlight = null;
}
