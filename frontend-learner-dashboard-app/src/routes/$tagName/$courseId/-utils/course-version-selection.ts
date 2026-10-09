import { languageOfLevel, type CourseLanguageOption } from "../../-utils/course-variants";
import type { SiteCartItem } from "../../-utils/site-cart";
import {
  invitePaymentEntryFor,
  type CourseLevel,
  type OpenEnrollInvite,
} from "../../-services/course-levels-service";

/**
 * Which version (language/level) of a course the course page shows, and what
 * changes when the visitor picks another one. Pure — the page wires it up in
 * -hooks/use-course-versions.ts.
 */

/**
 * Window event that opens the site cart drawer (the cart stream's
 * SiteCartButton listens). `detail.intent` is "view" or "checkout".
 */
export const SITE_CART_OPEN_EVENT = "siteCartOpen";

export interface SiteCartOpenDetail {
  intent: "view" | "checkout";
  /** The version just added, for a drawer that wants to highlight it. */
  packageSessionId?: string;
  source: "course";
}

const languageCodeOf = (version: Pick<CourseLevel, "levelName">, languages: CourseLanguageOption[]) =>
  languageOfLevel(version.levelName, languages)?.code ?? null;

/**
 * Versions in picker order: the site's language order first (English before
 * Hindi by default), versions whose language is unknown last, and the source
 * order (catalogue / product page order) within each group.
 */
export const orderVersions = (versions: CourseLevel[], languages: CourseLanguageOption[]): CourseLevel[] => {
  if (!languages.length) return versions;
  const rank = (v: CourseLevel) => {
    const code = languageCodeOf(v, languages);
    const i = code ? languages.findIndex((l) => l.code === code) : -1;
    return i < 0 ? languages.length : i;
  };
  return versions
    .map((v, index) => ({ v, index, r: rank(v) }))
    .sort((a, b) => a.r - b.r || a.index - b.index)
    .map(({ v }) => v);
};

/** One segment of the Language picker. */
export interface LanguageVersionOption {
  code: string;
  label: string;
  chip?: string;
  /** The version this segment selects. */
  packageSessionId: string;
  /** No invite: the version cannot be enrolled in, so it cannot be picked. */
  disabled: boolean;
}

/**
 * One option per language the course is offered in, in the site's order.
 * When a language has several versions (two sessions), the selected one
 * represents it, else its first version with an invite, else its first.
 */
export const languageOptionsFor = (
  versions: CourseLevel[],
  languages: CourseLanguageOption[],
  selectedPackageSessionId: string | null | undefined,
): LanguageVersionOption[] => {
  const options: LanguageVersionOption[] = [];
  for (const lang of languages) {
    const ofLanguage = versions.filter((v) => languageCodeOf(v, languages) === lang.code);
    if (!ofLanguage.length) continue;
    const rep =
      ofLanguage.find((v) => v.packageSessionId === selectedPackageSessionId) ??
      ofLanguage.find((v) => !!v.enrollInviteId) ??
      ofLanguage[0];
    options.push({
      code: lang.code,
      label: lang.label,
      chip: lang.chip,
      packageSessionId: rep.packageSessionId,
      disabled: !rep.enrollInviteId,
    });
  }
  return options;
};

export interface VersionSelectionInput {
  /** ?packageSessionId */
  urlPackageSessionId?: string | null;
  /** ?enrollInviteId */
  urlEnrollInviteId?: string | null;
  /** Package sessions the URL's invite sells (a non-default invite is not on any version). */
  urlInvitePackageSessionIds?: string[] | null;
  /** The visitor's course language, from the site locale (preferredCourseLanguage). */
  preferredLanguage?: string | null;
  languages: CourseLanguageOption[];
}

const preferLanguage = (candidates: CourseLevel[], input: VersionSelectionInput): CourseLevel | undefined =>
  (input.preferredLanguage
    ? candidates.find((v) => languageCodeOf(v, input.languages) === input.preferredLanguage)
    : undefined) ?? candidates[0];

/**
 * The version the URL names: ?packageSessionId, else the version(s) sold by
 * ?enrollInviteId (the visitor's language first when one invite sells several).
 */
export const urlDesignatedVersion = (
  versions: CourseLevel[],
  input: VersionSelectionInput,
): CourseLevel | null => {
  if (input.urlPackageSessionId) {
    const byPs = versions.find((v) => v.packageSessionId === input.urlPackageSessionId);
    if (byPs) return byPs;
  }
  if (input.urlEnrollInviteId) {
    const sold = new Set(input.urlInvitePackageSessionIds ?? []);
    const candidates = versions.filter(
      (v) => v.enrollInviteId === input.urlEnrollInviteId || sold.has(v.packageSessionId),
    );
    const byInvite = preferLanguage(candidates, input);
    if (byInvite) return byInvite;
  }
  return null;
};

/**
 * The version to show first: what the URL names, else the visitor's language
 * (a version that can be enrolled in), else the first version with an invite,
 * else the first version. Null only when there are no versions.
 */
