import { SidebarItemsType } from "../../../../types/layout-container-types";
import {
  House,
  BookOpen,
  Scroll,
  SignOut,
  NotePencil,
  Users,
  AddressBook,
  Files,
  Password,
  UserCircle,
  UserCircleMinus,
  ClipboardText,
} from "@phosphor-icons/react";
import i18next from "i18next";
import {
  ContentTerms,
  NAMING_SETTINGS_KEY,
  SystemTerms,
  type LocalizedNamingSettings,
} from "@/types/naming-settings";
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  type SupportedLocale,
} from "@/i18n/locales";
import { getLanguageSetting } from "@/services/language-settings";

const getNamingSettings = (): LocalizedNamingSettings[] => {
  try {
    const saved = localStorage.getItem(NAMING_SETTINGS_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to parse naming settings from localStorage:", error);
    return [];
  }
};

/* -------------------------------------------------------------------------- *
 * Locale-aware terminology resolution — mirrors the admin app's
 * components/common/layout-container/sidebar/utils.ts; keep the two in sync.
 *
 * Institutes rename terms ("Course" → "Programme") AND the UI can render in a
 * language other than the one those renames were typed in. resolveLocalizedTerm
 * covers steps (a)-(c) of the chain; it returns null when the caller must apply
 * step (d) — its own pre-existing fallback, byte-for-byte:
 *
 *   (a) term.locales[lng]                    → the institute's word for THIS locale
 *   (b) lng === content source locale        → null (flat customValue path = today)
 *   (c) i18n.t('terms:<key>')                → translated SYSTEM default
 *   (d) null                                 → caller's existing fallback
 *
 * ENGLISH IS UNTOUCHED: with no `locales` map and no LANGUAGE_SETTING, the
 * source locale defaults to 'en', so an 'en' UI always exits at (b) with null
 * and every caller behaves exactly as it did before this file changed. The
 * terms catalog is not even fetched.
 * -------------------------------------------------------------------------- */

const TERMS_NAMESPACE = "terms";

/**
 * Active UI locale. Read off the i18next singleton rather than importing
 * "@/i18n" so this module never triggers i18n init and no import cycle is
 * possible.
 */
const getActiveLocale = (): SupportedLocale =>
  normalizeLocale(i18next.resolvedLanguage ?? i18next.language);

/** Language the institute's flat customValue/customPluralValue are written in. */
const getContentSourceLocale = (): SupportedLocale => {
  try {
    return normalizeLocale(
      getLanguageSetting()?.content_source_locale ?? DEFAULT_LOCALE
    );
  } catch {
    return DEFAULT_LOCALE;
  }
};

// Locales whose terms catalog has been requested — the namespace is fetched
// lazily and only for locales that can actually reach step (c), so an
// English-only institute never pays for it.
const requestedTermsLocales = new Set<string>();

const ensureTermsCatalog = (locale: string): void => {
  if (requestedTermsLocales.has(locale) || !i18next.isInitialized) return;
  requestedTermsLocales.add(locale);
  void i18next
    .loadNamespaces(TERMS_NAMESPACE)
    // The catalog lands after the first paint; tell consumers to re-read.
    .then(() => notifyNamingSettingsUpdated())
    .catch(() => {
      // Missing/failed catalog is non-fatal — resolution falls to step (d).
      requestedTermsLocales.delete(locale);
    });
};

/** Translated system default for a term, or null when the catalog lacks it. */
const translateTerm = (key: string, suffix?: string): string | null => {
  if (!i18next.isInitialized) return null;
  const fullKey = suffix ? `${key}_${suffix}` : key;
  if (!i18next.exists(fullKey, { ns: TERMS_NAMESPACE })) return null;
  const value = i18next.t(fullKey, { ns: TERMS_NAMESPACE, defaultValue: "" });
  return typeof value === "string" && value.length > 0 ? value : null;
};

/**
 * Steps (a)-(c) above. `null` means "use your own fallback" (step (d)).
 *
 * Plural reads the `_other` suffix: it is the bare plural LABEL in every
 * catalog (en "Courses", ar broken plural "دورات"), not a count-driven form.
 */
export const resolveLocalizedTerm = (
  setting: LocalizedNamingSettings | undefined,
  key: string,
  form: "singular" | "plural"
): string | null => {
  const locale = getActiveLocale();

  // (a) Institute's own word for the active locale. `locales` is optional —
  // blobs cached before this field existed simply have nothing here.
  const override = setting?.locales?.[locale];
  const overrideValue =
    form === "plural" ? override?.customPluralValue : override?.customValue;
  if (overrideValue) return overrideValue;

  // (b) The flat fields already hold the right language — caller's path wins.
  if (locale === getContentSourceLocale()) return null;

  // (c) Translated system default.
  ensureTermsCatalog(locale);
  return translateTerm(key, form === "plural" ? "other" : undefined);
};

/* --- Reactivity ----------------------------------------------------------- *
 * Same window-event contract as the admin app's useNamingSettingsVersion hook.
 * Terminology is locale-aware, so a language switch changes the same labels a
 * rename does; consumers listening for this event re-read on both.
 * -------------------------------------------------------------------------- */

export const NAMING_SETTINGS_UPDATED_EVENT = "naming-settings-updated";

export const notifyNamingSettingsUpdated = (): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NAMING_SETTINGS_UPDATED_EVENT));
};

