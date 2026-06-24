import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { getPlatformFlavorInfo } from "@/utils/platform-flavor";
import { getOAuthRedirectOrigin } from "@/lib/auth/nativeOAuth";
import {
  getTokenDecodedData,
  setTokenInStorage,
  setAuthorizationCookie,
} from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { LOGIN_URL_APPLE_NATIVE } from "@/constants/urls";

/**
 * Native "Sign in with Apple" for iOS (Capacitor).
 *
 * Unlike the Google/GitHub flow (a Spring OAuth2 server-side redirect captured
 * by a Universal Link), iOS uses the native ASAuthorization sheet via
 * `@capacitor-community/apple-sign-in`. The sheet returns an identityToken
 * directly to JS, which we POST to the backend; the backend verifies it against
 * Apple's JWKS and returns our own access/refresh tokens. No browser, no
 * deep-link round-trip — so this completes the auth cycle itself, mirroring the
 * `appUrlOpen` handler in `__root.tsx`.
 *
 * The plugin only supports iOS (and a web shim). On Android the Apple option
 * must use the web-redirect flow (P1, backend pending).
 */

/** True only where the native Apple sheet is usable (iOS native). */
export function isAppleNativeAvailable(): boolean {
  return Capacitor.getPlatform() === "ios";
}

/** Thrown when the institute's session limit blocks a new login. */
export class AppleSessionLimitError extends Error {
  constructor(public activeSessions: unknown[]) {
    super("session_limit_exceeded");
    this.name = "AppleSessionLimitError";
  }
}

/** Thrown when the user dismisses the Apple sheet — callers should swallow it. */
export class AppleSignInCancelledError extends Error {
  constructor() {
    super("apple_sign_in_cancelled");
    this.name = "AppleSignInCancelledError";
  }
}

interface AppleAuthorizeResponse {
  response: {
    user?: string;
    email?: string;
    givenName?: string;
    familyName?: string;
    identityToken?: string;
    authorizationCode?: string;
  };
}

function randomNonce(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID().replace(/-/g, "");
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

/** ASAuthorizationError.canceled (1001) — a normal, intentional dismissal. */
function isUserCancellation(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err || "")).toLowerCase();
  return msg.includes("1001") || msg.includes("cancel");
}

/** Resolve the institute to sign into: caller-provided, else the stored one. */
async function resolveInstituteId(provided?: string): Promise<string | undefined> {
  if (provided) return provided;
  try {
    return (await Preferences.get({ key: "InstituteId" })).value || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Runs the full native Apple sign-in and, on success, completes the auth cycle
 * and navigates (dashboard for a single institute, institute-selection for
 * several) — the same end states as the normal login flow.
 *
 * @throws AppleSignInCancelledError when the user dismisses the sheet (swallow it).
 * @throws AppleSessionLimitError when the institute session limit is hit.
 * @throws Error with a user-facing message on any other failure.
 */
export async function loginWithAppleNative(opts: {
  instituteId?: string;
}): Promise<void> {
  const { SignInWithApple } = await import(
    "@capacitor-community/apple-sign-in"
  );

  const instituteId = await resolveInstituteId(opts.instituteId);
  const flavor = await getPlatformFlavorInfo();
  const clientId = flavor.appId || "io.vacademy.student.app";
  const redirectURI = `${await getOAuthRedirectOrigin()}/login/oauth/learner`;
  const nonce = randomNonce();

  let result: AppleAuthorizeResponse;
  try {
    result = (await SignInWithApple.authorize({
      clientId,
      redirectURI,
      scopes: "email name",
      nonce,
    })) as AppleAuthorizeResponse;
  } catch (err) {
    if (isUserCancellation(err)) {
      throw new AppleSignInCancelledError();
    }
    throw err instanceof Error ? err : new Error("Apple sign-in failed");
  }

  const r = result?.response;
  if (!r?.identityToken) {
    throw new Error("Apple sign-in did not return an identity token");
  }

  const res = await fetch(LOGIN_URL_APPLE_NATIVE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identityToken: r.identityToken,
      authorizationCode: r.authorizationCode,
      user: r.user,
      email: r.email,
      givenName: r.givenName,
      familyName: r.familyName,
      nonce,
      instituteId,
      platform: "ios",
    }),
  });

  if (!res.ok) {
    let message = "Apple sign-in failed. Please try again.";
    try {
      const body = await res.json();
      // The backend's GlobalExceptionHandler serialises the message under `ex`.
      if (body?.ex || body?.message) message = body.ex || body.message;
    } catch {
      /* keep default message */
    }
    throw new Error(message);
  }

  const data = await res.json();

  if (data?.session_limit_exceeded) {
    throw new AppleSessionLimitError(data.active_sessions || []);
  }

  const accessToken: string | undefined = data?.accessToken;
  const refreshToken: string | undefined = data?.refreshToken;
  if (!accessToken || !refreshToken) {
    throw new Error("Apple sign-in returned no tokens. Please try again.");
  }

  // Persist tokens up front — both the dashboard and institute-selection need them.
  await setTokenInStorage(TokenKey.accessToken, accessToken);
  await setTokenInStorage(TokenKey.refreshToken, refreshToken);
  setAuthorizationCookie(TokenKey.accessToken, accessToken);
  setAuthorizationCookie(TokenKey.refreshToken, refreshToken);

  const authorities = getTokenDecodedData(accessToken)?.authorities || {};
  const instituteKeys = Object.keys(authorities);

  // Multiple institutes → let the learner choose (mirrors the normal login flow,
  // login-form.tsx / ModularDynamicLoginContainer.tsx).
  if (instituteKeys.length > 1) {
    window.location.replace(
      `${window.location.origin}/institute-selection?redirect=/dashboard/`,
    );
    return;
  }

  // Single institute → complete the full auth cycle and go to the dashboard
  // (same as the native deep-link handler in __root.tsx).
  const targetInstitute =
    instituteId && instituteKeys.includes(instituteId)
      ? instituteId
      : instituteKeys[0] || "";
  const { performFullAuthCycle } = await import(
    "@/services/auth-cycle-service"
  );
  await performFullAuthCycle({ accessToken, refreshToken }, targetInstitute);
  window.location.replace(`${window.location.origin}/dashboard`);
}