export const pickInitialVersion = (versions: CourseLevel[], input: VersionSelectionInput): CourseLevel | null => {
  if (!versions.length) return null;
  const fromUrl = urlDesignatedVersion(versions, input);
  if (fromUrl) return fromUrl;
  const enrollable = versions.filter((v) => !!v.enrollInviteId);
  if (input.preferredLanguage) {
    const preferred = enrollable.find((v) => languageCodeOf(v, input.languages) === input.preferredLanguage);
    if (preferred) return preferred;
  }
  return enrollable[0] ?? versions[0];
};

/**
 * The invite a version is enrolled through. The version the URL names keeps
 * the URL's invite (a shared link or a product page may carry a non-default
 * invite); every other version uses its own.
 */
export const effectiveInviteIdFor = (
  version: CourseLevel,
  urlEnrollInviteId: string | null | undefined,
  urlVersion: CourseLevel | null | undefined,
): string | null =>
  urlEnrollInviteId && urlVersion && urlVersion.packageSessionId === version.packageSessionId
    ? urlEnrollInviteId
    : version.enrollInviteId;

/** What the overview card shows for a version. */
export interface VersionOffer {
  price: number;
  elevatedPrice?: number;
  currency?: string;
  availability?: string;
  /** The invite's setting_json (carries the admin's "enrolment closed" message). */
  settingJson?: string;
}

/**
 * Price and availability of a version. A product page version keeps that
 * page's own plan. A catalogue version takes the plan of its invite entry for
 * THIS package session (the rule the page has always applied to the invite it
 * fetched, minus the entry-[0] bug), and the search row's price until the
 * invite has loaded.
 */
export const resolveVersionOffer = (
  version: CourseLevel,
  invite: OpenEnrollInvite | null | undefined,
): VersionOffer => {
  let price = version.price ?? 0;
  let elevatedPrice = version.elevatedPrice ?? undefined;
  let currency = version.currency ?? undefined;
  if (version.source === "catalogue" && invite) {
    const plan = invitePaymentEntryFor(invite, version.packageSessionId)?.payment_option?.payment_plans?.[0];
    if (plan) {
      if (typeof plan.actual_price === "number") price = plan.actual_price;
      if (typeof plan.elevated_price === "number") elevatedPrice = plan.elevated_price;
      if (plan.currency) currency = plan.currency;
    }
  }
  return {
    price,
    elevatedPrice,
    currency,
    availability: invite?.availability_status ?? version.availability ?? undefined,
    settingJson: invite?.setting_json ?? undefined,
  };
};

/**
 * Query-string updates for a picked version (applied with replace). ?price and
 * ?available_slots described the version the link was built for, so they go.
 */
export const versionSearchUpdates = (version: CourseLevel): Record<string, string | null> => ({
  packageSessionId: version.packageSessionId,
  enrollInviteId: version.enrollInviteId,
  level: version.levelName,
  price: null,
  available_slots: null,
});

const isPlaceholderImage = (src: string | null | undefined) =>
  !src || src === "null" || src.startsWith("/api/placeholder/");

/** The site-cart line for the version on screen. Title and level stay in the base language. */
export const buildCourseCartItem = (input: {
  courseId: string;
  title: string;
  packageSessionId: string;
  levelName?: string | null;
  languages: CourseLanguageOption[];
  price?: number;
  elevatedPrice?: number;
  currency?: string;
  image?: string | null;
  enrollInviteId?: string | null;
}): SiteCartItem => ({
  packageSessionId: input.packageSessionId,
  courseId: input.courseId,
  title: input.title,
  levelName: input.levelName || undefined,
  languageCode: languageOfLevel(input.levelName, input.languages)?.code,
  price: input.price,
  elevatedPrice: input.elevatedPrice,
  currency: input.currency,
  image: isPlaceholderImage(input.image) ? undefined : (input.image as string),
  enrollInviteId: input.enrollInviteId || undefined,
  source: { kind: "course" },
});

/** Live course fields shown as text (hero, HTML page tokens, overview). */
const DISPLAY_TEXT_FIELDS = [
  "title",
  "description",
  "fullDescription",
  "level",
  "instructor",
  "aboutCourse",
  "whyLearn",
  "whoShouldLearn",
  "about_the_course_html",
  "course_html_description_html",
] as const;

/**
 * A display copy of the course with its live text through the site
 * dictionary (useSiteT). Returns the SAME object when nothing is translated,
 * so a single-language site passes exactly the data it always did. Never use
 * the copy for submission (payment descriptions, cart lines).
 */
export const localizeCourseDisplay = <T extends object>(course: T, translate: (text: string) => string): T => {
  const source = course as Record<string, unknown>;
  const out: Record<string, unknown> = { ...source };
  let changed = false;
  for (const key of DISPLAY_TEXT_FIELDS) {
    const value = source[key];
    if (typeof value !== "string" || !value) continue;
    const next = translate(value);
    if (next !== value) {
      out[key] = next;
      changed = true;
    }
  }
  if (Array.isArray(source.tags)) {
    const tags = source.tags as unknown[];
    const next = tags.map((tag) => (typeof tag === "string" ? translate(tag) : tag));
    if (next.some((tag, i) => tag !== tags[i])) {
      out.tags = next;
      changed = true;
    }
  }
  return changed ? (out as T) : course;
};