i18next.on("languageChanged", () => {
  notifyNamingSettingsUpdated();
});

// Utility function to get custom terminology with fallback to default
export const getTerminology = (key: string, defaultValue: string): string => {
  const settings = getNamingSettings();
  const setting = settings.find((item) => item.key === key);

  // Steps (a)-(c); null → step (d), the original line below, unchanged.
  const localized = resolveLocalizedTerm(setting, key, "singular");
  if (localized) return localized;

  return setting?.customValue || defaultValue;
};

// Utility function to get pluralized terminology.
// Handles two storage formats:
//  1. Raw backend format (learner): separate { key: "X_plural", customValue } entry
//  2. Admin merged format: single entry with customPluralValue field
// Falls back to naive pluralization of the singular custom value / default.
export const getTerminologyPlural = (
  key: string,
  defaultValue: string
): string => {
  const settings = getNamingSettings();

  // Steps (a)-(c); null → step (d), the original body below, unchanged.
  // Only the `key` entry carries per-locale overrides (the merged shape the
  // backend writes); a format-1 `<key>_plural` entry is source-language only.
  // naivePluralize is English-only, so reaching it for a non-English locale
  // would mangle the word — that is exactly what step (c) prevents.
  const localized = resolveLocalizedTerm(
    settings.find((item) => item.key === key),
    key,
    "plural"
  );
  if (localized) return localized;

  // Format 1: explicit _plural entry from backend
  const pluralEntry = settings.find((item) => item.key === `${key}_plural`);
  if (pluralEntry?.customValue) {
    return pluralEntry.customValue;
  }

  const setting = settings.find((item) => item.key === key);

  // Format 2: merged entry with customPluralValue field
  if (setting?.customPluralValue) {
    return setting.customPluralValue;
  }

  // Fallback: naive pluralize the singular value
  const singular = setting?.customValue || defaultValue;
  return naivePluralize(singular);
};

const naivePluralize = (word: string): string => {
  if (
    word.endsWith("s") ||
    word.endsWith("x") ||
    word.endsWith("z") ||
    word.endsWith("ch") ||
    word.endsWith("sh")
  ) {
    return `${word}es`;
  }
  if (
    word.endsWith("y") &&
    !["a", "e", "i", "o", "u"].includes(
      word.charAt(word.length - 2).toLowerCase()
    )
  ) {
    return `${word.slice(0, -1)}ies`;
  }
  return `${word}s`;
};

