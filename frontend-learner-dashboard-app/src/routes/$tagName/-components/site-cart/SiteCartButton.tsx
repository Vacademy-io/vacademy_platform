import React from "react";

/**
 * Header cart button for the site-wide course cart (-stores/site-cart-store.ts).
 * PLACEHOLDER: renders nothing until the site-cart UI lands; the header can
 * already import it. Must render null whenever globalSettings.siteCart is not
 * enabled, so sites without a site cart are unaffected.
 */
export interface SiteCartButtonProps {
  instituteId?: string;
  tagName?: string;
  /** globalSettings.siteCart of the site being rendered. */
  settings?: { enabled?: boolean; storeProductPageCode?: string } | null;
  className?: string;
}

export const SiteCartButton: React.FC<SiteCartButtonProps> = () => null;

export default SiteCartButton;
