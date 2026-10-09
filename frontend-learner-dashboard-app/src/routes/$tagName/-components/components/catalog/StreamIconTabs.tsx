import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useSiteT } from "../../../-utils/catalogue-locale";
import type { StreamTabs } from "./StreamTabs";
import { nextTabIndex, streamTabId, streamTabText, type CatalogStream } from "./catalog-streams";
import { firstGrapheme } from "./stream-icon-tabs-config";

/*
 * Figma "Stream tabs" (Courses page, node 1:101). Exact values that have no
 * token live in these constants (design-lint skips the marked lines).
 */
// Full-bleed white band, 1px border-strong-ish bottom border and a soft drop shadow; 16px above the tabs, 40px to the content.
const BAND = "w-full border-b border-palette-border bg-catalogue-bg-elevated pt-3 mb-6 lg:pt-4 lg:mb-10 shadow-[0px_4px_10px_0px_rgba(26,20,5,0.04)]"; // design-lint-ignore: Figma band shadow
// Equal-width tabs at lg (flex 1 0 0, 4px apart); a scrolling row of min-width tabs below lg. 4px top, 14px bottom, 6px stack gap, 3px underline.
const TAB = "group relative flex flex-none snap-start flex-col items-center gap-1 px-3 pt-1 pb-3 text-center border-b-[3px] min-w-[104px] sm:min-w-[120px] lg:min-w-0 lg:flex-1 lg:basis-0 lg:gap-1.5 lg:px-1 lg:pb-3.5"; // design-lint-ignore: Figma 3px underline + min tab widths
// 56px circle (48px on phones).
const ICON = "relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full lg:size-14";
// The All tab's 2x2 grid glyph: 22px in a 56px circle.
const GLYPH = "size-5 lg:size-[22px]"; // design-lint-ignore: Figma 22px glyph
// Devanagari name: Noto Sans Devanagari Bold 15/22 (the site font stack carries Noto for Devanagari).
const NAME = "max-w-full truncate whitespace-nowrap text-sm font-bold leading-5 transition-colors lg:text-[15px] lg:leading-[22px]"; // design-lint-ignore: Figma 15/22
// English line + count: Lato 11/14 (Medium → 400 inactive, Bold active).
const SUB = "flex max-w-full items-center justify-center whitespace-nowrap text-2xs lg:leading-[14px]"; // design-lint-ignore: Figma 11/14

/** Tab props the catalog passes to <StreamTabs> (feature 'tabs' adds the rest). */
type BaseProps = React.ComponentProps<typeof StreamTabs>;

export interface StreamIconTabsProps extends BaseProps {
  /** Catalogue totals per stream (countCardsByStream over every card) or null = no counts. */
  counts?: { total: number; bySlug: Map<string, number> } | null;
  /** Second line of the All tab ('' = none). */
  allSubtitle?: string;
  /** Class + style of the content container inside the band (the catalog's own content column). */
  shellClassName?: string;
  shellStyle?: React.CSSProperties;
  /** Lower-case singular / plural course term for the screen-reader count ("3 courses"). */
  courseTerm?: string;
  coursesTerm?: string;
}

/** The All tab's 2x2 grid of rounded squares (Figma 22px frame). */
const GridGlyph: React.FC = () => (
  <svg viewBox="0 0 22 22" fill="currentColor" aria-hidden="true" focusable="false" className={GLYPH}>
    <rect x="2" y="2" width="7.5" height="7.5" rx="2" />
    <rect x="12.5" y="2" width="7.5" height="7.5" rx="2" />
    <rect x="2" y="12.5" width="7.5" height="7.5" rx="2" />
    <rect x="12.5" y="12.5" width="7.5" height="7.5" rx="2" />
  </svg>
);

/**
 * The opt-in "icons" stream tabs (courseCatalog.streams.variant "icons"): a
 * full-width white band whose tabs show the stream's round image, its name
 * (Devanagari on Brahm Varchas) and "English name · count", with a saffron
 * underline under the active tab. Same ARIA tabs behaviour as <StreamTabs>:
 * only the selected tab is in the Tab order, arrows / Home / End move focus,
 * Enter / Space / click select. Colours come from the site palette (each falls
 * back to a catalogue token on a site without one).
 */