export const SidebarItemsData: SidebarItemsType[] = [
  {
    icon: House,
    id: "dashboard",
    title: "Dashboard",
    to: "/dashboard",
  },
  {
    icon: BookOpen,
    id: "learning-center",
    title: "Learning Center",
    subItems: [
      {
        subItem: "Study Library",
        subItemLink: "/study-library",
      },
      {
        subItem: "Attendance",
        subItemLink: "/learning-centre/attendance",
      },
      {
        subItem: getTerminologyPlural(
          ContentTerms.LiveSession,
          SystemTerms.LiveSession
        ),
        subItemLink: "/study-library/live-class",
      },
    ],
  },
  {
    icon: NotePencil,
    id: "homework",
    title: "Homework",
    subItems: [
      {
        subItem: "Homework List",
        subItemLink: "/homework/list",
      },
      {
        subItem: "Reports",
        subItemLink: "/homework/reports",
      },
    ],
  },
  {
    icon: Users,
    id: "sub-org-learners",
    title: "Sub-Org Learners",
    to: "/sub-org-learners",
  },
  {
    icon: Scroll,
    id: "assessment-centre",
    title: "Assessment Centre",
    subItems: [
      {
        subItem: "Assessment List",
        subItemLink: "/assessment/examination",
      },
      // {
      //     subItem: "Mock Test",
      //     subItemLink: "/assessment/mock-test",
      // },
      // {
      //     subItem: "Practice Test",
      //     subItemLink: "/assessment/practice-test",
      // },
      // {
      //     subItem: "Survey",
      //     subItemLink: "/assessment/survey",
      // },
      {
        subItem: "Reports",
        subItemLink: "/assessment/reports",
      },
    ],
  },
];
export const HamBurgerSidebarItemsData: SidebarItemsType[] = [
  //TODO : add other options when api and ui is available
  {
    icon: UserCircle,
    id: "view-profile",
    title: "View Profile Details",
    to: "/user-profile",
  },
  {
    icon: Files,
    id: "my-files",
    title: "My Files",
    to: "/my-files",
  },
  { icon: AddressBook, id: "my-reports", title: "My Reports", to: "/my-reports" },
  { icon: ClipboardText, id: "onboarding", title: "Onboarding", to: "/profile/onboarding" },
  // {
  //   icon: CreditCard,
  //   title: "Membership Details",
  //   to: "/membership-details",
  // },
  {
    icon: Password,
    id: "change-password",
    title: "Change Password",
    to: "/change-password",
  },
  // {
  //   icon: Headset,
  //   title: "Contact Support",
  //   to: "/support",
  // },
  {
    icon: SignOut,
    id: "logout",
    title: "Log Out",
    to: "/logout",
  },
  {
    icon: UserCircleMinus,
    id: "delete-account",
    title: "Delete Account",
    to: "/delete-user",
  },
];

// New function to filter menu items based on permissions
export async function filterHamburgerMenuItemsWithPermissions(
  HamBurgerSidebarItemsData: SidebarItemsType[],
  permissions: {
    canViewProfile: boolean;
    canEditProfile: boolean;
    canDeleteProfile: boolean;
    canViewFiles: boolean;
    canViewReports: boolean;
  }
) {
  // Filter based on permissions. Compare on stable `id`s, never on `title`
  // (display text — translated / institute-renamed).
  if (!permissions.canViewProfile) {
    HamBurgerSidebarItemsData = HamBurgerSidebarItemsData.filter(
      (item) => item.id !== "view-profile"
    );
  }

  if (!permissions.canViewFiles) {
    HamBurgerSidebarItemsData = HamBurgerSidebarItemsData.filter(
      (item) => item.id !== "my-files"
    );
  }

  if (!permissions.canViewReports) {
    HamBurgerSidebarItemsData = HamBurgerSidebarItemsData.filter(
      (item) => item.id !== "my-reports"
    );
  }

  if (!permissions.canEditProfile) {
    HamBurgerSidebarItemsData = HamBurgerSidebarItemsData.filter(
      (item) => item.id !== "change-password"
    );
  }

  if (!permissions.canDeleteProfile) {
    HamBurgerSidebarItemsData = HamBurgerSidebarItemsData.filter(
      (item) => item.id !== "delete-account"
    );
  }

  return HamBurgerSidebarItemsData;
}
