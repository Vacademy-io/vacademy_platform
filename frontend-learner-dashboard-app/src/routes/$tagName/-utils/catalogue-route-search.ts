import { retainSearchParams } from "@tanstack/react-router";

/**
 * The URL parameter carrying the visitor's site language — LOCALE_PARAM in
 * catalogue-i18n.ts (a unit test keeps the two equal). Spelled out here so the
 * route files, which ship in the main bundle, do not pull in the catalogue's
 * i18n code.
 */
export const SITE_LANGUAGE_PARAM = "lang";

/** A route search middleware that fits any route, whatever its search schema. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySearchMiddleware = ReturnType<typeof retainSearchParams<any>>;

/**
 * Search middleware for the catalogue routes: a navigation INTO the route that
 * does not set ?lang= itself keeps the one in the current URL (TanStack drops
 * every parameter a navigation does not name). Only catalogue routes use it,
 * so /login and /dashboard never inherit the site language. `lang` is read raw
 * from the URL and is part of no route's validated search — hence the
 * schema-agnostic type.
 *
 * A navigation whose `to` carries its own query string ("/courses?stream=x")
 * must use `href` instead, or the kept parameter lands after a second "?".
 */
export const retainSiteLanguage: AnySearchMiddleware = retainSearchParams<Record<string, unknown>>([
  SITE_LANGUAGE_PARAM,
]);
