import React from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { translateText } from "../-utils/catalogue-i18n";
import { useCatalogueLocale } from "../-utils/catalogue-locale";
import { computeCatalogueSeo, pageSeoOf } from "../-utils/catalogue-seo";

/**
 * The institute's own tab title (white-label branding), from the same
 * localStorage mirror the boot script in index.html applies before React
 * starts. Read from storage — never from document.title, which this
 * component itself writes.
 */
const readBrandTabText = (): string | null => {
  try {
    const raw = localStorage.getItem("TabBranding");
    const parsed = raw ? (JSON.parse(raw) as { tabText?: unknown }) : null;
    return typeof parsed?.tabText === "string" && parsed.tabText.trim() ? parsed.tabText.trim() : null;
  } catch {
    return null;
  }
};

interface CatalogueSeoHeadProps {
  /** The catalogue page on screen (its `seo` block, when the editor set one). */
  page?: unknown;
  instituteName?: string | null;
  /** The institute's words for course / courses (terminology). */
  course: string;
  courses: string;
}

/**
 * <title>, description and og:* for a catalogue page, in the visitor's site
 * language. Rendered inside CatalogueLocaleProvider, so both the chrome
 * fallbacks (react-i18next) and the authored page SEO follow ?lang=. A blog
 * post's own Helmet, rendered further down the tree, still wins.
 */
export const CatalogueSeoHead: React.FC<CatalogueSeoHeadProps> = ({ page, instituteName, course, courses }) => {
  const { t } = useTranslation("coursePlayerA");
  const { dict } = useCatalogueLocale();
  const institute = instituteName ? translateText(instituteName, dict) : "";
  const seo = computeCatalogueSeo({
    pageSeo: pageSeoOf(page),
    tabText: readBrandTabText(),
    instituteName,
    defaultTitle: t("courseCataloguePage.defaultTitle", { course }),
    defaultDescription: institute
      ? t("courseCataloguePage.seoDescriptionWithInstitute", { courses, institute })
      : t("courseCataloguePage.seoDescription", { courses }),
    dict,
  });
  return (
    <Helmet>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta property="og:title" content={seo.ogTitle} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:type" content="website" />
    </Helmet>
  );
};

export default CatalogueSeoHead;
