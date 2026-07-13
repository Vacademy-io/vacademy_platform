import { getStudentDisplaySettings } from "@/services/student-display-settings";

export const DEFAULT_POST_LOGIN_ROUTE = "/dashboard";

/**
 * TanStack's `navigate({ to })` only accepts routes it knows about, so every
 * call site in this app already passes `as never`. Accepting `to: never` here
 * lets any `useNavigate()` result be handed to these helpers unchanged.
 */
type PostLoginNavigate = (opts: { to: never; replace?: boolean }) => unknown;

const isAbsoluteUrl = (route: string) => /^https?:\/\//.test(route);

/**
 * `navigate({ to })` drops query strings and cannot leave the origin, so those
 * two shapes need a real page navigation to survive verbatim.
 */
const needsFullPageLoad = (route: string) =>
  isAbsoluteUrl(route) || route.includes("?");

/**
 * The institute's configured landing route (STUDENT_DISPLAY_SETTINGS →
 * postLoginRedirectRoute), applied only at the moment a learner logs in.
 *
 * Priority: explicit deep-link redirect → the caller's own target (e.g. the
 * course a learner logged in from) → institute landing route → /dashboard.
 */
export async function resolvePostLoginRoute(opts?: {
  explicitRedirect?: string | null;
  preferredRoute?: string | null;
}): Promise<string> {
  const explicit = opts?.explicitRedirect?.trim();
  if (explicit && explicit !== "/login/" && explicit !== "/login") {
    return explicit;
  }

  const preferred = opts?.preferredRoute?.trim();
  if (preferred) return preferred;

  try {
    // Force-refresh: the institute was only just resolved, and a cached value
    // can be up to a day stale.
    const settings = await getStudentDisplaySettings(true);
    return (
      settings?.postLoginRedirectRoute?.trim() || DEFAULT_POST_LOGIN_ROUTE
    );
  } catch {
    return DEFAULT_POST_LOGIN_ROUTE;
  }
}

/** Send a just-logged-in learner to wherever they belong. */
export async function navigateAfterLogin(
  navigate: PostLoginNavigate,
  opts?: {
    explicitRedirect?: string | null;
    preferredRoute?: string | null;
    replace?: boolean;
  },
): Promise<void> {
  const route = await resolvePostLoginRoute(opts);

  if (needsFullPageLoad(route)) {
    window.location.assign(route);
    return;
  }

  navigate({ to: route as never, replace: opts?.replace });
}
