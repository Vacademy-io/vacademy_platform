// Plain-language summary builders — pure functions, data → one friendly sentence.
//
// These are first-class strings (not scraped DOM) so: (a) every screen leads with
// a sentence a non-technical parent understands, and (b) read-aloud (a later phase)
// can speak the exact same text with zero rework. Keep them jargon-free.

import type { TFunction } from "i18next";
import type { ChildOverview } from "../-types/parent-child";

export type SummaryTone = "good" | "watch" | "action" | "neutral";

export interface AttentionItem {
  key: string;
  tone: SummaryTone;
  text: string;
  /** module route segment to open when tapped */
  module: string;
}

/**
 * "What needs your attention" — at most three items, computed from the overview.
 * Empty array => the UI shows a calm "nothing needs your attention right now",
 * never an empty box. Thresholds are deliberately simple and easy to tune.
 */
export function buildAttentionItems(overview: ChildOverview | undefined, t: TFunction): AttentionItem[] {
  if (!overview) return [];
  const items: AttentionItem[] = [];

  if ((overview.pendingInvoiceCount ?? 0) > 0) {
    items.push({
      key: "pending-fees",
      tone: "action",
      text: t("attention.pendingFees", { count: overview.pendingInvoiceCount }),
      module: "payments",
    });
  }

  return items.slice(0, 3);
}

export function greeting(childName: string | undefined, t: TFunction): string {
  return t("home.greeting", { name: childName || t("common.yourChild") });
}

export function badgesSummary(count: number | null | undefined, childName: string, t: TFunction): string {
  return t("rewards.summary", { name: childName, count: count ?? 0 });
}

export function certificatesSummary(count: number | null | undefined, childName: string, t: TFunction): string {
  return t("certificates.summary", { name: childName, count: count ?? 0 });
}

export function paymentsSummary(
  pending: number | null | undefined,
  total: number | null | undefined,
  childName: string,
  t: TFunction,
): string {
  if ((pending ?? 0) === 0) return t("payments.allPaid", { name: childName });
  return t("payments.duesSummary", { name: childName, count: pending });
}
