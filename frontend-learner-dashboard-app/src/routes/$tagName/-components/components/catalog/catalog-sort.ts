/**
 * Courses-page sort. Pure.
 *
 * The comparators are the catalogue's original ones applied to a card's
 * primary version (a card without grouping IS its row), plus "Popular":
 * ranked courses by enrolment rank, the rest after them in their current
 * order. Array.prototype.sort is stable, so ties keep catalogue order.
 */

import { comparePopularity } from "../../../-utils/course-badges";
import type { CourseCatalogSortOption } from "../../../-types/course-catalogue-types";
import type { CatalogCard, CatalogRowLike } from "./catalog-cards";

/** Milliseconds for a created_at value; missing or unparseable sorts as the epoch. */
export const createdTime = (value: string | null | undefined): number => {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

export const sortCatalogCards = <R extends CatalogRowLike>(
  cards: CatalogCard<R>[],
  sort: CourseCatalogSortOption,
  opts: {
    ranks: Map<string, number>;
    titleOf: (card: CatalogCard<R>) => string;
    /** The price a card shows (merged cards: given the active filters). Default: card.sortPrice. */
    priceOf?: (card: CatalogCard<R>) => number;
  },
): CatalogCard<R>[] => {
  const out = [...cards];
  const priceOf = opts.priceOf ?? ((card: CatalogCard<R>) => card.sortPrice);
  switch (sort) {
    case "Newest":
      out.sort((a, b) => createdTime(b.primary.createdAt) - createdTime(a.primary.createdAt));
      break;
    case "Oldest":
      out.sort((a, b) => createdTime(a.primary.createdAt) - createdTime(b.primary.createdAt));
      break;
    case "Price: Low to High":
      out.sort((a, b) => priceOf(a) - priceOf(b));
      break;
    case "Price: High to Low":
      out.sort((a, b) => priceOf(b) - priceOf(a));
      break;
    case "Rating":
      out.sort((a, b) => b.primary.rating - a.primary.rating);
      break;
    case "Name A-Z":
      out.sort((a, b) => opts.titleOf(a).localeCompare(opts.titleOf(b)));
      break;
    case "Name Z-A":
      out.sort((a, b) => opts.titleOf(b).localeCompare(opts.titleOf(a)));
      break;
    case "Popular": {
      const byRank = comparePopularity(opts.ranks);
      out.sort((a, b) => byRank(a.courseId, b.courseId));
      break;
    }
  }
  return out;
};
