import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CatalogEditorialCardConfig } from "../../../-types/catalog-cards-types";
import { useCatalogueLocale, useSiteT } from "../../../-utils/catalogue-locale";
import { formatLaunchDate, openComingSoonForm, readComingSoon } from "../../../-utils/coming-soon";
import { useCourseFormats } from "../../../-utils/course-format";
import { preferredCourseLanguage } from "../../../-utils/course-variants";
import { buildEditorialCardView, resolveCardDesign, type EditorialCardDeps } from "./catalog-card-view";
import { buildCatalogCards, type CatalogRowLike } from "./catalog-cards";
import { normaliseLanguages, resolveCatalogDiscovery, resolveVersionGroups } from "./catalog-config";
import { formatAmountLabel } from "./catalog-format";
import { useCatalogStreams } from "./use-catalog-discovery";
import { EditorialCardSkeleton, EditorialCourseCard } from "./EditorialCourseCard";

/**
 * courseShowcase with cardStyle "editorial" (feature 'cards'): the curated
 * strip drawn with the catalogue's editorial card — Free pill, format pill,
 * stream line, language chips, price and a text CTA. Mounted ONLY for such a
 * showcase, so a default showcase runs none of these hooks.
 *
 * Language versions fold into one card exactly as in the catalogue (same
 * buildCatalogCards) when globalSettings.courseLanguages is on; the limit
 * applies after folding. Streams come from `streamsLibraryId` (the folder
 * library the catalogue uses), formats from globalSettings.courseFormats.
 */

/** A showcase course as CourseShowcaseComponent maps it (raw fields kept for the card). */
export interface EditorialShowcaseCourse {
  id: string;
  title: string;
  description: string;
  thumbnailId: string;
  price: number;
  currency?: string;
  level?: string;
  tagsRaw?: string | null;
  comingSoonRaw?: unknown;
  availability?: string | null;
}

interface ShowcaseRow extends CatalogRowLike {
  thumbnail: string;
  course: EditorialShowcaseCourse;
}

export const SHOWCASE_EDITORIAL_GRID_CLASS = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4";

export interface EditorialShowcaseGridProps {
  /** Every course the showcase's source selected, in order (before the limit). */
  courses: EditorialShowcaseCourse[];
  limit: number;
  loading: boolean;
  card?: CatalogEditorialCardConfig;
  streamsLibraryId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalSettings?: any;
  instituteId?: string;
  onOpen: (course: EditorialShowcaseCourse) => void;
}

export const EditorialShowcaseGrid: React.FC<EditorialShowcaseGridProps> = ({
  courses,
  limit,
  loading,
  card,
  streamsLibraryId,
  globalSettings,
  instituteId,
  onOpen,
}) => {
  const { t } = useTranslation("coursePlayerB");
  const siteT = useSiteT();
  const siteLocale = useCatalogueLocale();
  const design = useMemo(() => resolveCardDesign({ cardStyle: "editorial", card }), [card]);
  const { formats } = useCourseFormats(globalSettings);
  // The catalogue's own stream resolution (folder library → streams), so the stream line matches it.
  const streamsConfig = useMemo(
    () =>
      streamsLibraryId
        ? resolveCatalogDiscovery({ streams: { enabled: true, source: "folderLibrary", libraryId: streamsLibraryId } }, null)
            .streams
        : null,
    [streamsLibraryId],
  );
  const { streams } = useCatalogStreams(instituteId ?? "", streamsConfig);

  const languageSettings = globalSettings?.courseLanguages;
  const grouping = languageSettings?.enabled === true;
  const languages = useMemo(() => normaliseLanguages(languageSettings), [languageSettings]);
  const versionGroups = useMemo(() => resolveVersionGroups(languageSettings?.versionGroups), [languageSettings]);
  const preferredLanguage = grouping ? preferredCourseLanguage(siteLocale.locale, languages) : null;

  const cards = useMemo(() => {
    const rows: ShowcaseRow[] = courses.map((c) => ({
      id: c.id,
      package_id: c.id,
      title: c.title,
      description: c.description,
      price: c.price,
      currency: c.currency,
      level: c.level ?? "",
      level_name: c.level ?? null,
      rating: 0,
      instructor: "",
      comma_separeted_tags: c.tagsRaw ?? null,
      coming_soon: c.comingSoonRaw,
      enroll_invite_availability: c.availability ?? null,
      thumbnail: c.thumbnailId,
      course: c,
    }));
    return buildCatalogCards(rows, { grouping, languages, preferredLanguage, versionGroups }).slice(0, Math.max(1, limit));
  }, [courses, grouping, languages, preferredLanguage, versionGroups, limit]);

  if (!design) return null;

  if (loading) {
    return (
      <div className={SHOWCASE_EDITORIAL_GRID_CLASS}>
        {Array.from({ length: Math.min(Math.max(1, limit), 6) }, (_, i) => (
          <EditorialCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const tt = (key: string, opts?: Record<string, unknown> | string): string => String(t(key, opts as never));
  const deps: EditorialCardDeps = {
    design,
    formats,
    streams,
    languages,
    activeLanguage: preferredLanguage,
    paymentEnabled: globalSettings?.payment?.enabled !== false,
    imageFit: "cover",
    siteT,
    t: tt,
    formatAmount: (amount, currency) => formatAmountLabel(amount, currency, siteLocale.locale),
    formatLaunch: (date) => formatLaunchDate(date, siteLocale.locale) ?? null,
    descriptionPlaceholder: tt("courseCatalog.noDescriptionAvailable"),
  };

  return (
    <div className={SHOWCASE_EDITORIAL_GRID_CLASS}>
      {cards.map((c, index) => {
        const view = buildEditorialCardView(c, deps);
        const course = c.primary.course;
        const comingSoon = readComingSoon(c.primary.coming_soon);
        return (
          <EditorialCourseCard
            key={c.courseId}
            view={view}
            index={index}
            onOpen={() => onOpen(course)}
            onCta={
              comingSoon
                ? () => {
                    if (!openComingSoonForm(comingSoon, tt("comingSoon.notifyTitle", { title: view.title }))) onOpen(course);
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
};

export default EditorialShowcaseGrid;
