/**
 * Stream tabs and their categories, from a folder library or a tag list. Pure.
 *
 * A stream (and a category) filters courses by COURSE TAG: a folder's tag is
 * its course_tag, else its slug (folderCourseTag). A course belongs to a
 * stream when it carries the stream's tag or the tag of any folder below it,
 * so an admin may tag courses at the category level only.
 *
 * Folders are never pruned for being empty here: whether a folder holds
 * product pages says nothing about whether courses carry its tag.
 */

import {
  folderCourseTag,
  folderSlug,
  type PublicFolderNode,
} from "../../../-services/folder-library-service";
import type { CatalogStreamItem } from "../../../-types/course-catalogue-types";
import type { StreamLabelMode } from "./catalog-config";

export interface CatalogCategory {
  id: string;
  slug: string;
  /** Raw (base-language) title — translate at display. */
  title: string;
  subtitle: string;
  /** Lower-case tags this category matches (its own + every folder below it). */
  tags: string[];
  comingSoon: boolean;
  audienceId: string | null;
}

export interface CatalogStream {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  /** The stream's own tag (lower-case) — what "Popular in its stream" ranks by. */
  tag: string;
  /** Lower-case tags this stream matches (its own + every folder below it). */
  tags: string[];
  comingSoon: boolean;
  audienceId: string | null;
  categories: CatalogCategory[];
}

const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase();
const text = (s: string | null | undefined) => (s || "").trim();

/** A folder's tag plus the tags of every folder below it, lower-case and unique. */
export const folderTagSet = (node: PublicFolderNode): string[] => {
  const out = new Set<string>();
  const walk = (n: PublicFolderNode) => {
    if (n.node_type !== "FOLDER") return;
    const tag = norm(folderCourseTag(n));
    if (tag) out.add(tag);
    (n.children || []).forEach(walk);
  };
  walk(node);
  return [...out];
};

const folderTitle = (n: PublicFolderNode) => text(n.title) || text(n.subtitle) || text(n.product_page_name);

/** Top-level folders are streams; their direct sub-folders are categories. Duplicate slugs keep the first. */
export const streamsFromFolderTree = (roots: PublicFolderNode[] | null | undefined): CatalogStream[] => {
  const streams: CatalogStream[] = [];
  const seen = new Set<string>();
  for (const node of roots || []) {
    if (!node || node.node_type !== "FOLDER") continue;
    const slug = folderSlug(node);
    if (!slug || seen.has(slug.toLowerCase())) continue;
    seen.add(slug.toLowerCase());
    const categorySlugs = new Set<string>();
    const categories: CatalogCategory[] = [];
    for (const child of node.children || []) {
      if (!child || child.node_type !== "FOLDER") continue;
      const childSlug = folderSlug(child);
      if (!childSlug || categorySlugs.has(childSlug.toLowerCase())) continue;
      categorySlugs.add(childSlug.toLowerCase());
      categories.push({
        id: child.id,
        slug: childSlug,
        title: folderTitle(child),
        subtitle: text(child.subtitle),
        tags: folderTagSet(child),
        comingSoon: !!child.coming_soon,
        audienceId: text(child.audience_id) || null,
      });
    }
    streams.push({
      id: node.id,
      slug,
      title: folderTitle(node),
      subtitle: text(node.subtitle),
      tag: norm(folderCourseTag(node)),
      tags: folderTagSet(node),
      comingSoon: !!node.coming_soon,
      audienceId: text(node.audience_id) || null,
      categories,
    });
  }
  return streams;
};

/** Streams from a hand-written list ({label, slug, tag}); items are pre-validated by the config. */
export const streamsFromTagItems = (items: CatalogStreamItem[]): CatalogStream[] =>
  items.map((item) => ({
    id: item.slug,
    slug: item.slug,
    title: item.label,
    subtitle: "",
    tag: norm(item.tag),
    tags: [norm(item.tag)].filter(Boolean),
    comingSoon: false,
    audienceId: null,
    categories: [],
  }));

/** Tab text: title, subtitle (falling back to the title), or both. */
export const streamTabText = (
  stream: Pick<CatalogStream, "title" | "subtitle" | "slug">,
  mode: StreamLabelMode,
): { primary: string; secondary: string } => {
  const title = stream.title || stream.subtitle || stream.slug;
  if (mode === "subtitle") return { primary: stream.subtitle || title, secondary: "" };
  if (mode === "both" && stream.subtitle && stream.subtitle !== title) {
    return { primary: title, secondary: stream.subtitle };
  }
  return { primary: title, secondary: "" };
};

export const findStream = (streams: CatalogStream[], slug: string | null | undefined): CatalogStream | null =>
  (slug && streams.find((s) => s.slug === slug)) || null;

/** The DOM id of one stream tab (null = "All courses") — the tab panel names its active tab with it. */
export const streamTabId = (controlsId: string, slug: string | null): string =>
  `${controlsId}-tab-${slug === null ? "all" : `s-${slug.replace(/[^A-Za-z0-9_-]/g, "_")}`}`;

/**
 * The tab a key moves focus to in a horizontal tab row (ARIA tabs pattern):
 * ArrowRight / ArrowLeft step and wrap around (mirrored right-to-left),
 * Home / End jump to the ends. Null = not a tab-navigation key.
 */
export const nextTabIndex = (key: string, index: number, count: number, rtl = false): number | null => {
  if (count <= 0 || index < 0) return null;
  const step = (delta: number) => (index + delta + count) % count;
  switch (key) {
    case "ArrowRight":
      return step(rtl ? -1 : 1);
    case "ArrowLeft":
      return step(rtl ? 1 : -1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
};
