/**
 * courseCatalog.filterSidebar / courseCatalog.customFilters — OWNED BY FEATURE
 * 'sidebar' (specs/filter-sidebar.json). Foundation stubs: replace the bodies.
 */
export interface CatalogFilterSidebarConfig {
  variant?: string;
  [key: string]: unknown;
}

export interface CatalogCustomFilterConfig {
  id: string;
  label: string;
  [key: string]: unknown;
}