export const StreamIconTabs: React.FC<StreamIconTabsProps> = ({
  streams,
  active,
  allLabel,
  labelMode,
  sticky,
  onSelect,
  controlsId,
  counts = null,
  allSubtitle = "",
  shellClassName = "w-full px-4 sm:px-6 lg:px-8",
  shellStyle,
  courseTerm = "course",
  coursesTerm = "courses",
}) => {
  const { t } = useTranslation("coursePlayerB");
  const siteT = useSiteT();
  const listRef = useRef<HTMLDivElement | null>(null);
  const firstRun = useRef(true);

  // Keep the selected tab in view on a scrolling (phone / tablet) row. Scrolls
  // the row only — never the page — so a tab switch cannot jump vertically.
  useEffect(() => {
    const list = listRef.current;
    const instant = firstRun.current;
    firstRun.current = false;
    if (!list || list.scrollWidth <= list.clientWidth || typeof list.scrollBy !== "function") return;
    const tab = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!tab) return;
    const listBox = list.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    const delta = tabBox.left + tabBox.width / 2 - (listBox.left + listBox.width / 2);
    if (Math.abs(delta) < 1) return;
    list.scrollBy({ left: delta, behavior: instant ? "auto" : "smooth" });
  }, [active, streams.length]);

  if (!streams.length) return null;

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const list = listRef.current;
    if (!list) return;
    const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const rtl = getComputedStyle(list).direction === "rtl";
    const next = nextTabIndex(e.key, tabs.indexOf(e.currentTarget), tabs.length, rtl);
    if (next === null) return;
    e.preventDefault();
    tabs[next]?.focus();
  };

  const tab = (opts: {
    key: string;
    slug: string | null;
    primary: string;
    secondary: string;
    icon: React.ReactNode;
    count: number | null;
    comingSoon: boolean;
  }) => {
    const { key, slug, primary, secondary, icon, count, comingSoon } = opts;
    const selected = active === slug;
    const soon = comingSoon && !count;
    const showCount = count !== null && !soon;
    return (
      <button
        key={key}
        id={controlsId ? streamTabId(controlsId, slug) : undefined}
        type="button"
        role="tab"
        aria-selected={selected}
        aria-controls={controlsId}
        tabIndex={selected ? 0 : -1}
        onClick={() => onSelect(slug)}
        onKeyDown={onKeyDown}
        className={cn(
          TAB,
          "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400",
          selected ? "border-palette-accent" : "border-transparent",
        )}
      >
        {icon}
        <span
          className={cn(
            NAME,
            selected ? "text-palette-primary" : "text-palette-text group-hover:text-palette-primary",
          )}
        >
          {primary}
        </span>
        {(secondary || showCount || soon) && (
          <span className={cn(SUB, selected ? "font-bold text-palette-gold" : "font-normal text-palette-muted")}>
            {secondary && <span className="min-w-0 truncate">{secondary}</span>}
            {showCount && (
              <>
                {secondary && (
                  <span aria-hidden="true" className="mx-1.5">
                    ·
                  </span>
                )}
                <span aria-hidden="true">{count}</span>
                <span className="sr-only">
                  {t("catalogTabs.countA11y", {
                    count: count as number,
                    course: courseTerm,
                    courses: coursesTerm,
                    defaultValue: `${count} ${count === 1 ? courseTerm : coursesTerm}`,
                  })}
                </span>
              </>
            )}
            {soon && (
              <span className="ms-1.5 rounded-catalogue-full bg-palette-sand px-1.5 py-px text-3xs font-semibold uppercase tracking-wide text-palette-primary">
                {t("courseCatalog.streamSoon", "Soon")}
              </span>
            )}
          </span>
        )}
      </button>
    );
  };

  const streamIcon = (s: CatalogStream, name: string) => {
    const imageUrl = s.imageUrl ?? null;
    if (imageUrl) {
      return (
        <span className={ICON}>
          <img src={imageUrl} alt="" width={56} height={56} decoding="async" className="size-full object-cover" />
        </span>
      );
    }
    const accent = s.accentColor ?? null;
    return (
      <span
        aria-hidden="true"
        className={cn(ICON, "text-lg font-bold", accent ? "text-white" : "bg-palette-sand text-palette-primary")}
        style={accent ? { backgroundColor: accent } : undefined}
      >
        {firstGrapheme(name)}
      </span>
    );
  };

  return (
    <div className={cn(BAND, sticky && "sticky top-16 z-20 md:top-20")}>
      <div className={shellClassName} style={shellStyle}>
        <div
          ref={listRef}
          role="tablist"
          aria-orientation="horizontal"
          aria-label={t("courseCatalog.streamsAriaLabel", "Streams")}
          className="catalogue-no-scrollbar flex snap-x gap-1 overflow-x-auto"
        >
          {tab({
            key: "__all__",
            slug: null,
            primary: allLabel || t("courseCatalog.allCourses", "All courses"),
            secondary: allSubtitle,
            icon: (
              <span className={cn(ICON, "bg-palette-primary text-palette-sand")}>
                <GridGlyph />
              </span>
            ),
            count: counts ? counts.total : null,
            comingSoon: false,
          })}
          {streams.map((s) => {
            const text = streamTabText({ title: siteT(s.title), subtitle: siteT(s.subtitle), slug: s.slug }, labelMode);
            return tab({
              key: s.id,
              slug: s.slug,
              primary: text.primary,
              secondary: text.secondary,
              icon: streamIcon(s, text.primary),
              count: counts ? counts.bySlug.get(s.slug) ?? 0 : null,
              comingSoon: s.comingSoon,
            });
          })}
        </div>
      </div>
    </div>
  );
};
