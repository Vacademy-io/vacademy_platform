/**
 * Courses-page cards → the site-wide cart (-utils/site-cart.ts). Pure.
 *
 * A card can add a version to the cart only when that version can be bought
 * right now: it has a package session, a price, an open enrolment window and
 * is not "coming soon". Free versions keep the course-page enrol path.
 */

import { resolveInviteAvailability } from "@/lib/invite-availability";
import type { CourseLanguageOption } from "../../../-utils/course-variants";
import type { SiteCartItem } from "../../../-utils/site-cart";
import { isComingSoonRow, rowLanguage, type CatalogRowLike } from "./catalog-cards";

export const packageSessionOf = (row: CatalogRowLike): string =>
  String(row.packageSessionId || row.package_session_id || "").trim();

export const isPurchasableRow = (row: CatalogRowLike): boolean =>
  !!packageSessionOf(row) &&
  typeof row.price === "number" &&
  row.price > 0 &&
  !isComingSoonRow(row) &&
  resolveInviteAvailability(row.enroll_invite_availability) === "AVAILABLE";

/** The versions of a card that can go in the cart, in catalogue order. */
export const purchasableVersions = <R extends CatalogRowLike>(rows: R[]): R[] => rows.filter(isPurchasableRow);

/** A cart line for one version. Title and level stay in the base language (translated at display). */
export const toSiteCartItem = (
  row: CatalogRowLike & { thumbnail?: string },
  courseId: string,
  languages: CourseLanguageOption[],
): SiteCartItem => {
  const lang = rowLanguage(row, languages);
  const image = typeof row.thumbnail === "string" && !row.thumbnail.includes("/api/placeholder/") ? row.thumbnail : undefined;
  return {
    packageSessionId: packageSessionOf(row),
    courseId,
    title: row.title,
    ...(row.level_name || row.level ? { levelName: String(row.level_name || row.level) } : {}),
    ...(lang ? { languageCode: lang.code } : {}),
    price: row.price,
    ...(typeof row.elevatedPrice === "number" ? { elevatedPrice: row.elevatedPrice } : {}),
    ...(row.currency ? { currency: row.currency } : {}),
    ...(image ? { image } : {}),
    ...(row.enrollInviteId ? { enrollInviteId: row.enrollInviteId } : {}),
    source: { kind: "catalog" },
  };
};

/** The version of this course already in the cart, if any (the cart holds one version per course). */
export const cartVersionOf = <R extends CatalogRowLike>(
  versions: R[],
  cartPackageSessionIds: Set<string>,
): R | undefined => versions.find((v) => cartPackageSessionIds.has(packageSessionOf(v)));
