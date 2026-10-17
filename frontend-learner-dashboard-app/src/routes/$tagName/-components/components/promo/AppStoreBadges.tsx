import React from "react";
import { AppleLogo, GooglePlayLogo } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * "Get it on Google Play" / "Download on the App Store" badges, the app
 * promo's alternative to a single "Get the app" button. Authored as
 * `appLinks: { playStore, appStore }` on the sidebar promo
 * (courseCatalog.filterSidebar.promo) and on the app banner (ctaBanner band
 * with a phone mockup). Only https links count; a store left empty gets no
 * badge, and no link at all keeps the authored button.
 *
 * The badge wording is the stores' own (their badges are English on every
 * site), so it is not run through the site dictionary.
 */

export interface AppStoreLinks {
  playStore: string | null;
  appStore: string | null;
}

const httpsUrl = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

/** The authored store links, or null when neither is a usable https URL. */
export const resolveAppStoreLinks = (raw: unknown): AppStoreLinks | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const links = raw as Record<string, unknown>;
  const playStore = httpsUrl(links.playStore);
  const appStore = httpsUrl(links.appStore);
  return playStore || appStore ? { playStore, appStore } : null;
};

// Store-badge geometry (black pill, logo + two-line label) — no token scale for these.
const BADGE =
  "flex min-w-[168px] items-center gap-3 rounded-[10px] border border-white/25 bg-black px-4 py-2.5 text-start text-white transition hover:border-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"; // design-lint-ignore: store badge 10px radius, black face
const SMALL = "block text-[11px] leading-4"; // design-lint-ignore: store badge caption 11/16
const LARGE = "block text-[18px] font-semibold leading-6"; // design-lint-ignore: store badge name 18/24

const Badge: React.FC<{ href: string; caption: string; name: string; icon: React.ReactNode; className?: string }> = ({
  href,
  caption,
  name,
  icon,
  className,
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={`${caption} ${name}`}
    className={cn(BADGE, className)}
    data-app-store-badge=""
  >
    <span aria-hidden="true" className="shrink-0">
      {icon}
    </span>
    <span aria-hidden="true">
      <span className={SMALL}>{caption}</span>
      <span className={LARGE}>{name}</span>
    </span>
  </a>
);

export const AppStoreBadges: React.FC<{
  links: AppStoreLinks;
  /** Full-width, one under the other (the narrow sidebar card). */
  stacked?: boolean;
  className?: string;
}> = ({ links, stacked = false, className }) => (
  <div className={cn("flex gap-3", stacked ? "w-full flex-col" : "flex-wrap", className)}>
    {links.playStore && (
      <Badge
        href={links.playStore}
        caption="GET IT ON"
        name="Google Play"
        icon={<GooglePlayLogo size={26} weight="fill" />}
        className={stacked ? "w-full" : undefined}
      />
    )}
    {links.appStore && (
      <Badge
        href={links.appStore}
        caption="Download on the"
        name="App Store"
        icon={<AppleLogo size={26} weight="fill" />}
        className={stacked ? "w-full" : undefined}
      />
    )}
  </div>
);
